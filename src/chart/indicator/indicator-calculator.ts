// ================================================================
// ⚡ INDICATOR CALCULATOR - Frontend Technical Indicators
// ================================================================

import { Time } from 'lightweight-charts';
import { OHLCData, IndicatorSettings, PriceSource } from '../chart-types';

export interface IndicatorPoint {
    time: number;
    value: number;
}

export class IndicatorCalculator {
    private ohlcData: OHLCData[] = [];

    // 🚀 OPTIMIZATION: Stateful cache for O(1) updates
    private cache = {
        sma: new Map<string, { runningSum: number; values: number[] }>(),
        ema: new Map<string, { lastValue: number; multiplier: number; values: number[] }>(),
        rsi: new Map<string, { avgGain: number; avgLoss: number; values: number[] }>(),
        prices: new Map<PriceSource, number[]>()
    };

    // ==================== DATA MANAGEMENT ====================

    public setOHLCData(data: OHLCData[]): void {
        this.ohlcData = data;
        this.cache = {
            sma: new Map(),
            ema: new Map(),
            rsi: new Map(),
            prices: new Map()
        };
        console.log('🧹 Calculator FULLY reset with new data');
    }

    public updateOHLCData(update: OHLCData): void {
        if (this.ohlcData.length === 0) {
            this.ohlcData.push(update);
            return;
        }

        const lastIndex = this.ohlcData.length - 1;
        if (this.ohlcData[lastIndex].time === update.time) {
            this.ohlcData[lastIndex] = update;
        } else {
            this.ohlcData.push(update);
        }
    }

    public getOHLCData(): OHLCData[] {
        return this.ohlcData;
    }

    public clear(): void {
        this.ohlcData = [];
        this.cache = {
            sma: new Map(),
            ema: new Map(),
            rsi: new Map(),
            prices: new Map()
        };
        console.log('🧹 ALL calculator caches cleared');
    }

    public hasData(): boolean {
        return this.ohlcData.length > 0;
    }

    public getDataCount(): number {
        return this.ohlcData.length;
    }

    // ==================== PRICE EXTRACTION ====================

    private extractPrices(source: PriceSource): number[] {
        if (this.cache.prices.has(source)) {
            return this.cache.prices.get(source)!;
        }

        if (this.ohlcData.length === 0) return [];

        let prices: number[];

        switch (source) {
            case 'close':  prices = this.ohlcData.map(c => c.close); break;
            case 'open':   prices = this.ohlcData.map(c => c.open); break;
            case 'high':   prices = this.ohlcData.map(c => c.high); break;
            case 'low':    prices = this.ohlcData.map(c => c.low); break;
            case 'hl2':    prices = this.ohlcData.map(c => (c.high + c.low) / 2); break;
            case 'hlc3':   prices = this.ohlcData.map(c => (c.high + c.low + c.close) / 3); break;
            case 'ohlc4':  prices = this.ohlcData.map(c => (c.open + c.high + c.low + c.close) / 4); break;
            default:       prices = this.ohlcData.map(c => c.close);
        }

        this.cache.prices.set(source, prices);
        return prices;
    }

    private getLatestPrice(source: PriceSource): number | null {
        if (this.ohlcData.length === 0) return null;

        const latest = this.ohlcData[this.ohlcData.length - 1];

        switch (source) {
            case 'close':  return latest.close;
            case 'open':   return latest.open;
            case 'high':   return latest.high;
            case 'low':    return latest.low;
            case 'hl2':    return (latest.high + latest.low) / 2;
            case 'hlc3':   return (latest.high + latest.low + latest.close) / 3;
            case 'ohlc4':  return (latest.open + latest.high + latest.low + latest.close) / 4;
            default:       return latest.close;
        }
    }

    // ==================== SIMPLE MOVING AVERAGE (SMA) ====================

