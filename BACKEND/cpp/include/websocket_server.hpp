// ================================================================
// WEBSOCKET_SERVER.HPP - WebSocket Server
// Subscribe runs on detached thread — no GIL blocking
// Watchlist defines which symbols stay cached
// Clear cache on disconnect — fresh start on reconnect
// ================================================================

#pragma once
#include <string>
#include <functional>
#include <set>
#include <mutex>
#include <queue>
#include <iostream>
#include <atomic>
#include <thread>
#include <chrono>
#include <algorithm>

#include "uWebSockets/src/App.h"
#include "config.hpp"
#include "candle.hpp"
#include "symbol_cache.hpp"
#include "chart_manager.hpp"
#include "trade_handler.hpp"
#include "message_handler.hpp"
#include "broadcast_manager.hpp"
#include "connector_bridge.hpp"

struct SocketData {};

class WebSocketServer {
private:
    using WSocket = uWS::WebSocket<false, true, SocketData>*;

    std::set<WSocket>       clients;
    std::mutex              clients_mtx;
    std::mutex              queue_mtx;
    std::queue<std::string> message_queue;
    std::atomic<bool>       running    { false };
    std::atomic<bool>       subscribing{ false };
    uWS::Loop*              loop = nullptr;

    // ── Send to all clients ──
    void sendToAll(const std::string& message) {
        std::lock_guard<std::mutex> lock(clients_mtx);
        for (auto* ws : clients) {
            ws->send(message, uWS::OpCode::TEXT);
        }
    }

    // ── Build initial data JSON ──
    std::string buildInitialJSON(
        const std::string& symbol,
        const std::string& timeframe,
        const CandleBuffer& candles)
    {
        std::string json = "{\"type\":\"initial\",";
        json += "\"symbol\":\"" + symbol + "\",";
        json += "\"timeframe\":\"" + timeframe + "\",";
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
        return json;
    }

    // ── Check if symbol is in watchlist ──
    bool isInWatchlist(const std::string& symbol) {
        auto watchlist = broadcast_manager.getWatchlist();
        return std::find(
            watchlist.begin(),
            watchlist.end(),
            symbol
        ) != watchlist.end();
    }

    // ================================================================
    // HANDLE SUBSCRIBE
    // ================================================================
    void handleSubscribe(
        const std::string& symbol,
        const std::string& timeframe)
    {
        std::cout << "Subscribe: " << symbol
                  << " " << timeframe << std::endl;

        // ── Add to active symbols ──
        broadcast_manager.addActiveSymbol(symbol);

        // ── Check cache ──
        if (symbol_cache.hasTF(symbol, timeframe)) {
            std::cout << "Cache hit: " << symbol
                      << " " << timeframe << std::endl;

            CandleBuffer candles = symbol_cache.getCandles(
                symbol, timeframe
            );

            std::string detected = symbol_cache.getDetected(symbol);
            chart_manager.setChartState(symbol, timeframe, detected);
            chart_manager.markChartReady();
            broadcast_manager.setActiveChart(symbol, timeframe);

            broadcastToAll(buildInitialJSON(symbol, timeframe, candles));

            std::cout << "Served " << candles.size()
                      << " candles from cache: "
                      << symbol << " " << timeframe << std::endl;

            symbol_cache.printActiveSymbols();
            return;
        }

        // ── Cache miss — pause broadcast ──
        std::cout << "Cache miss: " << symbol
                  << " " << timeframe
                  << " -- fetching from MT5" << std::endl;

        subscribing = true;
        broadcast_manager.setPaused(true);

        std::this_thread::sleep_for(
            std::chrono::milliseconds(100)
        );

        std::string detected =
            connector_bridge.autoDetectSymbol(symbol);

        if (detected.empty()) {
            subscribing = false;
            broadcast_manager.setPaused(false);
            broadcastToAll(
                "{\"type\":\"error\","
                "\"message\":\"Symbol not found: "
                + symbol + "\"}"
            );
            return;
        }

        CandleBuffer candles = connector_bridge.getInitialCandles(
            symbol, detected, timeframe,
            Config::CANDLE_FETCH_COUNT
        );

        subscribing = false;
        broadcast_manager.setPaused(false);

        if (candles.empty()) {
            broadcastToAll(
                "{\"type\":\"error\","
                "\"message\":\"No data for "
                + symbol + " " + timeframe + "\"}"
            );
            return;
        }

        symbol_cache.storeCandles(
            symbol, detected, timeframe, candles
        );

        chart_manager.setChartState(symbol, timeframe, detected);
        chart_manager.markChartReady();
        broadcast_manager.setActiveChart(symbol, timeframe);

        broadcastToAll(buildInitialJSON(symbol, timeframe, candles));

        std::cout << "Fetched and sent " << candles.size()
                  << " candles: "
                  << symbol << " " << timeframe << std::endl;

        symbol_cache.printActiveSymbols();
    }

    // ================================================================
    // HANDLE UNSUBSCRIBE
    // Symbol in watchlist → keep M1 running (no gap on switch back)
    // Symbol NOT in watchlist → stop M1 + clear cache (memory free)
    // ================================================================
    void handleUnsubscribe(const std::string& symbol) {
        std::cout << "Unsubscribe: " << symbol << std::endl;
        chart_manager.clearChartState();

        if (!isInWatchlist(symbol)) {
            // ── Not in watchlist → stop M1 + clear cache ──
            broadcast_manager.removeActiveSymbol(symbol);
            symbol_cache.clearSymbol(symbol);
            std::cout << "  " << symbol
                      << " not in watchlist -- M1 stopped"
                      << std::endl;
        } else {
            // ── In watchlist → keep M1 running ──
            std::cout << "  " << symbol
                      << " in watchlist -- M1 kept running"
                      << std::endl;
        }
    }

