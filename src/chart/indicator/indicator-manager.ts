// ================================================================
// ⚡ INDICATOR MANAGER
// ================================================================

import { LineSeries, ISeriesApi, SeriesType } from 'lightweight-charts';
import { IndicatorCalculator, IndicatorPoint } from './indicator-calculator';
import { IndicatorSettings, OHLCData } from '../chart-types';
import { ChartDataManager } from '../chart-data-manager';
import { getDecimalPrecision } from '../chart-utils';

const INDICATOR_COLORS: Record<string, string> = {
    'SMA': '#2196f3',
    'EMA': '#ff9800',
    'RSI': '#8b5cf6'
};

interface ActiveIndicator {
    id:       string;
    type:     string;
    series:   ISeriesApi<SeriesType>;
    color:    string;
    visible:  boolean;
    settings: IndicatorSettings;
    pane?:    any;
}

export class IndicatorManager {
    private chart:            any = null;
    private chartDataManager: ChartDataManager | null = null;
    private activeIndicators: Map<string, ActiveIndicator> = new Map();
    private calculator:       IndicatorCalculator = new IndicatorCalculator();
    private mainChart:        any = null;
    private calculatorReady:  boolean = false;
    private currentSymbol:    string = '';

    private abortController: AbortController | null = null;

    public onPaneCreated: ((pane: any) => Promise<void>) | null = null;

    constructor() {
        console.log('✅ Indicator Manager created');
    }

    // ==================== INITIALIZATION ====================

    public setChart(chartInstance: any): void {
        this.chart = chartInstance;
    }

    public setMainChart(mainChart: any): void {
        this.mainChart = mainChart;
    }

    public setSymbol(symbol: string): void {
        this.currentSymbol = symbol;
    }

    public initialize(chartDataManager: ChartDataManager): void {
        this.chartDataManager = chartDataManager;
        this.setupEventListeners();
        console.log('✅ Indicator Manager initialized');
    }

    // ==================== EVENT LISTENERS ====================

    private setupEventListeners(): void {
        this.abortController = new AbortController();
        const { signal } = this.abortController;

        document.addEventListener('indicator-settings-changed', (e: Event) => {
            const { indicatorId, settings, color } = (e as CustomEvent).detail;
            if (!indicatorId) return;

            if (color)    this.updateColor(indicatorId, color);
            if (settings) this.updateIndicatorSettings(indicatorId, settings);
        }, { signal });
    }

    // ==================== SERIES VISUAL OPTIONS ====================

    // ✅ Build visual applyOptions from settings — shared by create and update
    private buildSeriesOptions(settings: IndicatorSettings, type: string): Record<string, any> {
        return {
            color:                  settings.color                  || INDICATOR_COLORS[type],
            lineWidth:              (settings as any).lineWidth      || 2,
            priceLineVisible:       (settings as any).priceLineVisible       ?? true,
            lastValueVisible:       (settings as any).lastValueVisible       ?? true,
            crosshairMarkerVisible: (settings as any).crosshairMarkerVisible ?? true,
        };
    }

    // ==================== PANE INDICATOR (RSI) ====================

