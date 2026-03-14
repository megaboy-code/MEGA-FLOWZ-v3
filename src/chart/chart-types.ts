// ================================================================
// 📐 CHART TYPES - Shared interfaces across chart/ folder
// ================================================================

import { Time } from 'lightweight-charts';

// ==================== CONNECTION ====================

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

// ==================== LEGEND ====================

export interface LegendItemValue {
    label?: string;
    value:  string;
    color:  string;
}

export interface LegendItem {
    id:        string;
    name:      string;
    color:     string;
    values:    LegendItemValue[];
    icon?:     string;
    pane?:     any;
    settings?: Record<string, any>; // ✅ actual settings — no more ID parsing
}

export interface LegendUpdateData {
    symbol?:        string;
    timeframe?:     string;
    price?:         number | null;
    precision?:     number;
    volumeVisible?: boolean;
}

// ==================== INDICATORS ====================

export type PriceSource = 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4';

export interface IndicatorSettings {
    period: number;
    source: PriceSource;
    color?: string;
    overbought?: number;
    oversold?:   number;
    [key: string]: any;
}

// ==================== CHART ====================

export type ChartType  = 'candlestick' | 'line' | 'area' | 'baseline';
export type ChartState = 'IDLE' | 'LOADING' | 'READY';

// ==================== OHLC ====================

export interface OHLCData {
    time:    Time;
    open:    number;
    high:    number;
    low:     number;
    close:   number;
    volume?: number;
}

// ==================== DRAWING ====================

export interface DrawingToolsConfig {
    precision:      number;
    showLabels:     boolean;
    priceFormatter: (price: number) => string;
}

// ==================== CHART COLORS ====================

export interface ChartColors {
    background:  string;
    grid:        string;
    bull:        string;
    bear:        string;
    line:        string;
    volumeBull:  string;
    volumeBear:  string;
    scaleBorder: string;
    crosshair?:  string;
    textColor?:  string;
    wickBull?:   string;
    wickBear?:   string;
    borderBull?: string;
    borderBear?: string;
}

// ==================== SYSTEM THEME (DEFAULT) ====================

export const DEFAULT_CHART_COLORS: ChartColors = {
    background:  '#0f172a',
    grid:        '#2d3748',
    bull:        '#10b981',
    bear:        '#ef4444',
    line:        '#3b82f6',
    volumeBull:  '#10b981',
    volumeBear:  '#ef4444',
    scaleBorder: '#475569',
    crosshair:   '#4b5563',
    textColor:   '#e2e8f0',
    wickBull:    '#10b981',
    wickBear:    '#ef4444',
    borderBull:  '#10b981',
    borderBear:  '#ef4444'
};

// ==================== DARK THEME ====================

export const DARK_CHART_COLORS: ChartColors = {
    background:  '#0b121c',
    grid:        '#1f2b39',
    bull:        '#00e08a',
    bear:        '#ff3d57',
    line:        '#4c8dff',
    volumeBull:  '#00e08a',
    volumeBear:  '#ff3d57',
    scaleBorder: '#2a384a',
    crosshair:   '#4b5563',
    textColor:   '#cbd5e0',
    wickBull:    '#00e08a',
    wickBear:    '#ff3d57',
    borderBull:  '#00e08a',
    borderBear:  '#ff3d57'
};

// ==================== LIGHT THEME ====================

export const LIGHT_CHART_COLORS: ChartColors = {
    background:  '#f7f4ef',
    grid:        '#e8e3dc',
    bull:        '#00936a',
    bear:        '#c8202f',
    line:        '#1d5bb5',
    volumeBull:  '#00936a',
    volumeBear:  '#c8202f',
    scaleBorder: '#ddd8d0',
    crosshair:   '#4b5563',
    textColor:   '#4a4540',
    wickBull:    '#00936a',
    wickBear:    '#c8202f',
    borderBull:  '#00936a',
    borderBear:  '#c8202f'
};

// ==================== SETTINGS MODAL ====================

export interface SettingsModalConfig {
    colors:    ChartColors;
    chartType: string;
    symbol:    string;
}