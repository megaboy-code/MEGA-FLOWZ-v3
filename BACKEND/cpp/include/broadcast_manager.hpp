// ================================================================
// BROADCAST_MANAGER.HPP - Data Streaming & Broadcasting
// Single Python thread handles all MT5 calls
// Pause during subscribe — prevents GIL contention
// M1 candle update recomputes all cached TFs
// Anchored timing — no drift
// ================================================================

#pragma once
#include <string>
#include <set>
#include <vector>
#include <functional>
#include <thread>
#include <atomic>
#include <chrono>
#include <iostream>
#include <algorithm>
#include <mutex>
#include "config.hpp"
#include "chart_manager.hpp"
#include "symbol_cache.hpp"
#include "candle.hpp"

// ── Callback types ──
using BroadcastCallback       = std::function<void(const std::string&)>;
using FetchCandleCallback     = std::function<Candle(const std::string& detected)>;
using FetchPriceCallback      = std::function<std::string()>;
using FetchPositionsCallback  = std::function<std::string()>;
using FetchConnectionCallback = std::function<std::string()>;
using FetchWatchlistCallback  = std::function<std::string(
                                    const std::vector<std::string>& symbols)>;
using ReconnectCallback       = std::function<void()>;

class BroadcastManager {
private:
    // ── Callbacks ──
    BroadcastCallback       broadcast_cb;
    FetchCandleCallback     fetch_candle_cb;
    FetchPriceCallback      fetch_price_cb;
    FetchPositionsCallback  fetch_positions_cb;
    FetchConnectionCallback fetch_connection_cb;
    FetchWatchlistCallback  fetch_watchlist_cb;
    ReconnectCallback       reconnect_cb;

    // ── State ──
    std::atomic<bool> running  { false };
    std::atomic<bool> paused_  { false };
    std::thread       python_thread;

    // ── Active symbols — all get M1 update ──
    std::set<std::string> active_symbols;
    std::mutex            active_symbols_mtx;

    // ── Watchlist ──
    std::vector<std::string> watchlist;
    std::mutex               watchlist_mtx;

    // ── Active chart ──
    std::string active_symbol;
    std::string active_timeframe;
    std::mutex  active_mtx;

    // ── Connection state ──
    bool last_connected = false;
    bool first_check    = true;

    // ── Timing ──
    using Clock     = std::chrono::steady_clock;
    using TimePoint = std::chrono::time_point<Clock>;

    TimePoint last_candle;
    TimePoint last_price;
    TimePoint last_positions;
    TimePoint last_connection;
    TimePoint last_watchlist;

    std::chrono::milliseconds candle_dur;
    std::chrono::milliseconds price_dur;
    std::chrono::milliseconds positions_dur;
    std::chrono::milliseconds connection_dur;
    std::chrono::milliseconds watchlist_dur;

    // ── Broadcast helper ──
    void broadcast(const std::string& json) {
        if (broadcast_cb && !json.empty()) broadcast_cb(json);
    }

    // ── Build candle update JSON ──
    std::string buildCandleJSON(
        const std::string& symbol,
        const std::string& timeframe,
        const Candle& c)
    {
        std::string json = "{\"type\":\"update\",";
        json += "\"symbol\":\"" + symbol + "\",";
        json += "\"timeframe\":\"" + timeframe + "\",";
        json += "\"data\":{";
        json += "\"time\":"   + std::to_string(c.time)   + ",";
        json += "\"open\":"   + std::to_string(c.open)   + ",";
        json += "\"high\":"   + std::to_string(c.high)   + ",";
        json += "\"low\":"    + std::to_string(c.low)    + ",";
        json += "\"close\":"  + std::to_string(c.close)  + ",";
        json += "\"volume\":" + std::to_string(c.volume);
        json += "}}";
        return json;
    }

