// ================================================================
// TRADE_HANDLER.HPP - Trade Execution & Position Management
// Async callbacks — all trades go through Thread 2 queue
// Binary FlatBuffers — replaces all JSON sends
// ================================================================

#pragma once
#include <string>
#include <functional>
#include <sstream>
#include <vector>
#include <iostream>
#include "candle.hpp"
#include "flatbuffer_builder.hpp"

// ── Trade result ──
struct TradeResult {
    bool        success   = false;
    std::string direction;
    std::string symbol;
    double      volume    = 0.0;
    double      price     = 0.0;
    double      tp        = 0.0;
    double      sl        = 0.0;
    int64_t     ticket    = 0;
    int64_t     timestamp = 0;
    std::string message;
    std::string error;
};

// ── Callback types ──
using SendCallback = std::function<void(
    const uint8_t*, size_t)>;

using ExecuteTradeCallback = std::function<void(
    const std::string& symbol,
    const std::string& direction,
    double volume, double price,
    double sl, double tp,
    std::function<void(TradeResult)> callback)>;

using ClosePositionCallback = std::function<void(
    int64_t ticket,
    std::function<void(TradeResult)> callback)>;

using CloseAllCallback = std::function<void(
    std::function<void(TradeResult)> callback)>;

using ModifyPositionCallback = std::function<void(
    int64_t ticket, double sl, double tp,
    std::function<void(TradeResult)> callback)>;

class TradeHandler {
private:
    ExecuteTradeCallback   execute_trade_cb;
    ClosePositionCallback  close_position_cb;
    CloseAllCallback       close_all_cb;
    ModifyPositionCallback modify_position_cb;

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
    double parseOptional(const std::string& val) const {
        if (val.empty() || val == "0" || val == "None")
            return 0.0;
        try { return std::stod(val); }
        catch (...) { return 0.0; }
    }

    // ── Send FlatBuffer helper ──
    void send(
        SendCallback& cb,
        flatbuffers::DetachedBuffer buf)
    {
        if (cb && buf.size() > 0) {
            cb(buf.data(), buf.size());
        }
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
    // ================================================================
    void handleTradeCommand(
        const std::string& message,
        SendCallback send_cb)
    {
        auto parts = split(message, '_');
        if (parts.size() < 5) {
            send(send_cb, FBB::buildError(
                "Invalid format. Use: TRADE_BUY_EURUSD_0.01_1.0850"
            ));
            return;
        }
        try {
            std::string direction = parts[1];
            std::string symbol    = parts[2];
            double      volume    = std::stod(parts[3]);
            double      price     = std::stod(parts[4]);
            double      sl = parts.size() > 5
                ? parseOptional(parts[5]) : 0.0;
            double      tp = parts.size() > 6
                ? parseOptional(parts[6]) : 0.0;

            if (!execute_trade_cb) {
                send(send_cb, FBB::buildError(
                    "Trade executor not configured"
                ));
                return;
            }

            execute_trade_cb(
                symbol, direction, volume, price, sl, tp,
                [send_cb](TradeResult r) {
                    if (r.success) {
                        auto buf = FBB::buildTradeExecuted(
                            true,
                            r.direction,
                            r.symbol,
                            r.volume,
                            r.price,
                            r.ticket,
                            r.timestamp,
                            r.message
                        );
                        if (send_cb && buf.size() > 0)
                            send_cb(buf.data(), buf.size());
                    } else {
                        auto buf = FBB::buildTradeExecuted(
                            false, "", "", 0, 0, 0, 0, r.error
                        );
                        if (send_cb && buf.size() > 0)
                            send_cb(buf.data(), buf.size());
                    }
                }
            );

        } catch (const std::exception& e) {
            send(send_cb, FBB::buildError(
                std::string("Parse error: ") + e.what()
            ));
        }
    }

    // ================================================================
    // HANDLE CLOSE POSITION
    // Format: CLOSE_POSITION_123456
    // ================================================================
    void handleClosePosition(
        const std::string& message,
        SendCallback send_cb)
    {
        auto parts = split(message, '_');
        if (parts.size() < 3) {
            send(send_cb, FBB::buildError(
                "Invalid format. Use: CLOSE_POSITION_ticket"
            ));
            return;
        }
        try {
            int64_t ticket = std::stoll(parts[2]);

            if (!close_position_cb) {
                send(send_cb, FBB::buildError(
                    "Close callback not configured"
                ));
                return;
            }

            close_position_cb(ticket, [send_cb](TradeResult r) {
                auto buf = FBB::buildPositionClosed(
                    r.success,
                    r.ticket,
                    r.success ? r.message : r.error
                );
                if (send_cb && buf.size() > 0)
                    send_cb(buf.data(), buf.size());
            });

        } catch (const std::exception& e) {
            send(send_cb, FBB::buildError(
                std::string("Parse error: ") + e.what()
            ));
        }
    }

    // ================================================================
    // HANDLE CLOSE ALL
    // ================================================================
    void handleCloseAll(SendCallback send_cb) {
        if (!close_all_cb) {
            send(send_cb, FBB::buildError(
                "Close all callback not configured"
            ));
            return;
        }

        close_all_cb([send_cb](TradeResult r) {
            auto buf = FBB::buildPositionClosed(
                r.success, 0, r.message
            );
            if (send_cb && buf.size() > 0)
                send_cb(buf.data(), buf.size());
        });
    }

    // ================================================================
    // HANDLE MODIFY POSITION
    // Format: MODIFY_POSITION_ticket_sl_tp
    // ================================================================
    void handleModifyPosition(
        const std::string& message,
        SendCallback send_cb)
    {
        auto parts = split(message, '_');
        if (parts.size() < 5) {
            send(send_cb, FBB::buildError(
                "Invalid format. Use: MODIFY_POSITION_ticket_sl_tp"
            ));
            return;
        }
        try {
            int64_t ticket = std::stoll(parts[2]);
            double  sl     = parseOptional(parts[3]);
            double  tp     = parseOptional(parts[4]);

            if (!modify_position_cb) {
                send(send_cb, FBB::buildError(
                    "Modify callback not configured"
                ));
                return;
            }

            modify_position_cb(ticket, sl, tp,
                [send_cb](TradeResult r) {
                    auto buf = FBB::buildPositionModified(
                        r.success,
                        r.ticket,
                        r.success ? r.message : r.error
                    );
                    if (send_cb && buf.size() > 0)
                        send_cb(buf.data(), buf.size());
                }
            );

        } catch (const std::exception& e) {
            send(send_cb, FBB::buildError(
                std::string("Parse error: ") + e.what()
            ));
        }
    }
};

inline TradeHandler trade_handler;