    public calculateSMA(period: number = 20, source: PriceSource = 'close'): IndicatorPoint[] {
        if (this.ohlcData.length < period) {
            return this.ohlcData.map(candle => ({
                time: candle.time,
                value: NaN
            }));
        }

        const prices = this.extractPrices(source);
        const smaValues: IndicatorPoint[] = [];
        const cacheKey = `${period}_${source}`;

        let runningSum = 0;

        for (let i = 0; i < prices.length; i++) {
            if (i < period - 1) {
                smaValues.push({ time: this.ohlcData[i].time, value: NaN });
            } else if (i === period - 1) {
                runningSum = prices.slice(0, period).reduce((acc, val) => acc + val, 0);
                smaValues.push({ time: this.ohlcData[i].time, value: runningSum / period });
            } else {
                runningSum = runningSum - prices[i - period] + prices[i];
                smaValues.push({ time: this.ohlcData[i].time, value: runningSum / period });
            }
        }

        const validValues = smaValues.filter(v => !isNaN(v.value)).map(v => v.value);
        if (validValues.length > 0) {
            this.cache.sma.set(cacheKey, { runningSum, values: validValues });
        }

        return smaValues;
    }

    private handleSMAUpdate(
        cacheKey: string,
        period: number,
        source: PriceSource,
        update: OHLCData,
        isNewCandle: boolean
    ): IndicatorPoint | null {
        if (this.ohlcData.length < period) return null;

        if (!this.cache.sma.has(cacheKey)) {
            this.calculateSMA(period, source);
            if (!this.cache.sma.has(cacheKey)) return null;
        }

        const cached = this.cache.sma.get(cacheKey)!;
        const prices = this.cache.prices.get(source);
        if (!prices || prices.length < period + 1) return null;

        const newPrice = prices[prices.length - 1];
        if (newPrice === null || isNaN(newPrice)) return null;

        if (isNewCandle) {
            // ✅ PATH 1: NEW CANDLE - Update anchor with CLOSED candle
            const closedPrice = prices[prices.length - 2];
            const oldestInClosedWindow = prices[prices.length - period - 1];

            cached.runningSum = cached.runningSum - oldestInClosedWindow + closedPrice;

            const currentPrice = prices[prices.length - 1];
            const oldestInCurrentWindow = prices[prices.length - period];
            const preview = (cached.runningSum - oldestInCurrentWindow + currentPrice) / period;

            cached.values.push(preview);
            return { time: update.time, value: preview };

        } else {
            // ✅ PATH 2: FORMING CANDLE - Preview only, NO cache mutation
            const currentPrice = prices[prices.length - 1];
            const oldestInCurrentWindow = prices[prices.length - period];
            const preview = (cached.runningSum - oldestInCurrentWindow + currentPrice) / period;

            return { time: update.time, value: preview };
        }
    }

    public getLatestSMA(period: number = 20, source: PriceSource = 'close'): number | null {
        const cacheKey = `${period}_${source}`;

        if (this.cache.sma.has(cacheKey)) {
            const cached = this.cache.sma.get(cacheKey)!;
            const lastValue = cached.values[cached.values.length - 1];
            return lastValue !== undefined ? lastValue : null;
        }

        const smaValues = this.calculateSMA(period, source);
        for (let i = smaValues.length - 1; i >= 0; i--) {
            if (!isNaN(smaValues[i].value)) return smaValues[i].value;
        }

        return null;
    }

    // ==================== EXPONENTIAL MOVING AVERAGE (EMA) ====================

    public calculateEMA(period: number = 20, source: PriceSource = 'close'): IndicatorPoint[] {
        if (this.ohlcData.length < period) {
            return this.ohlcData.map(candle => ({
                time: candle.time,
                value: NaN
            }));
        }

        const prices = this.extractPrices(source);
        const emaValues: IndicatorPoint[] = [];
        const cacheKey = `${period}_${source}`;

        const multiplier = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((sum, val) => sum + val, 0) / period;

        for (let i = 0; i < prices.length; i++) {
            if (i < period - 1) {
                emaValues.push({ time: this.ohlcData[i].time, value: NaN });
            } else if (i === period - 1) {
                emaValues.push({ time: this.ohlcData[i].time, value: ema });
            } else {
                ema = (prices[i] - ema) * multiplier + ema;
                emaValues.push({ time: this.ohlcData[i].time, value: ema });
            }
        }

        const validValues = emaValues.filter(v => !isNaN(v.value)).map(v => v.value);
        if (validValues.length > 0) {
            this.cache.ema.set(cacheKey, { lastValue: ema, multiplier, values: validValues });
        }

        return emaValues;
    }