    // ================================================================
    // SINGLE PYTHON THREAD
    // All MT5 calls sequential — no GIL contention
    // Anchored timing — no drift over time
    // ================================================================
    void pythonLoop() {
        auto now       = Clock::now();
        last_candle    = now;
        last_price     = now;
        last_positions = now;
        last_connection= now;
        last_watchlist = now;

        // ── Sleep minimum interval ──
        auto min_dur = std::min({
            candle_dur,
            price_dur,
            positions_dur
        });

        while (running) {
            std::this_thread::sleep_for(min_dur);

            // ── Skip all Python calls if subscribe in progress ──
            // Gives GIL fully to subscribe thread
            if (paused_) continue;

            now = Clock::now();

            // ── Get active chart ──
            std::string cur_symbol, cur_timeframe;
            {
                std::lock_guard<std::mutex> lock(active_mtx);
                cur_symbol    = active_symbol;
                cur_timeframe = active_timeframe;
            }

            // ================================================================
            // M1 CANDLE UPDATE FOR ALL ACTIVE SYMBOLS
            // → fetches M1 from MT5 per symbol
            // → recomputes all cached TFs from M1
            // → broadcasts active symbol only to frontend
            // ================================================================
            if (now - last_candle >= candle_dur) {
                last_candle += candle_dur;  // ✅ anchored — no drift
                try {
                    // ── Snapshot active symbols ──
                    std::set<std::string> symbols_snapshot;
                    {
                        std::lock_guard<std::mutex> lock(active_symbols_mtx);
                        symbols_snapshot = active_symbols;
                    }

                    for (const auto& symbol : symbols_snapshot) {
                        // ── Check pause between symbols ──
                        if (paused_) break;

                        std::string detected =
                            symbol_cache.getDetected(symbol);
                        if (detected.empty()) continue;

                        // ── Fetch M1 from MT5 ──
                        Candle m1 = fetch_candle_cb(detected);
                        if (m1.time == 0) continue;

                        // ── Recompute all cached TFs from M1 ──
                        symbol_cache.processM1Update(symbol, m1);

                        // ── Broadcast active symbol only ──
                        if (symbol == cur_symbol) {
                            auto last = symbol_cache.getLastCandle(
                                symbol, cur_timeframe
                            );
                            if (last.has_value()) {
                                broadcast(buildCandleJSON(
                                    symbol, cur_timeframe, last.value()
                                ));
                            }
                        }
                    }
                } catch (const std::exception& e) {
                    std::cerr << "Candle loop error: "
                              << e.what() << std::endl;
                } catch (...) {
                    std::cerr << "Candle loop unknown error" << std::endl;
                }
            }

            if (paused_) continue;

            // ── Price stream — active symbol bid/ask ──
            if (now - last_price >= price_dur) {
                last_price += price_dur;  // ✅ anchored
                try {
                    if (fetch_price_cb) {
                        broadcast(fetch_price_cb());
                    }
                } catch (const std::exception& e) {
                    std::cerr << "Price loop error: "
                              << e.what() << std::endl;
                } catch (...) {
                    std::cerr << "Price loop unknown error" << std::endl;
                }
            }

            if (paused_) continue;

            // ── Watchlist prices — keeps symbols warm ──
            if (now - last_watchlist >= watchlist_dur) {
                last_watchlist += watchlist_dur;  // ✅ anchored
                try {
                    std::vector<std::string> wl;
                    {
                        std::lock_guard<std::mutex> lock(watchlist_mtx);
                        wl = watchlist;
                    }
                    if (!wl.empty() && fetch_watchlist_cb) {
                        std::string result = fetch_watchlist_cb(wl);
                        if (result != "{}") broadcast(result);
                    }
                } catch (const std::exception& e) {
                    std::cerr << "Watchlist loop error: "
                              << e.what() << std::endl;
                } catch (...) {
                    std::cerr << "Watchlist loop unknown error" << std::endl;
                }
            }

            if (paused_) continue;

            // ── Positions update ──
            if (now - last_positions >= positions_dur) {
                last_positions += positions_dur;  // ✅ anchored
                try {
                    if (fetch_positions_cb) {
                        broadcast(fetch_positions_cb());
                    }
                } catch (const std::exception& e) {
                    std::cerr << "Positions loop error: "
                              << e.what() << std::endl;
                } catch (...) {
                    std::cerr << "Positions loop unknown error" << std::endl;
                }
            }

            if (paused_) continue;

            // ── Connection check ──
            if (now - last_connection >= connection_dur) {
                last_connection += connection_dur;  // ✅ anchored
                try {
                    if (fetch_connection_cb) {
                        std::string status = fetch_connection_cb();
                        bool connected = status.find(
                            "\"mt5_connected\":true"
                        ) != std::string::npos;

                        bool changed = first_check ||
                                      (connected != last_connected);

                        if (changed) {
                            broadcast(status);

                            if (connected && !first_check) {
                                std::cout << "MT5 Reconnected" << std::endl;
                                if (reconnect_cb) reconnect_cb();
                            } else if (!connected) {
                                std::cout << "MT5 Disconnected" << std::endl;
                                chart_manager.saveStateForReconnection();
                            }

                            last_connected = connected;
                            first_check    = false;
                        }
                    }
                } catch (const std::exception& e) {
                    std::cerr << "Connection loop error: "
                              << e.what() << std::endl;
                } catch (...) {
                    std::cerr << "Connection loop unknown error" << std::endl;
                }
            }
        }
    }

public:

