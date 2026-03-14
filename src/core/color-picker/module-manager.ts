// ================================================================
// ⚡ MODULE MANAGER - Orchestrator
// ================================================================

import { ChartModule as ChartModuleImpl } from '../chart/chart-core';
import { ConnectionManager } from './connection-manager';
import { TradingModule as TradingModuleClass } from '../trading/trading';
import { Notification } from '../notification';
import { Panels } from '../panel';
import { WebSocketMessage, AccountInfo, PositionData } from '../types';

declare global {
    interface Window {
        // CalculatorModule: any;
        // CalculatorModuleInstance: any;
    }
}

export class ModuleManager {
    private chart: ChartModuleImpl | null = null;
    private tradingInstance: InstanceType<typeof TradingModuleClass> | null = null;
    private journalInstance: any | null = null;
    private strategyInstance: any | null = null;

    private journalLoading: boolean = false;
    private strategyLoading: boolean = false;

    private notifications = Notification;
    private panels = Panels;

    constructor(private connectionManager: ConnectionManager) {}

    // ==================== INITIALIZATION ====================

    public initialize(): void {
        this.setupConnectionCallbacks();

        this.initializeNotificationModule();
        this.initializeChartModule();
        this.initializeTradingModule();

        this.setupDOMEventBridge();

        console.log('✅ Module Manager initialized');
    }

    public destroy(): void {
        this.chart?.destroy();
        this.tradingInstance?.destroy();
        this.journalInstance?.destroy();
        this.strategyInstance?.destroy();
        this.notifications.destroy();
    }

    // ==================== CONNECTION CALLBACKS ====================

    private setupConnectionCallbacks(): void {

        // Candle data → Chart only
        this.connectionManager.onCandleData((data: WebSocketMessage) => {
            this.chart?.updateWithWebSocketData(data);
        });

        // Tick data → price-update DOM event → trading module listens
        this.connectionManager.onTickData((data: WebSocketMessage) => {
            document.dispatchEvent(new CustomEvent('price-update', {
                detail: {
                    bid:    data.bid,
                    ask:    data.ask,
                    symbol: data.symbol,
                    spread: data.spread,
                    change: data.change
                }
            }));
        });

        // Account update → Trading
        this.connectionManager.onAccountUpdate((account: AccountInfo) => {
            this.tradingInstance?.updateAccountInfo(account);
        });

        // Positions update → Trading
        this.connectionManager.onPositionsUpdate((positions: PositionData[]) => {
            this.tradingInstance?.updatePositions(positions);
        });

        // Trade executed → Notification + Trading
        this.connectionManager.onTradeExecuted((data: WebSocketMessage) => {
            this.notifications.success(
                `Trade ${data.direction || 'executed'} successfully`,
                { title: 'Trade Executed' }
            );
            this.tradingInstance?.handleTradeConfirmation(data);
        });

        // MT5 status → Chart legend
        this.connectionManager.onMT5Status((connected: boolean, statusText: string) => {
            document.dispatchEvent(new CustomEvent('mt5-status-changed', {
                detail: { connected, statusText }
            }));
        });

        // Connection status → Chart legend
        this.connectionManager.onConnectionStatus((status) => {
            document.dispatchEvent(new CustomEvent('chart-connection-status', {
                detail: { status }
            }));
        });

        // ✅ Strategy data — dispatch as DOM events only
        // chart-core.ts owns all strategy handling exclusively
        this.connectionManager.onStrategyData((data: WebSocketMessage) => {
            switch (data.type) {
                case 'strategy_initial':
                case 'strategy_update':
                case 'strategy_deployed':
                case 'strategy_removed':
                case 'strategy_updated':
                case 'strategy_signal':
                case 'auto_trading_status':
                    // ✅ Fire as DOM event — chart-core listener handles it
                    document.dispatchEvent(new CustomEvent(data.type, {
                        detail: data
                    }));
                    break;

                case 'backtest_results':
                    // ✅ Backtest results → strategy module only
                    this.strategyInstance?.handleBacktestResults(data);
                    break;

                default:
                    console.log(`📨 Unhandled strategy message: ${data.type}`);
            }
        });
    }

    // ==================== DOM EVENT BRIDGE ====================

