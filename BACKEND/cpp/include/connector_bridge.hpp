// ================================================================
// CONNECTOR_BRIDGE.HPP - Python MT5 Bridge
// Calls Python connector.py via pybind11
// ================================================================

#pragma once
#include <string>
#include <vector>
#include <iostream>
#include <mutex>
#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include "candle.hpp"
#include "trade_handler.hpp"

namespace py = pybind11;

class ConnectorBridge {
private:
    py::object connector;
    bool       initialized = false;
    std::mutex mtx;

    std::string dbl(double v) const {
        return std::to_string(v);
    }

    std::string optDbl(py::object val) const {
        try {
            if (val.is_none()) return "null";
            double v = val.cast<double>();
            if (v == 0.0) return "null";
            return std::to_string(v);
        } catch (...) { return "null"; }
    }

public:

    bool initialize() {
        try {
            py::gil_scoped_acquire gil;
            py::module_ sys = py::module_::import("sys");
            sys.attr("path").attr("append")(
                "C:/Users/mega/mega_env/BACKEND"
            );
            connector   = py::module_::import("connector").attr("connector");
            initialized = true;
            std::cout << "ConnectorBridge initialized" << std::endl;
            return true;
        } catch (const py::error_already_set& e) {
            std::cerr << "ConnectorBridge init error: " << e.what() << std::endl;
            return false;
        }
    }

    bool connect() {
        if (!initialized) return false;
        try {
            py::gil_scoped_acquire gil;
            return connector.attr("connect")().cast<bool>();
        } catch (...) { return false; }
    }

    // ── Initial candles ──
    CandleBuffer getInitialCandles(
        const std::string& symbol,
        const std::string& detected,
        const std::string& timeframe,
        int count)
    {
        CandleBuffer buffer;
        if (!initialized) return buffer;
        try {
            py::gil_scoped_acquire gil;
            py::object result = connector.attr("get_initial_candles")(
                symbol, detected, timeframe, count
            );
            py::list candles = result.attr("__getitem__")(0).cast<py::list>();
            for (auto& item : candles) {
                py::dict d = item.cast<py::dict>();
                Candle c;
                c.time   = d["time"].cast<int64_t>();
                c.open   = d["open"].cast<double>();
                c.high   = d["high"].cast<double>();
                c.low    = d["low"].cast<double>();
                c.close  = d["close"].cast<double>();
                c.volume = d["volume"].cast<int64_t>();
                buffer.push_back(c);
            }
        } catch (const py::error_already_set& e) {
            std::cerr << "getInitialCandles error: " << e.what() << std::endl;
        }
        return buffer;
    }

    // ── M1 candle update — anchor for all TF recompute ──
    Candle getCandleUpdate(const std::string& detected) {
        Candle empty;
        if (!initialized) return empty;
        try {
            py::gil_scoped_acquire gil;
            py::object result = connector.attr("get_candle_update")(detected);
            if (result.is_none()) return empty;
            py::dict d = result.cast<py::dict>();
            Candle c;
            c.time   = d["time"].cast<int64_t>();
            c.open   = d["open"].cast<double>();
            c.high   = d["high"].cast<double>();
            c.low    = d["low"].cast<double>();
            c.close  = d["close"].cast<double>();
            c.volume = d["volume"].cast<int64_t>();
            return c;
        } catch (...) { return empty; }
    }

    // ── Watchlist prices — batch fetch + change % ──
    std::string getWatchlistPrices(
        const std::vector<std::string>& symbols)
    {
        if (!initialized || symbols.empty()) return "{}";
        try {
            py::gil_scoped_acquire gil;

            py::list sym_list;
            for (const auto& s : symbols) sym_list.append(s);

            py::dict prices = connector.attr("get_watchlist_prices")(
                sym_list
            ).cast<py::dict>();

            std::string json = "{\"type\":\"watchlist_update\",\"prices\":{";
            bool first = true;

            for (auto& item : prices) {
                if (!first) json += ",";
                std::string sym = item.first.cast<std::string>();
                py::dict    p   = item.second.cast<py::dict>();

                json += "\"" + sym + "\":{";
                json += "\"bid\":"    + dbl(p["bid"].cast<double>())    + ",";
                json += "\"ask\":"    + dbl(p["ask"].cast<double>())    + ",";
                json += "\"spread\":" + dbl(p["spread"].cast<double>()) + ",";
                json += "\"time\":"   + std::to_string(p["time"].cast<int64_t>()) + ",";
                json += "\"change\":" + dbl(p["change"].cast<double>());
                json += "}";
                first = false;
            }

            json += "}}";
            return json;

        } catch (...) { return "{}"; }
    }

