// ================================================================
// ⚡ STRATEGY MODULE - Configuration & Backtesting Hub
// ================================================================

import { WebSocketMessage } from '../types';

// ==================== INTERFACES ====================

interface Strategy {
    id: string;
    name: string;
    category: string;
    description: string;
    complexity: 'Beginner' | 'Intermediate' | 'Advanced';
    default_params: Record<string, any>;
}

interface BacktestResult {
    strategy: string;
    market: string;
    days: number;
    timestamp: string;
    summary: {
        total_trades: number;
        winning_trades: number;
        losing_trades: number;
        win_rate: number;
        total_pnl: number;
        total_return_pct: number;
        final_balance: number;
        avg_win: number;
        avg_loss: number;
        profit_factor: number;
        max_drawdown_pct: number;
        sharpe_ratio: number;
    };
    equity_curve?: { time: string; balance: number }[];
    drawdown?: { time: string; value: number }[];
    params: Record<string, any>;
}

// ==================== STRATEGY MODULE ====================

export class StrategyModule {

    private strategies: Record<string, Strategy> = {};
    private lastBacktestResult: BacktestResult | null = null;
    private currentCategory: string = 'indicator';
    private currentConfigStrategy: Strategy | null = null;
    private lastBacktestStrategyId: string | null = null;

    // Bound refs for cleanup
    private boundCategoryClicks: Map<HTMLElement, EventListener> = new Map();
    private boundTabClicks: Map<HTMLElement, EventListener> = new Map();
    private boundDaysSlider: EventListener | null = null;
    private boundBtDaysSlider: EventListener | null = null;
    private boundBtCategory: EventListener | null = null;
    private boundBtStrategy: EventListener | null = null;
    private boundRunBacktest: EventListener | null = null;
    private boundCancelConfig: EventListener | null = null;
    private boundExecuteConfig: EventListener | null = null;
    private boundConfigBacktest: EventListener | null = null;
    private boundDeployFromResult: EventListener | null = null;

    constructor(
        private getSymbol: () => string,
        private getTimeframe: () => string
    ) {
        this.initializeStrategies();
        this.initialize();
    }

    // ==================== INITIALIZATION ====================

    private initialize(): void {
        console.log('⚡ Strategy Module initializing...');
        try {
            this.setupTabs();
            this.setupCategoryNav();
            this.setupBacktestStudio();
            this.setupConfigPanel();
            this.renderStrategyGrid();
            console.log('✅ Strategy Module initialized');
        } catch (error) {
            console.error('❌ Strategy Module initialization failed:', error);
        }
    }

    // ==================== STRATEGY DEFINITIONS ====================

