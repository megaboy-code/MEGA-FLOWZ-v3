# ===============================================================
# CONNECTOR.PY - MT5 Interface
# ===============================================================

import MetaTrader5 as mt5
from datetime import datetime
from typing import Optional, Dict, List, Tuple
import time
import config


# ===============================================================
# TIMEFRAME MAP - Single source of truth
# ===============================================================

TF_MAP = {
    'M1':  (mt5.TIMEFRAME_M1,  1),
    'M5':  (mt5.TIMEFRAME_M5,  5),
    'M15': (mt5.TIMEFRAME_M15, 15),
    'H1':  (mt5.TIMEFRAME_H1,  60),
    'H4':  (mt5.TIMEFRAME_H4,  240),
    'D1':  (mt5.TIMEFRAME_D1,  1440),
}


class MT5Connector:

    def __init__(self):
        self.connected          = False
        self.available_symbols  = []
        self.utc_offset         = 0
        self.symbol_cache       = {}
        self._daily_open_cache  = {}  # symbol → (open_price, timestamp)

    # ======================
    # CONNECTION MANAGEMENT
    # ======================

    def connect(self) -> bool:
        if not mt5.initialize():
            return False

        self.connected = True
        symbols = mt5.symbols_get()
        if symbols:
            self.available_symbols = [s.name for s in symbols]

        local = datetime.now()
        utc   = datetime.utcnow()
        self.utc_offset = (local - utc).total_seconds() / 3600

        return True

    def disconnect(self):
        if self.connected:
            mt5.shutdown()
            self.connected = False

    # ======================
    # BROKER STATUS CHECKING
    # ======================

    def check_mt5_connection(self) -> Dict:
        if not self.connected:
            return {
                'mt5_connected': False,
                'status_text':   'Connector not initialized',
                'timestamp':     datetime.utcnow().isoformat()
            }
        try:
            info = mt5.terminal_info()
            if info is None:
                return {
                    'mt5_connected': False,
                    'status_text':   'MT5 terminal not responding',
                    'timestamp':     datetime.utcnow().isoformat()
                }
            is_connected = info.connected
            return {
                'mt5_connected': is_connected,
                'status_text':   'Connected' if is_connected else 'Disconnected',
                'server':        info.server if hasattr(info, 'server') else 'Unknown',
                'timestamp':     datetime.utcnow().isoformat()
            }
        except Exception as e:
            return {
                'mt5_connected': False,
                'status_text':   f'MT5 connection error: {str(e)}',
                'timestamp':     datetime.utcnow().isoformat()
            }

    def _check_broker_connection(self, symbol: str) -> bool:
        if not self.connected:
            return False
        try:
            info = mt5.terminal_info()
            if info is None or not info.connected:
                return False
            tick = mt5.symbol_info_tick(symbol)
            return tick is not None
        except Exception:
            return False

    def _check_broker_connection_terminal(self) -> bool:
        if not self.connected:
            return False
        try:
            info = mt5.terminal_info()
            return info is not None and info.connected
        except Exception:
            return False

    # ======================
    # AUTO SYMBOL DETECTION
    # ======================

    def auto_detect_symbol(self, base_symbol: str) -> Optional[str]:
        if not self.connected:
            return None

        if base_symbol in self.symbol_cache:
            return self.symbol_cache[base_symbol]

        base = base_symbol.upper().replace('/', '')

        if base in self.available_symbols:
            mt5.symbol_select(base, True)
            self.symbol_cache[base_symbol] = base
            return base

        for symbol in self.available_symbols:
            if base in symbol:
                mt5.symbol_select(symbol, True)
                self.symbol_cache[base_symbol] = symbol
                return symbol

        common_modifiers = ['M', 'C', 'PRO', 'MICRO', 'MINI', 'CFD', '_', '.', ' ']
        for symbol in self.available_symbols:
            clean_symbol = symbol
            for mod in common_modifiers:
                clean_symbol = clean_symbol.replace(mod, '')
            if base == clean_symbol:
                mt5.symbol_select(symbol, True)
                self.symbol_cache[base_symbol] = symbol
                return symbol

        for symbol in self.available_symbols:
            if len(base) > 3 and base in symbol[:len(base) + 2]:
                mt5.symbol_select(symbol, True)
                self.symbol_cache[base_symbol] = symbol
                return symbol

        return None

    def get_cached_symbol(self, base_symbol: str) -> Optional[str]:
        if base_symbol in self.symbol_cache:
            return self.symbol_cache[base_symbol]
        return self.auto_detect_symbol(base_symbol)

    def clear_symbol_cache(self, symbol: str = None):
        if symbol:
            self.symbol_cache.pop(symbol, None)
        else:
            self.symbol_cache.clear()

    def clear_candle_cache(self, symbol: str = None, timeframe: str = None):
        self.clear_symbol_cache(symbol)

    # ======================
    # PRICE PRECISION
    # ======================

    def get_price_precision(self, symbol: str) -> int:
        symbol_upper = symbol.upper()
        for key, precision in config.SYMBOL_PRECISION.items():
            if key in symbol_upper:
                return precision
        return config.DEFAULT_PRECISION

    def round_price(self, symbol: str, price: float) -> float:
        if price is None:
            return 0.0
        precision = self.get_price_precision(symbol)
        return round(float(price), precision)

    # ======================
    # HELPER METHODS
    # ======================

    def bar(self, b, symbol: str = None) -> Dict:
        if symbol:
            precision = self.get_price_precision(symbol)
            return {
                "time":   int(b["time"]),
                "open":   round(float(b["open"]),  precision),
                "high":   round(float(b["high"]),  precision),
                "low":    round(float(b["low"]),   precision),
                "close":  round(float(b["close"]), precision),
                "volume": int(b["tick_volume"]) if "tick_volume" in b.dtype.names else 0
            }
        return {
            "time":   int(b["time"]),
            "open":   float(b["open"]),
            "high":   float(b["high"]),
            "low":    float(b["low"]),
            "close":  float(b["close"]),
            "volume": int(b["tick_volume"]) if "tick_volume" in b.dtype.names else 0
        }

    def _format_tick(self, tick, symbol: str = None) -> Dict:
        bid    = tick.bid
        ask    = tick.ask
        spread = tick.ask - tick.bid

        if symbol:
            precision = self.get_price_precision(symbol)
            bid    = round(bid,    precision)
            ask    = round(ask,    precision)
            spread = round(spread, precision)

        return {
            'bid':    bid,
            'ask':    ask,
            'last':   tick.last,
            'spread': spread,
            'time':   int(tick.time),
            'symbol': symbol
        }

    def _get_mt5_tf(self, timeframe: str) -> Optional[int]:
        entry = TF_MAP.get(timeframe.upper())
        return entry[0] if entry else None

    def _get_timeframe_minutes(self, timeframe: str) -> int:
        entry = TF_MAP.get(timeframe.upper())
        return entry[1] if entry else 60

    # ======================
    # WAKE-UP & FETCH PATTERN
    # ======================

    def _wake_up_mt5(self, symbol: str, mt5_tf: int, retries: int = 3) -> bool:
        mt5.symbol_select(symbol, True)
        for attempt in range(retries):
            try:
                wake_up_data = mt5.copy_rates_from_pos(symbol, mt5_tf, 0, 1)
                if wake_up_data is not None and len(wake_up_data) > 0:
                    return True
                print(f"   ⚠️ Wake-up attempt {attempt + 1} failed, retrying...")
                time.sleep(0.1)
            except Exception:
                time.sleep(0.1)
        return False

    def _calculate_handshake_delay(self, timeframe: str) -> float:
        tf_minutes = self._get_timeframe_minutes(timeframe)
        base_delay = max(0.05, (tf_minutes / 15) * 0.1)
        return min(0.3, base_delay)

    # ======================
    # INITIAL CANDLE FETCH
    # ======================

    def get_initial_candles(self, base_symbol: str, detected_symbol: str,
                            timeframe: str, count: int = None) -> Tuple[List[Dict], Optional[int]]:
        if not self.connected:
            return [], None

        if count is None:
            count = config.CANDLE_FETCH_COUNT

        mt5_tf = self._get_mt5_tf(timeframe)
        if not mt5_tf:
            return [], None

        mt5.symbol_select(detected_symbol, True)
        broker_tick = mt5.symbol_info_tick(detected_symbol)

        print(f"🔔 Waking up MT5 for {detected_symbol} {timeframe}...")

        if not self._wake_up_mt5(detected_symbol, mt5_tf):
            print(f"   ❌ MT5 wake-up failed after 3 attempts")

        delay = self._calculate_handshake_delay(timeframe)
        print(f"   ⏳ Handshake delay: {delay:.2f}s")
        time.sleep(delay)

        print(f"   📥 Fetching {count} candles...")
        rates = mt5.copy_rates_from_pos(detected_symbol, mt5_tf, 0, count)

        if rates is None or len(rates) == 0:
            print(f"   ❌ No data received")
            return [], None

        if len(rates) > count:
            rates = rates[-count:]

        candle_data    = [self.bar(r, detected_symbol) for r in rates]
        last_timestamp = candle_data[-1]['time'] if candle_data else None

        if broker_tick:
            print(f"   📊 Broker: {broker_tick.bid:.5f}/{broker_tick.ask:.5f} @ {broker_tick.time}")
        else:
            print(f"   ⚠️ Broker disconnected - showing historical data")

        if broker_tick and last_timestamp:
            tf_minutes     = self._get_timeframe_minutes(timeframe)
            gap_seconds    = broker_tick.time - last_timestamp
            max_acceptable = tf_minutes * 60 * 1.5

            if gap_seconds <= max_acceptable:
                print(f"✅ {detected_symbol} {timeframe}: {len(candle_data)} candles "
                      f"- Synced with Broker (gap: {gap_seconds / 60:.1f}min)")
            else:
                print(f"⚠️ {detected_symbol} {timeframe}: Data stale "
                      f"({gap_seconds / 60:.1f}min behind)")
        else:
            print(f"✅ {detected_symbol} {timeframe}: {len(candle_data)} candles - Historical data")

        return candle_data, last_timestamp

    # ======================
    # M1 CANDLE UPDATE
    # Always fetches M1 — anchor for all TF recompute
    # ======================

    def get_candle_update(self, detected_symbol: str) -> Optional[Dict]:
        """
        Fetch latest M1 candle.
        Always M1 — used as anchor to recompute all cached TFs.
        Symbol kept warm by price streaming — no wake up needed.
        """
        if not self.connected:
            return None

        rates = mt5.copy_rates_from_pos(
            detected_symbol,
            mt5.TIMEFRAME_M1,
            0, 1
        )

        if rates is None or len(rates) == 0:
            return None

        return self.bar(rates[0], detected_symbol)

    # ======================
    # DAILY OPEN CACHE
    # Used for watchlist change % calculation
    # Refreshed every hour
    # ======================

    def _get_daily_open(self, detected_symbol: str) -> float:
        """
        Get today's D1 open price.
        Cached per symbol — only fetches from MT5 once per hour.
        Zero extra MT5 calls after first fetch.
        """
        cache_key = f"daily_{detected_symbol}"
        now       = time.time()

        # ── Serve from cache if fresh ──
        if cache_key in self._daily_open_cache:
            price, timestamp = self._daily_open_cache[cache_key]
            if now - timestamp < 3600:  # 1 hour
                return price

        # ── Fetch from MT5 ──
        try:
            rates = mt5.copy_rates_from_pos(
                detected_symbol,
                mt5.TIMEFRAME_D1,
                0, 1
            )
            if rates is not None and len(rates) > 0:
                price = float(rates[0]['open'])
                self._daily_open_cache[cache_key] = (price, now)
                return price
        except Exception:
            pass

        return 0.0

    # ======================
    # WATCHLIST PRICES
    # Batch fetch — keeps symbols warm in MT5
    # Includes daily change % from cached D1 open
    # ======================

    def get_watchlist_prices(self, symbols: List[str]) -> Dict:
        """
        Fetch latest tick for each watchlist symbol.
        Keeps symbols warm in MT5 — prevents stale data.
        Includes change % from D1 open (cached — no extra MT5 calls).
        """
        if not self.connected:
            return {}

        result = {}
        for symbol in symbols:
            try:
                detected = self.get_cached_symbol(symbol)
                if not detected:
                    continue

                tick = mt5.symbol_info_tick(detected)
                if not tick:
                    continue

                precision  = self.get_price_precision(detected)
                daily_open = self._get_daily_open(detected)

                # ── Calculate daily change % ──
                change_pct = 0.0
                if daily_open > 0:
                    change_pct = round(
                        ((tick.bid - daily_open) / daily_open) * 100, 2
                    )

                result[symbol] = {
                    'bid':    round(tick.bid,            precision),
                    'ask':    round(tick.ask,            precision),
                    'spread': round(tick.ask - tick.bid, precision),
                    'time':   int(tick.time),
                    'change': change_pct,  # ✅ daily change %
                }
            except Exception:
                continue

        return result

    def get_current_price_with_symbol(self, base_symbol: str,
                                      detected_symbol: str) -> Optional[Dict]:
        """
        Get live bid/ask for active chart symbol.
        Used for buy/sell buttons, market depth, price display.
        """
        if not self.connected:
            return None

        tick = mt5.symbol_info_tick(detected_symbol)
        if not tick:
            return None

        return self._format_tick(tick, detected_symbol)

    # ======================
    # POSITIONS + ACCOUNT COMBINED
    # Single GIL acquire for both
    # Called every 500ms
    # ======================

    def get_positions_and_account(self) -> Dict:
        """
        Fetch positions and account info in one call.
        Single GIL acquire — no contention.
        Returns combined dict with positions and account.
        """
        return {
            'positions': self.get_positions(),
            'account':   self.get_account_info()
        }

    # ======================
    # ACCOUNT INFO
    # ======================

    def get_account_info(self) -> Optional[Dict]:
        if not self.connected:
            return None
        account = mt5.account_info()
        if not account:
            return None
        return {
            'balance':      round(account.balance,      2),
            'equity':       round(account.equity,       2),
            'margin':       round(account.margin,       2),
            'free_margin':  round(account.margin_free,  2),
            'margin_level': round(account.margin_level, 2),
            'currency':     account.currency,
            'server':       account.server,
            'leverage':     account.leverage
        }

    # ======================
    # POSITIONS
    # ======================

    def get_positions(self) -> List[Dict]:
        if not self.connected:
            return []

        positions = mt5.positions_get()
        if positions is None:
            return []

        result = []
        for pos in positions:
            precision     = self.get_price_precision(pos.symbol)
            current_price = round(pos.price_current, precision)

            result.append({
                'ticket':        pos.ticket,
                'symbol':        pos.symbol,
                'type':          'BUY' if pos.type == 0 else 'SELL',
                'volume':        pos.volume,
                'open_price':    round(pos.price_open,  precision),
                'current_price': current_price,
                'sl':            round(pos.sl, precision) if pos.sl and pos.sl > 0 else None,
                'tp':            round(pos.tp, precision) if pos.tp and pos.tp > 0 else None,
                'profit':        round(pos.profit,      2),
                'swap':          round(pos.swap,        2) if hasattr(pos, 'swap')       else 0,
                'commission':    round(pos.commission,  2) if hasattr(pos, 'commission') else 0,
                'open_time':     int(pos.time) if hasattr(pos, 'time') else 0
            })

        return result

    # ======================
    # TRADE EXECUTION
    # ======================

    def execute_trade(self, symbol: str, trade_type: str,
                      volume: float, price: float = 0,
                      tp: float = None, sl: float = None) -> Dict:
        if not self.connected:
            return {'success': False, 'error': 'Not connected to MT5'}

        detected = self.get_cached_symbol(symbol)
        if not detected:
            return {'success': False, 'error': f'Symbol {symbol} not found'}

        if not self._check_broker_connection(detected):
            return {'success': False, 'error': 'Broker disconnected, cannot execute trade'}

        if price == 0:
            tick = mt5.symbol_info_tick(detected)
            if not tick:
                return {'success': False, 'error': 'Failed to get price'}
            price = tick.ask if trade_type == 'BUY' else tick.bid

        request = {
            "action":       mt5.TRADE_ACTION_DEAL,
            "symbol":       detected,
            "volume":       volume,
            "type":         mt5.ORDER_TYPE_BUY if trade_type == 'BUY' else mt5.ORDER_TYPE_SELL,
            "price":        price,
            "sl":           sl if sl is not None else 0.0,
            "tp":           tp if tp is not None else 0.0,
            "deviation":    config.MT5_DEVIATION,
            "magic":        config.MT5_MAGIC,
            "comment":      config.TRADE_COMMENT,
            "type_time":    mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }

        try:
            result = mt5.order_send(request)
            if result is None:
                return {'success': False, 'error': 'order_send returned None'}
            if result.retcode != mt5.TRADE_RETCODE_DONE:
                return {
                    'success': False,
                    'error':   f'Trade failed: {result.comment}',
                    'retcode': result.retcode
                }
            return {
                'success':   True,
                'ticket':    result.order,
                'price':     self.round_price(detected, result.price),
                'volume':    result.volume,
                'symbol':    detected,
                'direction': trade_type,
                'timestamp': int(time.time()),
                'message':   f'Trade executed: {trade_type} {detected} {volume}L @ {result.price}'
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ======================
    # MODIFY POSITION
    # ======================

    def modify_position(self, ticket: int,
                        sl: float = None, tp: float = None) -> Dict:
        if not self.connected:
            return {'success': False, 'error': 'Not connected to MT5'}

        try:
            all_positions = mt5.positions_get()
            if all_positions is None:
                return {'success': False, 'error': 'Failed to get positions'}

            position = None
            for pos in all_positions:
                if pos.ticket == ticket:
                    position = pos
                    break

            if not position:
                return {'success': False, 'error': f'Position not found: {ticket}'}

            if not self._check_broker_connection(position.symbol):
                return {'success': False, 'error': 'Broker disconnected'}

            request = {
                "action":   mt5.TRADE_ACTION_SLTP,
                "symbol":   position.symbol,
                "position": ticket,
                "sl":       sl if sl is not None else position.sl,
                "tp":       tp if tp is not None else position.tp,
            }

            result = mt5.order_send(request)
            if result is None:
                return {'success': False, 'error': 'order_send returned None'}
            if result.retcode != mt5.TRADE_RETCODE_DONE:
                return {
                    'success': False,
                    'error':   f'Modify failed: {result.comment}',
                    'retcode': result.retcode
                }
            return {
                'success': True,
                'ticket':  ticket,
                'message': f'Position {ticket} modified. SL:{sl} TP:{tp}'
            }

        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ======================
    # CLOSE POSITION
    # ======================

    def close_position(self, ticket) -> Dict:
        if not self.connected:
            return {'success': False, 'error': 'Not connected to MT5'}

        try:
            ticket_int = int(ticket)
        except (ValueError, TypeError):
            return {'success': False, 'error': f'Invalid ticket format: {ticket}'}

        all_positions = mt5.positions_get()
        if all_positions is None:
            return {'success': False, 'error': 'Failed to get positions'}

        position = None
        for pos in all_positions:
            if pos.ticket == ticket_int:
                position = pos
                break

        if not position:
            return {'success': False, 'error': f'Position not found: {ticket_int}'}

        if not self._check_broker_connection(position.symbol):
            return {'success': False, 'error': 'Broker disconnected, cannot close position'}

        tick = mt5.symbol_info_tick(position.symbol)
        if not tick:
            return {'success': False, 'error': 'Failed to get current price'}

        if position.type == 0:
            close_price = tick.bid
            close_type  = mt5.ORDER_TYPE_SELL
        else:
            close_price = tick.ask
            close_type  = mt5.ORDER_TYPE_BUY

        request = {
            "action":       mt5.TRADE_ACTION_DEAL,
            "symbol":       position.symbol,
            "volume":       position.volume,
            "type":         close_type,
            "position":     position.ticket,
            "price":        close_price,
            "deviation":    config.MT5_DEVIATION,
            "magic":        config.MT5_MAGIC,
            "comment":      config.CLOSE_TRADE_COMMENT,
            "type_time":    mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }

        try:
            result = mt5.order_send(request)
            if result is None:
                return {'success': False, 'error': 'order_send returned None'}
            if result.retcode != mt5.TRADE_RETCODE_DONE:
                return {
                    'success': False,
                    'error':   f'Close failed: {result.comment} (retcode: {result.retcode})',
                    'retcode': result.retcode
                }
            profit = position.profit if hasattr(position, 'profit') else 0
            return {
                'success': True,
                'ticket':  ticket_int,
                'symbol':  position.symbol,
                'profit':  round(profit, 2),
                'message': f'Position {ticket_int} closed. P&L: ${profit:.2f}'
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ======================
    # CLOSE ALL POSITIONS
    # ======================

    def close_all_positions(self) -> Dict:
        if not self.connected:
            return {'success': False, 'error': 'Not connected to MT5'}

        if not self._check_broker_connection_terminal():
            return {'success': False, 'error': 'Broker disconnected, cannot close positions'}

        positions = mt5.positions_get()
        if positions is None:
            return {'success': False, 'error': 'Failed to get positions'}

        if len(positions) == 0:
            return {
                'success': True,
                'message': 'No open positions to close',
                'details': {'closed': 0, 'total_profit': 0}
            }

        closed_count = 0
        total_profit = 0

        for position in positions:
            try:
                result = self.close_position(position.ticket)
                if result['success']:
                    closed_count += 1
                    total_profit += result.get('profit', 0)
            except Exception as e:
                print(f"⚠️ Error closing position {position.ticket}: {e}")

        return {
            'success': True,
            'message': f'Closed {closed_count} of {len(positions)} positions',
            'details': {
                'closed':       closed_count,
                'total':        len(positions),
                'total_profit': round(total_profit, 2)
            }
        }

    # ======================
    # HEALTH CHECK
    # ======================

    def health_check(self) -> Dict:
        conn_status = self.check_mt5_connection()
        return {
            'connected':         self.connected,
            'mt5_status':        conn_status,
            'symbols_available': len(self.available_symbols),
            'symbols_cached':    len(self.symbol_cache),
            'utc_offset':        self.utc_offset,
            'last_check':        datetime.now().isoformat()
        }


# ===============================================================
# GLOBAL INSTANCE
# ===============================================================

connector = MT5Connector()