    // ── Current price — active chart symbol ──
    std::string getCurrentPrice(
        const std::string& symbol,
        const std::string& detected)
    {
        if (!initialized) return "";
        try {
            py::gil_scoped_acquire gil;
            py::object result = connector.attr("get_current_price_with_symbol")(
                symbol, detected
            );
            if (result.is_none()) return "";
            py::dict d = result.cast<py::dict>();
            std::string json = "{";
            json += "\"type\":\"price_update\",";
            json += "\"symbol\":\"" + symbol + "\",";
            json += "\"bid\":"    + dbl(d["bid"].cast<double>())    + ",";
            json += "\"ask\":"    + dbl(d["ask"].cast<double>())    + ",";
            json += "\"spread\":" + dbl(d["spread"].cast<double>()) + ",";
            json += "\"time\":"   + std::to_string(d["time"].cast<int64_t>());
            json += "}";
            return json;
        } catch (...) { return ""; }
    }

    // ================================================================
    // POSITIONS + ACCOUNT COMBINED
    // Single GIL acquire — no contention
    // Returns positions_update with embedded account info
    // ================================================================
    std::string getPositionsAndAccount() {
        if (!initialized) {
            return "{\"type\":\"positions_update\","
                   "\"positions\":[],"
                   "\"account\":null}";
        }
        try {
            py::gil_scoped_acquire gil;

            // ── Single Python call — one GIL acquire ──
            py::dict result = connector.attr("get_positions_and_account")()
                .cast<py::dict>();

            py::list positions = result["positions"].cast<py::list>();
            py::object account = result["account"];

            // ── Build positions array ──
            std::string json = "{\"type\":\"positions_update\",\"positions\":[";
            bool first = true;

            for (auto& item : positions) {
                if (!first) json += ",";
                py::dict p = item.cast<py::dict>();
                json += "{";
                json += "\"ticket\":"        + std::to_string(p["ticket"].cast<int64_t>())   + ",";
                json += "\"symbol\":\""      + p["symbol"].cast<std::string>()                + "\",";
                json += "\"type\":\""        + p["type"].cast<std::string>()                  + "\",";
                json += "\"volume\":"        + dbl(p["volume"].cast<double>())                + ",";
                json += "\"open_price\":"    + dbl(p["open_price"].cast<double>())            + ",";
                json += "\"current_price\":" + dbl(p["current_price"].cast<double>())         + ",";
                json += "\"sl\":"            + optDbl(p["sl"])                                + ",";
                json += "\"tp\":"            + optDbl(p["tp"])                                + ",";
                json += "\"profit\":"        + dbl(p["profit"].cast<double>())                + ",";
                json += "\"swap\":"          + dbl(p["swap"].cast<double>())                  + ",";
                json += "\"open_time\":"     + std::to_string(p["open_time"].cast<int64_t>());
                json += "}";
                first = false;
            }

            json += "]";

            // ── Build account object ──
            if (!account.is_none()) {
                py::dict a = account.cast<py::dict>();
                json += ",\"account\":{";
                json += "\"balance\":"      + dbl(a["balance"].cast<double>())      + ",";
                json += "\"equity\":"       + dbl(a["equity"].cast<double>())       + ",";
                json += "\"margin\":"       + dbl(a["margin"].cast<double>())       + ",";
                json += "\"free_margin\":"  + dbl(a["free_margin"].cast<double>())  + ",";
                json += "\"margin_level\":" + dbl(a["margin_level"].cast<double>()) + ",";
                json += "\"leverage\":"     + std::to_string(a["leverage"].cast<int>());
                json += "}";
            } else {
                json += ",\"account\":null";
            }

            json += "}";
            return json;

        } catch (const py::error_already_set& e) {
            std::cerr << "getPositionsAndAccount error: " << e.what() << std::endl;
            return "{\"type\":\"positions_update\","
                   "\"positions\":[],"
                   "\"account\":null}";
        }
    }

    // ── Account info — standalone ──
    std::string getAccountInfo() {
        if (!initialized) return "";
        try {
            py::gil_scoped_acquire gil;
            py::object result = connector.attr("get_account_info")();
            if (result.is_none()) return "";
            py::dict d = result.cast<py::dict>();
            std::string json = "{\"type\":\"account_info\",\"account\":{";
            json += "\"balance\":"      + dbl(d["balance"].cast<double>())      + ",";
            json += "\"equity\":"       + dbl(d["equity"].cast<double>())       + ",";
            json += "\"margin\":"       + dbl(d["margin"].cast<double>())       + ",";
            json += "\"free_margin\":"  + dbl(d["free_margin"].cast<double>())  + ",";
            json += "\"margin_level\":" + dbl(d["margin_level"].cast<double>()) + ",";
            json += "\"leverage\":"     + std::to_string(d["leverage"].cast<int>());
            json += "}}";
            return json;
        } catch (...) { return ""; }
    }

