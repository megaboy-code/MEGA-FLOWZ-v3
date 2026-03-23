# MEGA FLOWZ Trading Platform - Backend Architecture

## 📋 Table of Contents

1. [Overview](#overview)
1. [Architecture](#architecture)
1. [File Structure](#file-structure)
1. [Module Descriptions](#module-descriptions)
1. [Data Flow](#data-flow)
1. [MT5 Call Reference](#mt5-call-reference)
1. [WebSocket Message Protocol](#websocket-message-protocol)
1. [Setup & Installation](#setup--installation)
1. [Configuration](#configuration)
1. [Build System](#build-system)
1. [Troubleshooting](#troubleshooting)
1. [Pending Features](#pending-features)

-----

## Overview

**MEGA FLOWZ** is a professional trading terminal backend built on a hybrid C++/Python architecture.

- **C++ engine** handles all real-time processing, WebSocket serving, message routing, candle cache, symbol cache, trade logic, and data streaming
- **Python bridge** handles MT5 API calls exclusively — the only reason Python runs at all
- **Frontend** connects to the C++ WebSocket server directly

**Performance vs pure Python:**

```
CPU idle:   0%      (was 15-25%)
Memory:     23.8MB  (was 150-200MB)
Latency:    <1ms    (was 5-15ms)
```

-----

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  FRONTEND (TypeScript)               │
│              ws://localhost:8765                     │
└─────────────────────┬───────────────────────────────┘
                      │ WebSocket
┌─────────────────────▼───────────────────────────────┐
│              C++ ENGINE (mega_engine.exe)            │
│                                                      │
│  websocket_server.hpp   ← uWebSockets server        │
│  message_handler.hpp    ← command routing           │
│  chart_manager.hpp      ← chart state/storage       │
│  trade_handler.hpp      ← trade parsing/routing     │
│  broadcast_manager.hpp  ← single Python thread      │
│  connector_bridge.hpp   ← pybind11 Python bridge    │
│  symbol_cache.hpp       ← lazy TF cache + M1 recompute│
│  config.hpp             ← constants                 │
│  candle.hpp             ← data structures           │
└─────────────────────┬───────────────────────────────┘
                      │ pybind11 (GIL managed)
┌─────────────────────▼───────────────────────────────┐
│              PYTHON BRIDGE (connector.py)            │
│                                                      │
│  MT5 connection          get_initial_candles()       │
│  symbol detection        get_candle_update()         │
│  price streaming         get_current_price()         │
│  trade execution         execute_trade()             │
│  position management     get_positions_and_account() │
│  watchlist prices        get_watchlist_prices()      │
│  daily open cache        _get_daily_open()           │
│                          check_mt5_connection()      │
└─────────────────────┬───────────────────────────────┘
                      │ MT5 Python API
┌─────────────────────▼───────────────────────────────┐
│              MetaTrader 5 Terminal                   │
└─────────────────────────────────────────────────────┘
```

-----

## 📁 File Structure

```
BACKEND/
│
├── cpp/                              ← C++ engine source
│   ├── CMakeLists.txt                ← build configuration
│   ├── include/
│   │   ├── candle.hpp                ← Candle + TickData structs
│   │   ├── config.hpp                ← server constants
│   │   ├── chart_manager.hpp         ← chart state + candle storage
│   │   ├── trade_handler.hpp         ← trade command parsing
│   │   ├── message_handler.hpp       ← WebSocket message routing
│   │   ├── broadcast_manager.hpp     ← single-thread data streaming
│   │   ├── connector_bridge.hpp      ← pybind11 Python bridge
│   │   ├── symbol_cache.hpp          ← lazy fetch + M1 TF recompute
│   │   └── websocket_server.hpp      ← uWebSockets server
│   ├── src/
│   │   └── main.cpp                  ← entry point + wiring
│   ├── libs/
│   │   ├── uWebSockets/              ← WebSocket library
│   │   └── uSockets/                 ← uWebSockets dependency
│   └── build/
│       └── mega_engine.exe           ← compiled binary
│
├── connector.py                      ← MT5 Python interface
├── config.py                         ← Python config
└── strategy_manager.py               ← strategy engine (Python, pending C++ port)
```

-----

## 📖 Module Descriptions

### C++ Engine

-----

#### `candle.hpp` — Core Data Structures

```cpp
struct Candle {
    int64_t time;
    double  open, high, low, close;
    int64_t volume;
};

using CandleBuffer = std::deque<Candle>;

struct TickData {
    int64_t time   = 0;
    double  bid    = 0.0;
    double  ask    = 0.0;
    int64_t volume = 0;
};

using TickBuffer = std::vector<TickData>;
```

-----

#### `config.hpp` — Constants

```cpp
namespace Config {
    WS_HOST                   = "localhost"
    WS_PORT                   = 8765
    CANDLE_FETCH_COUNT        = 2000
    DATA_FETCH_INTERVAL       = 0.5s   // M1 candle update
    PRICE_STREAM_INTERVAL     = 0.5s   // bid/ask stream
    POSITION_FETCH_INTERVAL   = 0.5s   // positions + account
    CONNECTION_CHECK_INTERVAL = 5.0s   // MT5 connection
    MT5_DEVIATION             = 5
    MT5_MAGIC                 = 234000
    TRADE_COMMENT             = "MEGA FLOWZ"
    CLOSE_COMMENT             = "MEGA FLOWZ - Close"
}
```

-----

#### `symbol_cache.hpp` — Lazy TF Cache + M1 Recompute

**Key design:** Each symbol has its own cache per timeframe.
Initial fetch happens once on first visit. Subsequent visits served from memory.

**M1 Recompute Logic:**
Every 500ms `processM1Update()` is called with latest M1 candle.
All cached TFs are recomputed from M1 in nanoseconds — no extra MT5 calls.

```cpp
void storeCandles(symbol, detected, timeframe, candles)
bool hasTF(symbol, timeframe)
CandleBuffer getCandles(symbol, timeframe)
void processM1Update(symbol, m1_candle)
  // M1 time inside TF period? → update high/low/close/volume
  // M1 time outside TF period? → append new TF candle
std::optional<Candle> getLastCandle(symbol, timeframe)
void clearSymbol(symbol)
void clearAll()
```

-----

#### `broadcast_manager.hpp` — Data Streaming

**Key design:** Single Python thread. Pause during subscribe.
Anchored timing — no drift. Active symbols set for all subscribed symbols.

**Active symbols:**

```
All subscribed symbols added to active_symbols set
Every 500ms: M1 fetched for ALL active symbols
  → processM1Update() per symbol
  → all cached TFs recomputed
  → only active chart symbol broadcast to frontend
  → no gap when switching between symbols
```

**Pause mechanism:**

```
Subscribe fires → setPaused(true)
  → broadcast thread skips all Python calls
  → subscribe thread gets full GIL
  → 2000 candle fetch without contention
Subscribe complete → setPaused(false)
  → broadcast resumes
```

**Reconnect behavior:**

```
MT5 disconnects → saveStateForReconnection()
MT5 reconnects  → symbol_cache.clearAll()
               → clearActiveSymbols()
               → re-fetch active symbol fresh
               → re-add to active_symbols
               → broadcast initial data
```

-----

#### `connector_bridge.hpp` — Python MT5 Bridge

**Methods:**

```cpp
getInitialCandles(sym, det, tf, count) → CandleBuffer
getCandleUpdate(detected)              → M1 Candle
getPositionsAndAccount()               → positions + account JSON
getWatchlistPrices(symbols)            → bid/ask + change% JSON
getCurrentPrice(sym, detected)         → bid/ask JSON
getAccountInfo()                       → account JSON (startup)
executeTrade(...)                      → TradeResult
closePosition(ticket)                  → TradeResult
closeAllPositions()                    → TradeResult
modifyPosition(ticket, sl, tp)         → TradeResult
checkConnection()                      → connection JSON
autoDetectSymbol(symbol)               → detected string
```

**getPositionsAndAccount() — combined call:**

```
Single GIL acquire
  → get_positions()    → positions list
  → get_account_info() → balance/equity/margin
Returns one JSON with both
Balance updates immediately after trade close
```

-----

#### `websocket_server.hpp` — WebSocket Server

**Subscribe on detached thread:**

```cpp
std::thread([this, symbol, timeframe]() {
    handleSubscribe(symbol, timeframe);
}).detach();
// uWS thread returns immediately — no GIL blocking
```

**Watchlist remove logic:**

```
Remove from watchlist (stop price streaming) always
Only stop M1 + clear cache if NOT currently viewing
If user still on that chart → keep M1 running → no gap
```

-----

#### `message_handler.hpp` — WebSocket Message Router

**After trade actions:**

```
positions_cb() called → getPositionsAndAccount()
Returns positions + account in one message
Balance updates immediately after trade close/open
No separate account_cb() needed after trades
```

-----

### Python Bridge

-----

#### `connector.py` — MT5 Interface

**Key methods:**

```python
get_candle_update(detected)
  → always fetches M1 (anchor for all TF recompute)
  → no wake up needed (symbol warm from price stream)

get_positions_and_account()
  → single call returns both
  → { 'positions': [...], 'account': {...} }
  → one GIL acquire for both

get_watchlist_prices(symbols)
  → symbol_info_tick() per symbol
  → calculates daily change % from cached D1 open
  → D1 open cached per symbol for 1 hour
  → zero extra MT5 calls after first hour fetch

_get_daily_open(detected)
  → fetches D1 candle open price
  → caches for 1 hour
  → used for change % calculation
```

-----

## 🔄 Data Flow

### Chart Subscription (Cache Miss)

```
SUBSCRIBE → detached thread → setPaused(true)
→ getInitialCandles() → 2000 candles
→ symbol_cache.storeCandles()
→ broadcast_manager.addActiveSymbol()
→ setPaused(false)
→ broadcastToAll(initial JSON)
```

### Chart Subscription (Cache Hit)

```
SUBSCRIBE → symbol_cache.hasTF() → true
→ getCandles() instant from memory
→ broadcastToAll(initial JSON)
← zero MT5 calls
```

### M1 Candle Update + TF Recompute

```
Every 500ms for each active symbol:
  getCandleUpdate(detected) → MT5: copy_rates_from_pos(M1, 0, 1)
  processM1Update(symbol, m1):
    for each cached TF:
      M1 inside period? → update high/low/close/volume
      M1 outside period? → append new candle
  if active chart symbol → broadcast update
```

### Positions + Account

```
Every 500ms:
  getPositionsAndAccount() → ONE GIL acquire
    → get_positions() + get_account_info()
  broadcast { positions: [...], account: {...} }
  Frontend updates both table and balance simultaneously
```

### Trade Execution

```
TRADE_BUY_BTCUSD_0.01_68288_68188_68388
  parts[5]=sl=68188  parts[6]=tp=68388
→ executeTrade(sym, dir, vol, price, sl=68188, tp=68388)
→ Python: execute_trade(sym, dir, vol, price, tp=68388, sl=68188)
  ← Python positional: tp before sl
→ MT5: order_send()
→ send trade_executed response
→ positions_cb() → fresh positions + updated balance
```

### Watchlist Prices + Change %

```
Every 500ms:
  getWatchlistPrices([symbols])
    → symbol_info_tick() per symbol
    → _get_daily_open() from cache
    → change% = (bid - open) / open * 100
  broadcast watchlist_update
  Frontend: price flash + change % update
```

-----

## 📡 MT5 Call Reference

### Every 500ms

|Call                                            |Purpose                    |
|------------------------------------------------|---------------------------|
|`copy_rates_from_pos(M1, 0, 1)` × active symbols|M1 anchor for TF recompute |
|`symbol_info_tick()` × 1                        |active chart price         |
|`symbol_info_tick()` × N watchlist              |watchlist prices + change %|
|`positions_get()`                               |open positions             |
|`account_info()`                                |balance/equity/margin      |

### Every 5 seconds

|Call             |Purpose             |
|-----------------|--------------------|
|`terminal_info()`|MT5 connection check|

### Every 1 hour (cached)

|Call                                         |Purpose                |
|---------------------------------------------|-----------------------|
|`copy_rates_from_pos(D1, 0, 1)` × N watchlist|daily open for change %|

### On Demand

|Call                              |Trigger               |
|----------------------------------|----------------------|
|`copy_rates_from_pos(TF, 0, 2000)`|SUBSCRIBE cache miss  |
|`order_send()`                    |TRADE / CLOSE / MODIFY|

-----

## 📡 WebSocket Message Protocol

### Client → Server

```
SUBSCRIBE_BTCUSD_M1
UNSUBSCRIBE_BTCUSD
INITIAL_DATA_RECEIVED
WATCHLIST_ADD_EURUSD
WATCHLIST_REMOVE_EURUSD
TRADE_BUY_BTCUSD_0.01_68288_68188_68388
CLOSE_POSITION_2535877046
CLOSE_ALL
MODIFY_POSITION_2535877046_68200_68400
GET_POSITIONS
GET_ACCOUNT_INFO
GET_CURRENT_PRICE
GET_CONNECTION_STATUS
AUTO_ON / AUTO_OFF
CLEAR_CACHE
ping
```

### Server → Client

```json
// Initial candles
{"type":"initial","symbol":"BTCUSD","timeframe":"M1","data":[...],"count":2000}

// Candle update
{"type":"update","symbol":"BTCUSD","timeframe":"M1","data":{...}}

// Price tick
{"type":"price_update","symbol":"BTCUSD","bid":68282.74,"ask":68296.74,"spread":14.0,"time":123}

// Positions + Account combined
{
  "type":"positions_update",
  "positions":[{"ticket":123,"symbol":"BTCUSD","type":"BUY","volume":0.01,
    "open_price":68288,"current_price":68310,"sl":68188,"tp":68388,
    "profit":2.12,"swap":0,"open_time":123}],
  "account":{"balance":10000,"equity":10002,"margin":68,"free_margin":9933,"leverage":100}
}

// Watchlist update
{"type":"watchlist_update","prices":{"BTCUSD":{"bid":68282,"ask":68296,"spread":14,"change":1.23}}}

// Trade executed
{"type":"trade_executed","success":true,"direction":"BUY","symbol":"BTCUSD",
 "volume":0.01,"price":68288.89,"ticket":123,"timestamp":123,"message":"..."}

// Connection status
{"type":"connection_status","data":{"mt5_connected":true,"status_text":"Connected"}}
```

-----

## 🚀 Setup & Installation

### Prerequisites

```
Windows OS
MetaTrader 5 terminal installed and running
Python 3.12+ with venv
MSYS2 with MinGW64
```

### Python environment

```bash
python -m venv venv
venv\Scripts\activate
pip install MetaTrader5 pybind11 cmake
```

### MSYS2 compiler tools

```bash
pacman -S mingw-w64-x86_64-gcc
pacman -S mingw-w64-x86_64-cmake
pacman -S mingw-w64-x86_64-ninja
pacman -S mingw-w64-x86_64-libuv
```

### Build

```bash
cd cpp/build
cmake .. -G "Ninja" -DCMAKE_BUILD_TYPE=Release
ninja
.\mega_engine.exe
```

### Stop engine

```bash
taskkill /F /IM mega_engine.exe
```

-----

## ⚙️ Configuration

`config.hpp` (C++) and `config.py` (Python) must stay in sync:

```
POSITION_FETCH_INTERVAL   = 0.5s
DATA_FETCH_INTERVAL       = 0.5s
PRICE_STREAM_INTERVAL     = 0.5s
CONNECTION_CHECK_INTERVAL = 5.0s
CANDLE_FETCH_COUNT        = 2000
```

-----

## 🔨 Build System

```bash
# Rebuild after changes
cd cpp/build
ninja

# Full reconfigure (only if CMakeLists.txt changes)
cmake .. -G "Ninja" -DCMAKE_BUILD_TYPE=Release
ninja
```

-----

## 🐛 Troubleshooting

### Engine hangs on subscribe

Ensure `broadcast_manager.setPaused(true/false)` wraps initial fetch in `websocket_server.hpp`.

### SL/TP not applied

Python expects `tp` before `sl` positionally:

```python
execute_trade(sym, dir, vol, price, tp, sl)  # tp before sl
```

### Balance not updating after close

`message_handler.hpp` must call `positions_cb()` after close (not `account_cb()`).
`getPositionsAndAccount()` returns both in one call.

### SL/TP not updating live in modal

`trading.ts` `updatePositionRows()` must update cells[5] and cells[6].

### Watchlist showing ‘–’

`connection-manager.ts` must re-send `WATCHLIST_ADD_` for all symbols on WebSocket connect.

### Gap in chart after symbol switch

`websocket_server.hpp` `handleSubscribe()` must call `broadcast_manager.addActiveSymbol()`.

### Cache stale after reconnect

Expected — reconnect clears all caches and re-fetches active symbol only.

-----

## 🏗️ Key Architecture Patterns

### Single Python Thread

All MT5 calls through one thread. 0% CPU idle. 23.8MB memory.

### GIL Pause on Subscribe

Subscribe thread gets full GIL during initial 2000 candle fetch.
No contention with broadcast thread.

### M1 Anchor

One M1 fetch per symbol → C++ recomputes all TFs in nanoseconds.
No separate MT5 calls for H1/H4/D1 updates.

### Combined Positions + Account

One Python call, one GIL acquire, instant balance update after trade.

### Lazy TF Cache

First visit per TF = MT5 fetch. All subsequent visits = instant from memory.

### Active Symbols Set

All subscribed symbols get M1 updates even when not active chart.
No gap when switching back to previously viewed symbol.

-----

## 📝 Pending Features

### Priority 1 — Tick System (foundation)

```
Replace get_candle_update() with get_ticks_range()
Use copy_ticks_from() — no timezone issues
C++ builds OHLC from ticks
Tick sequence visualization (requestAnimationFrame)
```

### Priority 2 — Tape Speed + Order Flow

```
Tape speed from tick count
Volume delta from bid/ask direction
Absorption detection
Spread anomaly / stop hunt detection
```

### Priority 3 — Dynamic Interval

```
VolatilityMonitor class
Auto adjusts: 100ms (scalp) → 1000ms (dead market)
Based on tick count per window
```

### Priority 4 — Algorithmic Scalping

```
Fast exit loop (100ms)
No broker SL/TP for scalping
Emergency disaster stop only (50-100 pips)
MEGA controls exit timing
```

### Priority 5 — Dynamic Stop Widening

```
Spread monitor → widen stop on anomaly
News filter → time-based risk windows
Auto-widen before volatility
Move to breakeven on extreme conditions
```

### Priority 6 — MEGA Engine

```
M — Measurement (tick sequences, spread, delta)
E — Expectation (pattern recognition, probability)
G — Gap analysis (micro/macro/full)
A — Adaptation (sizing, exit logic)
Recursive memory (pattern lifecycle, weight decay)
```

### Priority 7 — Other

```
Trade arrow fix (detachPrimitive() lag)
Watchdog timer for inactive symbols
Market depth visualization
Watchlist change % (built, needs test)
```

-----

## 🔑 Key Design Decisions

|Decision                  |Reason                                  |
|--------------------------|----------------------------------------|
|C++ for engine            |0% idle CPU vs 15-25% Python asyncio    |
|Single Python thread      |GIL prevents parallel Python execution  |
|M1 as anchor for all TFs  |One MT5 call serves all timeframes      |
|Combined positions+account|One GIL acquire = instant balance update|
|Lazy TF cache             |First visit slow, all others instant    |
|Active symbols set        |No gap on symbol switch                 |
|Detached subscribe thread |uWS thread never blocked                |
|Pause during subscribe    |Full GIL for heavy initial fetch        |

-----

*MEGA FLOWZ Backend — C++ engine + Python MT5 bridge*
*Version: 4.0 (Full C++ Architecture)*
*Last updated: 2026-03-23*