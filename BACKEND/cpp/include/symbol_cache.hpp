// ================================================================
// SYMBOL_CACHE.HPP - Per Symbol/TF Candle Cache
// Lazy fetch: fetch from MT5 on first visit
// Serve from cache on subsequent visits
// M1 candle update recomputes all cached TFs
// ================================================================

#pragma once
#include <string>
#include <unordered_map>
#include <vector>
#include <mutex>
#include <optional>
#include <iostream>
#include <algorithm>
#include <chrono>
#include "candle.hpp"

// ── Timeframe minutes ──
inline int tfMinutes(const std::string& timeframe) {
    if (timeframe == "M1")  return 1;
    if (timeframe == "M5")  return 5;
    if (timeframe == "M15") return 15;
    if (timeframe == "H1")  return 60;
    if (timeframe == "H4")  return 240;
    if (timeframe == "D1")  return 1440;
    return 60;
}

// ── Timeframe seconds ──
inline int64_t tfSeconds(const std::string& timeframe) {
    return static_cast<int64_t>(tfMinutes(timeframe)) * 60;
}

// ── Timeframe sort order ──
inline int tfOrder(const std::string& tf) {
    if (tf == "M1")  return 1;
    if (tf == "M5")  return 2;
    if (tf == "M15") return 3;
    if (tf == "H1")  return 4;
    if (tf == "H4")  return 5;
    if (tf == "D1")  return 6;
    return 99;
}

struct CachedSymbol {
    std::string symbol;
    std::string detected;
    std::unordered_map<std::string, CandleBuffer> tf_buffers;
};

class SymbolCache {
private:
    std::unordered_map<std::string, CachedSymbol> cache;
    std::mutex mtx;

public:

    // ── Check if symbol is cached ──
    bool hasSymbol(const std::string& symbol) {
        std::lock_guard<std::mutex> lock(mtx);
        return cache.count(symbol) > 0;
    }

    // ── Check if specific TF is cached ──
    bool hasTF(
        const std::string& symbol,
        const std::string& timeframe)
    {
        std::lock_guard<std::mutex> lock(mtx);
        auto it = cache.find(symbol);
        if (it == cache.end()) return false;
        return it->second.tf_buffers.count(timeframe) > 0;
    }

    // ── Store initial candles for a TF ──
    void storeCandles(
        const std::string& symbol,
        const std::string& detected,
        const std::string& timeframe,
        const CandleBuffer& candles)
    {
        std::lock_guard<std::mutex> lock(mtx);
        auto& sym                 = cache[symbol];
        sym.symbol                = symbol;
        sym.detected              = detected;
        sym.tf_buffers[timeframe] = candles;

        std::cout << "Cached: " << symbol << " " << timeframe
                  << " (" << candles.size() << " candles)"
                  << std::endl;
    }

    // ── Get candles for TF ──
    CandleBuffer getCandles(
        const std::string& symbol,
        const std::string& timeframe)
    {
        std::lock_guard<std::mutex> lock(mtx);
        auto it = cache.find(symbol);
        if (it == cache.end()) return {};
        auto tf_it = it->second.tf_buffers.find(timeframe);
        if (tf_it == it->second.tf_buffers.end()) return {};
        return tf_it->second;
    }

    // ── Get detected symbol ──
    std::string getDetected(const std::string& symbol) {
        std::lock_guard<std::mutex> lock(mtx);
        auto it = cache.find(symbol);
        if (it == cache.end()) return "";
        return it->second.detected;
    }

    // ── Get all cached TFs for a symbol ──
    std::vector<std::string> getCachedTFs(
        const std::string& symbol)
    {
        std::lock_guard<std::mutex> lock(mtx);
        std::vector<std::string> tfs;
        auto it = cache.find(symbol);
        if (it == cache.end()) return tfs;
        for (auto& kv : it->second.tf_buffers) {
            tfs.push_back(kv.first);
        }
        return tfs;
    }