    private handleEMAUpdate(
        cacheKey: string,
        period: number,
        source: PriceSource,
        update: OHLCData,
        isNewCandle: boolean
    ): IndicatorPoint | null {
        if (this.ohlcData.length < period) return null;

        if (!this.cache.ema.has(cacheKey)) {
            this.calculateEMA(period, source);
            if (!this.cache.ema.has(cacheKey)) return null;
        }

        const cached = this.cache.ema.get(cacheKey)!;
        const prices = this.cache.prices.get(source);
        if (!prices || prices.length < period + 1) return null;

        const newPrice = prices[prices.length - 1];
        if (newPrice === null || isNaN(newPrice)) return null;

        if (isNewCandle) {
            // ✅ PATH 1: NEW CANDLE - Update anchor with CLOSED candle
            const closedPrice = prices[prices.length - 2];
            cached.lastValue = (closedPrice - cached.lastValue) * cached.multiplier + cached.lastValue;

            const formingEMA = (newPrice - cached.lastValue) * cached.multiplier + cached.lastValue;
            cached.values.push(formingEMA);
            return { time: update.time, value: formingEMA };

        } else {
            // ✅ PATH 2: FORMING CANDLE - Preview only, NO cache mutation
            const formingEMA = (newPrice - cached.lastValue) * cached.multiplier + cached.lastValue;
            return { time: update.time, value: formingEMA };
        }
    }

    public getLatestEMA(period: number = 20, source: PriceSource = 'close'): number | null {
        const cacheKey = `${period}_${source}`;

        if (this.cache.ema.has(cacheKey)) {
            const cached = this.cache.ema.get(cacheKey)!;
            const lastValue = cached.values[cached.values.length - 1];
            return lastValue !== undefined ? lastValue : null;
        }

        const emaValues = this.calculateEMA(period, source);
        for (let i = emaValues.length - 1; i >= 0; i--) {
            if (!isNaN(emaValues[i].value)) return emaValues[i].value;
        }

        return null;
    }

    // ==================== RELATIVE STRENGTH INDEX (RSI) ====================

    public calculateRSI(period: number = 14, source: PriceSource = 'close'): IndicatorPoint[] {
        if (this.ohlcData.length < period + 1) {
            return this.ohlcData.map(candle => ({
                time: candle.time,
                value: NaN
            }));
        }

        const prices = this.extractPrices(source);
        const rsiValues: IndicatorPoint[] = [];
        const cacheKey = `${period}_${source}`;

        let avgGain = 0;
        let avgLoss = 0;

        for (let i = 1; i <= period; i++) {
            const change = prices[i] - prices[i - 1];
            if (change >= 0) avgGain += change;
            else avgLoss -= change;
        }

        avgGain = avgGain / period;
        avgLoss = avgLoss / period;

        let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        let rsi = 100 - (100 / (1 + rs));

        for (let i = 0; i < period; i++) {
            rsiValues.push({ time: this.ohlcData[i].time, value: NaN });
        }

        rsiValues[period - 1] = { time: this.ohlcData[period - 1].time, value: rsi };

        for (let i = period; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            const gain = Math.max(0, change);
            const loss = Math.max(0, -change);

            avgGain = ((avgGain * (period - 1)) + gain) / period;
            avgLoss = ((avgLoss * (period - 1)) + loss) / period;

            rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            rsi = 100 - (100 / (1 + rs));
            rsi = Math.max(0, Math.min(100, rsi));

            rsiValues.push({ time: this.ohlcData[i].time, value: rsi });
        }

        const validValues = rsiValues.filter(v => !isNaN(v.value)).map(v => v.value);
        if (validValues.length > 0) {
            this.cache.rsi.set(cacheKey, { avgGain, avgLoss, values: validValues });
        }

        return rsiValues;
    }