    private setupDOMEventBridge(): void {

        document.addEventListener('symbol-changed', (e: Event) => {
            const { symbol } = (e as CustomEvent).detail;
            if (!symbol) return;
            this.connectionManager.setSymbol(symbol);
        });

        document.addEventListener('timeframe-changed', (e: Event) => {
            const { timeframe } = (e as CustomEvent).detail;
            if (!timeframe) return;
            this.connectionManager.setTimeframe(timeframe);
        });

        document.addEventListener('chart-initial-data-loaded', () => {
            this.connectionManager.sendCommand('INITIAL_DATA_RECEIVED');
        });

        document.addEventListener('auto-trade-toggled', (e: Event) => {
            const { enabled } = (e as CustomEvent).detail;
            this.connectionManager.setAutoTrading(enabled);
            if (enabled) {
                this.notifications.success('Auto trading is now active', { title: 'Auto Trading Enabled' });
            } else {
                this.notifications.warning('Auto trading has been disabled', { title: 'Auto Trading Disabled' });
            }
        });

        document.addEventListener('execute-trade', (e: Event) => {
            const { command } = (e as CustomEvent).detail;
            if (command) this.connectionManager.sendCommand(command);
        });

        document.addEventListener('close-position', (e: Event) => {
            const { ticket } = (e as CustomEvent).detail;
            if (ticket) this.connectionManager.closePosition(ticket);
        });

        document.addEventListener('close-all-positions', () => {
            this.connectionManager.closeAllPositions();
        });

        // Strategy commands — lazy load strategy module on demand
        document.addEventListener('deploy-strategy', (e: Event) => {
            const { strategyType, symbol, timeframe, params } = (e as CustomEvent).detail;
            if (strategyType && symbol && timeframe) {
                this.connectionManager.deployStrategy(strategyType, symbol, timeframe, params || {});
            }
            this.loadStrategyModule();
        });

        document.addEventListener('remove-strategy', (e: Event) => {
            const { strategyId } = (e as CustomEvent).detail;
            if (strategyId) this.connectionManager.removeStrategy(strategyId);
        });

        document.addEventListener('update-strategy', (e: Event) => {
            const { strategyId, updates } = (e as CustomEvent).detail;
            if (strategyId && updates) this.connectionManager.updateStrategy(strategyId, updates);
        });

        document.addEventListener('get-active-strategies', () => {
            this.connectionManager.getActiveStrategies();
            this.loadStrategyModule();
        });

        document.addEventListener('backtest-strategy', (e: Event) => {
            const { strategyType, symbol, timeframe, days, params } = (e as CustomEvent).detail;
            if (strategyType && symbol && timeframe && days) {
                this.connectionManager.backtestStrategy(strategyType, symbol, timeframe, days, params || {});
            }
            this.loadStrategyModule();
        });

        // Journal — lazy load on demand
        document.addEventListener('hotkey-modal-toggle', (e: Event) => {
            const { modal } = (e as CustomEvent).detail;
            if (modal === 'full-journal') this.loadJournalModule();
        });

        document.addEventListener('show-panel', (e: Event) => {
            const { panel } = (e as CustomEvent).detail;
            if (panel === 'journal') this.loadJournalModule();
            if (panel) this.panels.show(panel);
        });

        // Strategy tab click
        document.addEventListener('tab-switched', (e: Event) => {
            const { tabId } = (e as CustomEvent).detail;
            if (tabId === 'strategy') this.loadStrategyModule();
        });

        document.addEventListener('hotkey-panel-switch', (e: Event) => {
            const { panel } = (e as CustomEvent).detail;
            if (panel) this.panels.show(panel);
        });

        document.addEventListener('show-notification', (e: Event) => {
            const { title, message, type } = (e as CustomEvent).detail;
            this.showNotification(title, message, type);
        });

        document.addEventListener('trade-error', (e: Event) => {
            const { message } = (e as CustomEvent).detail;
            this.notifications.error(message || 'Trade execution failed', { title: 'Trade Error' });
        });

        document.addEventListener('hide-panel', () => {
            this.panels.hide();
        });
    }

    // ==================== LAZY LOADERS ====================

    private async loadJournalModule(): Promise<void> {
        if (this.journalInstance || this.journalLoading) return;
        this.journalLoading = true;

        try {
            const { JournalModule } = await import('../journal/journal');
            this.journalInstance = new JournalModule();
            this.journalInstance.initialize();
            console.log('✅ Journal Module lazy loaded');
        } catch (error) {
            console.error('❌ Failed to lazy load journal:', error);
            this.notifications.error('Failed to load journal module', { title: 'Module Error' });
        } finally {
            this.journalLoading = false;
        }
    }

    private async loadStrategyModule(): Promise<void> {
        if (this.strategyInstance || this.strategyLoading) return;
        this.strategyLoading = true;

        try {
            const { StrategyModule } = await import('../strategy/strategy');
            this.strategyInstance = new StrategyModule(
                () => this.connectionManager.getCurrentSymbol(),
                () => this.connectionManager.getCurrentTimeframe()
            );
            console.log('✅ Strategy Module lazy loaded');
        } catch (error) {
            console.error('❌ Failed to lazy load strategy:', error);
            this.notifications.error('Failed to load strategy module', { title: 'Module Error' });
        } finally {
            this.strategyLoading = false;
        }
    }

    // ==================== MODULE INITIALIZATION ====================

    private initializeChartModule(): void {
        try {
            this.chart = new ChartModuleImpl();
            console.log('✅ Chart Module initialized');
        } catch (error) {
            console.error('❌ Failed to initialize chart:', error);
            this.notifications.error('Failed to initialize chart module', { title: 'Module Error' });
        }
    }

    private initializeTradingModule(): void {
        try {
            this.tradingInstance = new TradingModuleClass();
            console.log('✅ Trading Module initialized');
        } catch (error) {
            console.error('❌ Failed to initialize trading:', error);
            this.notifications.error('Failed to initialize trading module', { title: 'Module Error' });
        }
    }

    private initializeNotificationModule(): void {
        try {
            Notification.initialize();
            console.log('✅ Notification Module initialized');
        } catch (error) {
            console.error('❌ Failed to initialize notifications:', error);
        }
    }

    // ==================== NOTIFICATION HELPER ====================

    public showNotification(
        title: string,
        message: string,
        type: 'success' | 'error' | 'warning' | 'info' = 'info'
    ): void {
        switch (type) {
            case 'success': this.notifications.success(message, { title }); break;
            case 'error':   this.notifications.error(message, { title });   break;
            case 'warning': this.notifications.warning(message, { title }); break;
            case 'info':    this.notifications.info(message, { title });    break;
        }
    }

    // ==================== GETTERS ====================

    public getChart(): ChartModuleImpl | null          { return this.chart; }
    public getTradingModule()                           { return this.tradingInstance; }
    public getJournalModule()                           { return this.journalInstance; }
    public getStrategyModule()                          { return this.strategyInstance; }
    public getConnectionManager(): ConnectionManager    { return this.connectionManager; }
    public getPanelsModule(): typeof Panels             { return this.panels; }
    public getNotificationModule(): typeof Notification { return this.notifications; }
}