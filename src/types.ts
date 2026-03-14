// ================================================================
// ⚡ MEGA FLOWZ DASHBOARD - TYPE DEFINITIONS
// ================================================================

// WebSocket message types from Python backend
export interface WebSocketMessage {
    type: string;
    account?: AccountInfo;
    positions?: PositionData[];
    candles?: CandleData[];
    symbol?: string;
    bid?: number;
    ask?: number;
    spread?: number;
    change?: number;
    direction?: string;
    strategy_id?: string;
    timestamp?: string;
    data?: any;
    [key: string]: any;
}

export interface CandleData {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

export interface TradeData {
    symbol: string;
    direction: 'BUY' | 'SELL';
    volume: number;
    price: number;
    ticket?: number;
    timestamp: string;
}

export interface AccountInfo {
    balance: number;
    equity: number;
    margin?: number;
    free_margin?: number;
    margin_level?: number;
    currency?: string;
    server?: string;
}

export interface PositionData {
    ticket: string | number;
    symbol: string;
    type: 'BUY' | 'SELL' | 0 | 1;
    volume: number;
    openPrice?: number;
    entry_price?: number;
    price_open?: number;
    profit?: number;
    pl?: number;
    unrealizedPL?: number;
    id?: string | number;
}

// Strategy command types
export interface StrategyCommand {
    type: 'activate_strategy' | 'backtest_strategy' | 'enable_strategies' |
          'disable_strategies' | 'pause_all_strategies' | 'stop_all_strategies' |
          'remove_strategy' | 'strategy_chart_data' | 'auto_trade_execute';
    strategy?: any;
    strategyId?: string;
    category?: string;
    symbol?: string;
    timeframe?: string;
    parameters?: any;
    days?: number;
}

// Module interfaces
export interface NotificationModule {
    success: (message: string, options?: any) => void;
    error: (message: string, options?: any) => void;
    warning: (message: string, options?: any) => void;
    info: (message: string, options?: any) => void;
    toggleModal?: () => void;
    hideModal?: () => void;
}

export interface JournalModule {
    initialize?: () => void;
    switchTab?: (tab: string) => void;
    destroy?: () => void;
}

export interface CalculatorModule {
    // Add specific methods if needed
}