    private handleRSIUpdate(
        cacheKey: string,
        period: number,
        source: PriceSource,
        update: OHLCData,
        isNewCandle: boolean
    ): IndicatorPoint | null {
        if (this.ohlcData.length < period + 2) return null;

        if (!this.cache.rsi.has(cacheKey)) {
            this.calculateRSI(period, source);
            if (!this.cache.rsi.has(cacheKey)) return null;
        }

        const cached = this.cache.rsi.get(cacheKey)!;
        const prices = this.cache.prices.get(source);
        if (!prices || prices.length < 3) return null;

        const newPrice = prices[prices.length - 1];
        if (newPrice === null || isNaN(newPrice)) return null;

        if (isNewCandle) {
            // ✅ PATH 1: NEW CANDLE - Update anchor with CLOSED candles only
            const closedPrice = prices[prices.length - 2];
            const prevClosed = prices[prices.length - 3];

            const closedChange = closedPrice - prevClosed;
            cached.avgGain = (cached.avgGain * (period - 1) + Math.max(0, closedChange)) / period;
            cached.avgLoss = (cached.avgLoss * (period - 1) + Math.max(0, -closedChange)) / period;

            // ✅ Preview for forming candle
            const liveChange = newPrice - closedPrice;
            const tempGain = (cached.avgGain * (period - 1) + Math.max(0, liveChange)) / period;
            const tempLoss = (cached.avgLoss * (period - 1) + Math.max(0, -liveChange)) / period;

            const rs = tempLoss === 0 ? 100 : tempGain / tempLoss;
            const previewRSI = Math.max(0, Math.min(100, 100 - (100 / (1 + rs))));

            cached.values.push(previewRSI);
            return { time: update.time, value: previewRSI };

        } else {
            // ✅ PATH 2: FORMING CANDLE - Preview only, NO cache mutation
            const prevClosed = prices[prices.length - 2];
            const liveChange = newPrice - prevClosed;
            const tempGain = (cached.avgGain * (period - 1) + Math.max(0, liveChange)) / period;
            const tempLoss = (cached.avgLoss * (period - 1) + Math.max(0, -liveChange)) / period;

            const rs = tempLoss === 0 ? 100 : tempGain / tempLoss;
            const previewRSI = Math.max(0, Math.min(100, 100 - (100 / (1 + rs))));

            return { time: update.time, value: previewRSI };
        }
    }

    public getLatestRSI(period: number = 14, source: PriceSource = 'close'): number | null {
        const cacheKey = `${period}_${source}`;

        if (this.cache.rsi.has(cacheKey)) {
            const cached = this.cache.rsi.get(cacheKey)!;
            const lastValue = cached.values[cached.values.length - 1];
            return lastValue !== undefined ? lastValue : null;
        }

        const rsiValues = this.calculateRSI(period, source);
        for (let i = rsiValues.length - 1; i >= 0; i--) {
            if (!isNaN(rsiValues[i].value)) return rsiValues[i].value;
        }

        return null;
    }

    // ==================== BATCH CALCULATION ====================

    public calculateIndicator(
        indicatorType: 'SMA' | 'EMA' | 'RSI',
        settings: IndicatorSettings
    ): IndicatorPoint[] {
        const { period, source } = settings;

        switch (indicatorType.toUpperCase()) {
            case 'SMA': return this.calculateSMA(period, source as PriceSource);
            case 'EMA': return this.calculateEMA(period, source as PriceSource);
            case 'RSI': return this.calculateRSI(period, source as PriceSource);
            default: throw new Error(`Unsupported indicator type: ${indicatorType}`);
        }
    }

    public getLatestValue(
        indicatorType: 'SMA' | 'EMA' | 'RSI',
        settings: IndicatorSettings
    ): number | null {
        const { period, source } = settings;

        switch (indicatorType.toUpperCase()) {
            case 'SMA': return this.getLatestSMA(period, source as PriceSource);
            case 'EMA': return this.getLatestEMA(period, source as PriceSource);
            case 'RSI': return this.getLatestRSI(period, source as PriceSource);
            default: return null;
        }
    }