    public async addPaneIndicator(
        indicatorType: 'RSI',
        settings?:     IndicatorSettings
    ): Promise<void> {
        if (!this.chart || !this.chartDataManager) return;

        const finalSettings: IndicatorSettings = {
            period:                 settings?.period                 || 14,
            source:                 settings?.source                 || 'close',
            color:                  settings?.color                  || INDICATOR_COLORS[indicatorType],
            ...(settings as any)?.lineWidth      !== undefined && { lineWidth:              (settings as any).lineWidth      },
            ...(settings as any)?.priceLineVisible       !== undefined && { priceLineVisible:       (settings as any).priceLineVisible       },
            ...(settings as any)?.lastValueVisible       !== undefined && { lastValueVisible:       (settings as any).lastValueVisible       },
            ...(settings as any)?.crosshairMarkerVisible !== undefined && { crosshairMarkerVisible: (settings as any).crosshairMarkerVisible },
        };

        const ohlcData = this.chartDataManager.getOHLCData();
        if (!ohlcData || ohlcData.length === 0) return;

        const indicatorId = `${indicatorType}_${finalSettings.period}_${finalSettings.source}_${Date.now()}`;

        if (!this.mainChart) {
            console.error('❌ MainChart reference not available');
            return;
        }

        try {
            const pane = await this.mainChart.addPane(120, `rsi_${indicatorId}`);
            if (!pane) return;

            if (this.onPaneCreated) await this.onPaneCreated(pane);

            this.calculator.setOHLCData(ohlcData);
            const values      = this.calculator.calculateIndicator(indicatorType, finalSettings);
            const validValues = values.filter(p => !isNaN(p.value));

            if (validValues.length === 0) {
                try { await this.mainChart.removePane(pane); } catch (e) {}
                return;
            }

            // ✅ Use buildSeriesOptions for consistent options
            const seriesOptions = {
                ...this.buildSeriesOptions(finalSettings, indicatorType),
                priceFormat: { type: 'price', precision: 2, minMove: 0.01 }
            };

            const series = await this.mainChart.addSeriesToPane(
                pane,
                LineSeries,
                seriesOptions,
                indicatorId
            );

            if (!series) {
                try { await this.mainChart.removePane(pane); } catch (e) {}
                return;
            }

            series.setData(validValues as any);

            try {
                series.priceScale().applyOptions({
                    scaleMargins: { top: 0.1, bottom: 0.1 }
                });
            } catch (e) {}

            this.activeIndicators.set(indicatorId, {
                id:       indicatorId,
                type:     indicatorType,
                series,
                color:    finalSettings.color || INDICATOR_COLORS[indicatorType],
                visible:  true,
                settings: finalSettings,
                pane
            });

            this.calculatorReady = true;

            const latestValue = validValues[validValues.length - 1]?.value ?? 0;

            document.dispatchEvent(new CustomEvent('indicator-added', {
                detail: {
                    id:       indicatorId,
                    name:     `${indicatorType}(${finalSettings.period})`,
                    color:    finalSettings.color,
                    values:   [{ value: latestValue.toFixed(2), color: finalSettings.color }],
                    pane,
                    settings: { ...finalSettings }
                }
            }));

            console.log(`✅ ${indicatorType} added: ${indicatorId}`);

        } catch (error) {
            console.error(`❌ Failed to add ${indicatorType}:`, error);
        }
    }

    // ==================== OVERLAY INDICATOR (SMA/EMA) ====================

    public addIndicator(
        indicatorType: 'SMA' | 'EMA',
        settings?:     IndicatorSettings
    ): void {
        if (!this.chart || !this.chartDataManager) return;

        const finalSettings: IndicatorSettings = {
            period: settings?.period || 20,
            source: settings?.source || 'close',
            color:  settings?.color  || INDICATOR_COLORS[indicatorType] || '#888888',
            ...(settings as any)?.lineWidth              !== undefined && { lineWidth:              (settings as any).lineWidth              },
            ...(settings as any)?.priceLineVisible       !== undefined && { priceLineVisible:       (settings as any).priceLineVisible       },
            ...(settings as any)?.lastValueVisible       !== undefined && { lastValueVisible:       (settings as any).lastValueVisible       },
            ...(settings as any)?.crosshairMarkerVisible !== undefined && { crosshairMarkerVisible: (settings as any).crosshairMarkerVisible },
        };

        const ohlcData = this.chartDataManager.getOHLCData();
        if (!ohlcData || ohlcData.length === 0) return;

        const indicatorId = `${indicatorType}_${finalSettings.period}_${finalSettings.source}_${Date.now()}`;

        this.calculator.setOHLCData(ohlcData);
        const values      = this.calculator.calculateIndicator(indicatorType, finalSettings);
        const validValues = values.filter(p => !isNaN(p.value));
        if (validValues.length === 0) return;

        const series = this.drawSeries(indicatorId, indicatorType, finalSettings, validValues);
        if (!series) return;

        this.activeIndicators.set(indicatorId, {
            id:       indicatorId,
            type:     indicatorType,
            series,
            color:    finalSettings.color || INDICATOR_COLORS[indicatorType],
            visible:  true,
            settings: finalSettings
        });

        this.calculatorReady = true;

        const latestValue = validValues[validValues.length - 1]?.value ?? 0;
        const precision   = getDecimalPrecision(this.currentSymbol);

        document.dispatchEvent(new CustomEvent('indicator-added', {
            detail: {
                id:       indicatorId,
                name:     `${indicatorType}(${finalSettings.period})`,
                color:    finalSettings.color,
                values:   [{ value: latestValue.toFixed(precision), color: finalSettings.color }],
                pane:     null,
                settings: { ...finalSettings }
            }
        }));

        console.log(`✅ Indicator added: ${indicatorId}`);
    }