    // ── Execute trade ──
    TradeResult executeTrade(
        const std::string& symbol,
        const std::string& direction,
        double volume,
        double price,
        double sl,
        double tp)
    {
        TradeResult result;
        if (!initialized) {
            result.error = "Bridge not initialized";
            return result;
        }
        try {
            py::gil_scoped_acquire gil;
            py::object r = connector.attr("execute_trade")(
                symbol, direction, volume, price,
                tp > 0 ? py::cast(tp) : py::none(),
                sl > 0 ? py::cast(sl) : py::none()
            );
            py::dict d = r.cast<py::dict>();
            result.success = d["success"].cast<bool>();
            if (result.success) {
                result.direction = direction;
                result.symbol    = symbol;
                result.volume    = volume;
                result.price     = d["price"].cast<double>();
                result.ticket    = d["ticket"].cast<int64_t>();
                result.timestamp = d["timestamp"].cast<int64_t>();
                result.message   = d["message"].cast<std::string>();
            } else {
                result.error = d["error"].cast<std::string>();
            }
        } catch (const py::error_already_set& e) {
            result.error = e.what();
            std::cerr << "executeTrade error: " << e.what() << std::endl;
        }
        return result;
    }

    // ── Close position ──
    TradeResult closePosition(int64_t ticket) {
        TradeResult result;
        if (!initialized) {
            result.error = "Bridge not initialized";
            return result;
        }
        try {
            py::gil_scoped_acquire gil;
            py::dict d = connector.attr("close_position")(ticket).cast<py::dict>();
            result.success = d["success"].cast<bool>();
            result.message = result.success
                ? d["message"].cast<std::string>()
                : d["error"].cast<std::string>();
        } catch (const py::error_already_set& e) {
            result.error = e.what();
        }
        return result;
    }

    // ── Close all positions ──
    TradeResult closeAllPositions() {
        TradeResult result;
        if (!initialized) {
            result.error = "Bridge not initialized";
            return result;
        }
        try {
            py::gil_scoped_acquire gil;
            py::dict d = connector.attr("close_all_positions")().cast<py::dict>();
            result.success = d["success"].cast<bool>();
            result.message = d["message"].cast<std::string>();
        } catch (const py::error_already_set& e) {
            result.error = e.what();
        }
        return result;
    }

    // ── Modify position ──
    TradeResult modifyPosition(int64_t ticket, double sl, double tp) {
        TradeResult result;
        if (!initialized) {
            result.error = "Bridge not initialized";
            return result;
        }
        try {
            py::gil_scoped_acquire gil;
            py::dict d = connector.attr("modify_position")(
                ticket,
                sl > 0 ? py::cast(sl) : py::none(),
                tp > 0 ? py::cast(tp) : py::none()
            ).cast<py::dict>();
            result.success = d["success"].cast<bool>();
            result.message = result.success
                ? d["message"].cast<std::string>()
                : d["error"].cast<std::string>();
        } catch (const py::error_already_set& e) {
            result.error = e.what();
            std::cerr << "modifyPosition error: " << e.what() << std::endl;
        }
        return result;
    }

    // ── Check connection ──
    std::string checkConnection() {
        if (!initialized) {
            return "{\"type\":\"connection_status\","
                   "\"data\":{\"mt5_connected\":false,"
                   "\"status_text\":\"Bridge not initialized\"}}";
        }
        try {
            py::gil_scoped_acquire gil;
            py::dict d = connector.attr("check_mt5_connection")().cast<py::dict>();
            bool connected = d["mt5_connected"].cast<bool>();
            std::string status = d["status_text"].cast<std::string>();
            return "{\"type\":\"connection_status\","
                   "\"data\":{\"mt5_connected\":"
                   + std::string(connected ? "true" : "false")
                   + ",\"status_text\":\"" + status + "\"}}";
        } catch (...) {
            return "{\"type\":\"connection_status\","
                   "\"data\":{\"mt5_connected\":false,"
                   "\"status_text\":\"Error\"}}";
        }
    }

    // ── Auto detect symbol ──
    std::string autoDetectSymbol(const std::string& symbol) {
        if (!initialized) return "";
        try {
            py::gil_scoped_acquire gil;
            py::object result = connector.attr("auto_detect_symbol")(symbol);
            if (result.is_none()) return "";
            return result.cast<std::string>();
        } catch (...) { return ""; }
    }

    bool isInitialized() const { return initialized; }
};

inline ConnectorBridge connector_bridge;