// ================================================================
// ⚡ STRATEGY MANAGER - Frontend Strategy Lines
// ================================================================

import { LineSeries, ISeriesApi, SeriesType } from 'lightweight-charts';
import { getDecimalPrecision } from './chart-utils';

const STRATEGY_COLORS: Record<string, string[]> = {
    'ma_crossover':        ['#00d394', '#ff4d6b'],
    'ema_ribbon':          ['#3a86ff', '#ff006e'],
    'adx_trend':           ['#ffbe0b', '#fb5607'],
    'bollinger_reversion': ['#8338ec', '#ff006e'],
    'rsi_reversion':       ['#06d6a0', '#ef476f'],
    'default':             ['#00d394', '#ff4d6b']
};

interface ActiveStrategy {
    id:           string;
    strategyType: string;
    fastSeries:   ISeriesApi<SeriesType> | null;
    slowSeries:   ISeriesApi<SeriesType> | null;
    fastPeriod:   number;
    slowPeriod:   number;
    fastColor:    string;
    slowColor:    string;
    visible:      boolean;
}

export class FrontendStrategyManager {
    private chart:            any = null;
    private activeStrategies: Map<string, ActiveStrategy> = new Map();
    private currentSymbol:    string = '';

    // ✅ AbortController — one abort() removes all listeners
    private abortController: AbortController | null = null;

    constructor() {
        console.log('✅ Strategy Manager created');
    }

    // ==================== SETUP ====================

    public setChart(chartInstance: any): void {
        this.chart = chartInstance;
    }

    // ✅ Keep precision in sync when symbol changes
    public setSymbol(symbol: string): void {
        this.currentSymbol = symbol;
    }

    public initialize(): void {
        this.abortController = new AbortController();
        const { signal } = this.abortController;

        // ✅ Single consolidated event — replaces 'strategy-color-change'
        document.addEventListener('strategy-settings-changed', (e: Event) => {
            const { strategyId, fastColor, slowColor } = (e as CustomEvent).detail;
            if (strategyId) this.updateColors(strategyId, fastColor, slowColor);
        }, { signal });
    }

    // ==================== ADD ====================

    public addStrategyIndicators(data: any): void {
        const indicators = data.indicators || data.data?.indicators;
        if (!indicators || !this.chart) return;

        Object.entries(indicators).forEach(([strategyId, indicator]: [string, any]) => {
            if (this.activeStrategies.has(strategyId)) {
                this.removeStrategyIndicators(strategyId);
            }

            const strategyType = indicator.strategy_type || 'ma_crossover';
            const colors       = STRATEGY_COLORS[strategyType] || STRATEGY_COLORS['default'];
            const precision    = getDecimalPrecision(this.currentSymbol); // ✅ symbol precision

            const fastData = (indicator.fast_ma || [])
                .filter((p: any) => p.value !== null && p.value !== undefined)
                .map((p: any) => ({ time: p.time, value: p.value }));

            const slowData = (indicator.slow_ma || [])
                .filter((p: any) => p.value !== null && p.value !== undefined)
                .map((p: any) => ({ time: p.time, value: p.value }));

            const fastSeries = this.drawSeries(colors[0], fastData);
            const slowSeries = this.drawSeries(colors[1], slowData);

            const fastValue = fastData.length > 0 ? fastData[fastData.length - 1].value : 0;
            const slowValue = slowData.length > 0 ? slowData[slowData.length - 1].value : 0;

            this.activeStrategies.set(strategyId, {
                id:           strategyId,
                strategyType,
                fastSeries,
                slowSeries,
                fastPeriod:   indicator.fast_period || 0,
                slowPeriod:   indicator.slow_period || 0,
                fastColor:    colors[0],
                slowColor:    colors[1],
                visible:      true
            });

            document.dispatchEvent(new CustomEvent('indicator-added', {
                detail: {
                    id:     strategyId,
                    name:   strategyType.replace(/_/g, ' ').toUpperCase(),
                    color:  colors[0],
                    icon:   'fa-robot',
                    pane:   null,
                    values: [
                        {
                            label: `F(${indicator.fast_period})`,
                            value: fastValue.toFixed(precision),
                            color: colors[0]
                        },
                        {
                            label: `S(${indicator.slow_period})`,
                            value: slowValue.toFixed(precision),
                            color: colors[1]
                        }
                    ]
                }
            }));

            console.log(`✅ Strategy lines drawn: ${strategyId}`);
        });
    }

    // ==================== UPDATE ====================

