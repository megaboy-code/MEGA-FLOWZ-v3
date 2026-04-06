// ================================================================
// MESSAGE_HANDLER.HPP - WebSocket Message Routing
// Binary FlatBuffers — replaces all JSON sends
// ================================================================

#pragma once
#include <string>
#include <functional>
#include <iostream>
#include "chart_manager.hpp"
#include "trade_handler.hpp"
#include "symbol_cache.hpp"
#include "flatbuffer_builder.hpp"

// ── Callback types ──
using SendCallback          = std::function<void(const uint8_t*, size_t)>;
using SubscribeCallback     = std::function<void(const std::string&, const std::string&)>;
using MsgPositionsCallback  = std::function<void()>;
using MsgAccountCallback    = std::function<void()>;
using MsgPriceCallback      = std::function<void()>;
using MsgConnectionCallback = std::function<void()>;
using StrategyCallback      = std::function<void(const std::string&)>;
using AutoTradingCallback   = std::function<void(bool)>;

class MessageHandler {
private:
    SendCallback          send_cb;
    SubscribeCallback     subscribe_cb;
    MsgPositionsCallback  positions_cb;
    MsgAccountCallback    account_cb;
    MsgPriceCallback      price_cb;
    MsgConnectionCallback connection_cb;
    StrategyCallback      strategy_cb;
    AutoTradingCallback   auto_trading_cb;

    // ── Send FlatBuffer ──
    void send(flatbuffers::DetachedBuffer buf) {
        if (send_cb && buf.size() > 0) {
            send_cb(buf.data(), buf.size());
        }
    }

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

public:

    // ── Set callbacks ──
    void setSendCallback(SendCallback cb)                { send_cb         = cb; }
    void setSubscribeCallback(SubscribeCallback cb)      { subscribe_cb    = cb; }
    void setPositionsCallback(MsgPositionsCallback cb)   { positions_cb    = cb; }
    void setAccountCallback(MsgAccountCallback cb)       { account_cb      = cb; }
    void setPriceCallback(MsgPriceCallback cb)           { price_cb        = cb; }
    void setConnectionCallback(MsgConnectionCallback cb) { connection_cb   = cb; }
    void setStrategyCallback(StrategyCallback cb)        { strategy_cb     = cb; }
    void setAutoTradingCallback(AutoTradingCallback cb)  { auto_trading_cb = cb; }

    // ================================================================
    // PROCESS MESSAGE — main router
    // ================================================================
    void processMessage(const std::string& message) {

        // ── Ping ──
        if (message == "ping") {
            send(FBB::buildPong());
            return;
        }

        // ── Subscribe ──
        if (message.size() >= 10 &&
            message.substr(0, 10) == "SUBSCRIBE_")
        {
            std::string symbol, timeframe;
            if (parseSymbolTimeframe(
                    message, "SUBSCRIBE_", symbol, timeframe)) {
                if (subscribe_cb) subscribe_cb(symbol, timeframe);
            } else {
                send(FBB::buildError(
                    "Use SUBSCRIBE_SYMBOL_TIMEFRAME format"
                ));
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
            trade_handler.handleTradeCommand(message, send_cb);
            return;
        }

        // ── Close all ──
        if (message == "CLOSE_ALL") {
            trade_handler.handleCloseAll(send_cb);
            return;
        }

        // ── Close position ──
        if (message.size() >= 15 &&
            message.substr(0, 15) == "CLOSE_POSITION_")
        {
            trade_handler.handleClosePosition(message, send_cb);
            return;
        }

        // ── Modify position ──
        if (message.size() >= 16 &&
            message.substr(0, 16) == "MODIFY_POSITION_")
        {
            trade_handler.handleModifyPosition(message, send_cb);
            return;
        }

        // ── Get positions ──
        if (message == "GET_POSITIONS") {
            if (positions_cb) positions_cb();
            return;
        }

        // ── Get account info ──
        if (message == "GET_ACCOUNT_INFO") {
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
            send(FBB::buildAutoTradingStatus(
                true, "Auto trading enabled"
            ));
            return;
        }

        if (message == "AUTO_OFF") {
            if (auto_trading_cb) auto_trading_cb(false);
            send(FBB::buildAutoTradingStatus(
                false, "Auto trading disabled"
            ));
            return;
        }

        // ── Watchlist ──
        if (message.size() >= 14 &&
            message.substr(0, 14) == "WATCHLIST_ADD_")
        {
            return;
        }

        if (message.size() >= 17 &&
            message.substr(0, 17) == "WATCHLIST_REMOVE_")
        {
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
            send(FBB::buildCacheCleared("Cache cleared"));
            return;
        }

        // ── Unknown ──
        send(FBB::buildError("Unknown command: " + message));
    }
};

inline MessageHandler message_handler;