    // ==================== DRAWING ====================

    private drawSeries(
        indicatorId:   string,
        indicatorType: string,
        settings:      IndicatorSettings,
        data:          IndicatorPoint[]
    ): ISeriesApi<SeriesType> | null {
        if (!this.chart) return null;

        const precision = getDecimalPrecision(this.currentSymbol);
        const minMove   = 1 / Math.pow(10, precision);

        try {
            // ✅ Use buildSeriesOptions for consistent options
            const series = this.chart.addSeries(LineSeries, {
                ...this.buildSeriesOptions(settings, indicatorType),
                priceFormat: { type: 'price', precision, minMove }
            });

            if (data.length > 0) series.setData(data as any);

            return series;
        } catch (error) {
            console.error(`❌ Failed to draw ${indicatorType}:`, error);
            return null;
        }
    }

    // ==================== RECALCULATE ====================

    public recalculate(): void {
        if (!this.chartDataManager) return;
        if (this.activeIndicators.size === 0) return;

        const ohlcData = this.chartDataManager.getOHLCData();
        if (!ohlcData || ohlcData.length === 0) return;

        this.calculator.setOHLCData(ohlcData);
        this.calculatorReady = true;

        this.activeIndicators.forEach((indicator, indicatorId) => {
            try {
                const values      = this.calculator.calculateIndicator(
                    indicator.type as 'SMA' | 'EMA' | 'RSI',
                    indicator.settings
                );
                const validValues = values.filter(p => !isNaN(p.value));
                if (validValues.length === 0) return;

                indicator.series.setData(validValues as any);

                const latestValue = validValues[validValues.length - 1].value;
                const precision   = indicator.type === 'RSI'
                    ? 2
                    : getDecimalPrecision(this.currentSymbol);

                document.dispatchEvent(new CustomEvent('indicator-value-update', {
                    detail: { id: indicatorId, value: latestValue.toFixed(precision) }
                }));
            } catch (error) {
                console.error(`❌ Failed to recalculate ${indicator.type}:`, error);
            }
        });

        console.log('✅ Indicators recalculated');
    }

    // ==================== LIVE UPDATE ====================

    public updateLatestValues(candle: OHLCData): void {
        if (!this.calculatorReady) return;

        this.activeIndicators.forEach((indicator, indicatorId) => {
            try {
                const latestPoint = this.calculator.calculateUpdate(
                    indicator.type as 'SMA' | 'EMA' | 'RSI',
                    indicator.settings,
                    candle
                );

                if (latestPoint && !isNaN(latestPoint.value) && isFinite(latestPoint.value)) {
                    indicator.series.update(latestPoint as any);

                    const precision = indicator.type === 'RSI'
                        ? 2
                        : getDecimalPrecision(this.currentSymbol);

                    document.dispatchEvent(new CustomEvent('indicator-value-update', {
                        detail: { id: indicatorId, value: latestPoint.value.toFixed(precision) }
                    }));
                }
            } catch (error) {}
        });
    }

    // ==================== REMOVE ====================