    // ================================================================
    // HANDLE WATCHLIST ADD
    // ================================================================
    void handleWatchlistAdd(const std::string& symbol) {
        broadcast_manager.addToWatchlist(symbol);
        connector_bridge.autoDetectSymbol(symbol);
    }

    // ================================================================
    // HANDLE WATCHLIST REMOVE
    // Always stop price streaming
    // Only stop M1 if user not currently viewing
    // ================================================================
    void handleWatchlistRemove(const std::string& symbol) {
        broadcast_manager.removeFromWatchlist(symbol);

        auto state = chart_manager.getChartState();
        if (state.symbol != symbol) {
            // ── Not viewing → stop M1 + clear cache ──
            broadcast_manager.removeActiveSymbol(symbol);
            symbol_cache.clearSymbol(symbol);
            std::cout << "Watchlist remove: " << symbol
                      << " (M1 stopped)" << std::endl;
        } else {
            // ── Still viewing → keep M1 running ──
            std::cout << "Watchlist remove: " << symbol
                      << " (still viewing)" << std::endl;
        }
    }

public:

    // ── Broadcast from any thread ──
    void broadcastToAll(const std::string& message) {
        if (!loop) {
            std::lock_guard<std::mutex> lock(queue_mtx);
            message_queue.push(message);
            return;
        }
        loop->defer([this, message]() {
            sendToAll(message);
        });
    }

    // ── Start server ──
    void start() {
        running = true;

        broadcast_manager.setBroadcastCallback(
            [this](const std::string& json) {
                broadcastToAll(json);
            }
        );

        message_handler.setSendCallback(
            [this](const std::string& json) {
                broadcastToAll(json);
            }
        );

        message_handler.setAutoTradingCallback(
            [](bool enabled) {
                std::cout << "Auto trading: "
                          << (enabled ? "ON" : "OFF")
                          << std::endl;
            }
        );

        broadcast_manager.start();

        std::cout << "WebSocketServer setup complete" << std::endl;

        auto app = uWS::App();
        loop = uWS::Loop::get();

        app.ws<SocketData>("/*", {

            .open = [this](WSocket ws) {
                {
                    std::lock_guard<std::mutex> lock(clients_mtx);
                    clients.insert(ws);
                }
                std::cout << "Client connected. Total: "
                          << clients.size() << std::endl;

                std::lock_guard<std::mutex> qlock(queue_mtx);
                while (!message_queue.empty()) {
                    ws->send(
                        message_queue.front(),
                        uWS::OpCode::TEXT
                    );
                    message_queue.pop();
                }
            },

            .message = [this](
                WSocket ws,
                std::string_view msg,
                uWS::OpCode opcode)
            {
                std::string message(msg);

                // ── SUBSCRIBE ──
                if (message.size() > 10 &&
                    message.substr(0, 10) == "SUBSCRIBE_")
                {
                    std::string content = message.substr(10);
                    auto pos = content.find('_');
                    if (pos != std::string::npos) {
                        std::string symbol    = content.substr(0, pos);
                        std::string timeframe = content.substr(pos + 1);
                        std::thread([this, symbol, timeframe]() {
                            handleSubscribe(symbol, timeframe);
                        }).detach();
                        return;
                    }
                }

                // ── UNSUBSCRIBE ──
                if (message.size() > 12 &&
                    message.substr(0, 12) == "UNSUBSCRIBE_")
                {
                    std::string symbol = message.substr(12);
                    handleUnsubscribe(symbol);
                    return;
                }

                // ── WATCHLIST ADD ──
                if (message.size() > 14 &&
                    message.substr(0, 14) == "WATCHLIST_ADD_")
                {
                    std::string symbol = message.substr(14);
                    handleWatchlistAdd(symbol);
                    return;
                }

                // ── WATCHLIST REMOVE ──
                if (message.size() > 17 &&
                    message.substr(0, 17) == "WATCHLIST_REMOVE_")
                {
                    std::string symbol = message.substr(17);
                    handleWatchlistRemove(symbol);
                    return;
                }

                // ── All other messages ──
                message_handler.processMessage(message);
            },

            .close = [this](
                WSocket ws,
                int,
                std::string_view)
            {
                {
                    std::lock_guard<std::mutex> lock(clients_mtx);
                    clients.erase(ws);
                }

                std::cout << "Client disconnected. Total: "
                          << clients.size() << std::endl;

                // ✅ Clear all caches when no clients connected
                // Prevents stale data / gap on reconnect
                if (clients.empty()) {
                    std::cout << "No clients -- cache cleared for fresh start"
                              << std::endl;
                    symbol_cache.clearAll();
                    broadcast_manager.clearActiveSymbols();
                }
            }
        })
        .listen(Config::WS_PORT, [](auto* socket) {
            if (socket) {
                std::cout << "Server listening on port "
                          << Config::WS_PORT << std::endl;
            } else {
                std::cerr << "Failed to listen on port "
                          << Config::WS_PORT << std::endl;
            }
        })
        .run();
    }

    void stop() {
        running = false;
        broadcast_manager.stop();
        if (loop) {
            loop->defer([this]() {});
        }
    }
};

inline WebSocketServer ws_server;