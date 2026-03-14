// ================================================================
// ⚡ CHART CORE - Orchestrator
// ================================================================

import { MainChart, InitialDataParams, UpdateDataParams } from './chart-engine/index';
import { ChartLegend } from './legend/index';
import { ChartDataManager } from './chart-data-manager';
import { ChartDrawingModule } from './drawingtools/index';
import { UserPriceAlerts } from './price-alerts';
import { getDecimalPrecision, getPriceFormatter } from './chart-utils';
import { ChartUI } from './ui/chart-ui';
import { ChartContextMenu } from './ui/context-menu';
import { DrawingToolsConfig, LegendItem } from './chart-types';
import { WebSocketMessage } from '../types';

export class ChartModule {
    private mainChart:        MainChart;
    private chartDataManager: ChartDataManager;
    private chartContainer:   HTMLElement | null = null;
    private drawingModule:    ChartDrawingModule | null = null;
    private chartLegend:      ChartLegend | null = null;
    private priceAlerts:      UserPriceAlerts | null = null;
    private chartUI:          ChartUI | null = null;
    private contextMenu:      ChartContextMenu | null = null;
    private resizeObserver:   ResizeObserver | null = null;

    // ==================== LAZY LOADED MODULES ====================
    private indicatorManager: any | null = null;
    public  strategyManager:  any | null = null;

    private indicatorLoading: boolean = false;
    private strategyLoading:  boolean = false;

    // ✅ Modern AbortController — one abort() removes all listeners
    private abortController: AbortController | null = null;

    private _currentSymbol:    string;
    private _currentTimeframe: string;

    public get currentSymbol(): string    { return this._currentSymbol; }
    public get currentTimeframe(): string { return this._currentTimeframe; }

    private visibilityMap: Map<string, boolean> = new Map();