    private initializeStrategies(): void {
        this.strategies = {

            // ── Indicator Based ──
            'ma_crossover': {
                id: 'ma_crossover',
                name: 'MA Crossover',
                category: 'indicator',
                description: 'Dual moving average crossover signal system',
                complexity: 'Beginner',
                default_params: { fast: 10, slow: 30, volume: 0.01 }
            },
            'ema_ribbon': {
                id: 'ema_ribbon',
                name: 'EMA Ribbon',
                category: 'indicator',
                description: 'Multiple EMA convergence and divergence',
                complexity: 'Intermediate',
                default_params: { periods: '5,10,20,30,50', volume: 0.01 }
            },
            'rsi_reversion': {
                id: 'rsi_reversion',
                name: 'RSI Reversion',
                category: 'indicator',
                description: 'Oversold and overbought RSI mean reversion',
                complexity: 'Beginner',
                default_params: { period: 14, oversold: 30, overbought: 70, volume: 0.01 }
            },
            'bollinger_reversion': {
                id: 'bollinger_reversion',
                name: 'Bollinger Reversion',
                category: 'indicator',
                description: 'Mean reversion using Bollinger Band extremes',
                complexity: 'Beginner',
                default_params: { period: 20, std: 2, volume: 0.01 }
            },
            'adx_trend': {
                id: 'adx_trend',
                name: 'ADX Trend',
                category: 'indicator',
                description: 'ADX trend strength filtered directional system',
                complexity: 'Intermediate',
                default_params: { period: 14, threshold: 25, volume: 0.01 }
            },
            'macd_signal': {
                id: 'macd_signal',
                name: 'MACD Signal',
                category: 'indicator',
                description: 'MACD histogram and signal line crossover',
                complexity: 'Beginner',
                default_params: { fast: 12, slow: 26, signal: 9, volume: 0.01 }
            },

            // ── Market Structure ──
            'order_block': {
                id: 'order_block',
                name: 'Order Block',
                category: 'market_structure',
                description: 'Smart money order block detection and trade',
                complexity: 'Advanced',
                default_params: { lookback: 20, volume: 0.01 }
            },
            'fair_value_gap': {
                id: 'fair_value_gap',
                name: 'Fair Value Gap',
                category: 'market_structure',
                description: 'FVG imbalance fill strategy',
                complexity: 'Intermediate',
                default_params: { min_gap: 5, volume: 0.01 }
            },
            'bos_choch': {
                id: 'bos_choch',
                name: 'BOS / CHoCH',
                category: 'market_structure',
                description: 'Break of structure and change of character',
                complexity: 'Advanced',
                default_params: { lookback: 10, volume: 0.01 }
            },
            'support_resistance': {
                id: 'support_resistance',
                name: 'Support & Resistance',
                category: 'market_structure',
                description: 'Dynamic S/R level detection and bounce trading',
                complexity: 'Intermediate',
                default_params: { lookback: 50, strength: 3, volume: 0.01 }
            },

            // ── Pattern ──
            'engulfing': {
                id: 'engulfing',
                name: 'Engulfing',
                category: 'pattern',
                description: 'Bullish and bearish engulfing candle patterns',
                complexity: 'Beginner',
                default_params: { confirmation: 1, volume: 0.01 }
            },
            'pin_bar': {
                id: 'pin_bar',
                name: 'Pin Bar',
                category: 'pattern',
                description: 'Rejection candle pin bar reversal strategy',
                complexity: 'Beginner',
                default_params: { ratio: 0.6, volume: 0.01 }
            },
            'head_shoulders': {
                id: 'head_shoulders',
                name: 'Head & Shoulders',
                category: 'pattern',
                description: 'Classic H&S and inverse H&S reversal pattern',
                complexity: 'Advanced',
                default_params: { lookback: 50, tolerance: 0.02, volume: 0.01 }
            },
            'double_top_bottom': {
                id: 'double_top_bottom',
                name: 'Double Top / Bottom',
                category: 'pattern',
                description: 'Double top and double bottom reversal detection',
                complexity: 'Intermediate',
                default_params: { lookback: 30, tolerance: 0.01, volume: 0.01 }
            },

            // ── Triangular ──
            'triangular_arb': {
                id: 'triangular_arb',
                name: 'Triangular Arbitrage',
                category: 'triangular',
                description: 'Three-pair correlation divergence detection',
                complexity: 'Advanced',
                default_params: { pair1: 'EURUSD', pair2: 'GBPUSD', pair3: 'EURGBP', threshold: 0.001, volume: 0.01 }
            },
            'triangular_ema': {
                id: 'triangular_ema',
                name: 'Triangular EMA',
                category: 'triangular',
                description: 'EMA applied across three correlated pairs',
                complexity: 'Advanced',
                default_params: { pair1: 'EURUSD', pair2: 'GBPUSD', pair3: 'EURGBP', period: 20, volume: 0.01 }
            },

            // ── Pair Correlation ──
            'pair_spread': {
                id: 'pair_spread',
                name: 'Pair Spread',
                category: 'correlation',
                description: 'Correlated pair spread mean reversion',
                complexity: 'Intermediate',
                default_params: { pair1: 'EURUSD', pair2: 'GBPUSD', window: 20, threshold: 2, volume: 0.01 }
            },
            'correlation_hedge': {
                id: 'correlation_hedge',
                name: 'Correlation Hedge',
                category: 'correlation',
                description: 'Hedge via negatively correlated pair exposure',
                complexity: 'Advanced',
                default_params: { pair1: 'EURUSD', pair2: 'USDCHF', ratio: 0.8, volume: 0.01 }
            },

            // ── ML ──
            'ml_classifier': {
                id: 'ml_classifier',
                name: 'ML Classifier',
                category: 'ml',
                description: 'Random Forest price direction classifier',
                complexity: 'Advanced',
                default_params: { n_estimators: 100, features: 'price_volume', volume: 0.01 }
            },
            'volatility_regime': {
                id: 'volatility_regime',
                name: 'Volatility Regime',
                category: 'ml',
                description: 'GARCH regime detection and adaptive sizing',
                complexity: 'Advanced',
                default_params: { p: 1, q: 1, window: 30, volume: 0.01 }
            },
            'lstm_predictor': {
                id: 'lstm_predictor',
                name: 'LSTM Predictor',
                category: 'ml',
                description: 'LSTM neural network price sequence prediction',
                complexity: 'Advanced',
                default_params: { lookback: 60, epochs: 50, volume: 0.01 }
            }
        };
    }

