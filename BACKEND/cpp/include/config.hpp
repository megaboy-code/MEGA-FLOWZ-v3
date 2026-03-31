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
    constexpr double POSITION_FETCH_INTERVAL   = 0.5;
    constexpr double DATA_FETCH_INTERVAL       = 0.1;
    constexpr double PRICE_STREAM_INTERVAL     = 0.5;
    constexpr double CONNECTION_CHECK_INTERVAL = 5.0;

    // ── TRADE CONFIGURATION ──
    constexpr int         MT5_DEVIATION = 5;
    constexpr int         MT5_MAGIC     = 234000;
    constexpr const char* TRADE_COMMENT = "MEGA FLOWZ";
    constexpr const char* CLOSE_COMMENT = "MEGA FLOWZ - Close";

    // ── PYTHON BACKEND PATH ──
    constexpr const char* BACKEND_PATH = "C:/Users/mega/mega_env/BACKEND";
}