    public updateStrategyIndicators(data: any): void {
        const indicators = data.indicators || data.data?.indicators;
        if (!indicators || !this.chart) return;

        Object.entries(indicators).forEach(([strategyId, indicator]: [string, any]) => {
            const strategy  = this.activeStrategies.get(strategyId);
            if (!strategy) return;

            const precision = getDecimalPrecision(this.currentSymbol); // ✅ symbol precision

            if (strategy.fastSeries && indicator.fast_ma) {
                const point = indicator.fast_ma;
                if (point.time && point.value !== null) {
                    try {
                        strategy.fastSeries.update({
                            time:  point.time,
                            value: point.value
                        } as any);
                    } catch (error) {}
                }
            }

            if (strategy.slowSeries && indicator.slow_ma) {
                const point = indicator.slow_ma;
                if (point.time && point.value !== null) {
                    try {
                        strategy.slowSeries.update({
                            time:  point.time,
                            value: point.value
                        } as any);
                    } catch (error) {}
                }
            }

            const fastValue = indicator.fast_ma?.value;
            const slowValue = indicator.slow_ma?.value;

            if (fastValue !== null || slowValue !== null) {
                document.dispatchEvent(new CustomEvent('indicator-value-update', {
                    detail: {
                        id: strategyId,
                        values: [
                            {
                                label: `F(${strategy.fastPeriod})`,
                                value: fastValue?.toFixed(precision) ?? '--',
                                color: strategy.fastColor
                            },
                            {
                                label: `S(${strategy.slowPeriod})`,
                                value: slowValue?.toFixed(precision) ?? '--',
                                color: strategy.slowColor
                            }
                        ]
                    }
                }));
            }
        });
    }

    // ==================== REMOVE ====================

    public removeStrategyIndicators(strategyId: string): void {
        const strategy = this.activeStrategies.get(strategyId);

        if (strategy && this.chart) {
            try {
                if (strategy.fastSeries) this.chart.removeSeries(strategy.fastSeries);
                if (strategy.slowSeries) this.chart.removeSeries(strategy.slowSeries);
            } catch (error) {}
        }

        this.activeStrategies.delete(strategyId);
        console.log(`🗑️ Strategy lines removed: ${strategyId}`);
    }

    // ==================== VISIBILITY ====================

    public toggleVisibility(strategyId: string): void {
        const strategy = this.activeStrategies.get(strategyId);
        if (!strategy) return;

        strategy.visible = !strategy.visible;

        try {
            if (strategy.fastSeries) {
                strategy.fastSeries.applyOptions({ visible: strategy.visible });
            }
            if (strategy.slowSeries) {
                strategy.slowSeries.applyOptions({ visible: strategy.visible });
            }
        } catch (error) {}
    }

    // ==================== COLOR ====================

    public updateColors(strategyId: string, fastColor: string, slowColor: string): void {
        const strategy = this.activeStrategies.get(strategyId);
        if (!strategy) return;

        try {
            if (strategy.fastSeries) {
                strategy.fastSeries.applyOptions({ color: fastColor });
                strategy.fastColor = fastColor;
            }
            if (strategy.slowSeries) {
                strategy.slowSeries.applyOptions({ color: slowColor });
                strategy.slowColor = slowColor;
            }
        } catch (error) {}
    }

    // ==================== CLEAR ====================

    public clearAll(): void {
        Array.from(this.activeStrategies.keys())
            .forEach(id => this.removeStrategyIndicators(id));
    }

    // ==================== GETTERS ====================

    public hasStrategy(strategyId: string): boolean {
        return this.activeStrategies.has(strategyId);
    }

    // ==================== DRAWING ====================

    private drawSeries(
        color: string,
        data:  Array<{ time: any; value: number }>
    ): ISeriesApi<SeriesType> | null {
        if (!this.chart) return null;

        const precision = getDecimalPrecision(this.currentSymbol); // ✅ symbol precision
        const minMove   = 1 / Math.pow(10, precision);

        try {
            const series = this.chart.addSeries(LineSeries, {
                color,
                lineWidth:              1,
                lastValueVisible:       true,
                priceLineVisible:       false,
                crosshairMarkerVisible: true,
                priceFormat: { type: 'price', precision, minMove }
            });

            if (data.length > 0) series.setData(data as any);

            return series;
        } catch (error) {
            console.error('❌ Failed to draw strategy line:', error);
            return null;
        }
    }

    // ==================== DESTROY ====================

    public async destroy(): Promise<void> {
        // ✅ async — future proof for pane removal if strategies ever use panes
        this.abortController?.abort();
        this.abortController = null;
        this.clearAll();
        this.chart = null;
        console.log('🗑️ Strategy Manager destroyed');
    }
}