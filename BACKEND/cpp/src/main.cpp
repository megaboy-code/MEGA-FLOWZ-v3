// ================================================================
// MAIN.CPP - MEGA FLOWZ C++ Engine Entry Point
// ================================================================

#include <iostream>
#include <csignal>
#include <atomic>
#include <pybind11/embed.h>

#ifdef _WIN32
#include <windows.h>
#endif

#include "config.hpp"
#include "candle.hpp"
#include "symbol_cache.hpp"
#include "chart_manager.hpp"
#include "trade_handler.hpp"
#include "message_handler.hpp"
#include "broadcast_manager.hpp"
#include "connector_bridge.hpp"
#include "websocket_server.hpp"

namespace py = pybind11;

std::atomic<bool> should_exit { false };

void signalHandler(int sig) {
    std::cout << "\nShutdown signal received" << std::endl;
    should_exit = true;
    broadcast_manager.stop();
    ws_server.stop();
    std::exit(0);
}

#ifdef _WIN32
BOOL WINAPI consoleHandler(DWORD type) {
    std::cout << "\nShutdown..." << std::endl;
    should_exit = true;
    broadcast_manager.stop();
    std::exit(0);
    return TRUE;
}
#endif

int main() {
    std::cout << "MEGA FLOWZ Engine starting..." << std::endl;

    std::signal(SIGINT,  signalHandler);
    std::signal(SIGTERM, signalHandler);

#ifdef _WIN32
    SetConsoleCtrlHandler(consoleHandler, TRUE);
#endif

    // ── Start Python interpreter ──
    py::scoped_interpreter python_guard{};

    // ── Initialize connector bridge ──
    if (!connector_bridge.initialize()) {
        std::cerr << "Failed to initialize connector bridge" << std::endl;
        return 1;
    }

    // ── Connect to MT5 ──
    if (!connector_bridge.connect()) {
        std::cerr << "Warning: MT5 not connected." << std::endl;
    } else {
        std::cout << "MT5 connected" << std::endl;
    }

    // ── Wire trade handler ──
    trade_handler.setExecuteTradeCallback([](
        const std::string& symbol,
        const std::string& direction,
        double volume, double price,
        double sl, double tp) -> TradeResult
    {
        return connector_bridge.executeTrade(
            symbol, direction, volume, price, sl, tp
        );
    });

    trade_handler.setClosePositionCallback(
        [](int64_t ticket) -> TradeResult {
            return connector_bridge.closePosition(ticket);
        }
    );

    trade_handler.setCloseAllCallback([]() -> TradeResult {
        return connector_bridge.closeAllPositions();
    });

    trade_handler.setModifyPositionCallback([](
        int64_t ticket, double sl, double tp) -> TradeResult
    {
        return connector_bridge.modifyPosition(ticket, sl, tp);
    });

    // ── Wire broadcast manager ──

    // ✅ M1 candle update — anchor for all TF recompute
    broadcast_manager.setFetchCandleCallback([](
        const std::string& detected) -> Candle
    {
        return connector_bridge.getCandleUpdate(detected);
    });

    // ✅ Price stream — active chart bid/ask
    broadcast_manager.setFetchPriceCallback([]() -> std::string {
        auto state = chart_manager.getChartState();
        if (state.symbol.empty() || state.detected.empty()) return "";
        return connector_bridge.getCurrentPrice(
            state.symbol, state.detected
        );
    });

    // ✅ Positions + Account combined — single GIL acquire
    broadcast_manager.setFetchPositionsCallback([]() -> std::string {
        return connector_bridge.getPositionsAndAccount();
    });

    // ✅ Connection check
    broadcast_manager.setFetchConnectionCallback([]() -> std::string {
        return connector_bridge.checkConnection();
    });

    // ✅ Watchlist prices — keeps symbols warm + change %
    broadcast_manager.setFetchWatchlistCallback([](
        const std::vector<std::string>& symbols) -> std::string
    {
        return connector_bridge.getWatchlistPrices(symbols);
    });

    // ✅ MT5 reconnect — clear all caches, fresh start
    broadcast_manager.setReconnectCallback([]() {
        auto state = chart_manager.getReconnectionState();
        if (!state) return;

        std::cout << "Reconnect: clearing all caches..." << std::endl;

        // ── Clear ALL symbol caches ──
        symbol_cache.clearAll();

        // ── Clear active symbols ──
        broadcast_manager.clearActiveSymbols();

        // ── Detect active symbol ──
        std::string detected =
            connector_bridge.autoDetectSymbol(state->symbol);
        if (detected.empty()) return;

        // ── Fetch fresh initial data ──
        chart_manager.setChartState(
            state->symbol, state->timeframe, detected
        );

        CandleBuffer candles = connector_bridge.getInitialCandles(
            state->symbol, detected,
            state->timeframe,
            Config::CANDLE_FETCH_COUNT
        );

        if (candles.empty()) return;

        chart_manager.storeCandles(
            state->symbol, state->timeframe, candles
        );
        chart_manager.markChartReady();

        symbol_cache.storeCandles(
            state->symbol, detected,
            state->timeframe, candles
        );

        broadcast_manager.addActiveSymbol(state->symbol);
        broadcast_manager.setActiveChart(
            state->symbol, state->timeframe
        );

        std::string json = "{\"type\":\"initial\",";
        json += "\"symbol\":\"" + state->symbol + "\",";
        json += "\"timeframe\":\"" + state->timeframe + "\",";
        json += "\"data\":[";

        bool first = true;
        for (const auto& c : candles) {
            if (!first) json += ",";
            json += "{";
            json += "\"time\":"   + std::to_string(c.time)   + ",";
            json += "\"open\":"   + std::to_string(c.open)   + ",";
            json += "\"high\":"   + std::to_string(c.high)   + ",";
            json += "\"low\":"    + std::to_string(c.low)    + ",";
            json += "\"close\":"  + std::to_string(c.close)  + ",";
            json += "\"volume\":" + std::to_string(c.volume);
            json += "}";
            first = false;
        }

        json += "],\"count\":"
             + std::to_string(candles.size()) + "}";

        ws_server.broadcastToAll(json);
        std::cout << "Reconnect: Sent "
                  << candles.size()
                  << " fresh candles for "
                  << state->symbol << std::endl;
    });

    // ── Wire message handler callbacks ──
    message_handler.setPositionsCallback([]() {
        // ✅ Positions + account combined
        std::string pos = connector_bridge.getPositionsAndAccount();
        ws_server.broadcastToAll(pos);
    });

    message_handler.setAccountCallback([]() {
        // ✅ Standalone account — for GET_ACCOUNT_INFO only
        std::string acc = connector_bridge.getAccountInfo();
        if (!acc.empty()) ws_server.broadcastToAll(acc);
    });

    message_handler.setPriceCallback([]() {
        auto state = chart_manager.getChartState();
        if (state.symbol.empty()) return;
        std::string price = connector_bridge.getCurrentPrice(
            state.symbol, state.detected
        );
        if (!price.empty()) ws_server.broadcastToAll(price);
    });

    message_handler.setConnectionCallback([]() {
        std::string conn = connector_bridge.checkConnection();
        ws_server.broadcastToAll(conn);
    });

    message_handler.setAutoTradingCallback([](bool enabled) {
        std::cout << "Auto trading: "
                  << (enabled ? "ON" : "OFF") << std::endl;
    });

    // ── Release GIL before starting event loop ──
    {
        py::gil_scoped_release release;
        ws_server.start();
    }

    return 0;
}