    // ── Set callbacks ──
    void setBroadcastCallback(BroadcastCallback cb)           { broadcast_cb         = cb; }
    void setFetchCandleCallback(FetchCandleCallback cb)       { fetch_candle_cb      = cb; }
    void setFetchPriceCallback(FetchPriceCallback cb)         { fetch_price_cb       = cb; }
    void setFetchPositionsCallback(FetchPositionsCallback cb) { fetch_positions_cb   = cb; }
    void setFetchConnectionCallback(FetchConnectionCallback cb){ fetch_connection_cb = cb; }
    void setFetchWatchlistCallback(FetchWatchlistCallback cb) { fetch_watchlist_cb   = cb; }
    void setReconnectCallback(ReconnectCallback cb)           { reconnect_cb         = cb; }

    // ── Pause/resume broadcast ──
    // Called during subscribe to give GIL to subscribe thread
    void setPaused(bool paused) {
        paused_ = paused;
        if (!paused) {
            std::cout << "▶ Broadcast resumed" << std::endl;
        }
    }

    // ── Set active chart ──
    void setActiveChart(
        const std::string& symbol,
        const std::string& timeframe)
    {
        std::lock_guard<std::mutex> lock(active_mtx);
        active_symbol    = symbol;
        active_timeframe = timeframe;
    }

    // ── Active symbols management ──
    void addActiveSymbol(const std::string& symbol) {
        std::lock_guard<std::mutex> lock(active_symbols_mtx);
        active_symbols.insert(symbol);
        std::cout << "Active symbol added: " << symbol
                  << " (total: " << active_symbols.size() << ")"
                  << std::endl;
    }

    void removeActiveSymbol(const std::string& symbol) {
        std::lock_guard<std::mutex> lock(active_symbols_mtx);
        active_symbols.erase(symbol);
        std::cout << "Active symbol removed: " << symbol
                  << " (total: " << active_symbols.size() << ")"
                  << std::endl;
    }

    void clearActiveSymbols() {
        std::lock_guard<std::mutex> lock(active_symbols_mtx);
        active_symbols.clear();
        std::cout << "Active symbols cleared" << std::endl;
    }

    // ── Watchlist management ──
    void addToWatchlist(const std::string& symbol) {
        std::lock_guard<std::mutex> lock(watchlist_mtx);
        if (std::find(watchlist.begin(), watchlist.end(), symbol)
            == watchlist.end())
        {
            watchlist.push_back(symbol);
            std::cout << "Watchlist add: " << symbol << std::endl;
        }
    }

    void removeFromWatchlist(const std::string& symbol) {
        std::lock_guard<std::mutex> lock(watchlist_mtx);
        watchlist.erase(
            std::remove(watchlist.begin(), watchlist.end(), symbol),
            watchlist.end()
        );
        std::cout << "Watchlist remove: " << symbol << std::endl;
    }

    std::vector<std::string> getWatchlist() {
        std::lock_guard<std::mutex> lock(watchlist_mtx);
        return watchlist;
    }

    // ── Lifecycle ──
    void start() {
        if (running) return;

        candle_dur     = std::chrono::milliseconds(
            static_cast<int>(Config::DATA_FETCH_INTERVAL * 1000));
        price_dur      = std::chrono::milliseconds(
            static_cast<int>(Config::PRICE_STREAM_INTERVAL * 1000));
        positions_dur  = std::chrono::milliseconds(
            static_cast<int>(Config::POSITION_FETCH_INTERVAL * 1000));
        connection_dur = std::chrono::milliseconds(
            static_cast<int>(Config::CONNECTION_CHECK_INTERVAL * 1000));
        watchlist_dur  = price_dur;

        running       = true;
        python_thread = std::thread(&BroadcastManager::pythonLoop, this);

        std::cout << "BroadcastManager started" << std::endl;
    }

    void stop() {
        if (!running) return;
        running = false;
        if (python_thread.joinable()) python_thread.join();
        std::cout << "BroadcastManager stopped" << std::endl;
    }

    ~BroadcastManager() { stop(); }

    bool isRunning() const { return running; }
};

inline BroadcastManager broadcast_manager; 