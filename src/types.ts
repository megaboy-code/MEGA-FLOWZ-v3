// ================================================================
// ⚡ MEGA FLOWZ DASHBOARD - TYPE DEFINITIONS
// ================================================================

// ==================== WEBSOCKET ====================

export interface WebSocketMessage {
    type:        string;
    account?:    AccountInfo;
    positions?:  PositionData[];
    candles?:    CandleData[];
    symbol?:     string;
    timeframe?:  string;
    bid?:        number;
    ask?:        number;
    spread?:     number;
    change?:     number;
    direction?:  string;
    strategy_id?: string;
    timestamp?:  string;
    data?:       any;
    [key: string]: any;
}

// ==================== CANDLE ====================

export interface CandleData {
    time:    number;       // ✅ Unix timestamp seconds — not string
    open:    number;
    high:    number;
    low:     number;
    close:   number;
    volume?: number;
}

// ==================== TRADE ====================

export interface TradeData {
    symbol:     string;
    direction:  'BUY' | 'SELL';
    volume:     number;
    price:      number;
    ticket?:    number;
    timestamp:  string;
}

// ==================== ACCOUNT ====================

export interface AccountInfo {
    balance:       number;
    equity:        number;
    margin?:       number;
    free_margin?:  number;
    margin_level?: number;
    leverage?:     number;
    currency?:     string;
    server?:       string;
}

// ==================== POSITION ====================

export interface PositionData {
    ticket:        number;
    symbol:        string;
    type:          'BUY' | 'SELL';
    volume:        number;
    open_price:    number;      // ✅ was entry_price / openPrice / price_open
    current_price: number;      // ✅ live price
    sl:            number | null; // ✅ null when not set
    tp:            number | null; // ✅ null when not set
    profit:        number;
    swap?:         number;
    commission?:   number;
    open_time:     number;      // ✅ was time — Unix timestamp seconds
}

// ==================== STRATEGY ====================

export interface StrategyCommand {
    type:        'activate_strategy' | 'backtest_strategy' | 'enable_strategies' |
                 'disable_strategies' | 'pause_all_strategies' | 'stop_all_strategies' |
                 'remove_strategy' | 'strategy_chart_data' | 'auto_trade_execute';
    strategy?:   any;
    strategyId?: string;
    category?:   string;
    symbol?:     string;
    timeframe?:  string;
    parameters?: any;
    days?:       number;
}

// ==================== MODULES ====================

export interface NotificationModule {
    success:      (message: string, options?: any) => void;
    error:        (message: string, options?: any) => void;
    warning:      (message: string, options?: any) => void;
    info:         (message: string, options?: any) => void;
    toggleModal?: () => void;
    hideModal?:   () => void;
}

export interface JournalModule {
    initialize?: () => void;
    switchTab?:  (tab: string) => void;
    destroy?:    () => void;
}