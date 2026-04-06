// ================================================================
// BROADCAST_MANAGER.HPP - Data Streaming & Broadcasting
// Push architecture — Python threads push data via callbacks
//   Thread 1 → onTick       — bid/ask per symbol
//   Thread 1 → onBarUpdate  — raw M1 OHLC → recompute all TFs
//   Thread 3 → onPositionsUpdate  — positions + account
//   Thread 3 → onConnectionUpdate — connection status
// FlatBuffers binary — replaces all JSON
// ================================================================

#pragma once
#include <string>
#include <set>
#include <vector>
#include <functional>
#include <atomic>
#include <algorithm>
#include <mutex>
#include "config.hpp"
#include "chart_manager.hpp"
#include "symbol_cache.hpp"
#include "candle.hpp"
#include "flatbuffer_builder.hpp"

using BroadcastCallback = std::function<void(
    const uint8_t* data, size_t size)>;
using ReconnectCallback = std::function<void()>;

class BroadcastManager {
private:
    BroadcastCallback broadcast_cb;
    ReconnectCallback reconnect_cb;

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

    void broadcast(flatbuffers::DetachedBuffer buf) {
        if (broadcast_cb && buf.size() > 0) {
            broadcast_cb(buf.data(), buf.size());
        }
    }

public:

    void setBroadcastCallback(BroadcastCallback cb) { broadcast_cb = cb; }
    void setReconnectCallback(ReconnectCallback cb) { reconnect_cb = cb; }

    void setActiveChart(
        const std::string& symbol,
        const std::string& timeframe)
    {
        std::lock_guard<std::mutex> lock(active_mtx);
        active_symbol    = symbol;
        active_timeframe = timeframe;
    }

    // ── Watchlist management ──
    void addToWatchlist(const std::string& symbol) {
        std::lock_guard<std::mutex> lock(watchlist_mtx);
        if (std::find(watchlist.begin(), watchlist.end(), symbol)
            == watchlist.end())
        {
            watchlist.push_back(symbol);
        }
    }

    void removeFromWatchlist(const std::string& symbol) {
        std::lock_guard<std::mutex> lock(watchlist_mtx);
        watchlist.erase(
            std::remove(watchlist.begin(), watchlist.end(), symbol),
            watchlist.end()
        );
    }

    std::vector<std::string> getWatchlist() {
        std::lock_guard<std::mutex> lock(watchlist_mtx);
        return watchlist;
    }

    bool isInWatchlist(const std::string& symbol) {
        std::lock_guard<std::mutex> lock(watchlist_mtx);
        return std::find(
            watchlist.begin(), watchlist.end(), symbol
        ) != watchlist.end();
    }

    // ================================================================
    // ON TICK — Thread 1 push
    // ================================================================
    void onTick(
        const std::string& symbol,
        double bid, double ask,
        int64_t time_msc)
    {
        std::string base = symbol_cache.getBaseSymbol(symbol);

        std::string cur_symbol, cur_timeframe;
        {
            std::lock_guard<std::mutex> lock(active_mtx);
            cur_symbol    = active_symbol;
            cur_timeframe = active_timeframe;
        }

        // ── Price update — active chart only ──
        if (base == cur_symbol) {
            broadcast(FBB::buildPriceUpdate(
                base, bid, ask, ask - bid, time_msc
            ));
        }

        // ── Watchlist update ──
        if (isInWatchlist(base)) {
            double daily_open = symbol_cache.getDailyOpen(base);
            double change_pct = 0.0;
            if (daily_open > 0.0) {
                change_pct =
                    ((bid - daily_open) / daily_open) * 100.0;
            }
            broadcast(FBB::buildWatchlistUpdate(
                base, bid, ask, ask - bid,
                time_msc, change_pct
            ));
        }
    }

    // ================================================================
    // ON BAR UPDATE — Thread 1 push
    // ================================================================
    void onBarUpdate(
        const std::string& symbol,
        const CandleBuffer& candles)
    {
        if (candles.empty()) return;

        std::string base = symbol_cache.getBaseSymbol(symbol);

        const Candle& m1 = candles.back();
        if (m1.time == 0) return;

        // ── Recompute all cached TFs from M1 ──
        symbol_cache.processM1Update(base, m1);

        // ── Broadcast active TF only ──
        std::string cur_symbol, cur_timeframe;
        {
            std::lock_guard<std::mutex> lock(active_mtx);
            cur_symbol    = active_symbol;
            cur_timeframe = active_timeframe;
        }

        if (base == cur_symbol && !cur_timeframe.empty()) {
            auto last = symbol_cache.getLastCandle(
                base, cur_timeframe
            );
            if (last.has_value()) {
                broadcast(FBB::buildBarUpdate(
                    base, cur_timeframe, last.value()
                ));
            }
        }
    }

    // ================================================================
    // ON POSITIONS UPDATE — Thread 3 push
    // Receives pre-built binary buffer from connector_bridge
    // ================================================================
    void onPositionsUpdate(flatbuffers::DetachedBuffer buf) {
        broadcast(std::move(buf));
    }

    // ================================================================
    // ON CONNECTION UPDATE — Thread 3 push
    // Only broadcast on state change
    // ================================================================
    void onConnectionUpdate(bool connected,
                            const std::string& status_text)
    {
        bool changed = first_check ||
                      (connected != last_connected);

        if (changed) {
            broadcast(FBB::buildConnectionStatus(
                connected, status_text
            ));

            if (connected && !first_check) {
                if (reconnect_cb) reconnect_cb();
            } else if (!connected) {
                chart_manager.saveStateForReconnection();
            }

            last_connected = connected;
            first_check    = false;
        }
    }

    bool isRunning() const { return true; }
};

inline BroadcastManager broadcast_manager;