    constructor() {
        console.log('📈 Chart Module Initialized');

        this._currentSymbol    = localStorage.getItem('last_symbol')    || 'EURUSD';
        this._currentTimeframe = localStorage.getItem('last_timeframe') || 'H1';

        this.chartDataManager = new ChartDataManager();
        this.mainChart = new MainChart(
            this._currentSymbol,
            this._currentTimeframe,
            this.chartDataManager
        );

        this.mainChart.onChartReady = () => this.onChartReady();

        this.mainChart.onInitialDataLoaded = (detail) => this.onInitialDataLoaded(detail);

        this.mainChart.onPriceUpdate = (price) => {
            if (this.chartLegend) {
                this.chartLegend.update({
                    price,
                    precision: getDecimalPrecision(this._currentSymbol)
                });
            }
            const latestOHLC = this.chartDataManager.getLatestOHLC();
            if (latestOHLC) this.indicatorManager?.updateLatestValues(latestOHLC);
        };

        this.mainChart.onSymbolChange = (symbol) => {
            this._currentSymbol = symbol;
            document.dispatchEvent(new CustomEvent('symbol-changed', {
                detail: { symbol }
            }));
        };

        this.mainChart.onTimeframeChange = (timeframe) => {
            this._currentTimeframe = timeframe;
            document.dispatchEvent(new CustomEvent('timeframe-changed', {
                detail: { timeframe }
            }));
        };

        this.mainChart.onStateChange = (state) => {
            if (state === 'READY') {
                this.indicatorManager?.recalculate();
            }
        };

        this.mainChart.onVolumeUpdate = (volume, isBullish) => {
            if (this.chartLegend) {
                this.chartLegend.updateVolume(volume, isBullish);
            }
        };

        this.mainChart.onVolumeToggle = (visible: boolean) => {
            if (this.chartLegend) {
                this.chartLegend.update({ volumeVisible: visible });
            }
        };

        // ✅ Series has data — safe to restore drawings
        // This fires from inside setData() — perfectly synced
        this.mainChart.onSeriesDataReady = () => {
            this.drawingModule?.onDataReady()
        }

        // ✅ Series about to be destroyed — clear tools first
        // Prevents "Chart API not available" crash
        this.mainChart.onBeforeSeriesRemoved = () => {
            this.drawingModule?.clearToolsOnly()
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    // ==================== INITIALIZATION ====================

    private initialize(): void {
        try {
            this.chartContainer = document.getElementById('tvChart');
            if (!this.chartContainer) {
                console.error('❌ Chart container #tvChart not found');
                return;
            }
            this.setupEventListeners();
            this.setupResizeObserver();
            this.loadChart();
        } catch (error) {
            console.error('❌ Chart Module initialization failed:', error);
        }
    }

    private async loadChart(): Promise<void> {
        if (!this.chartContainer) return;
        if (!this.mainChart.getChart()) {
            await this.mainChart.loadChart(this.chartContainer);
        }
    }

    private setupResizeObserver(): void {
        if (!this.chartContainer) return;

        this.resizeObserver = new ResizeObserver(() => {
            const chart = this.mainChart.getChart();
            if (chart && this.chartContainer) {
                const container = this.chartContainer;
                requestAnimationFrame(() => {
                    chart.resize(container.clientWidth, container.clientHeight, true);
                });
            }
        });

        this.resizeObserver.observe(this.chartContainer);
    }

    // ==================== CHART READY ====================

    private onChartReady(): void {
        this.initializeLegend();
        this.initializeDrawingModule();
        this.initializePriceAlerts();
        this.initializeChartUI();
        this.initializeContextMenu();
        this.setupCrosshairTracking();

        document.dispatchEvent(new CustomEvent('chart-ready', {
            detail: {
                symbol:        this._currentSymbol,
                timeframe:     this._currentTimeframe,
                volumeVisible: this.mainChart.isVolumeVisible()
            }
        }));
    }

    private onInitialDataLoaded(detail: any): void {
        if (detail.symbol && detail.symbol !== this._currentSymbol) {
            this._currentSymbol = detail.symbol;
        }
        document.dispatchEvent(new CustomEvent('chart-initial-data-loaded', { detail }));
    }

    // ==================== EAGER MODULE INITIALIZATION ====================

    private initializeLegend(): void {
        if (!this.chartContainer) return;
        this.chartLegend = new ChartLegend(this.chartContainer);
        this.chartLegend.initialize();
        this.chartLegend.update({
            symbol:        this._currentSymbol,
            timeframe:     this._currentTimeframe,
            precision:     getDecimalPrecision(this._currentSymbol),
            volumeVisible: this.mainChart.isVolumeVisible()
        });
    }

    private initializeDrawingModule(): void {
        const chart  = this.mainChart.getChart();
        const series = this.mainChart.getSeries();
        if (!chart || !series) return;

        const config: DrawingToolsConfig = {
            precision:      getDecimalPrecision(this._currentSymbol),
            showLabels:     true,
            priceFormatter: getPriceFormatter(this._currentSymbol)
        };

        this.drawingModule = new ChartDrawingModule(
            chart,
            series,
            config,
            undefined,
            this._currentSymbol,
            this._currentTimeframe
        );
        this.drawingModule.initialize();
        console.log('✅ Drawing Module initialized');
    }

    private initializePriceAlerts(): void {
        const series = this.mainChart.getSeries();
        if (!series) return;

        try {
            this.priceAlerts = null;
            this.priceAlerts = new UserPriceAlerts();
            this.priceAlerts.setSymbolName(this._currentSymbol);
            series.attachPrimitive(this.priceAlerts);
        } catch (error) {
            console.error('❌ Failed to initialize price alerts:', error);
        }
    }

    private initializeChartUI(): void {
        this.chartUI = new ChartUI(
            {
                onSymbolChange:    (symbol)    => this.handleSymbolChange(symbol),
                onTimeframeChange: (timeframe) => this.handleTimeframeChange(timeframe),
                onChartTypeChange: (chartType) => this.handleChartTypeChange(chartType)
            },
            this._currentSymbol,
            this._currentTimeframe,
            this.mainChart.currentChartType
        );
        this.chartUI.initialize();
        console.log('✅ Chart UI initialized');
    }

    private initializeContextMenu(): void {
        this.contextMenu = new ChartContextMenu();
        console.log('✅ Context menu initialized');
    }

    // ==================== LAZY LOADERS ====================

    private async loadIndicatorManager(): Promise<void> {
        if (this.indicatorManager || this.indicatorLoading) return;
        this.indicatorLoading = true;

        try {
            const chart = this.mainChart.getChart();
            if (!chart) return;

            const { IndicatorManager } = await import('./indicator/index');

            this.indicatorManager = new IndicatorManager();
            this.indicatorManager.setMainChart(this.mainChart);
            this.indicatorManager.setChart(chart);
            this.indicatorManager.setSymbol(this._currentSymbol);
            this.indicatorManager.initialize(this.chartDataManager);

            this.indicatorManager.onPaneCreated = async (pane: any) => {
                if (this.chartLegend) {
                    await this.chartLegend.createPaneLegend(pane);
                }
            };

            console.log('✅ Indicator Manager lazy loaded');
        } catch (error) {
            console.error('❌ Failed to lazy load indicator manager:', error);
        } finally {
            this.indicatorLoading = false;
        }
    }

    private async loadStrategyManager(): Promise<void> {
        if (this.strategyManager || this.strategyLoading) return;
        this.strategyLoading = true;

        try {
            const chart = this.mainChart.getChart();
            if (!chart) return;

            const { FrontendStrategyManager } = await import('./strategy-manager');

            this.strategyManager = new FrontendStrategyManager();
            this.strategyManager.setChart(chart);
            this.strategyManager.setSymbol(this._currentSymbol);
            this.strategyManager.initialize();
            console.log('✅ Strategy Manager lazy loaded');
        } catch (error) {
            console.error('❌ Failed to lazy load strategy manager:', error);
        } finally {
            this.strategyLoading = false;
        }
    }

    // ==================== CROSSHAIR ====================

    private setupCrosshairTracking(): void {
        const chart  = this.mainChart.getChart();
        const series = this.mainChart.getSeries();
        if (!chart || !series) return;

        let lastPrice:      number | null = null;
        let lastUpdateTime: number = 0;
        const THROTTLE_MS = 16;

        chart.subscribeCrosshairMove((param: any) => {
            if (!param.time || !param.point) {
                if (lastPrice !== null) {
                    lastPrice = null;
                    if (this.chartLegend) {
                        this.chartLegend.update({
                            price:     null,
                            precision: getDecimalPrecision(this._currentSymbol)
                        });
                    }
                }
                return;
            }

            const now = Date.now();
            if (now - lastUpdateTime < THROTTLE_MS) return;
            lastUpdateTime = now;

            const seriesData = param.seriesData?.get(series);
            if (!seriesData) return;

            const price = this.mainChart.currentChartType === 'candlestick'
                ? seriesData.close
                : seriesData.value || seriesData.close;

            if (price === undefined) return;

            if (lastPrice !== price) {
                lastPrice = price;
                if (this.chartLegend) {
                    this.chartLegend.update({
                        price,
                        precision: getDecimalPrecision(this._currentSymbol)
                    });
                }
            }

            if (this.drawingModule) {
                this.drawingModule.onCrosshairMove(param);
            }
        });
    }

    // ==================== CALLED BY MODULE MANAGER ====================

    public updateWithWebSocketData(data: WebSocketMessage): void {
        if (!data || !data.type) return;

        if (data.type === 'initial') {
            const params: InitialDataParams = {
                data:      data.data,
                symbol:    data.symbol,
                timeframe: data.timeframe
            };
            this.mainChart.handleInitialData(params);
        } else if (data.type === 'update') {
            const params: UpdateDataParams = {
                data:      data.data,
                symbol:    data.symbol,
                timeframe: data.timeframe
            };
            this.mainChart.handleUpdate(params);
        }
    }

    public handleSymbolChange(symbol: string): void {
        if (this._currentSymbol === symbol) return;
        this._currentSymbol = symbol;
        this.mainChart.handleSymbolChange(symbol);
        this.strategyManager?.clearAll();
        this.visibilityMap.clear();

        this.indicatorManager?.setSymbol(symbol);
        this.strategyManager?.setSymbol(symbol);

        if (this.chartLegend) {
            this.chartLegend.update({
                symbol,
                precision: getDecimalPrecision(symbol)
            });
        }
        if (this.chartUI) this.chartUI.updateSymbol(symbol);

        // ✅ Save + update tracking only
        // clearToolsOnly + loadDrawings handled by onBeforeSeriesRemoved + onSeriesDataReady
        this.drawingModule?.onSymbolChange(symbol);
    }

    public handleTimeframeChange(timeframe: string): void {
        if (this._currentTimeframe === timeframe) return;
        this._currentTimeframe = timeframe;
        this.mainChart.handleTimeframeChange(timeframe);
        this.strategyManager?.clearAll();
        this.visibilityMap.clear();

        if (this.chartLegend) {
            this.chartLegend.update({ timeframe });
        }
        if (this.chartUI) this.chartUI.updateTimeframe(timeframe);

        // ✅ Save + update tracking only
        // clearToolsOnly + loadDrawings handled by onBeforeSeriesRemoved + onSeriesDataReady
        this.drawingModule?.onTimeframeChange(timeframe);
    }

    public handleChartTypeChange(newChartType: string): void {
        if (this.mainChart.currentChartType === newChartType) return;

        // ✅ onBeforeSeriesRemoved will fire inside createSeries()
        // drawing tools cleared automatically before series destroyed
        this.mainChart.setChartType(newChartType);

        if (this.drawingModule) {
            this.drawingModule.destroy();
            this.drawingModule = null;
            this.initializeDrawingModule();
        }

        this.initializePriceAlerts();
        if (this.chartUI) this.chartUI.updateChartType(newChartType);
    }

    public setDrawingState(isActive: boolean): void {
        if (!this.drawingModule) return;
        if (isActive) this.drawingModule.activateDrawingMode();
        else          this.drawingModule.deactivateDrawingMode();
    }

    public setSelectionState(isActive: boolean): void {
        if (!this.drawingModule) return;
        if (isActive) this.drawingModule.activateSelectionMode();
        else          this.drawingModule.deactivateSelectionMode();
    }

    // ==================== DOWNLOAD ====================

    private triggerChartDownload(): void {
        const dataUrl = this.mainChart.downloadChart();
        if (dataUrl) {
            const link      = document.createElement('a');
            link.download   = `chart-${this._currentSymbol}-${this._currentTimeframe}-${new Date().toISOString().split('T')[0]}.png`;
            link.href       = dataUrl;
            link.click();
        }
    }

    // ==================== EVENT LISTENERS ====================

    private setupEventListeners(): void {
        this.abortController = new AbortController();
        const { signal } = this.abortController;

        document.addEventListener('chart-reset-request',          () => this.mainChart.resetView(), { signal });
        document.addEventListener('chart-download-request',       () => this.triggerChartDownload(), { signal });
        document.addEventListener('chart-toggle-grid',            () => this.mainChart.toggleGrid(), { signal });
        document.addEventListener('chart-toggle-crosshair',       () => this.mainChart.toggleCrosshair(), { signal });
        document.addEventListener('chart-toggle-timescale',       () => this.mainChart.toggleTimeScale(), { signal });
        document.addEventListener('chart-toggle-grid-vertical',   () => this.mainChart.toggleGridVertical(), { signal });
        document.addEventListener('chart-toggle-grid-horizontal', () => this.mainChart.toggleGridHorizontal(), { signal });

        document.addEventListener('chart-toggle-volume', async () => {
            await this.mainChart.toggleVolume();
        }, { signal });

        document.addEventListener('chart-type-changed', (e: Event) => {
            const { chartType } = (e as CustomEvent).detail;
            if (chartType) this.handleChartTypeChange(chartType);
        }, { signal });

        document.addEventListener('hotkey-global-action', (e: Event) => {
            const { action } = (e as CustomEvent).detail;
            switch (action) {
                case 'fullscreen':     this.toggleFullscreen();      break;
                case 'chart-reset':    this.mainChart.resetView();   break;
                case 'chart-download': this.triggerChartDownload();  break;
            }
        }, { signal });

        document.addEventListener('chart-start-drawing', (e: Event) => {
            const { toolType } = (e as CustomEvent).detail;
            if (toolType) this.drawingModule?.startDrawing(toolType);
        }, { signal });

        document.addEventListener('chart-clear-drawings', () => {
            this.drawingModule?.clearAllDrawings();
        }, { signal });

        document.addEventListener('chart-connection-status', (e: Event) => {
            const { status } = (e as CustomEvent).detail;
            if (status && this.chartLegend) {
                this.chartLegend.updateConnectionStatus(status);
            }
        }, { signal });

        document.addEventListener('mt5-status-changed', (e: Event) => {
            const { connected } = (e as CustomEvent).detail;
            if (this.chartLegend) {
                this.chartLegend.updateConnectionStatus(
                    connected ? 'connected' : 'disconnected'
                );
            }
        }, { signal });

        document.addEventListener('chart-settings-modal-request', () => {
            import('./ui/chart-settings-modal').then(({ ChartSettingsModal }) => {
                const modal = new ChartSettingsModal({
                    colors:    this.mainChart.getColors(),
                    chartType: this.mainChart.currentChartType,
                    symbol:    this._currentSymbol
                });
                modal.open();
            });
        }, { signal });

        document.addEventListener('chart-colors-change', (e: Event) => {
            const { colors } = (e as CustomEvent).detail;
            this.mainChart.updateChartColors(colors);
        }, { signal });

        document.addEventListener('chart-scale-change', (e: Event) => {
            this.mainChart.applyScaleOptions((e as CustomEvent).detail);
        }, { signal });

        document.addEventListener('chart-scale-margins', (e: Event) => {
            const { top, bottom } = (e as CustomEvent).detail;
            this.mainChart.applyScaleMargins(top, bottom);
        }, { signal });

        document.addEventListener('chart-scale-position', (e: Event) => {
            const { position } = (e as CustomEvent).detail;
            this.mainChart.applyScalePosition(position);
        }, { signal });

        document.addEventListener('chart-font-size', (e: Event) => {
            const { size } = (e as CustomEvent).detail;
            this.mainChart.applyFontSize(size);
        }, { signal });

        document.addEventListener('chart-crosshair-style', (e: Event) => {
            const { style } = (e as CustomEvent).detail;
            this.mainChart.applyCrosshairStyle(style);
        }, { signal });

        document.addEventListener('chart-bar-spacing', (e: Event) => {
            const { spacing } = (e as CustomEvent).detail;
            if (spacing !== undefined) this.mainChart.applyBarSpacing(spacing);
        }, { signal });

        document.addEventListener('chart-time-visible', (e: Event) => {
            const { visible } = (e as CustomEvent).detail;
            if (visible !== undefined) this.mainChart.applyTimeVisible(visible);
        }, { signal });

        document.addEventListener('chart-watermark', (e: Event) => {
            const { visible, color } = (e as CustomEvent).detail;
            if (visible !== undefined) this.mainChart.applyWatermark(visible, color);
        }, { signal });

        // ==================== BID / ASK ====================

        document.addEventListener('price-update', (e: Event) => {
            const { bid, ask } = (e as CustomEvent).detail;
            if (bid !== undefined && ask !== undefined) {
                this.mainChart.updateBidAsk(bid, ask);
            }
        }, { signal });

        document.addEventListener('chart-setting-toggle', (e: Event) => {
            const { key, value } = (e as CustomEvent).detail;
            if (key === 'showBid') this.mainChart.toggleBidAsk('bid', value);
            if (key === 'showAsk') this.mainChart.toggleBidAsk('ask', value);
        }, { signal });

        // ==================== INDICATORS ====================

        document.addEventListener('indicator-added', (e: Event) => {
            const item = (e as CustomEvent).detail as LegendItem;
            if (item && this.chartLegend) {
                this.chartLegend.addItem(item);
            }
        }, { signal });

        document.addEventListener('indicator-value-update', (e: Event) => {
            const { id, value, values } = (e as CustomEvent).detail;
            if (!this.chartLegend) return;
            if (values) {
                this.chartLegend.updateItemValues(id, values);
            } else if (value) {
                this.chartLegend.updateItemValue(id, value);
            }
        }, { signal });

        document.addEventListener('indicator-name-update', (e: Event) => {
            const { id, name, settings } = (e as CustomEvent).detail;
            if (this.chartLegend) {
                this.chartLegend.updateItemName(id, name);
                if (settings) this.chartLegend.updateItemSettings(id, settings);
            }
        }, { signal });

        document.addEventListener('open-item-settings', (e: Event) => {
            const { item } = (e as CustomEvent).detail as { item: LegendItem };
            if (!item) return;

            if (item.icon === 'fa-robot') {
                import('./ui/strategy-settings-modal').then(({ StrategySettingsModal }) => {
                    new StrategySettingsModal(item).open();
                });
            } else {
                import('./ui/indicator-settings-modal').then(({ IndicatorSettingsModal }) => {
                    new IndicatorSettingsModal(item).open();
                });
            }
        }, { signal });

        document.addEventListener('legend-toggle-item', (e: Event) => {
            const { id } = (e as CustomEvent).detail;
            if (!id) return;
            if (this.strategyManager?.hasStrategy(id)) {
                this.strategyManager.toggleVisibility(id);
            } else {
                this.indicatorManager?.toggleVisibility(id);
            }
            const visible = this.toggleVisibilityState(id);
            if (this.chartLegend) {
                this.chartLegend.setItemVisible(id, visible);
            }
        }, { signal });

        document.addEventListener('legend-remove-item', async (e: Event) => {
            const { id } = (e as CustomEvent).detail;
            if (!id) return;

            if (id === 'volume') {
                await this.mainChart.toggleVolume();
            } else if (this.strategyManager?.hasStrategy(id)) {
                this.strategyManager.removeStrategyIndicators(id);
                document.dispatchEvent(new CustomEvent('remove-strategy', {
                    detail: { strategyId: id }
                }));
            } else {
                await this.indicatorManager?.removeIndicator(id);
            }
        }, { signal });

        document.addEventListener('add-indicator', async (e: Event) => {
            const { type, config } = (e as CustomEvent).detail;
            if (!type) return;

            if (type === 'VOLUME') {
                await this.mainChart.toggleVolume();
                return;
            }

            await this.loadIndicatorManager();
            if (type === 'RSI') {
                await this.indicatorManager?.addPaneIndicator(type, config?.settings);
            } else {
                this.indicatorManager?.addIndicator(type, config?.settings);
            }
        }, { signal });

        // ==================== STRATEGIES ====================

        document.addEventListener('strategy_initial', async (e: Event) => {
            await this.loadStrategyManager();
            this.strategyManager?.addStrategyIndicators((e as CustomEvent).detail);
        }, { signal });

        document.addEventListener('strategy_update', async (e: Event) => {
            await this.loadStrategyManager();
            this.strategyManager?.updateStrategyIndicators((e as CustomEvent).detail);
        }, { signal });

        document.addEventListener('tab-switched', (e: Event) => {
            const { tabId } = (e as CustomEvent).detail;
            if (tabId === 'strategy') this.loadStrategyManager();
        }, { signal });

        document.addEventListener('deploy-strategy', () => {
            this.loadStrategyManager();
        }, { signal });
    }

    // ==================== FULLSCREEN ====================

    private toggleFullscreen(): void {
        const chartContainer = document.getElementById('tvChart');
        if (!chartContainer) return;

        if (!document.fullscreenElement) {
            if (chartContainer.requestFullscreen) {
                chartContainer.requestFullscreen();
            } else if ((chartContainer as any).webkitRequestFullscreen) {
                (chartContainer as any).webkitRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if ((document as any).webkitExitFullscreen) {
                (document as any).webkitExitFullscreen();
            }
        }
    }

    // ==================== VISIBILITY TRACKING ====================

    private toggleVisibilityState(id: string): boolean {
        const current = this.visibilityMap.get(id) ?? true;
        const next    = !current;
        this.visibilityMap.set(id, next);
        return next;
    }

    // ==================== PUBLIC API ====================

    public startDrawing(toolType: string): void {
        this.drawingModule?.startDrawing(toolType);
    }

    public clearAllDrawings(): void {
        this.drawingModule?.clearAllDrawings();
    }

    public removeSelectedDrawings(): void {
        this.drawingModule?.removeSelectedDrawings();
    }

    public exportDrawings(): string {
        return this.drawingModule ? this.drawingModule.exportDrawings() : '[]';
    }

    public importDrawings(json: string): void {
        this.drawingModule?.importDrawings(json);
    }

    public getChart(): any                               { return this.mainChart.getChart(); }
    public getDrawingModule(): ChartDrawingModule | null { return this.drawingModule; }
    public getLineTools(): any                           { return this.drawingModule ? this.drawingModule.getLineTools() : null; }
    public isReady(): boolean                            { return this.mainChart.isReady(); }
    public isVolumeVisible(): boolean                    { return this.mainChart.isVolumeVisible(); }
    public getDataManager(): ChartDataManager            { return this.chartDataManager; }

    // ==================== DESTROY ====================

    public async destroy(): Promise<void> {
        this.abortController?.abort();
        this.abortController = null;

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.contextMenu) {
            this.contextMenu.destroy();
            this.contextMenu = null;
        }
        if (this.chartUI) {
            this.chartUI.destroy();
            this.chartUI = null;
        }
        if (this.drawingModule) {
            this.drawingModule.destroy();
            this.drawingModule = null;
        }
        if (this.chartLegend) {
            this.chartLegend.destroy();
            this.chartLegend = null;
        }

        if (this.indicatorManager) {
            await this.indicatorManager.destroy();
            this.indicatorManager = null;
            this.indicatorLoading = false;
        }

        if (this.strategyManager) {
            await this.strategyManager.destroy();
            this.strategyManager  = null;
            this.strategyLoading  = false;
        }

        if (this.chartDataManager) this.chartDataManager.clear();

        this.mainChart.destroy();
    }
}