    public async removeIndicator(indicatorId: string): Promise<void> {
        const indicator = this.activeIndicators.get(indicatorId);

        if (indicator && this.chart) {
            try {
                this.chart.removeSeries(indicator.series);
                if (indicator.pane && this.mainChart) {
                    try { await this.mainChart.removePane(indicator.pane); } catch (e) {}
                }
            } catch (error) {}
        }

        this.activeIndicators.delete(indicatorId);

        if (this.activeIndicators.size === 0) {
            this.calculatorReady = false;
        }

        console.log(`🗑️ Indicator removed: ${indicatorId}`);
    }

    // ==================== VISIBILITY ====================

    public toggleVisibility(indicatorId: string, visible?: boolean): void {
        const indicator = this.activeIndicators.get(indicatorId);
        if (!indicator) return;

        const newVisible = visible !== undefined ? visible : !indicator.visible;

        try {
            indicator.series.applyOptions({ visible: newVisible });
            indicator.visible = newVisible;
        } catch (error) {}
    }

    // ==================== SETTINGS ====================

    private updateColor(indicatorId: string, color: string): void {
        const indicator = this.activeIndicators.get(indicatorId);
        if (!indicator) return;
        try {
            indicator.series.applyOptions({ color });
            indicator.color          = color;
            indicator.settings.color = color;
        } catch (error) {}
    }

    private updateIndicatorSettings(
        indicatorId: string,
        newSettings:  IndicatorSettings
    ): void {
        const indicator = this.activeIndicators.get(indicatorId);
        if (!indicator || !this.chartDataManager) return;

        indicator.settings = { ...indicator.settings, ...newSettings };

        // ✅ Apply all visual options — lineWidth, priceLineVisible, lastValueVisible etc
        try {
            indicator.series.applyOptions(
                this.buildSeriesOptions(indicator.settings, indicator.type)
            );
        } catch (e) {}

        const ohlcData = this.chartDataManager.getOHLCData();
        if (!ohlcData || ohlcData.length === 0) return;

        this.calculator.setOHLCData(ohlcData);
        const values      = this.calculator.calculateIndicator(
            indicator.type as 'SMA' | 'EMA' | 'RSI',
            indicator.settings
        );
        const validValues = values.filter(p => !isNaN(p.value));
        if (validValues.length === 0) return;

        indicator.series.setData(validValues as any);

        const latestValue = validValues[validValues.length - 1].value;
        const precision   = indicator.type === 'RSI'
            ? 2
            : getDecimalPrecision(this.currentSymbol);

        document.dispatchEvent(new CustomEvent('indicator-value-update', {
            detail: { id: indicatorId, value: latestValue.toFixed(precision) }
        }));

        const newName = `${indicator.type}(${indicator.settings.period})`;
        document.dispatchEvent(new CustomEvent('indicator-name-update', {
            detail: { id: indicatorId, name: newName, settings: { ...indicator.settings } }
        }));
    }

    // ==================== DESTROY ====================

    public async destroy(): Promise<void> {
        this.abortController?.abort();
        this.abortController = null;

        if (this.chart) {
            for (const indicator of this.activeIndicators.values()) {
                try {
                    this.chart.removeSeries(indicator.series);
                    if (indicator.pane && this.mainChart) {
                        try { await this.mainChart.removePane(indicator.pane); } catch (e) {}
                    }
                } catch (error) {}
            }
        }

        this.activeIndicators.clear();
        this.calculator.clear();
        this.calculatorReady = false;

        this.chart            = null;
        this.chartDataManager = null;
        this.mainChart        = null;

        console.log('🗑️ Indicator Manager destroyed');
    }

    // ==================== GETTERS ====================

    public getActiveIndicators(): Array<{
        id:       string;
        type:     string;
        settings: IndicatorSettings;
        visible:  boolean;
        pane?:    any;
    }> {
        return Array.from(this.activeIndicators.values()).map(ind => ({
            id:       ind.id,
            type:     ind.type,
            settings: ind.settings,
            visible:  ind.visible,
            pane:     ind.pane
        }));
    }

    public hasIndicator(indicatorId: string): boolean {
        return this.activeIndicators.has(indicatorId);
    }
}