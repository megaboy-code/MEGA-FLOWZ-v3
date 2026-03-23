// ================================================================
// MESSAGE_HANDLER.HPP - WebSocket Message Routing
// Replaces: message_handler.py
// ================================================================

#pragma once
#include <string>
#include <functional>
#include <iostream>
#include "chart_manager.hpp"
#include "trade_handler.hpp"
#include "symbol_cache.hpp"

// ── Callback types ──
using SendCallback          = std::function<void(const std::string&)>;
using SubscribeCallback     = std::function<void(const std::string&, const std::string&)>;
using PositionsCallback     = std::function<void()>;
using AccountCallback       = std::function<void()>;
using PriceCallback         = std::function<void()>;
using ConnectionCallback    = std::function<void()>;
using StrategyCallback      = std::function<void(const std::string&)>;
using AutoTradingCallback   = std::function<void(bool)>;

class MessageHandler {
private:
    SendCallback        send_cb;
    SubscribeCallback   subscribe_cb;
    PositionsCallback   positions_cb;
    AccountCallback     account_cb;
    PriceCallback       price_cb;
    ConnectionCallback  connection_cb;
    StrategyCallback    strategy_cb;
    AutoTradingCallback auto_trading_cb;

    // ── Parse symbol and timeframe ──
    bool parseSymbolTimeframe(
        const std::string& message,
        const std::string& prefix,
        std::string& symbol,
        std::string& timeframe) const
    {
        std::string content = message.substr(prefix.size());
        auto pos = content.find('_');
        if (pos == std::string::npos) return false;
        symbol    = content.substr(0, pos);
        timeframe = content.substr(pos + 1);
        return !symbol.empty() && !timeframe.empty();
    }

    // ── Send JSON helper ──
    void send(const std::string& json) {
        if (send_cb) send_cb(json);
    }

    // ── Build trade response JSON ──
    std::string buildTradeResponse(const TradeResult& r) {
        std::string json = "{";
        json += "\"type\":\"trade_executed\",";
        json += "\"success\":" + std::string(r.success ? "true" : "false") + ",";
        if (r.success) {
            json += "\"direction\":\"" + r.direction + "\",";
            json += "\"symbol\":\""    + r.symbol    + "\",";
            json += "\"volume\":"      + std::to_string(r.volume)    + ",";
            json += "\"price\":"       + std::to_string(r.price)     + ",";
            json += "\"ticket\":"      + std::to_string(r.ticket)    + ",";
            json += "\"timestamp\":"   + std::to_string(r.timestamp) + ",";
            json += "\"message\":\""   + r.message + "\"";
        } else {
            json += "\"message\":\"" + r.error + "\"";
        }
        json += "}";
        return json;
    }

    // ── Build error JSON ──
    std::string buildError(const std::string& msg) {
        return "{\"type\":\"error\",\"message\":\"" + msg + "\"}";
    }

public:

    // ── Set callbacks ──
    void setSendCallback(SendCallback cb)               { send_cb         = cb; }
    void setSubscribeCallback(SubscribeCallback cb)     { subscribe_cb    = cb; }
    void setPositionsCallback(PositionsCallback cb)     { positions_cb    = cb; }
    void setAccountCallback(AccountCallback cb)         { account_cb      = cb; }
    void setPriceCallback(PriceCallback cb)             { price_cb        = cb; }
    void setConnectionCallback(ConnectionCallback cb)   { connection_cb   = cb; }
    void setStrategyCallback(StrategyCallback cb)       { strategy_cb     = cb; }
    void setAutoTradingCallback(AutoTradingCallback cb) { auto_trading_cb = cb; }

