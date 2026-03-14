// ================================================================
// 📊 VOLUME MANAGER - Volume series lifecycle and updates
// ================================================================

import { IChartApi, ISeriesApi, HistogramSeries, HistogramData } from 'lightweight-charts';
import { OHLCData } from '../chart-types';

export class VolumeManager {
    private chart: IChartApi | null = null;
    private volumeSeries: ISeriesApi<"Histogram"> | null = null;
    private volumeColors: { bull: string; bear: string };
    private lastVolumeCandle: OHLCData | null = null;
    private currentTimeframe: string = '';

    // ✅ Callback out — MainChart wires this to chart-core → legend
    public onVolumeUpdate: ((volume: number, isBullish: boolean) => void) | null = null;

    constructor(colors: { bull: string; bear: string }) {
        this.volumeColors = {
            bull: colors.bull || '#10b981',
            bear: colors.bear || '#ef4444'
        };
    }

    // ==================== INITIALIZATION ====================

    public setChart(chart: IChartApi): void {
        this.chart = chart;
    }

    public setTimeframe(timeframe: string): void {
        this.currentTimeframe = timeframe;
    }

    // ==================== CREATE/REMOVE SERIES ====================

    public createSeries(mainSeries: ISeriesApi<any>): ISeriesApi<"Histogram"> | null {
        if (!this.chart) {
            console.error('❌ Chart not initialized for volume series');
            return null;
        }

        try {
            if (this.volumeSeries) {
                this.chart.removeSeries(this.volumeSeries);
                this.volumeSeries = null;
            }

            this.volumeSeries = this.chart.addSeries(HistogramSeries, {
                color: this.volumeColors.bull,
                priceFormat: { type: 'volume' },
                priceScaleId: '',
            });

            if (this.volumeSeries) {
                this.volumeSeries.priceScale().applyOptions({
                    scaleMargins: { top: 0.7, bottom: 0 },
                });

                if (mainSeries) {
                    mainSeries.priceScale().applyOptions({
                        scaleMargins: { top: 0.1, bottom: 0.4 },
                    });
                }

                console.log(`✅ Volume series created for ${this.currentTimeframe}`);
            }

            return this.volumeSeries;
        } catch (error) {
            console.error('❌ Failed to create volume series:', error);
            return null;
        }
    }

    public removeSeries(): void {
        if (!this.chart || !this.volumeSeries) return;

        try {
            this.chart.removeSeries(this.volumeSeries);
            this.volumeSeries = null;
            this.lastVolumeCandle = null;
            console.log(`✅ Volume series removed`);
        } catch (error) {
            console.error('❌ Failed to remove volume series:', error);
        }
    }

    // ==================== DATA MANAGEMENT ====================

    public setData(candles: OHLCData[]): void {
        if (!this.volumeSeries || !Array.isArray(candles) || candles.length === 0) return;

        try {
            const volumeData = this.convertOHLCToVolumeData(candles);
            this.volumeSeries.setData(volumeData);
            console.log(`📊 Volume data set: ${volumeData.length} bars`);

            this.lastVolumeCandle = candles[candles.length - 1];
            this.emitVolumeUpdate(this.lastVolumeCandle);
        } catch (error) {
            console.error('❌ Failed to set volume data:', error);
        }
    }

    public updateCandle(candle: OHLCData): void {
        if (!this.volumeSeries || !candle || candle.volume === undefined) return;

        try {
            const volumeCandle = this.convertCandleToVolumeCandle(candle);
            this.volumeSeries.update(volumeCandle);
            this.lastVolumeCandle = candle;
            this.emitVolumeUpdate(candle);
        } catch (error) {
            console.error('❌ Failed to update volume candle:', error);
        }
    }

    public clearData(): void {
        if (!this.volumeSeries) return;

        try {
            this.volumeSeries.setData([]);
            this.lastVolumeCandle = null;
            console.log(`✅ Volume data cleared`);
        } catch (error) {
            console.error('❌ Failed to clear volume data:', error);
        }
    }

    // ==================== DATA CONVERSION ====================

    private convertOHLCToVolumeData(candles: OHLCData[]): HistogramData[] {
        return candles
            .filter(candle => candle && candle.time && candle.volume !== undefined)
            .map(candle => this.convertCandleToVolumeCandle(candle));
    }

    private convertCandleToVolumeCandle(candle: OHLCData): HistogramData {
        const isBullish = candle.close >= candle.open;
        return {
            time: candle.time,
            value: candle.volume || 0,
            color: isBullish ? this.volumeColors.bull : this.volumeColors.bear
        };
    }

    // ==================== CALLBACK ====================

    private emitVolumeUpdate(candle: OHLCData): void {
        if (candle.volume === undefined) return;
        if (this.onVolumeUpdate) {
            const isBullish = candle.close >= candle.open;
            this.onVolumeUpdate(candle.volume, isBullish);
        }
    }

    // ==================== COLORS ====================

    // ✅ ohlcData passed from MainChart — no duplicate store needed
    public updateColors(bullColor?: string, bearColor?: string, ohlcData?: OHLCData[]): void {
        if (bullColor) this.volumeColors.bull = bullColor;
        if (bearColor) this.volumeColors.bear = bearColor;
        if (this.volumeSeries && ohlcData && ohlcData.length > 0) {
            const volumeData = this.convertOHLCToVolumeData(ohlcData);
            this.volumeSeries.setData(volumeData);
            console.log('🎨 Volume colors reapplied');
        }
    }

    public resetScaleMargins(mainSeries: ISeriesApi<any>): void {
        if (!mainSeries) return;
        mainSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.1, bottom: 0.1 },
        });
    }

    // ==================== GETTERS ====================

    public getSeries(): ISeriesApi<"Histogram"> | null { return this.volumeSeries; }
    public isVisible(): boolean { return this.volumeSeries !== null; }
    public getColors(): { bull: string; bear: string } { return { ...this.volumeColors }; }

    public getCurrentVolume(): number | null {
        return this.lastVolumeCandle?.volume ?? null;
    }

    public isVolumeBullish(): boolean | null {
        if (!this.lastVolumeCandle) return null;
        return this.lastVolumeCandle.close >= this.lastVolumeCandle.open;
    }

    // ==================== DESTROY ====================

    public destroy(): void {
        this.removeSeries();
        this.onVolumeUpdate = null;
        this.chart = null;
        this.lastVolumeCandle = null;
    }
}