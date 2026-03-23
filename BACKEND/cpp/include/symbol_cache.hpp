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
                  << " (" << candles.size() << " candles)" << std::endl;
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
    //
    // Called every 800ms with latest M1 candle from MT5
    // M1 is the anchor — all HTF candles derived from it
    //
    // Logic per cached TF:
    //   M1 candle time inside TF period?
    //     YES → update TF last candle high/low/close/volume
    //     NO  → new TF candle started → append
    // ================================================================
    void processM1Update(
        const std::string& symbol,
        const Candle& m1)
    {
        // Ignore empty candle
        if (m1.time == 0) return;

        std::lock_guard<std::mutex> lock(mtx);

        auto sym_it = cache.find(symbol);
        if (sym_it == cache.end()) return;

        auto& sym_data = sym_it->second;

        // ── Process each cached TF ──
        for (auto& [tf, buffer] : sym_data.tf_buffers) {
            if (buffer.empty()) continue;

            int64_t period     = tfSeconds(tf);
            Candle& last       = buffer.back();
            int64_t candle_end = last.time + period;

            if (m1.time < candle_end) {
                // ── Same TF candle period ──
                // Update high/low/close/volume from M1
                if (m1.high > last.high)  last.high  = m1.high;
                if (m1.low  < last.low)   last.low   = m1.low;
                last.close  = m1.close;
                last.volume += m1.volume;

            } else {
                // ── New TF candle period ──
                // Calculate aligned candle start time
                int64_t new_time = last.time + period;

                // Handle multiple missed periods
                while (new_time + period <= m1.time) {
                    new_time += period;
                }

                Candle new_candle;
                new_candle.time   = new_time;
                new_candle.open   = m1.open;   // M1 open = TF open
                new_candle.high   = m1.high;
                new_candle.low    = m1.low;
                new_candle.close  = m1.close;
                new_candle.volume = m1.volume;

                buffer.push_back(new_candle);

                // Keep buffer at 2000
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
        std::cout << "Cache cleared: " << symbol << std::endl;
    }

    // ── Clear all ──
    void clearAll() {
        std::lock_guard<std::mutex> lock(mtx);
        cache.clear();
        std::cout << "Cache cleared: all" << std::endl;
    }

    // ── Debug stats ──
    void printStats() {
        std::lock_guard<std::mutex> lock(mtx);
        std::cout << "=== Symbol Cache ===" << std::endl;
        for (auto& [sym, data] : cache) {
            std::cout << sym << " (" << data.detected << "):" << std::endl;
            for (auto& [tf, buf] : data.tf_buffers) {
                std::cout << "  " << tf << ": "
                          << buf.size() << " candles" << std::endl;
            }
        }
        std::cout << "===================" << std::endl;
    }
};

inline SymbolCache symbol_cache;