    // ==================== TABS ====================

    private setupTabs(): void {
        const tabs = document.querySelectorAll('.strategy-tab');
        tabs.forEach(tab => {
            const handler: EventListener = (e) => {
                const tabName = (e.currentTarget as HTMLElement).dataset.tab;
                if (tabName) this.switchTab(tabName);
            };
            tab.addEventListener('click', handler);
            this.boundTabClicks.set(tab as HTMLElement, handler);
        });
    }

    public switchTab(tabName: string): void {
        document.querySelectorAll('.strategy-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.strategy-tab-content').forEach(c => c.classList.remove('active'));

        const tab = document.querySelector(`.strategy-tab[data-tab="${tabName}"]`);
        const content = document.getElementById(`${tabName}-tab`);

        if (tab) tab.classList.add('active');
        if (content) content.classList.add('active');

        if (tabName === 'backtest' && this.lastBacktestResult) {
            this.renderBacktestResult(this.lastBacktestResult);
        }
    }

    // ==================== CATEGORY NAV ====================

    private setupCategoryNav(): void {
        const buttons = document.querySelectorAll('.category-btn');
        buttons.forEach(btn => {
            const handler: EventListener = (e) => {
                const category = (e.currentTarget as HTMLElement).dataset.category;
                if (category) this.selectCategory(category);
            };
            btn.addEventListener('click', handler);
            this.boundCategoryClicks.set(btn as HTMLElement, handler);
        });
    }

    private selectCategory(category: string): void {
        this.currentCategory = category;
        this.currentConfigStrategy = null;

        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        const activeBtn = document.querySelector(`.category-btn[data-category="${category}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        this.closeConfigPanel();
        this.renderStrategyGrid();
    }

    // ==================== STRATEGY GRID ====================

    private renderStrategyGrid(): void {
        const grid = document.getElementById('strategy-grid');
        if (!grid) return;

        grid.innerHTML = '';

        if (this.currentCategory === 'custom') {
            this.renderCustomBuilder(grid);
            return;
        }

        const filtered = Object.values(this.strategies)
            .filter(s => s.category === this.currentCategory);

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="strategy-card coming-soon" style="grid-column: 1/-1; pointer-events: none;">
                    <div class="strategy-card-header">
                        <span class="strategy-card-name">Coming Soon</span>
                        <span class="coming-soon-badge">SOON</span>
                    </div>
                    <p class="strategy-card-desc">Strategies for this category are being developed.</p>
                </div>
            `;
            return;
        }

        filtered.forEach(strategy => {
            const card = this.createStrategyCard(strategy);
            grid.appendChild(card);
        });
    }