    // ── Get all cached symbols ──
    std::vector<std::string> getCachedSymbols() {
        std::lock_guard<std::mutex> lock(mtx);
        std::vector<std::string> symbols;
        for (auto& kv : cache) {
            symbols.push_back(kv.first);
        }
        return symbols;
    }

    // ================================================================
    // M1 CANDLE UPDATE → RECOMPUTE ALL CACHED TFs
    // ================================================================
    void processM1Update(
        const std::string& symbol,
        const Candle& m1)
    {
        if (m1.time == 0) return;

        std::lock_guard<std::mutex> lock(mtx);

        auto sym_it = cache.find(symbol);
        if (sym_it == cache.end()) return;

        auto& sym_data = sym_it->second;

        for (auto& [tf, buffer] : sym_data.tf_buffers) {
            if (buffer.empty()) continue;

            int64_t period     = tfSeconds(tf);
            Candle& last       = buffer.back();
            int64_t candle_end = last.time + period;

            if (m1.time < candle_end) {
                // ── Same TF candle ──
                if (m1.high > last.high) last.high  = m1.high;
                if (m1.low  < last.low)  last.low   = m1.low;
                last.close  = m1.close;
                last.volume += m1.volume;

            } else {
                // ── New TF candle ──
                int64_t new_time = last.time + period;
                while (new_time + period <= m1.time) {
                    new_time += period;
                }

                Candle new_candle;
                new_candle.time   = new_time;
                new_candle.open   = m1.open;
                new_candle.high   = m1.high;
                new_candle.low    = m1.low;
                new_candle.close  = m1.close;
                new_candle.volume = m1.volume;

                buffer.push_back(new_candle);

                if (buffer.size() > 2000) {
                    buffer.pop_front();
                }
            }
        }
    }

    // ── Get last candle for TF ──
    std::optional<Candle> getLastCandle(
        const std::string& symbol,
        const std::string& timeframe)
    {
        std::lock_guard<std::mutex> lock(mtx);
        auto it = cache.find(symbol);
        if (it == cache.end()) return std::nullopt;
        auto tf_it = it->second.tf_buffers.find(timeframe);
        if (tf_it == it->second.tf_buffers.end()) return std::nullopt;
        if (tf_it->second.empty()) return std::nullopt;
        return tf_it->second.back();
    }

    // ── Clear symbol from cache ──
    void clearSymbol(const std::string& symbol) {
        std::lock_guard<std::mutex> lock(mtx);
        cache.erase(symbol);
    }

    // ── Clear all ──
    void clearAll() {
        std::lock_guard<std::mutex> lock(mtx);
        cache.clear();
    }

    // ================================================================
    // PRINT ACTIVE SYMBOLS — called after every subscribe
    // Shows all cached symbols and their timeframes vertically
    // ================================================================
    void printActiveSymbols() {
        std::lock_guard<std::mutex> lock(mtx);

        if (cache.empty()) return;

        std::cout << "----------------------------" << std::endl;
        std::cout << "Active Symbols:" << std::endl;

        for (auto& [sym, data] : cache) {
            // ── Collect and sort TFs ──
            std::vector<std::string> tfs;
            for (auto& [tf, buf] : data.tf_buffers) {
                tfs.push_back(tf);
            }

            // ── Sort by timeframe order ──
            std::sort(tfs.begin(), tfs.end(),
                [](const std::string& a, const std::string& b) {
                    return tfOrder(a) < tfOrder(b);
                }
            );

            // ── Build TF list ──
            std::string tf_list = "";
            for (size_t i = 0; i < tfs.size(); i++) {
                if (i > 0) tf_list += ", ";
                tf_list += tfs[i];
            }

            std::cout << "  " << sym
                      << " [" << tf_list << "]"
                      << std::endl;
        }

        std::cout << "----------------------------" << std::endl;
    }
};

inline SymbolCache symbol_cache;