// ================================================================
// CONFIG.HPP - Server configuration constants
// ================================================================

#pragma once
#include <string>

namespace Config {

    // ── WEBSOCKET ──
    constexpr const char* WS_HOST = "127.0.0.1";
    constexpr int         WS_PORT = 8765;

    // ── CANDLE DATA ──
    constexpr int CANDLE_FETCH_COUNT = 1000;

    // ── FETCH INTERVALS (seconds) ──
    constexpr double POSITION_FETCH_INTERVAL   = 0.5;   // positions + account
    constexpr double DATA_FETCH_INTERVAL       = 0.5;   // M1 candle update
    constexpr double PRICE_STREAM_INTERVAL     = 0.5;   // bid/ask stream
    constexpr double CONNECTION_CHECK_INTERVAL = 5.0;   // MT5 connection

    // ── TRADE CONFIGURATION ──
    constexpr int         MT5_DEVIATION   = 5;
    constexpr int         MT5_MAGIC       = 234000;
    constexpr const char* TRADE_COMMENT   = "MEGA FLOWZ";
    constexpr const char* CLOSE_COMMENT   = "MEGA FLOWZ - Close";

    // ── PRICE PRECISION ──
    constexpr int DEFAULT_PRECISION = 5;
} 