    private createStrategyCard(strategy: Strategy): HTMLElement {
        const card = document.createElement('div');
        card.className = 'strategy-card';
        card.dataset.id = strategy.id;

        card.innerHTML = `
            <div class="strategy-card-header">
                <span class="strategy-card-name">${strategy.name}</span>
                <span class="complexity-badge ${strategy.complexity.toLowerCase()}">${strategy.complexity}</span>
            </div>
            <p class="strategy-card-desc">${strategy.description}</p>
            <div class="strategy-card-actions">
                <button class="card-btn card-btn-backtest" data-id="${strategy.id}">Backtest</button>
                <button class="card-btn card-btn-deploy" data-id="${strategy.id}">Add to Chart</button>
                <button class="card-btn card-btn-configure" data-id="${strategy.id}">Configure</button>
            </div>
        `;

        card.querySelector('.card-btn-backtest')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.quickBacktest(strategy.id);
        });

        card.querySelector('.card-btn-deploy')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.quickDeploy(strategy.id);
        });

        card.querySelector('.card-btn-configure')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openConfigPanel(strategy.id);
            card.classList.add('selected');
        });

        return card;
    }

    // ==================== CONFIG PANEL ====================

    private setupConfigPanel(): void {
        const cancelBtn = document.getElementById('cancel-config-btn');
        const executeBtn = document.getElementById('execute-config-btn');
        const configBacktestBtn = document.getElementById('config-backtest-btn');

        if (cancelBtn) {
            this.boundCancelConfig = () => this.closeConfigPanel();
            cancelBtn.addEventListener('click', this.boundCancelConfig);
        }

        if (executeBtn) {
            this.boundExecuteConfig = () => this.executeConfig('deploy');
            executeBtn.addEventListener('click', this.boundExecuteConfig);
        }

        if (configBacktestBtn) {
            this.boundConfigBacktest = () => this.executeConfig('backtest');
            configBacktestBtn.addEventListener('click', this.boundConfigBacktest);
        }

        const deployFromResult = document.getElementById('deploy-from-result-btn');
        if (deployFromResult) {
            this.boundDeployFromResult = () => this.deployFromLastBacktest();
            deployFromResult.addEventListener('click', this.boundDeployFromResult);
        }
    }

    private openConfigPanel(strategyId: string): void {
        const strategy = this.strategies[strategyId];
        if (!strategy) return;

        this.currentConfigStrategy = strategy;

        // Deselect all cards
        document.querySelectorAll('.strategy-card').forEach(c => c.classList.remove('selected'));
        const card = document.querySelector(`.strategy-card[data-id="${strategyId}"]`);
        if (card) card.classList.add('selected');

        // Update title
        const nameEl = document.getElementById('config-strategy-name');
        if (nameEl) nameEl.textContent = strategy.name;

        // Render param fields
        this.renderParamFields(strategy, 'param-fields', 'param');

        // Show panel
        const panel = document.getElementById('config-panel');
        const placeholder = document.getElementById('config-placeholder');
        if (panel) panel.classList.remove('hidden');
        if (placeholder) placeholder.style.display = 'none';
    }

    private closeConfigPanel(): void {
        const panel = document.getElementById('config-panel');
        const placeholder = document.getElementById('config-placeholder');

        if (panel) panel.classList.add('hidden');
        if (placeholder) placeholder.style.display = '';

        document.querySelectorAll('.strategy-card').forEach(c => c.classList.remove('selected'));
        this.currentConfigStrategy = null;
    }

    private renderParamFields(strategy: Strategy, containerId: string, prefix: string): void {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        Object.entries(strategy.default_params).forEach(([key, value]) => {
            const div = document.createElement('div');
            div.className = 'param-field';
            div.innerHTML = `
                <label class="param-label">${key.replace(/_/g, ' ')}</label>
                <input
                    type="text"
                    class="param-input"
                    id="${prefix}-${key}"
                    value="${value}"
                >
            `;
            container.appendChild(div);
        });
    }

    private collectParams(strategy: Strategy, prefix: string): Record<string, any> {
        const params: Record<string, any> = {};
        Object.keys(strategy.default_params).forEach(key => {
            const input = document.getElementById(`${prefix}-${key}`) as HTMLInputElement;
            if (input) {
                const val = input.value;
                params[key] = isNaN(Number(val)) ? val : Number(val);
            }
        });
        return params;
    }

    private executeConfig(action: 'deploy' | 'backtest'): void {
        if (!this.currentConfigStrategy) return;

        const symbol = (document.getElementById('config-symbol') as HTMLSelectElement)?.value || this.getSymbol();
        const timeframe = (document.getElementById('config-timeframe') as HTMLSelectElement)?.value || this.getTimeframe();
        const params = this.collectParams(this.currentConfigStrategy, 'param');

        if (action === 'deploy') {
            this.dispatchDeploy(this.currentConfigStrategy.id, symbol, timeframe, params);
            this.closeConfigPanel();
        } else {
            this.lastBacktestStrategyId = this.currentConfigStrategy.id;
            this.dispatchBacktest(this.currentConfigStrategy.id, symbol, timeframe, 30, params);
            this.switchTab('backtest');
        }
    }

    // ==================== QUICK ACTIONS ====================

    private quickDeploy(strategyId: string): void {
        const strategy = this.strategies[strategyId];
        if (!strategy) return;

        this.dispatchDeploy(
            strategy.id,
            this.getSymbol(),
            this.getTimeframe(),
            strategy.default_params
        );
    }

    private quickBacktest(strategyId: string): void {
        const strategy = this.strategies[strategyId];
        if (!strategy) return;

        this.lastBacktestStrategyId = strategyId;

        this.dispatchBacktest(
            strategy.id,
            this.getSymbol(),
            this.getTimeframe(),
            30,
            strategy.default_params
        );

        this.switchTab('backtest');
        this.showNotification('Backtest Started', `Running ${strategy.name} backtest...`, 'info');
    }

    private deployFromLastBacktest(): void {
        if (!this.lastBacktestResult || !this.lastBacktestStrategyId) return;

        const strategy = this.strategies[this.lastBacktestStrategyId];
        if (!strategy) return;

        this.dispatchDeploy(
            strategy.id,
            this.getSymbol(),
            this.getTimeframe(),
            this.lastBacktestResult.params
        );
    }

    // ==================== BACKTEST STUDIO ====================

    private setupBacktestStudio(): void {
        const btCategory = document.getElementById('bt-category');
        const btStrategy = document.getElementById('bt-strategy');
        const btDays = document.getElementById('bt-days');
        const runBtn = document.getElementById('run-backtest-btn');

        if (btCategory) {
            this.boundBtCategory = () => this.updateStudioStrategies();
            btCategory.addEventListener('change', this.boundBtCategory);
        }

        if (btStrategy) {
            this.boundBtStrategy = () => this.updateStudioParams();
            btStrategy.addEventListener('change', this.boundBtStrategy);
        }

        if (btDays) {
            this.boundBtDaysSlider = (e) => {
                const val = (e.target as HTMLInputElement).value;
                const display = document.getElementById('bt-days-value');
                if (display) display.textContent = val;
            };
            btDays.addEventListener('input', this.boundBtDaysSlider);
        }

        if (runBtn) {
            this.boundRunBacktest = () => this.runStudioBacktest();
            runBtn.addEventListener('click', this.boundRunBacktest);
        }

        this.updateStudioStrategies();
    }

    private updateStudioStrategies(): void {
        const categoryEl = document.getElementById('bt-category') as HTMLSelectElement;
        const strategyEl = document.getElementById('bt-strategy') as HTMLSelectElement;
        if (!categoryEl || !strategyEl) return;

        const category = categoryEl.value;
        strategyEl.innerHTML = '';

        Object.values(this.strategies)
            .filter(s => s.category === category)
            .forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.name;
                strategyEl.appendChild(opt);
            });

        this.updateStudioParams();
    }

    private updateStudioParams(): void {
        const strategyEl = document.getElementById('bt-strategy') as HTMLSelectElement;
        const strategy = strategyEl ? this.strategies[strategyEl.value] : null;
        if (!strategy) return;

        this.renderParamFields(strategy, 'studio-params', 'studio-param');
    }

    private runStudioBacktest(): void {
        const strategyEl = document.getElementById('bt-strategy') as HTMLSelectElement;
        const symbolEl = document.getElementById('bt-symbol') as HTMLSelectElement;
        const timeframeEl = document.getElementById('bt-timeframe') as HTMLSelectElement;
        const daysEl = document.getElementById('bt-days') as HTMLInputElement;

        if (!strategyEl || !symbolEl || !timeframeEl || !daysEl) return;

        const strategyId = strategyEl.value;
        const strategy = this.strategies[strategyId];
        if (!strategy) return;

        const symbol = symbolEl.value;
        const timeframe = timeframeEl.value;
        const days = parseInt(daysEl.value);
        const params = this.collectParams(strategy, 'studio-param');

        this.lastBacktestStrategyId = strategyId;

        // Loading state
        const runBtn = document.getElementById('run-backtest-btn');
        if (runBtn) runBtn.classList.add('loading');

        this.dispatchBacktest(strategyId, symbol, timeframe, days, params);
        this.showNotification('Backtest Running', `${strategy.name} on ${symbol} ${timeframe} for ${days} days`, 'info');
    }

    // ==================== BACKTEST RESULTS ====================

    public handleBacktestResults(data: WebSocketMessage): void {
        // Remove loading state
        const runBtn = document.getElementById('run-backtest-btn');
        if (runBtn) runBtn.classList.remove('loading');

        // Normalize response format
        const raw = data.data || data;
        const summary = raw.summary;

        if (!summary) {
            this.showNotification('Backtest Error', 'Invalid backtest response', 'error');
            return;
        }

        const strategyId = this.lastBacktestStrategyId || raw.strategy || 'Unknown';
        const strategyName = this.strategies[strategyId]?.name || strategyId;

        const result: BacktestResult = {
            strategy: strategyName,
            market: `${raw.symbol || ''} ${raw.timeframe || ''}`.trim(),
            days: raw.days || 30,
            timestamp: new Date().toLocaleTimeString(),
            summary: {
                total_trades:     summary.total_trades     || 0,
                winning_trades:   summary.winning_trades   || 0,
                losing_trades:    summary.losing_trades    || 0,
                win_rate:         summary.win_rate         || 0,
                total_pnl:        summary.total_pnl        || 0,
                total_return_pct: summary.total_return_pct || 0,
                final_balance:    summary.final_balance    || 0,
                avg_win:          summary.avg_win          || 0,
                avg_loss:         summary.avg_loss         || 0,
                profit_factor:    summary.profit_factor    || 0,
                max_drawdown_pct: summary.max_drawdown_pct || 0,
                sharpe_ratio:     summary.sharpe_ratio     || 0
            },
            equity_curve: raw.equity_curve || [],
            drawdown:     raw.drawdown     || [],
            params:       raw.params       || {}
        };

        this.lastBacktestResult = result;
        this.renderBacktestResult(result);

        const pnl = result.summary.total_pnl;
        const pnlStr = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;

        this.showNotification(
            'Backtest Complete',
            `${result.strategy}: ${result.summary.total_trades} trades, ${result.summary.win_rate.toFixed(1)}% WR, ${pnlStr}`,
            pnl >= 0 ? 'success' : 'warning'
        );
    }

    private renderBacktestResult(result: BacktestResult): void {
        const noResults = document.getElementById('no-results-msg');
        const panel = document.getElementById('latest-result');
        if (!noResults || !panel) return;

        noResults.classList.add('hidden');
        panel.classList.remove('hidden');

        const s = result.summary;
        const pnlPositive = s.total_pnl >= 0;
        const wrPositive = s.win_rate >= 50;

        // Strategy name + market
        this.setText('result-strategy-name', result.strategy);
        this.setText('result-market', result.market);
        this.setText('result-days', `${result.days} days`);
        this.setText('result-timestamp', result.timestamp);

        // Key metrics
        this.setText('result-trades', s.total_trades.toString());
        this.setColoredText('result-winrate', `${s.win_rate.toFixed(1)}%`, wrPositive);
        this.setColoredText('result-pnl', `${pnlPositive ? '+' : '-'}$${Math.abs(s.total_pnl).toFixed(2)}`, pnlPositive);
        this.setText('result-sharpe', s.sharpe_ratio.toFixed(2));
        this.setText('result-maxdd', `${s.max_drawdown_pct.toFixed(1)}%`);

        // Detail grid
        this.setText('result-pf', s.profit_factor.toFixed(2));
        this.setText('result-avgwin', `$${s.avg_win.toFixed(2)}`);
        this.setText('result-avgloss', `$${Math.abs(s.avg_loss).toFixed(2)}`);
        this.setText('result-balance', `$${s.final_balance.toFixed(2)}`);
        this.setText('result-return', `${s.total_return_pct >= 0 ? '+' : ''}${s.total_return_pct.toFixed(2)}%`);
        this.setText('result-wins', s.winning_trades.toString());
        this.setText('result-losses', s.losing_trades.toString());

        // Plotly charts
        this.renderEquityCurve(result);
        this.renderDrawdownChart(result);
    }

    private renderEquityCurve(result: BacktestResult): void {
        const el = document.getElementById('equity-chart');
        if (!el || typeof (window as any).Plotly === 'undefined') return;

        const Plotly = (window as any).Plotly;

        const hasData = result.equity_curve && result.equity_curve.length > 0;

        const times = hasData
            ? result.equity_curve!.map(p => p.time)
            : this.generatePlaceholderDates(result.days);

        const values = hasData
            ? result.equity_curve!.map(p => p.balance)
            : this.generatePlaceholderEquity(result.summary.final_balance, result.days);

        const color = result.summary.total_pnl >= 0 ? '#00d394' : '#ff4d6b';

        Plotly.react(el, [{
            x: times,
            y: values,
            type: 'scatter',
            mode: 'lines',
            fill: 'tozeroy',
            fillcolor: `${color}18`,
            line: { color, width: 1.5, shape: 'spline' },
            hovertemplate: '%{x}<br>$%{y:.2f}<extra></extra>'
        }], {
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            margin: { t: 8, r: 8, b: 24, l: 48 },
            xaxis: {
                color: '#64748b',
                gridcolor: 'rgba(255,255,255,0.04)',
                tickfont: { size: 9, family: 'JetBrains Mono' },
                showgrid: true
            },
            yaxis: {
                color: '#64748b',
                gridcolor: 'rgba(255,255,255,0.04)',
                tickfont: { size: 9, family: 'JetBrains Mono' },
                tickprefix: '$',
                showgrid: true
            },
            showlegend: false
        }, {
            responsive: true,
            displayModeBar: false
        });
    }

    private renderDrawdownChart(result: BacktestResult): void {
        const el = document.getElementById('drawdown-chart');
        if (!el || typeof (window as any).Plotly === 'undefined') return;

        const Plotly = (window as any).Plotly;

        const hasData = result.drawdown && result.drawdown.length > 0;

        const times = hasData
            ? result.drawdown!.map(p => p.time)
            : this.generatePlaceholderDates(result.days);

        const values = hasData
            ? result.drawdown!.map(p => p.value)
            : this.generatePlaceholderDrawdown(result.summary.max_drawdown_pct, result.days);

        Plotly.react(el, [{
            x: times,
            y: values,
            type: 'scatter',
            mode: 'lines',
            fill: 'tozeroy',
            fillcolor: 'rgba(255,77,107,0.12)',
            line: { color: '#ff4d6b', width: 1.5, shape: 'spline' },
            hovertemplate: '%{x}<br>%{y:.2f}%<extra></extra>'
        }], {
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            margin: { t: 8, r: 8, b: 24, l: 48 },
            xaxis: {
                color: '#64748b',
                gridcolor: 'rgba(255,255,255,0.04)',
                tickfont: { size: 9, family: 'JetBrains Mono' },
                showgrid: true
            },
            yaxis: {
                color: '#64748b',
                gridcolor: 'rgba(255,255,255,0.04)',
                tickfont: { size: 9, family: 'JetBrains Mono' },
                ticksuffix: '%',
                showgrid: true
            },
            showlegend: false
        }, {
            responsive: true,
            displayModeBar: false
        });
    }

    // ==================== PLACEHOLDER DATA ====================
    // Used when backend doesn't yet return equity_curve / drawdown arrays

    private generatePlaceholderDates(days: number): string[] {
        const dates: string[] = [];
        const now = new Date();
        for (let i = days; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().split('T')[0]);
        }
        return dates;
    }

    private generatePlaceholderEquity(finalBalance: number, days: number): number[] {
        const start = 1000;
        const values: number[] = [];
        let current = start;
        const step = (finalBalance - start) / days;
        for (let i = 0; i <= days; i++) {
            const noise = (Math.random() - 0.5) * 20;
            current += step + noise;
            values.push(parseFloat(current.toFixed(2)));
        }
        return values;
    }

    private generatePlaceholderDrawdown(maxDD: number, days: number): number[] {
        const values: number[] = [];
        for (let i = 0; i <= days; i++) {
            const dd = -(Math.random() * maxDD);
            values.push(parseFloat(dd.toFixed(2)));
        }
        return values;
    }

    // ==================== CUSTOM BUILDER ====================

    private renderCustomBuilder(grid: HTMLElement): void {
        grid.style.gridTemplateColumns = '1fr';
        grid.innerHTML = `
            <div class="custom-builder">
                <div class="custom-builder-header">
                    <i class="fas fa-sliders"></i>
                    <span>Custom Strategy Builder</span>
                    <small>Coming in Phase 2</small>
                </div>
                <p class="custom-builder-desc">
                    Combine modules from any category — Indicator, Market Structure, Pattern, Triangular, Correlation, or ML.
                    Set logic operators (ALL / ANY / WEIGHTED) and define Context, Logic, and Entry layers across multiple timeframes.
                </p>
            </div>
        `;
    }

    // ==================== DISPATCH HELPERS ====================

    private dispatchDeploy(strategyType: string, symbol: string, timeframe: string, params: Record<string, any>): void {
        document.dispatchEvent(new CustomEvent('deploy-strategy', {
            bubbles: true,
            detail: { strategyType, symbol, timeframe, params }
        }));
        this.showNotification(
            'Strategy Deployed',
            `${this.strategies[strategyType]?.name || strategyType} added to chart`,
            'success'
        );
    }

    private dispatchBacktest(strategyType: string, symbol: string, timeframe: string, days: number, params: Record<string, any>): void {
        document.dispatchEvent(new CustomEvent('backtest-strategy', {
            bubbles: true,
            detail: { strategyType, symbol, timeframe, days, params }
        }));
    }

    // ==================== UTILITY ====================

    private setText(id: string, value: string): void {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    private setColoredText(id: string, value: string, positive: boolean): void {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
            el.style.color = positive ? 'var(--success, #00d394)' : 'var(--danger, #ff4d6b)';
        }
    }

    private showNotification(title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
        document.dispatchEvent(new CustomEvent('show-notification', {
            detail: { title, message, type }
        }));
    }

    // ==================== PUBLIC API ====================

    public setSymbol(symbol: string): void {
        // Symbol injected via getter — no state needed
    }

    public setTimeframe(timeframe: string): void {
        // Timeframe injected via getter — no state needed
    }

    // ==================== CLEANUP ====================

    public destroy(): void {
        console.log('🗑️ Cleaning up Strategy Module');

        this.boundTabClicks.forEach((handler, el) => el.removeEventListener('click', handler));
        this.boundCategoryClicks.forEach((handler, el) => el.removeEventListener('click', handler));

        const btCategory = document.getElementById('bt-category');
        const btStrategy = document.getElementById('bt-strategy');
        const btDays = document.getElementById('bt-days');
        const runBtn = document.getElementById('run-backtest-btn');
        const cancelBtn = document.getElementById('cancel-config-btn');
        const executeBtn = document.getElementById('execute-config-btn');
        const configBacktestBtn = document.getElementById('config-backtest-btn');
        const deployFromResult = document.getElementById('deploy-from-result-btn');

        if (btCategory && this.boundBtCategory) btCategory.removeEventListener('change', this.boundBtCategory);
        if (btStrategy && this.boundBtStrategy) btStrategy.removeEventListener('change', this.boundBtStrategy);
        if (btDays && this.boundBtDaysSlider) btDays.removeEventListener('input', this.boundBtDaysSlider);
        if (runBtn && this.boundRunBacktest) runBtn.removeEventListener('click', this.boundRunBacktest);
        if (cancelBtn && this.boundCancelConfig) cancelBtn.removeEventListener('click', this.boundCancelConfig);
        if (executeBtn && this.boundExecuteConfig) executeBtn.removeEventListener('click', this.boundExecuteConfig);
        if (configBacktestBtn && this.boundConfigBacktest) configBacktestBtn.removeEventListener('click', this.boundConfigBacktest);
        if (deployFromResult && this.boundDeployFromResult) deployFromResult.removeEventListener('click', this.boundDeployFromResult);

        this.boundTabClicks.clear();
        this.boundCategoryClicks.clear();
    }
}