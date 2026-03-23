// ================================================================
// TRADE_HANDLER.HPP - Trade Execution & Position Management
// Replaces: trade_handler.py
// ================================================================

#pragma once
#include <string>
#include <functional>
#include <sstream>
#include <vector>
#include <iostream>
#include "candle.hpp"

// ── Trade result ──
struct TradeResult {
    bool        success     = false;
    std::string direction;
    std::string symbol;
    double      volume      = 0.0;
    double      price       = 0.0;
    double      tp          = 0.0;
    double      sl          = 0.0;
    int64_t     ticket      = 0;
    int64_t     timestamp   = 0;
    std::string message;
    std::string error;
};

// ── Callback types ──
using ExecuteTradeCallback   = std::function<TradeResult(
    const std::string& symbol,
    const std::string& direction,
    double volume,
    double price,
    double sl,
    double tp)>;

using ClosePositionCallback  = std::function<TradeResult(int64_t ticket)>;
using CloseAllCallback       = std::function<TradeResult()>;
using ModifyPositionCallback = std::function<TradeResult(
    int64_t ticket,
    double sl,
    double tp)>;

class TradeHandler {
private:
    ExecuteTradeCallback    execute_trade_cb;
    ClosePositionCallback   close_position_cb;
    CloseAllCallback        close_all_cb;
    ModifyPositionCallback  modify_position_cb;

    // ── Split string helper ──
    std::vector<std::string> split(
        const std::string& str,
        char delimiter) const
    {
        std::vector<std::string> parts;
        std::stringstream ss(str);
        std::string token;
        while (std::getline(ss, token, delimiter)) {
            parts.push_back(token);
        }
        return parts;
    }

    // ── Parse optional double ──
    // Returns 0.0 for empty, "0", "None"
    double parseOptional(const std::string& val) const {
        if (val.empty() || val == "0" || val == "None") return 0.0;
        try { return std::stod(val); }
        catch (...) { return 0.0; }
    }

public:

    // ── Set callbacks ──
    void setExecuteTradeCallback(ExecuteTradeCallback cb)     { execute_trade_cb   = cb; }
    void setClosePositionCallback(ClosePositionCallback cb)   { close_position_cb  = cb; }
    void setCloseAllCallback(CloseAllCallback cb)             { close_all_cb       = cb; }
    void setModifyPositionCallback(ModifyPositionCallback cb) { modify_position_cb = cb; }

    // ================================================================
    // HANDLE TRADE COMMAND
    // Format: TRADE_BUY_EURUSD_0.01_1.0850_sl_tp
    // parts:  [0]   [1] [2]     [3]  [4]   [5][6]
    // ================================================================
    TradeResult handleTradeCommand(const std::string& message) {
        TradeResult fail;

        auto parts = split(message, '_');

        if (parts.size() < 5) {
            fail.error = "Invalid format. Use: TRADE_BUY_EURUSD_0.01_1.0850";
            return fail;
        }

        try {
            std::string direction = parts[1];
            std::string symbol    = parts[2];
            double      volume    = std::stod(parts[3]);
            double      price     = std::stod(parts[4]);

            // ✅ sl first (parts[5]), tp second (parts[6])
            // Matches frontend connection-manager.ts order
            double sl = parts.size() > 5 ? parseOptional(parts[5]) : 0.0;
            double tp = parts.size() > 6 ? parseOptional(parts[6]) : 0.0;

            if (!execute_trade_cb) {
                fail.error = "Trade executor not configured";
                return fail;
            }

            std::cout << "Trade: " << direction
                      << " " << symbol
                      << " " << volume
                      << " @ " << price
                      << " SL:" << sl
                      << " TP:" << tp << std::endl;

            // ✅ Pass sl, tp in correct order
            return execute_trade_cb(symbol, direction, volume, price, sl, tp);

        } catch (const std::exception& e) {
            fail.error = std::string("Parse error: ") + e.what();
            return fail;
        }
    }

    // ================================================================
    // HANDLE CLOSE POSITION
    // Format: CLOSE_POSITION_123456
    // ================================================================
    TradeResult handleClosePosition(const std::string& message) {
        TradeResult fail;

        auto parts = split(message, '_');

        if (parts.size() < 3) {
            fail.error = "Invalid format. Use: CLOSE_POSITION_ticket";
            return fail;
        }

        try {
            int64_t ticket = std::stoll(parts[2]);

            if (!close_position_cb) {
                fail.error = "Close callback not configured";
                return fail;
            }

            std::cout << "Close position: " << ticket << std::endl;
            return close_position_cb(ticket);

        } catch (const std::exception& e) {
            fail.error = std::string("Parse error: ") + e.what();
            return fail;
        }
    }

    // ================================================================
    // HANDLE CLOSE ALL
    // ================================================================
    TradeResult handleCloseAll() {
        if (!close_all_cb) {
            TradeResult fail;
            fail.error = "Close all callback not configured";
            return fail;
        }
        std::cout << "Close all positions" << std::endl;
        return close_all_cb();
    }

    // ================================================================
    // HANDLE MODIFY POSITION
    // Format: MODIFY_POSITION_ticket_sl_tp
    // ================================================================
    TradeResult handleModifyPosition(const std::string& message) {
        TradeResult fail;

        auto parts = split(message, '_');

        if (parts.size() < 5) {
            fail.error = "Invalid format. Use: MODIFY_POSITION_ticket_sl_tp";
            return fail;
        }

        try {
            int64_t ticket = std::stoll(parts[2]);
            double  sl     = parseOptional(parts[3]);
            double  tp     = parseOptional(parts[4]);

            if (!modify_position_cb) {
                fail.error = "Modify callback not configured";
                return fail;
            }

            std::cout << "Modify: " << ticket
                      << " SL:" << sl
                      << " TP:" << tp << std::endl;

            return modify_position_cb(ticket, sl, tp);

        } catch (const std::exception& e) {
            fail.error = std::string("Parse error: ") + e.what();
            return fail;
        }
    }

    // ================================================================
    // AUTO TRADING
    // ================================================================
    TradeResult handleAutoTradeOn() {
        TradeResult r;
        r.success = true;
        r.message = "Auto trading enabled";
        return r;
    }

    TradeResult handleAutoTradeOff() {
        TradeResult r;
        r.success = true;
        r.message = "Auto trading disabled";
        return r;
    }
};

// ── Global instance ──
inline TradeHandler trade_handler;