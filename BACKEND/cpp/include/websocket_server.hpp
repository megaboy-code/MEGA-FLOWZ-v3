// ================================================================
// WEBSOCKET_SERVER.HPP - WebSocket Server
// Subscribe runs on detached thread — no GIL blocking
// Watchlist defines which symbols stay cached
// Clear cache on disconnect — fresh start on reconnect
// Binary FlatBuffers — replaces all JSON text frames
// ================================================================

#pragma once
#include <string>
#include <functional>
#include <set>
#include <mutex>
#include <queue>
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
#include "flatbuffer_builder.hpp"

struct SocketData {};

class WebSocketServer {
private:
    using WSocket = uWS::WebSocket<false, true, SocketData>*;

    std::set<WSocket>  clients;
    std::mutex         clients_mtx;
    std::mutex         queue_mtx;
    uWS::Loop*         loop = nullptr;

    // ── Binary message queue — for messages before loop ready ──
    struct QueuedMessage {
        std::vector<uint8_t> data;
    };
    std::queue<QueuedMessage> message_queue;

    // ── Send binary to all clients ──
    void sendToAll(const uint8_t* data, size_t size) {
        std::string_view sv(
            reinterpret_cast<const char*>(data), size
        );
        std::lock_guard<std::mutex> lock(clients_mtx);
        for (auto* ws : clients) {
            ws->send(sv, uWS::OpCode::BINARY);
        }
    }

    // ── Build initial data FlatBuffer ──
    flatbuffers::DetachedBuffer buildInitialFB(
        const std::string&  symbol,
        const std::string&  timeframe,
        const CandleBuffer& candles)
    {
        return FBB::buildInitialData(symbol, timeframe, candles);
    }

    // ================================================================
    // HANDLE SUBSCRIBE
    // Cache hit  — serve immediately from cache
    // Cache miss — push to Thread 2, no Python touched here
    // ================================================================
    void handleSubscribe(
        const std::string& symbol,
        const std::string& timeframe)
    {
        if (symbol_cache.hasTF(symbol, timeframe)) {
            CandleBuffer candles =
                symbol_cache.getCandles(symbol, timeframe);

            std::string detected =
                symbol_cache.getDetected(symbol);

            connector_bridge.addActiveSymbol(detected);
            chart_manager.setChartState(
                symbol, timeframe, detected
            );
            chart_manager.markChartReady();
            broadcast_manager.setActiveChart(symbol, timeframe);

            auto buf = buildInitialFB(symbol, timeframe, candles);
            broadcastToAll(buf.data(), buf.size());
            return;
        }

        // ── Cache miss — push to Thread 2 ──
        connector_bridge.requestDetectAndFetch(
            symbol, timeframe,
            Config::CANDLE_FETCH_COUNT
        );
    }

    // ================================================================
    // HANDLE UNSUBSCRIBE
    // ================================================================
    void handleUnsubscribe(const std::string& symbol) {
        chart_manager.clearChartState();

        if (!broadcast_manager.isInWatchlist(symbol)) {
            std::string detected =
                symbol_cache.getDetected(symbol);
            connector_bridge.removeActiveSymbol(detected);
            symbol_cache.clearSymbol(symbol);
        }
    }

    // ================================================================
    // HANDLE WATCHLIST ADD
    // ================================================================
    void handleWatchlistAdd(const std::string& symbol) {
        broadcast_manager.addToWatchlist(symbol);

        std::string detected =
            connector_bridge.autoDetectSymbol(symbol);

        if (!detected.empty()) {
            connector_bridge.addActiveSymbol(detected);
            symbol_cache.storeDetected(symbol, detected);
            connector_bridge.requestDailyOpen(detected);
        }
    }

    // ================================================================
    // HANDLE WATCHLIST REMOVE
    // ================================================================
    void handleWatchlistRemove(const std::string& symbol) {
        broadcast_manager.removeFromWatchlist(symbol);

        auto state = chart_manager.getChartState();
        if (state.symbol != symbol) {
            std::string detected =
                symbol_cache.getDetected(symbol);
            connector_bridge.removeActiveSymbol(detected);
            symbol_cache.clearSymbol(symbol);
        }
    }

public:

    // ── Broadcast binary from any thread ──
    void broadcastToAll(const uint8_t* data, size_t size) {
        if (!loop) {
            std::vector<uint8_t> copy(data, data + size);
            std::lock_guard<std::mutex> lock(queue_mtx);
            message_queue.push({ std::move(copy) });
            return;
        }
        std::vector<uint8_t> copy(data, data + size);
        loop->defer([this, copy = std::move(copy)]() {
            sendToAll(copy.data(), copy.size());
        });
    }

    // ── Convenience overload for DetachedBuffer ──
    void broadcastToAll(flatbuffers::DetachedBuffer buf) {
        broadcastToAll(buf.data(), buf.size());
    }

    // ── Start server ──
    void start() {
        broadcast_manager.setBroadcastCallback(
            [this](const uint8_t* data, size_t size) {
                broadcastToAll(data, size);
            }
        );

        message_handler.setSendCallback(
            [this](const uint8_t* data, size_t size) {
                broadcastToAll(data, size);
            }
        );

        auto app = uWS::App();
        loop = uWS::Loop::get();

        app.ws<SocketData>("/*", {

            .open = [this](WSocket ws) {
                {
                    std::lock_guard<std::mutex> lock(clients_mtx);
                    clients.insert(ws);
                }

                // ── Flush queued messages ──
                std::lock_guard<std::mutex> qlock(queue_mtx);
                while (!message_queue.empty()) {
                    auto& msg = message_queue.front();
                    std::string_view sv(
                        reinterpret_cast<const char*>(
                            msg.data.data()),
                        msg.data.size()
                    );
                    ws->send(sv, uWS::OpCode::BINARY);
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
                    handleUnsubscribe(message.substr(12));
                    return;
                }

                // ── WATCHLIST ADD ──
                if (message.size() > 14 &&
                    message.substr(0, 14) == "WATCHLIST_ADD_")
                {
                    handleWatchlistAdd(message.substr(14));
                    return;
                }

                // ── WATCHLIST REMOVE ──
                if (message.size() > 17 &&
                    message.substr(0, 17) == "WATCHLIST_REMOVE_")
                {
                    handleWatchlistRemove(message.substr(17));
                    return;
                }

                // ── PING ──
                if (message == "ping") {
                    auto buf = FBB::buildPong();
                    std::string_view sv(
                        reinterpret_cast<const char*>(buf.data()),
                        buf.size()
                    );
                    ws->send(sv, uWS::OpCode::BINARY);
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

                if (clients.empty()) {
                    symbol_cache.clearAll();
                    connector_bridge.setActiveSymbols({});
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
        if (loop) {
            loop->defer([this]() {});
        }
    }
};

inline WebSocketServer ws_server;