    // ==================== UPDATE CALCULATION (O(1) EFFICIENT) ====================

    public calculateUpdate(
        indicatorType: 'SMA' | 'EMA' | 'RSI',
        settings: IndicatorSettings,
        update: OHLCData
    ): IndicatorPoint | null {
        const { period, source } = settings;

        if (this.ohlcData.length === 0) return null;

        const cacheKey = `${period}_${source}`;

        // ✅ Determine isNewCandle BEFORE mutating data
        const lastCandle = this.ohlcData[this.ohlcData.length - 1];
        const isNewCandle = lastCandle.time !== update.time;

        // Get or build price cache
        let priceCache = this.cache.prices.get(source as PriceSource);
        if (!priceCache) {
            priceCache = this.extractPrices(source as PriceSource);
        }

        // Update OHLC data
        this.updateOHLCData(update);

        // Update price cache
        const newPrice = this.getLatestPrice(source as PriceSource);
        if (newPrice === null) return null;

        if (isNewCandle) {
            priceCache.push(newPrice);
        } else if (priceCache.length > 0) {
            priceCache[priceCache.length - 1] = newPrice;
        } else {
            priceCache.push(newPrice);
        }

        this.cache.prices.set(source as PriceSource, priceCache);

        switch (indicatorType.toUpperCase()) {
            case 'SMA': return this.handleSMAUpdate(cacheKey, period, source as PriceSource, update, isNewCandle);
            case 'EMA': return this.handleEMAUpdate(cacheKey, period, source as PriceSource, update, isNewCandle);
            case 'RSI': return this.handleRSIUpdate(cacheKey, period, source as PriceSource, update, isNewCandle);
            default:    return null;
        }
    }

    // ==================== VALIDATION ====================

    public validateSettings(settings: IndicatorSettings): { valid: boolean; error?: string } {
        if (settings.period < 1) {
            return { valid: false, error: 'Period must be >= 1' };
        }

        const validSources: PriceSource[] = ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4'];
        if (!validSources.includes(settings.source as PriceSource)) {
            return { valid: false, error: `Invalid source. Must be one of: ${validSources.join(', ')}` };
        }

        return { valid: true };
    }

    // ==================== HELPER METHODS ====================

    public filterValidValues(points: IndicatorPoint[]): IndicatorPoint[] {
        return points.filter(point => !isNaN(point.value));
    }

    public formatForChart(points: IndicatorPoint[]): { time: number; value: number }[] {
        return this.filterValidValues(points);
    }

    // ==================== INFO METHODS ====================

    public getSupportedIndicators(): string[] {
        return ['SMA', 'EMA', 'RSI'];
    }

    public getIndicatorInfo(indicatorType: 'SMA' | 'EMA' | 'RSI'): {
        name: string;
        description: string;
        defaultPeriod: number;
        defaultSource: PriceSource;
        minPeriod: number;
        supportedSources: PriceSource[];
    } {
        const info = {
            'SMA': {
                name: 'Simple Moving Average',
                description: 'Average price over a specified period',
                defaultPeriod: 20,
                defaultSource: 'close' as PriceSource,
                minPeriod: 2,
                supportedSources: ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4'] as PriceSource[]
            },
            'EMA': {
                name: 'Exponential Moving Average',
                description: 'Weighted average giving more importance to recent prices',
                defaultPeriod: 20,
                defaultSource: 'close' as PriceSource,
                minPeriod: 2,
                supportedSources: ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4'] as PriceSource[]
            },
            'RSI': {
                name: 'Relative Strength Index',
                description: 'Momentum oscillator measuring speed and change of price movements',
                defaultPeriod: 14,
                defaultSource: 'close' as PriceSource,
                minPeriod: 2,
                supportedSources: ['close', 'open', 'high', 'low'] as PriceSource[]
            }
        };

        return info[indicatorType];
    }
}