    // ================================================================
    // PROCESS MESSAGE — main router
    // ================================================================
    void processMessage(const std::string& message) {

        std::cout << "MSG: " << message << std::endl;

        // ── Ping ──
        if (message == "ping") {
            send("pong");
            return;
        }

        // ── Subscribe ──
        if (message.size() >= 10 &&
            message.substr(0, 10) == "SUBSCRIBE_")
        {
            std::string symbol, timeframe;
            if (parseSymbolTimeframe(message, "SUBSCRIBE_", symbol, timeframe)) {
                if (subscribe_cb) subscribe_cb(symbol, timeframe);
            } else {
                send(buildError("Use SUBSCRIBE_SYMBOL_TIMEFRAME format"));
            }
            return;
        }

        // ── Unsubscribe ──
        if (message.size() >= 12 &&
            message.substr(0, 12) == "UNSUBSCRIBE_")
        {
            std::string symbol = message.substr(12);
            chart_manager.clearCandles(symbol);
            chart_manager.clearChartState();
            return;
        }

        // ── Initial data received ──
        if (message == "INITIAL_DATA_RECEIVED") {
            chart_manager.markChartReady();
            return;
        }

        // ── Trade execution ──
        if (message.size() >= 6 &&
            message.substr(0, 6) == "TRADE_")
        {
            auto result = trade_handler.handleTradeCommand(message);
            send(buildTradeResponse(result));
            if (result.success) {
                // ✅ positions_cb now returns positions + account combined
                // No need for separate account_cb call
                if (positions_cb) positions_cb();
            }
            return;
        }

        // ── Close all ──
        if (message == "CLOSE_ALL") {
            auto result = trade_handler.handleCloseAll();
            send("{\"type\":\"positions_closed\","
                 "\"success\":" + std::string(result.success ? "true" : "false") + ","
                 "\"message\":\"" + result.message + "\"}");
            // ✅ positions + account in one call
            if (positions_cb) positions_cb();
            return;
        }

        // ── Close position ──
        if (message.size() >= 15 &&
            message.substr(0, 15) == "CLOSE_POSITION_")
        {
            auto result = trade_handler.handleClosePosition(message);
            send("{\"type\":\"position_closed\","
                 "\"success\":" + std::string(result.success ? "true" : "false") + ","
                 "\"message\":\"" + result.message + "\"}");
            // ✅ positions + account in one call
            if (positions_cb) positions_cb();
            return;
        }

        // ── Modify position ──
        if (message.size() >= 16 &&
            message.substr(0, 16) == "MODIFY_POSITION_")
        {
            auto result = trade_handler.handleModifyPosition(message);
            send("{\"type\":\"position_modified\","
                 "\"success\":" + std::string(result.success ? "true" : "false") + ","
                 "\"message\":\"" + result.message + "\"}");
            // ✅ positions + account in one call
            if (positions_cb) positions_cb();
            return;
        }

        // ── Get positions ──
        if (message == "GET_POSITIONS") {
            // ✅ positions + account combined
            if (positions_cb) positions_cb();
            return;
        }

        // ── Get account info ──
        if (message == "GET_ACCOUNT_INFO") {
            // ✅ standalone account for initial load
            if (account_cb) account_cb();
            return;
        }

        // ── Get current price ──
        if (message == "GET_CURRENT_PRICE") {
            if (price_cb) price_cb();
            return;
        }

        // ── Get connection status ──
        if (message == "GET_CONNECTION_STATUS") {
            if (connection_cb) connection_cb();
            return;
        }

        // ── Auto trading ──
        if (message == "AUTO_ON") {
            if (auto_trading_cb) auto_trading_cb(true);
            send("{\"type\":\"auto_trading_status\","
                 "\"enabled\":true,"
                 "\"message\":\"Auto trading enabled\"}");
            return;
        }

        if (message == "AUTO_OFF") {
            if (auto_trading_cb) auto_trading_cb(false);
            send("{\"type\":\"auto_trading_status\","
                 "\"enabled\":false,"
                 "\"message\":\"Auto trading disabled\"}");
            return;
        }

        // ── Strategy commands ──
        if ((message.size() >= 16 && (
                message.substr(0, 16) == "DEPLOY_STRATEGY_" ||
                message.substr(0, 16) == "REMOVE_STRATEGY_" ||
                message.substr(0, 16) == "UPDATE_STRATEGY_")) ||
            (message.size() >= 19 &&
                message.substr(0, 19) == "BACKTEST_STRATEGY_") ||
            message == "GET_ACTIVE_STRATEGIES")
        {
            if (strategy_cb) strategy_cb(message);
            return;
        }

        // ── Clear cache ──
        if (message == "CLEAR_CACHE") {
            chart_manager.clearCandles();
            symbol_cache.clearAll();
            send("{\"type\":\"cache_cleared\","
                 "\"message\":\"Cache cleared\"}");
            return;
        }

        // ── Unknown ──
        send(buildError("Unknown command: " + message));
    }
};

// ── Global instance ──
inline MessageHandler message_handler;