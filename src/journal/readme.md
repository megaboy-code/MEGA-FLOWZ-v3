
# JOURNAL SYSTEM — Architecture & Current State

## Overview
The journal system has two parts:
- **Mini Journal** — sidebar panel, today's trades only
- **Full Journal** — full page, calendar view + all history

---

## Data Flow (Current — Working)
```

MT5 broker
→ Python connector.py (_handle_fetch_journal_today)
→ C++ connector_bridge
→ FlatBuffer journal_data message
→ WebSocket
→ ConnectionManager.onJournalData
→ ModuleManager
→ JournalMiniModule.setTrades()

```
### Trigger
On WebSocket connect, connection manager sends:
```

GET_JOURNAL_TODAY

```
Python fetches all closed deals from broker midnight → now.
Broker midnight is derived from `self.daily_open_time` — a D1 candle
timestamp fetched from MT5 directly (broker server time, not machine time).

### Key fix already done
Old code used `datetime.now()` (machine time) for midnight.
Fixed to use `rates[0]['time']` from D1 candle — this is broker server
time and is accurate regardless of machine timezone.

---

## Mini Journal (Working)

**File:** `journal-mini.ts`

- Receives trades via `setTrades(trades[])` from ModuleManager
- Live trade appended via `addTrade()` from notification callback
- Has three-dot menu: Refresh (fires `journal-refresh` event) + Export CSV
- Refresh button fires custom event — not yet wired to backend request
- PnL formatted with `toFixed(2)` — backend sends raw floats from MT5
- WIN/LOSS determined by `profit >= 0`

---

## Full Journal (Incomplete — Not Connected)

**File:** `journal.ts`

- Currently uses sample data + localStorage — NOT connected to MT5
- Has calendar view (monthly), trades table, trade detail modal
- `loadData()` reads from localStorage — needs to be replaced
- `generateSampleTrades()` is placeholder — needs to be removed
- Needs a public `setTrades(trades[])` method added
- Lazy loaded by ModuleManager only when journal tab is opened

---

## What's Missing (Next Steps)

### 1. Python — new range fetcher
Add `request_journal_range(date_from_ts, date_to_ts)` command.
Add `_handle_fetch_journal_range` handler — same logic as
`_handle_fetch_journal_today` but with flexible timestamp range.

### 2. C++ — new command + FlatBuffer scope field
- Handle `GET_JOURNAL_MONTH_YYYY_MM` command in message_handler
- Calculate first and last day of that month as Unix timestamps
- Add `scope` string field to `journal_data` FlatBuffer
  - `scope = "today"` for mini journal
  - `scope = "month"` for full journal

### 3. Connection Manager
- Add `getJournalMonth(year, month)` public method
  sends `GET_JOURNAL_MONTH_YYYY_MM`
- Pass `scope` through `onJournalData` callback

### 4. Module Manager
- Split `onJournalData` by scope:
  - `scope === "today"` → `journalMiniInstance.setTrades()`
  - `scope === "month"` → `journalInstance.setTrades()`

### 5. Full Journal
- Add `public setTrades(trades[])` method
- Remove `generateSampleTrades()` and localStorage
- On month navigate → call `connectionManager.getJournalMonth(year, month)`
- On first lazy load → request current month automatically

---

## FlatBuffer Journal Data Shape (Current)
```

journal_data {
trades: [
{
ticket,
symbol,
type,        // 0 = BUY, 1 = SELL
volume,
open_price,  // ⚠️ currently same as close_price — not yet fixed
close_price,
profit,
swap,
commission,
open_time,   // Unix timestamp
close_time   // Unix timestamp
}
]
}

```
## Known Issue — open_price
`DEAL_ENTRY_OUT` only carries the close side of a trade.
`open_price` is currently set to `deal.price` (close price) as placeholder.
Fix: match `DEAL_ENTRY_IN` deal by `position_id` to get real open price.
This was identified but not yet implemented.

---

## Files Involved
| File | Language | Role |
|------|----------|------|
| `connector.py` | Python | MT5 data fetch, journal handlers |
| `connector_bridge.cpp/hpp` | C++ | Python↔C++ bridge |
| `message_handler.cpp/hpp` | C++ | WebSocket command parser |
| `flatbuffer_builder.cpp/hpp` | C++ | Build journal_data FlatBuffer |
| `connection-manager.ts` | TypeScript | WebSocket pipe, command sender |
| `module-manager.ts` | TypeScript | Orchestrator, callback wiring |
| `journal-mini.ts` | TypeScript | Mini sidebar journal panel |
| `journal.ts` | TypeScript | Full journal, calendar, modal |
| `journal-mini.css` | CSS | Mini journal styles |
```