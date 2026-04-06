// ================================================================
// FLATBUFFER_BUILDER.HPP - FlatBuffers Message Builder
// Replaces all JSON string builders in:
//   broadcast_manager.hpp — tick, bar, positions, connection
//   connector_bridge.hpp  — positions, connection
//   trade_handler.hpp     — trade results
// All functions return flatbuffers::DetachedBuffer
// Caller sends via ws->send(buf.data(), buf.size(), BINARY)
// ================================================================

#pragma once
#include <string>
#include <vector>
#include <flatbuffers/flatbuffers.h>
#include "generated/mega_flowz_generated.h"
#include "candle.hpp"

namespace FBB {

// ================================================================
// TIMEFRAME STRING → ENUM
// ================================================================

inline MegaFlowz::Timeframe toTFEnum(const std::string& tf) {
    if (tf == "M1")  return MegaFlowz::Timeframe_M1;
    if (tf == "M5")  return MegaFlowz::Timeframe_M5;
    if (tf == "M15") return MegaFlowz::Timeframe_M15;
    if (tf == "H1")  return MegaFlowz::Timeframe_H1;
    if (tf == "H4")  return MegaFlowz::Timeframe_H4;
    if (tf == "D1")  return MegaFlowz::Timeframe_D1;
    return MegaFlowz::Timeframe_M1;
}

// ================================================================
// POSITION TYPE INT → ENUM
// ================================================================

inline MegaFlowz::PositionType toPosType(int type_int) {
    return type_int == 0
        ? MegaFlowz::PositionType_Buy
        : MegaFlowz::PositionType_Sell;
}

// ================================================================
// DIRECTION STRING → ENUM
// ================================================================

inline MegaFlowz::PositionType toDirectionEnum(
    const std::string& direction)
{
    return direction == "BUY"
        ? MegaFlowz::PositionType_Buy
        : MegaFlowz::PositionType_Sell;
}

// ================================================================
// CANDLE STRUCT — inline, zero allocation
// ================================================================

inline MegaFlowz::Candle toFBCandle(const Candle& c) {
    return MegaFlowz::Candle(
        c.time,
        c.open,
        c.high,
        c.low,
        c.close,
        c.volume
    );
}

// ================================================================
// INITIAL DATA — 1000 candle burst
// ================================================================

inline flatbuffers::DetachedBuffer buildInitialData(
    const std::string& symbol,
    const std::string& timeframe,
    const CandleBuffer& candles)
{
    flatbuffers::FlatBufferBuilder fbb(
        512 + candles.size() * sizeof(MegaFlowz::Candle)
    );

    auto sym_off = fbb.CreateString(symbol);

    std::vector<MegaFlowz::Candle> fb_candles;
    fb_candles.reserve(candles.size());
    for (const auto& c : candles) {
        fb_candles.push_back(toFBCandle(c));
    }
    auto candles_off = fbb.CreateVectorOfStructs(fb_candles);

    auto initial = MegaFlowz::CreateInitialData(
        fbb,
        sym_off,
        toTFEnum(timeframe),
        candles_off
    );

    auto msg = MegaFlowz::CreateMessage(
        fbb,
        MegaFlowz::MessagePayload_InitialData,
        initial.Union()
    );

    fbb.Finish(msg);
    return fbb.Release();
}

// ================================================================
// BAR UPDATE — live candle push
// ================================================================

inline flatbuffers::DetachedBuffer buildBarUpdate(
    const std::string& symbol,
    const std::string& timeframe,
    const Candle& candle)
{
    flatbuffers::FlatBufferBuilder fbb(256);

    auto sym_off  = fbb.CreateString(symbol);
    auto fb_candle = toFBCandle(candle);

    auto update = MegaFlowz::CreateBarUpdate(
        fbb,
        sym_off,
        toTFEnum(timeframe),
        &fb_candle
    );

    auto msg = MegaFlowz::CreateMessage(
        fbb,
        MegaFlowz::MessagePayload_BarUpdate,
        update.Union()
    );

    fbb.Finish(msg);
    return fbb.Release();
}

// ================================================================
// PRICE UPDATE — tick bid/ask for active chart
// ================================================================

inline flatbuffers::DetachedBuffer buildPriceUpdate(
    const std::string& symbol,
    double bid, double ask,
    double spread, int64_t time_msc)
{
    flatbuffers::FlatBufferBuilder fbb(256);

    auto sym_off = fbb.CreateString(symbol);

    auto price = MegaFlowz::CreatePriceUpdate(
        fbb,
        sym_off,
        bid,
        ask,
        spread,
        time_msc
    );

    auto msg = MegaFlowz::CreateMessage(
        fbb,
        MegaFlowz::MessagePayload_PriceUpdate,
        price.Union()
    );

    fbb.Finish(msg);
    return fbb.Release();
}

// ================================================================
// WATCHLIST UPDATE — one symbol per tick
// ================================================================

inline flatbuffers::DetachedBuffer buildWatchlistUpdate(
    const std::string& symbol,
    double bid, double ask,
    double spread, int64_t time_msc,
    double change_pct)
{
    flatbuffers::FlatBufferBuilder fbb(256);

    auto sym_off = fbb.CreateString(symbol);

    auto wl = MegaFlowz::CreateWatchlistUpdate(
        fbb,
        sym_off,
        bid,
        ask,
        spread,
        time_msc,
        change_pct
    );

    auto msg = MegaFlowz::CreateMessage(
        fbb,
        MegaFlowz::MessagePayload_WatchlistUpdate,
        wl.Union()
    );

    fbb.Finish(msg);
    return fbb.Release();
}

// ================================================================
// POSITIONS UPDATE — Thread 3 push
// ================================================================

struct RawPosition {
    int64_t     ticket;
    std::string symbol;
    int         type;
    double      volume;
    double      open_price;
    double      current_price;
    double      sl;
    double      tp;
    double      profit;
    double      swap;
    double      commission;
    int64_t     open_time;
};

struct RawAccount {
    double balance;
    double equity;
    double margin;
    double free_margin;
    double margin_level;
    int32_t leverage;
};

inline flatbuffers::DetachedBuffer buildPositionsUpdate(
    const std::vector<RawPosition>& positions,
    const RawAccount* account)
{
    flatbuffers::FlatBufferBuilder fbb(
        512 + positions.size() * 128
    );

    // ── Build position vector ──
    std::vector<flatbuffers::Offset<MegaFlowz::Position>> pos_offsets;
    pos_offsets.reserve(positions.size());

    for (const auto& p : positions) {
        auto sym_off = fbb.CreateString(p.symbol);
        auto pos = MegaFlowz::CreatePosition(
            fbb,
            p.ticket,
            sym_off,
            toPosType(p.type),
            p.volume,
            p.open_price,
            p.current_price,
            p.sl,
            p.tp,
            p.profit,
            p.swap,
            p.commission,
            p.open_time
        );
        pos_offsets.push_back(pos);
    }

    auto positions_off = fbb.CreateVector(pos_offsets);

    // ── Build account ──
    flatbuffers::Offset<MegaFlowz::Account> account_off = 0;
    if (account) {
        account_off = MegaFlowz::CreateAccount(
            fbb,
            account->balance,
            account->equity,
            account->margin,
            account->free_margin,
            account->margin_level,
            account->leverage
        );
    }

    auto pu = MegaFlowz::CreatePositionsUpdate(
        fbb,
        positions_off,
        account_off
    );

    auto msg = MegaFlowz::CreateMessage(
        fbb,
        MegaFlowz::MessagePayload_PositionsUpdate,
        pu.Union()
    );

    fbb.Finish(msg);
    return fbb.Release();
}

// ================================================================
// CONNECTION STATUS
// ================================================================

inline flatbuffers::DetachedBuffer buildConnectionStatus(
    bool connected,
    const std::string& status_text)
{
    flatbuffers::FlatBufferBuilder fbb(128);

    auto text_off = fbb.CreateString(status_text);

    auto cs = MegaFlowz::CreateConnectionStatus(
        fbb,
        connected,
        text_off
    );

    auto msg = MegaFlowz::CreateMessage(
        fbb,
        MegaFlowz::MessagePayload_ConnectionStatus,
        cs.Union()
    );

    fbb.Finish(msg);
    return fbb.Release();
}

// ================================================================
// TRADE EXECUTED
// ================================================================

inline flatbuffers::DetachedBuffer buildTradeExecuted(
    bool success,
    const std::string& direction,
    const std::string& symbol,
    double volume, double price,
    int64_t ticket, int64_t timestamp,
    const std::string& message)
{
    flatbuffers::FlatBufferBuilder fbb(256);

    auto sym_off = fbb.CreateString(symbol);
    auto msg_off = fbb.CreateString(message);

    auto te = MegaFlowz::CreateTradeExecuted(
        fbb,
        success,
        toDirectionEnum(direction),
        sym_off,
        volume,
        price,
        ticket,
        timestamp,
        msg_off
    );

    auto msg = MegaFlowz::CreateMessage(
        fbb,
        MegaFlowz::MessagePayload_TradeExecuted,
        te.Union()
    );

    fbb.Finish(msg);
    return fbb.Release();
}

// ================================================================
// POSITION CLOSED
// ================================================================

inline flatbuffers::DetachedBuffer buildPositionClosed(
    bool success,
    int64_t ticket,
    const std::string& message)
{
    flatbuffers::FlatBufferBuilder fbb(128);

    auto msg_off = fbb.CreateString(message);

    auto pc = MegaFlowz::CreatePositionClosed(
        fbb,
        success,
        ticket,
        msg_off
    );

    auto msg = MegaFlowz::CreateMessage(
        fbb,
        MegaFlowz::MessagePayload_PositionClosed,
        pc.Union()
    );

    fbb.Finish(msg);
    return fbb.Release();
}

// ================================================================
// POSITION MODIFIED
// ================================================================

inline flatbuffers::DetachedBuffer buildPositionModified(
    bool success,
    int64_t ticket,
    const std::string& message)
{
    flatbuffers::FlatBufferBuilder fbb(128);

    auto msg_off = fbb.CreateString(message);

    auto pm = MegaFlowz::CreatePositionModified(
        fbb,
        success,
        ticket,
        msg_off
    );

    auto msg = MegaFlowz::CreateMessage(
        fbb,
        MegaFlowz::MessagePayload_PositionModified,
        pm.Union()
    );

    fbb.Finish(msg);
    return fbb.Release();
}

// ================================================================
// ERROR
// ================================================================

inline flatbuffers::DetachedBuffer buildError(
    const std::string& message)
{
    flatbuffers::FlatBufferBuilder fbb(128);

    auto msg_off = fbb.CreateString(message);

    auto err = MegaFlowz::CreateErrorMsg(fbb, msg_off);

    auto msg = MegaFlowz::CreateMessage(
        fbb,
        MegaFlowz::MessagePayload_ErrorMsg,
        err.Union()
    );

    fbb.Finish(msg);
    return fbb.Release();
}

// ================================================================
// AUTO TRADING STATUS
// ================================================================

inline flatbuffers::DetachedBuffer buildAutoTradingStatus(
    bool enabled,
    const std::string& message)
{
    flatbuffers::FlatBufferBuilder fbb(128);

    auto msg_off = fbb.CreateString(message);

    auto at = MegaFlowz::CreateAutoTradingStatus(
        fbb,
        enabled,
        msg_off
    );

    auto msg = MegaFlowz::CreateMessage(
        fbb,
        MegaFlowz::MessagePayload_AutoTradingStatus,
        at.Union()
    );

    fbb.Finish(msg);
    return fbb.Release();
}

// ================================================================
// CACHE CLEARED
// ================================================================

inline flatbuffers::DetachedBuffer buildCacheCleared(
    const std::string& message)
{
    flatbuffers::FlatBufferBuilder fbb(128);

    auto msg_off = fbb.CreateString(message);

    auto cc = MegaFlowz::CreateCacheCleared(fbb, msg_off);

    auto msg = MegaFlowz::CreateMessage(
        fbb,
        MegaFlowz::MessagePayload_CacheCleared,
        cc.Union()
    );

    fbb.Finish(msg);
    return fbb.Release();
}

// ================================================================
// PONG
// ================================================================

inline flatbuffers::DetachedBuffer buildPong() {
    return buildCacheCleared("pong");
}

} // namespace FBB
