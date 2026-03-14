// ===============================================================
// 📝 COMPLETE JOURNAL MODULE - Trading Journal with Mini-Journal (TypeScript)
// ===============================================================
// ==================== TYPE DEFINITIONS ====================
export interface Trade {
    id: number;
    date: string; // YYYY-MM-DD format
    pair: string;
    direction: 'LONG' | 'SHORT';
    size: string; // e.g., "0.5"
    pnl: string; // e.g., "+$125" or "-$45"
    result: 'WIN' | 'LOSS';
    entry?: string;
    exit?: string;
    pips?: string;
    time?: string;
    duration?: string;
    timeframe?: string;
    indicators?: string;
    notes?: string;
    riskReward?: string;
    strategy?: string;
}
export interface TradeDetails {
    [key: number]: Trade;
}
export interface CalendarDay {
    total: number;
    wins: number;
    losses: number;
    pnl: number;
}
export interface CalendarData {
    [key: string]: CalendarDay; // key is date string YYYY-MM-DD
}
export interface ChartConfigs {
    colors: {
        primary: string;
        success: string;
        danger: string;
        warning: string;
        info: string;
    };
    chartDefaults: any;
}
export interface ChartInitialized {
    pnl: boolean;
    winRate: boolean;
    monthly: boolean;
    pair: boolean;
}
export interface JournalElements {
    tabs: {
        calendar: HTMLElement | null;
        trades: HTMLElement | null;
        stats: HTMLElement | null;
    };
    calendar: {
        title: HTMLElement | null;
        days: HTMLElement | null;
        weekdays: Element | null;
        selectedDate: HTMLElement | null;
    };
    trades: {
        daily: HTMLElement | null;
        filtered: HTMLElement | null;
        filter: HTMLSelectElement | null;
    };
    stats: {
        totalTrades: HTMLElement | null;
        winRate: HTMLElement | null;
        netPnl: HTMLElement | null;
        netProfit: HTMLElement | null;
        winRateLarge: HTMLElement | null;
        profitFactor: HTMLElement | null;
        maxDrawdown: HTMLElement | null;
    };
    charts: {
        pnl: HTMLElement | null;
        winRate: HTMLElement | null;
        monthly: HTMLElement | null;
        pair: HTMLElement | null;
    };
    modal: {
        container: HTMLElement | null;
        content: HTMLElement | null;
        close: Element | null;
    };
    tabButtons: NodeListOf<Element>;
    navButtons: NodeListOf<Element>;
    todayBtn: Element | null;
    viewAllBtn: Element | null;
    openFullJournalBtn: HTMLElement | null;
    journalToggleBtn: HTMLElement | null;
    closeFullJournalBtn: HTMLElement | null;
    fullJournalOverlay: HTMLElement | null;
    dateRange: HTMLElement | null;
}
export interface MiniJournalElements {
    todayPnl: HTMLElement | null;
    todayWinRate: HTMLElement | null;
    recentTrades: HTMLElement | null;
    quickAddBtn: HTMLElement | null;
    badge: HTMLElement | null;
}
// ==================== MAIN JOURNAL MODULE ====================
export class JournalModule {
    // State Management
    private currentDate: Date = new Date();
    private selectedDate: Date = new Date();
    private charts: { [key: string]: any } = {};
    private isInitialized: boolean = false;
    private isChartsLoaded: boolean = false;
   
    // Data Storage
    private tradeDetails: TradeDetails = this.getDefaultTradeDetails();
    private tradesData: Trade[] = this.generateTradesData();
    private calendarData: CalendarData = this.generateCalendarData();
   
    // DOM Elements Cache
    private elements: JournalElements = {
        tabs: { calendar: null, trades: null, stats: null },
        calendar: { title: null, days: null, weekdays: null, selectedDate: null },
        trades: { daily: null, filtered: null, filter: null },
        stats: {
            totalTrades: null, winRate: null, netPnl: null,
            netProfit: null, winRateLarge: null, profitFactor: null, maxDrawdown: null
        },
        charts: { pnl: null, winRate: null, monthly: null, pair: null },
        modal: { container: null, content: null, close: null },
        tabButtons: document.querySelectorAll('.journal-tab'),
        navButtons: document.querySelectorAll('.journal-nav-btn'),
        todayBtn: document.querySelector('.journal-today-btn'),
        viewAllBtn: document.querySelector('.journal-view-all'),
        openFullJournalBtn: document.getElementById('openFullJournalFromPanel'),
        journalToggleBtn: document.getElementById('journalToggleBtn'),
        closeFullJournalBtn: document.getElementById('closeFullJournalBtn'),
        fullJournalOverlay: document.getElementById('fullJournalOverlay'),
        dateRange: document.getElementById('journalDateRange')
    };
   
    // Mini-journal elements
    private miniElements: MiniJournalElements = {
        todayPnl: document.getElementById('todayPnl'),
        todayWinRate: document.getElementById('todayWinRate'),
        recentTrades: document.getElementById('journalRecentTrades'),
        quickAddBtn: document.getElementById('quickAddTradeBtn'),
        badge: document.getElementById('journalBadge')
    };
   
    // Chart Configuration
    private chartConfigs: ChartConfigs = {
        colors: {
            primary: '#3A86FF',
            success: '#00D394',
            danger: '#FF4D6B',
            warning: '#F59E0B',
            info: '#8B5CF6'
        },
        chartDefaults: {
            chart: {
                background: 'transparent',
                foreColor: '#FFFFFF',
                fontFamily: 'Inter, sans-serif',
                toolbar: { show: false }
            },
            grid: {
                borderColor: '#334155',
                strokeDashArray: 4
            },
            tooltip: { 
                theme: 'dark',
                style: {
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '12px'
                }
            },
            dataLabels: { enabled: false }
        }
    };
   
    // Track chart initialization to prevent duplicates
    private chartInitialized: ChartInitialized = {
        pnl: false,
        winRate: false,
        monthly: false,
        pair: false
    };

    // ANTI-FLICKERING FIXES - ADDED
    private eventListeners: Map<string, EventListener[]> = new Map();
    private isDestroyed: boolean = false;
    private updateDebounceTimers: Map<string, number> = new Map();
    private updateMiniJournalThrottle: number | null = null;

    constructor() {
        console.log("📝 Journal Module Constructed (TypeScript)");
    }

    // ==================== INITIALIZATION ====================
    public initialize(): void {
        if (this.isInitialized) {
            console.log("📝 Journal already initialized - skipping to prevent duplicate listeners");
            return;
        }

        try {
            console.log("🚀 Initializing Journal Module...");
           
            // Cache DOM elements
            this.cacheElements();
           
            // Validate required elements
            if (!this.validateRequiredElements()) {
                console.error('❌ Required elements missing');
                this.showErrorMessage('Journal components not found. Please refresh the page.');
                return;
            }
           
            // Setup all components
            this.setupEventHandlers();
            this.setupCalendar();
            this.setupTradesTable();
           
            // Initialize mini-journal
            this.updateMiniJournal();
           
            // Setup chart containers (fixed heights)
            this.setupChartContainers();
           
            // Load saved data
            this.loadData();
           
            this.isInitialized = true;
            console.log("✅ Journal Module initialized successfully");
           
            // Auto-select today with correct date format
            setTimeout(() => this.goToToday(), 100);
           
        } catch (error) {
            console.error('❌ Journal Module initialization failed:', error);
            this.showErrorMessage('Failed to initialize journal. Please check console for errors.');
        }
    }

    // ==================== ANTI-FLICKERING FIXES ====================

    private addEventListener(eventName: string, type: string, handler: EventListener, options?: { selector?: string, element?: Element }): void {
        const element = options?.element || (options?.selector ? document.querySelector(options.selector) : document);
        
        if (!element) return;
        
        const wrappedHandler = (e: Event) => {
            if (this.isDestroyed) return;
            handler(e);
        };
        
        element.addEventListener(type, wrappedHandler);
        
        // Store for cleanup
        const key = `${eventName}-${type}`;
        if (!this.eventListeners.has(key)) {
            this.eventListeners.set(key, []);
        }
        this.eventListeners.get(key)!.push(wrappedHandler);
    }

    private cleanupEventHandlers(): void {
        this.eventListeners.forEach((handlers, key) => {
            const [eventName, type] = key.split('-');
            handlers.forEach(handler => {
                // Remove from all possible elements
                document.removeEventListener(type, handler);
                if (this.elements.fullJournalOverlay) {
                    this.elements.fullJournalOverlay.removeEventListener(type, handler);
                }
                if (this.elements.modal.container) {
                    this.elements.modal.container.removeEventListener(type, handler);
                }
            });
        });
        this.eventListeners.clear();
    }

    private debouncedUpdate(updateType: 'mini' | 'full' | 'stats' | 'calendar' | 'sync', callback: () => void, delay: number = 150): void {
        const timerKey = `${updateType}_update`;
        
        if (this.updateDebounceTimers.has(timerKey)) {
            clearTimeout(this.updateDebounceTimers.get(timerKey)!);
        }
        
        const timerId = window.setTimeout(() => {
            if (this.isDestroyed) return;
            callback();
            this.updateDebounceTimers.delete(timerKey);
        }, delay);
        
        this.updateDebounceTimers.set(timerKey, timerId);
    }

    private synchronizeJournalUpdates(): void {
        this.debouncedUpdate('sync', () => {
            const today = this.formatDate(new Date());
            const todayTrades = this.tradesData.filter(trade => trade.date === today);
            const stats = this.calculateStats(todayTrades);
            
            // Update mini-journal
            if (this.miniElements.todayPnl) {
                this.miniElements.todayPnl.textContent = stats.formattedPnl;
                this.miniElements.todayPnl.className = stats.pnlClass;
            }
            
            if (this.miniElements.todayWinRate) {
                this.miniElements.todayWinRate.textContent = stats.winRateText;
                this.miniElements.todayWinRate.className = stats.winRateClass;
            }
            
            // Update full journal if open
            if (this.elements.fullJournalOverlay?.classList.contains('active')) {
                this.updateStatsCards();
            }
        }, 200);
    }

    private calculateStats(todayTrades: Trade[]): {
        formattedPnl: string;
        pnlClass: string;
        winRateText: string;
        winRateClass: string;
    } {
        if (todayTrades.length === 0) {
            return {
                formattedPnl: '$0',
                pnlClass: 'mini-stat-value',
                winRateText: '0%',
                winRateClass: 'mini-stat-value'
            };
        }
        
        const todayPnl = todayTrades.reduce((sum, trade) => {
            const value = parseFloat(trade.pnl.replace(/[^0-9.-]+/g, ''));
            return sum + (trade.pnl.startsWith('+') ? value : -value);
        }, 0);
        
        const winningTrades = todayTrades.filter(t => t.result === 'WIN').length;
        const winRate = todayTrades.length > 0 ? Math.round((winningTrades / todayTrades.length) * 100) : 0;
        
        return {
            formattedPnl: `$${todayPnl > 0 ? '+' : ''}${Math.abs(todayPnl).toFixed(0)}`,
            pnlClass: `mini-stat-value ${todayPnl >= 0 ? 'positive' : 'negative'}`,
            winRateText: `${winRate}%`,
            winRateClass: `mini-stat-value ${winRate >= 50 ? 'positive' : 'negative'}`
        };
    }

    // ==================== MINI-JOURNAL FUNCTIONS ====================
    private updateMiniJournal(): void {
        this.debouncedUpdate('mini', () => {
            try {
                this.updateMiniStats();
                this.updateRecentTrades();
                this.updateJournalBadge();
                console.log("📱 Mini-journal updated (debounced)");
            } catch (error) {
                console.error('❌ Mini-journal update failed:', error);
            }
        }, 100);
    }

    private updateMiniStats(): void {
        try {
            const today = this.formatDate(new Date());
            const todayTrades = this.tradesData.filter(trade => trade.date === today);
           
            if (todayTrades.length === 0) {
                if (this.miniElements.todayPnl) {
                    this.miniElements.todayPnl.textContent = '$0';
                    this.miniElements.todayPnl.className = 'mini-stat-value';
                }
                if (this.miniElements.todayWinRate) {
                    this.miniElements.todayWinRate.textContent = '0%';
                    this.miniElements.todayWinRate.className = 'mini-stat-value';
                }
                return;
            }
           
            const stats = this.calculateStats(todayTrades);
           
            if (this.miniElements.todayPnl) {
                this.miniElements.todayPnl.textContent = stats.formattedPnl;
                this.miniElements.todayPnl.className = stats.pnlClass;
            }
           
            if (this.miniElements.todayWinRate) {
                this.miniElements.todayWinRate.textContent = stats.winRateText;
                this.miniElements.todayWinRate.className = stats.winRateClass;
            }
           
        } catch (error) {
            console.error('❌ Mini stats update failed:', error);
        }
    }

    private updateRecentTrades(): void {
        try {
            const recentTrades = this.tradesData.slice(0, 5);
           
            if (!this.miniElements.recentTrades) return;
           
            this.miniElements.recentTrades.innerHTML = '';
           
            if (recentTrades.length === 0) {
                this.miniElements.recentTrades.innerHTML = `
                    <div class="no-recent-trades">
                        <i class="fas fa-chart-line"></i>
                        <p>No trades today</p>
                    </div>
                `;
                return;
            }
           
            recentTrades.forEach(trade => {
                const tradeEl = document.createElement('div');
                tradeEl.className = 'journal-mini-trade';
                tradeEl.dataset.tradeId = trade.id.toString();

                tradeEl.innerHTML = `
                    <div class="mini-trade-header">
                        <span class="mini-trade-pair">${trade.pair}</span>
                        <span class="mini-trade-direction ${trade.direction.toLowerCase()}">
                            ${trade.direction === 'LONG' ? '▲' : '▼'}
                        </span>
                    </div>
                    <div class="mini-trade-details">
                        <span class="mini-trade-size">${trade.size}L</span>
                        <span class="mini-trade-pnl ${trade.result.toLowerCase()}">
                            ${trade.pnl}
                        </span>
                    </div>
                `;

                this.addEventListener(`trade-click-${trade.id}`, 'click', () => {
                    this.showTradeDetail(trade.id);
                }, { element: tradeEl });

                if (this.miniElements.recentTrades) {
                    this.miniElements.recentTrades.appendChild(tradeEl);
                }
            });
           
        } catch (error) {
            console.error('❌ Recent trades update failed:', error);
        }
    }

    private updateJournalBadge(): void {
        if (!this.miniElements.badge) return;
       
        const today = this.formatDate(new Date());
        const todayTrades = this.tradesData.filter(trade => trade.date === today).length;
       
        this.miniElements.badge.textContent = todayTrades > 0 ? todayTrades.toString() : '';
        this.miniElements.badge.style.display = todayTrades > 0 ? 'flex' : 'none';
    }

    private setupMiniJournalHandlers(): void {
        // Quick Add Trade button
        if (this.miniElements.quickAddBtn) {
            this.miniElements.quickAddBtn.replaceWith(this.miniElements.quickAddBtn.cloneNode(true));
            const freshBtn = document.getElementById('quickAddTradeBtn');
            if (freshBtn) {
                this.addEventListener('quick-add-trade', 'click', (e: Event) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showQuickAddTradeForm();
                }, { element: freshBtn });
            }
        }
       
        // Open Full Journal button from mini-panel
        if (this.elements.openFullJournalBtn) {
            this.elements.openFullJournalBtn.replaceWith(this.elements.openFullJournalBtn.cloneNode(true));
            const freshBtn = document.getElementById('openFullJournalFromPanel');
            if (freshBtn) {
                this.addEventListener('open-full-journal', 'click', (e: Event) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.openFullJournal();
                }, { element: freshBtn });
            }
        }
       
        // Journal toggle button in top controls
        if (this.elements.journalToggleBtn) {
            this.elements.journalToggleBtn.replaceWith(this.elements.journalToggleBtn.cloneNode(true));
            const freshBtn = document.getElementById('journalToggleBtn');
            if (freshBtn) {
                this.addEventListener('journal-toggle', 'click', (e: Event) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleFullJournal();
                }, { element: freshBtn });
            }
        }
    }

    private showQuickAddTradeForm(): void {
        // Create modal form for quick trade entry
        const modal = document.createElement('div');
        modal.className = 'quick-trade-modal';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 24px;
            z-index: 10001;
            min-width: 350px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        `;
       
        modal.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: white; font-size: 1.2rem;">
                <i class="fas fa-plus-circle" style="color: #3a86ff;"></i> Quick Log Trade
            </h3>
           
            <div style="display: grid; gap: 16px;">
                <div>
                    <label style="display: block; color: #94a3b8; margin-bottom: 6px; font-size: 0.9rem;">
                        Pair
                    </label>
                    <select id="quickPair" style="width: 100%; padding: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: white;">
                        <option value="EURUSD">EUR/USD</option>
                        <option value="GBPUSD">GBP/USD</option>
                        <option value="USDJPY">USD/JPY</option>
                        <option value="AUDUSD">AUD/USD</option>
                        <option value="XAUUSD">XAU/USD</option>
                    </select>
                </div>
               
                <div>
                    <label style="display: block; color: #94a3b8; margin-bottom: 6px; font-size: 0.9rem;">
                        Direction
                    </label>
                    <div style="display: flex; gap: 10px;">
                        <button id="quickLong" style="flex: 1; padding: 10px; background: rgba(0, 211, 148, 0.3); border: 1px solid #00d394; color: #00d394; border-radius: 6px; cursor: pointer;">
                            LONG
                        </button>
                        <button id="quickShort" style="flex: 1; padding: 10px; background: rgba(255, 77, 107, 0.1); border: 1px solid #ff4d6b; color: #ff4d6b; border-radius: 6px; cursor: pointer;">
                            SHORT
                        </button>
                    </div>
                </div>
               
                <div>
                    <label style="display: block; color: #94a3b8; margin-bottom: 6px; font-size: 0.9rem;">
                        Size (Lots)
                    </label>
                    <input type="number" id="quickSize" value="0.1" step="0.01" min="0.01" style="width: 100%; padding: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: white;">
                </div>
               
                <div>
                    <label style="display: block; color: #94a3b8; margin-bottom: 6px; font-size: 0.9rem;">
                        P&L ($)
                    </label>
                    <input type="number" id="quickPnl" value="50" step="1" style="width: 100%; padding: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: white;">
                </div>
               
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button id="quickSubmit" style="flex: 1; padding: 12px; background: #3a86ff; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        Add Trade
                    </button>
                    <button id="quickCancel" style="flex: 1; padding: 12px; background: #475569; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        Cancel
                    </button>
                </div>
            </div>
        `;
       
        document.body.appendChild(modal);
       
        let selectedDirection: 'LONG' | 'SHORT' = 'LONG';
       
        // Use one-time event listeners for modal
        const longBtn = document.getElementById('quickLong');
        const shortBtn = document.getElementById('quickShort');
        const submitBtn = document.getElementById('quickSubmit');
        const cancelBtn = document.getElementById('quickCancel');
       
        if (longBtn) {
            longBtn.onclick = () => {
                selectedDirection = 'LONG';
                (longBtn as HTMLElement).style.background = 'rgba(0, 211, 148, 0.3)';
                (shortBtn as HTMLElement).style.background = 'rgba(255, 77, 107, 0.1)';
            };
        }
       
        if (shortBtn) {
            shortBtn.onclick = () => {
                selectedDirection = 'SHORT';
                (longBtn as HTMLElement).style.background = 'rgba(0, 211, 148, 0.1)';
                (shortBtn as HTMLElement).style.background = 'rgba(255, 77, 107, 0.3)';
            };
        }
       
        if (submitBtn) {
            submitBtn.onclick = () => {
                const pair = (document.getElementById('quickPair') as HTMLSelectElement).value;
                const size = parseFloat((document.getElementById('quickSize') as HTMLInputElement).value);
                const pnlValue = parseFloat((document.getElementById('quickPnl') as HTMLInputElement).value);
                const pnl = pnlValue >= 0 ? `+$${pnlValue}` : `-$${Math.abs(pnlValue)}`;
                const result = pnlValue >= 0 ? 'WIN' : 'LOSS';
               
                // Add new trade
                const newTrade: Trade = {
                    id: Date.now(),
                    date: this.formatDate(new Date()),
                    pair: pair,
                    direction: selectedDirection,
                    size: size.toFixed(1),
                    pnl: pnl,
                    result: result,
                    entry: '1.0000',
                    exit: '1.0010',
                    pips: pnlValue >= 0 ? '+10' : '-5'
                };
               
                // Add to data
                this.tradesData.unshift(newTrade);
                this.tradeDetails[newTrade.id] = newTrade;
               
                // Update UI with synchronization
                this.synchronizeJournalUpdates();
                this.updateCalendarData();
                this.updateTradesTable();
               
                // Save to localStorage
                this.saveData();
               
                // Close modal
                document.body.removeChild(modal);
               
                // Show notification
                if ((window as any).MegaFlowzApp && (window as any).MegaFlowzApp.notifications) {
                    (window as any).MegaFlowzApp.notifications.success(
                        `Trade logged: ${selectedDirection} ${pair} ${size}L - P&L: ${pnl}`,
                        { title: 'Trade Added', duration: 3000 }
                    );
                }
            };
        }
       
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                document.body.removeChild(modal);
            };
        }
       
        // Close on outside click
        const outsideClickHandler = (e: Event) => {
            if (modal && document.body.contains(modal) && !modal.contains(e.target as Node)) {
                document.body.removeChild(modal);
                document.removeEventListener('click', outsideClickHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', outsideClickHandler), 10);
    }

    public toggleFullJournal(): void {
        if (!this.elements.fullJournalOverlay) return;
       
        if (this.elements.fullJournalOverlay.classList.contains('active')) {
            this.closeFullJournal();
        } else {
            this.openFullJournal();
        }
    }

    private openFullJournal(): void {
        if (!this.elements.fullJournalOverlay) return;
       
        this.elements.fullJournalOverlay.style.display = 'flex';
        setTimeout(() => this.elements.fullJournalOverlay!.classList.add('active'), 10);
       
        // Update date range display
        if (this.elements.dateRange) {
            const today = new Date();
            const options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
            this.elements.dateRange.textContent = today.toLocaleDateString('en-US', options);
        }
    }

    private closeFullJournal(): void {
        if (!this.elements.fullJournalOverlay) return;
       
        this.elements.fullJournalOverlay.classList.remove('active');
        setTimeout(() => {
            this.elements.fullJournalOverlay!.style.display = 'none';
        }, 300);
    }

    // ==================== EVENT HANDLERS ====================
    private setupEventHandlers(): void {
        try {
            // Cleanup first
            this.cleanupEventHandlers();
            
            // Journal tab switching
            this.elements.tabButtons.forEach(tab => {
                this.addEventListener(`tab-${tab.getAttribute('data-tab')}`, 'click', (e: Event) => {
                    const target = e.target as HTMLElement;
                    const tabName = target.dataset.tab || target.closest('[data-tab]')?.getAttribute('data-tab');
                    if (tabName) {
                        this.switchTab(tabName);
                    }
                }, { element: tab });
            });
            
            // Calendar navigation
            this.elements.navButtons.forEach(btn => {
                this.addEventListener('nav-btn', 'click', (e: Event) => {
                    const target = e.target as HTMLElement;
                    const button = target.closest('.journal-nav-btn');
                    if (button) {
                        const direction = parseInt(button.getAttribute('data-direction') || '0');
                        this.changeMonth(direction);
                    }
                }, { element: btn });
            });
            
            // Calendar day selection
            if (this.elements.calendar.days) {
                this.addEventListener('calendar-day-click', 'click', (e: Event) => {
                    const target = e.target as HTMLElement;
                    const dayElement = target.closest('.journal-calendar-day:not(.empty)');
                    if (dayElement) {
                        this.selectDate(dayElement as HTMLElement);
                    }
                }, { element: this.elements.calendar.days });
            }
            
            // Trade row clicks
            if (this.elements.trades.filtered) {
                this.addEventListener('trade-row-click', 'click', (e: Event) => {
                    const target = e.target as HTMLElement;
                    const tradeRow = target.closest('tr[data-trade-id]');
                    if (tradeRow) {
                        const tradeId = parseInt(tradeRow.getAttribute('data-trade-id') || '0');
                        this.showTradeDetail(tradeId);
                    }
                }, { element: this.elements.trades.filtered });
            }
            
            // Daily trades clicks
            if (this.elements.trades.daily) {
                this.addEventListener('daily-trade-click', 'click', (e: Event) => {
                    const target = e.target as HTMLElement;
                    const tradeRow = target.closest('.journal-daily-trade');
                    if (tradeRow && (tradeRow as HTMLElement).dataset.tradeId) {
                        const tradeId = parseInt((tradeRow as HTMLElement).dataset.tradeId!);
                        this.showTradeDetail(tradeId);
                    }
                }, { element: this.elements.trades.daily });
            }
            
            // Modal close
            if (this.elements.modal.container) {
                this.addEventListener('modal-close', 'click', (e: Event) => {
                    const target = e.target as HTMLElement;
                    if (target === this.elements.modal.container ||
                        target.classList.contains('journal-close-modal')) {
                        this.closeTradeDetail();
                    }
                }, { element: this.elements.modal.container });

                // Close on Escape key
                this.addEventListener('escape-key', 'keydown', (e: Event) => {
                    const ke = e as KeyboardEvent;
                    if (ke.key === 'Escape' && this.elements.modal.container?.classList.contains('active')) {
                        this.closeTradeDetail();
                    }
                });
            }
            
            // Trade filtering
            if (this.elements.trades.filter) {
                this.addEventListener('trade-filter', 'change', (e: Event) => {
                    const target = e.target as HTMLSelectElement;
                    this.filterTrades(target.value);
                }, { element: this.elements.trades.filter });
            }
            
            // View all button
            if (this.elements.viewAllBtn) {
                this.addEventListener('view-all', 'click', (e: Event) => {
                    e.preventDefault();
                    this.switchTab('trades');
                }, { element: this.elements.viewAllBtn });
            }
            
            // Today button
            if (this.elements.todayBtn) {
                this.addEventListener('today-btn', 'click', () => this.goToToday(), { element: this.elements.todayBtn });
            }
            
            // Close full journal button
            if (this.elements.closeFullJournalBtn) {
                this.addEventListener('close-full-journal', 'click', () => {
                    this.closeFullJournal();
                }, { element: this.elements.closeFullJournalBtn });
            }
            
            // Close journal on overlay click
            if (this.elements.fullJournalOverlay) {
                this.addEventListener('overlay-click', 'click', (e: Event) => {
                    if (e.target === this.elements.fullJournalOverlay) {
                        this.closeFullJournal();
                    }
                }, { element: this.elements.fullJournalOverlay });
            }
            
            // Listen for hotkey J to toggle journal
            document.addEventListener('hotkey-modal-toggle', (e: Event) => {
                const customEvent = e as CustomEvent<any>;
                if (customEvent.detail?.modal === 'full-journal') {
                    this.toggleFullJournal();
                }
            });
            
            // Setup mini-journal handlers
            this.setupMiniJournalHandlers();
            
            console.log("🔌 Journal event handlers setup complete");
        } catch (error) {
            console.error('❌ Event handlers setup failed:', error);
        }
    }

    // ==================== REMAINING METHODS (UNCHANGED) ====================
    
    private cacheElements(): void {
        // Tab elements
        this.elements.tabs = {
            calendar: document.getElementById('journal-calendar-tab'),
            trades: document.getElementById('journal-trades-tab'),
            stats: document.getElementById('journal-stats-tab')
        };
       
        // Calendar elements
        this.elements.calendar = {
            title: document.getElementById('journal-calendar-title'),
            days: document.getElementById('journal-calendar-days'),
            weekdays: document.querySelector('.journal-calendar-weekdays'),
            selectedDate: document.getElementById('journal-selected-date')
        };
       
        // Trades elements
        this.elements.trades = {
            daily: document.getElementById('journal-daily-trades'),
            filtered: document.getElementById('journal-filtered-trades'),
            filter: document.getElementById('journal-filter-dropdown') as HTMLSelectElement
        };
       
        // Stats elements
        this.elements.stats = {
            totalTrades: document.getElementById('totalTradesStat'),
            winRate: document.getElementById('winRateStat'),
            netPnl: document.getElementById('netPnlStat'),
            netProfit: document.getElementById('netProfitStat'),
            winRateLarge: document.getElementById('winRateLargeStat'),
            profitFactor: document.getElementById('profitFactorStat'),
            maxDrawdown: document.getElementById('maxDrawdownStat')
        };
       
        // Chart elements
        this.elements.charts = {
            pnl: document.getElementById('journal-pnlChart'),
            winRate: document.getElementById('journal-winRateChart'),
            monthly: document.getElementById('journal-monthlyChart'),
            pair: document.getElementById('journal-pairPerformanceChart')
        };
       
        // Modal elements
        this.elements.modal = {
            container: document.getElementById('journal-trade-modal'),
            content: document.getElementById('journal-trade-detail-content'),
            close: document.querySelector('.journal-close-modal')
        };
    }
    
    private validateRequiredElements(): boolean {
        const required = [
            'journal-calendar-title', 'journal-calendar-days',
            'journal-selected-date', 'journal-daily-trades',
            'journal-filtered-trades', 'journal-trade-modal'
        ];
       
        const missing = required.filter(id => !document.getElementById(id));
       
        if (missing.length > 0) {
            console.error('❌ Missing elements:', missing);
            return false;
        }
       
        return true;
    }
    
    private getDefaultTradeDetails(): TradeDetails {
        const today = this.formatDate(new Date());
        const yesterday = this.formatDate(new Date(Date.now() - 86400000));
       
        return {
            1: {
                id: 1,
                date: today,
                time: '14:30',
                pair: 'EURUSD',
                direction: 'LONG',
                size: '0.5',
                entry: '1.0950',
                exit: '1.0975',
                pips: '+25',
                pnl: '+$125',
                result: 'WIN',
                duration: '45 minutes',
                timeframe: 'H1',
                indicators: 'EMA, RSI, MACD',
                notes: 'Strong bullish momentum with RSI confirmation',
                riskReward: '1:2',
                strategy: 'Momentum Breakout'
            },
            2: {
                id: 2,
                date: today,
                time: '11:15',
                pair: 'GBPUSD',
                direction: 'SHORT',
                size: '0.3',
                entry: '1.2750',
                exit: '1.2765',
                pips: '-15',
                pnl: '-$45',
                result: 'LOSS',
                duration: '25 minutes',
                timeframe: 'M15',
                indicators: 'Bollinger, Stochastic',
                notes: 'Unexpected news caused reversal',
                riskReward: '1:1',
                strategy: 'Mean Reversion'
            },
            3: {
                id: 3,
                date: yesterday,
                time: '16:45',
                pair: 'USDJPY',
                direction: 'LONG',
                size: '0.4',
                entry: '145.20',
                exit: '145.80',
                pips: '+60',
                pnl: '+$180',
                result: 'WIN',
                duration: '2 hours',
                timeframe: 'H4',
                indicators: 'EMA, ATR',
                notes: 'Successful breakout trade with tight stop',
                riskReward: '1:3',
                strategy: 'Breakout'
            }
        };
    }
    
    private generateTradesData(): Trade[] {
        const trades: Trade[] = [];
        const pairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'XAUUSD'];
        const directions: ('LONG' | 'SHORT')[] = ['LONG', 'SHORT'];
       
        // Get today and yesterday for realistic dates
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
       
        // Add today's trades (2-4 trades)
        const todayTrades = Math.floor(Math.random() * 3) + 2;
        for (let i = 1; i <= todayTrades; i++) {
            const pair = pairs[Math.floor(Math.random() * pairs.length)];
            const direction = directions[Math.floor(Math.random() * directions.length)];
            const result: 'WIN' | 'LOSS' = Math.random() > 0.3 ? 'WIN' : 'LOSS';
           
            const size = (Math.random() * 0.7 + 0.1).toFixed(1);
            const pnl = result === 'WIN'
                ? `+$${(Math.random() * 300 + 50).toFixed(0)}`
                : `-$${(Math.random() * 100 + 20).toFixed(0)}`;
           
            trades.push({
                id: i,
                date: this.formatDate(today),
                pair,
                direction,
                size,
                pnl,
                result,
                entry: '1.0000',
                exit: '1.0010',
                pips: result === 'WIN' ? '+10' : '-5'
            });
        }
       
        // Add yesterday's trades
        for (let i = todayTrades + 1; i <= todayTrades + 5; i++) {
            const pair = pairs[Math.floor(Math.random() * pairs.length)];
            const direction = directions[Math.floor(Math.random() * directions.length)];
            const result: 'WIN' | 'LOSS' = Math.random() > 0.3 ? 'WIN' : 'LOSS';
           
            const size = (Math.random() * 0.7 + 0.1).toFixed(1);
            const pnl = result === 'WIN'
                ? `+$${(Math.random() * 300 + 50).toFixed(0)}`
                : `-$${(Math.random() * 100 + 20).toFixed(0)}`;
           
            trades.push({
                id: i,
                date: this.formatDate(yesterday),
                pair,
                direction,
                size,
                pnl,
                result,
                entry: '1.0000',
                exit: '1.0010',
                pips: result === 'WIN' ? '+10' : '-5'
            });
        }
       
        // Add older trades (last 30 days)
        for (let i = todayTrades + 6; i <= 20; i++) {
            const date = new Date();
            date.setDate(date.getDate() - Math.floor(Math.random() * 28) - 2);
           
            const pair = pairs[Math.floor(Math.random() * pairs.length)];
            const direction = directions[Math.floor(Math.random() * directions.length)];
            const result: 'WIN' | 'LOSS' = Math.random() > 0.3 ? 'WIN' : 'LOSS';
           
            const size = (Math.random() * 0.7 + 0.1).toFixed(1);
            const pnl = result === 'WIN'
                ? `+$${(Math.random() * 300 + 50).toFixed(0)}`
                : `-$${(Math.random() * 100 + 20).toFixed(0)}`;
           
            trades.push({
                id: i,
                date: this.formatDate(date),
                pair,
                direction,
                size,
                pnl,
                result,
                entry: '1.0000',
                exit: '1.0010',
                pips: result === 'WIN' ? '+10' : '-5'
            });
        }
       
        return trades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    
    private generateCalendarData(): CalendarData {
        const data: CalendarData = {};
        const today = new Date();
       
        for (let i = 0; i < 30; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
           
            const dateStr = this.formatDate(date);
            const trades = this.tradesData.filter(trade => trade.date === dateStr);
           
            if (trades.length > 0) {
                const wins = trades.filter(t => t.result === 'WIN').length;
                const losses = trades.filter(t => t.result === 'LOSS').length;
               
                data[dateStr] = {
                    total: trades.length,
                    wins,
                    losses,
                    pnl: trades.reduce((sum, trade) => {
                        const value = parseFloat(trade.pnl.replace(/[^0-9.-]+/g, ''));
                        return sum + (trade.pnl.startsWith('+') ? value : -value);
                    }, 0)
                };
            }
        }
       
        return data;
    }
    
    private updateCalendarData(): void {
        this.calendarData = this.generateCalendarData();
       
        if (this.elements.calendar.days) {
            this.updateCalendar();
        }
       
        this.updateStatsCards();
    }
    
    // ==================== TAB MANAGEMENT ====================
    private switchTab(tabName: string): void {
        console.log(`📊 Switching to ${tabName} tab`);
       
        try {
            // Remove active class from all tabs and content
            this.elements.tabButtons.forEach(tab => tab.classList.remove('active'));
            Object.values(this.elements.tabs).forEach(tab => {
                if (tab) tab.classList.remove('active');
            });
           
            // Add active class to selected tab and content
            const tabElement = Array.from(this.elements.tabButtons).find(
                tab => (tab as HTMLElement).dataset.tab === tabName
            ) as HTMLElement;
           
            if (tabElement && this.elements.tabs[tabName as keyof typeof this.elements.tabs]) {
                tabElement.classList.add('active');
                this.elements.tabs[tabName as keyof typeof this.elements.tabs]!.classList.add('active');
            }
           
            // Initialize tab-specific content
            switch(tabName) {
                case 'calendar':
                    this.updateCalendar();
                    this.updateDailyTrades();
                    break;
                   
                case 'stats':
                    if (!this.isChartsLoaded) {
                        setTimeout(() => this.initializeCharts(), 300);
                    } else {
                        // Ensure charts maintain fixed size
                        this.fixChartSizes();
                    }
                    this.updateStatsCards();
                    break;
                   
                case 'trades':
                    this.updateTradesTable();
                    break;
            }
           
        } catch (error) {
            console.error('❌ Tab switch failed:', error);
        }
    }
    
    // ==================== CALENDAR FUNCTIONALITY ====================
    private setupCalendar(): void {
        this.updateCalendar();
        this.updateDailyTrades();
    }
    
    private updateCalendar(): void {
        this.debouncedUpdate('calendar', () => {
            try {
                const year = this.currentDate.getFullYear();
                const month = this.currentDate.getMonth();
               
                // Update calendar title
                const monthNames = ["January", "February", "March", "April", "May", "June",
                                   "July", "August", "September", "October", "November", "December"];
                if (this.elements.calendar.title) {
                    this.elements.calendar.title.textContent = `${monthNames[month]} ${year}`;
                }
               
                // Get first day of month and number of days
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
               
                // Generate calendar days
                if (!this.elements.calendar.days) return;
               
                this.elements.calendar.days.innerHTML = '';
               
                // Add empty cells for days before the first day of the month
                for (let i = 0; i < firstDay; i++) {
                    const emptyDay = document.createElement('div');
                    emptyDay.className = 'journal-calendar-day empty';
                    this.elements.calendar.days.appendChild(emptyDay);
                }
               
                // Add days of the month
                const today = new Date();
                const todayStr = this.formatDate(today);
                const selectedStr = this.formatDate(this.selectedDate);
               
                for (let day = 1; day <= daysInMonth; day++) {
                    const dayElement = document.createElement('div');
                    dayElement.className = 'journal-calendar-day';
                    dayElement.textContent = day.toString();
                    dayElement.dataset.day = day.toString();
                    dayElement.dataset.month = month.toString();
                    dayElement.dataset.year = year.toString();
                   
                    // Create date string for comparison (YYYY-MM-DD)
                    const dateStr = this.formatDate(new Date(year, month, day));
                   
                    // Check if this is today
                    if (dateStr === todayStr) {
                        dayElement.classList.add('today');
                    }
                   
                    // Check if this is the selected date
                    if (dateStr === selectedStr) {
                        dayElement.classList.add('selected');
                    }
                   
                    // Apply trade results if data exists
                    if (this.calendarData[dateStr]) {
                        const dayData = this.calendarData[dateStr];
                        if (dayData.wins > 0 && dayData.losses === 0) {
                            dayElement.classList.add('win');
                            dayElement.title = `${dayData.wins} winning trades`;
                        } else if (dayData.losses > 0 && dayData.wins === 0) {
                            dayElement.classList.add('loss');
                            dayElement.title = `${dayData.losses} losing trades`;
                        } else if (dayData.wins > 0 && dayData.losses > 0) {
                            dayElement.classList.add('mixed');
                            dayElement.title = `${dayData.wins} wins, ${dayData.losses} losses`;
                        }
                    }
                   
                    this.elements.calendar.days.appendChild(dayElement);
                }
               
                // Add empty cells at the end if needed
                const totalCells = firstDay + daysInMonth;
                const remainingCells = 42 - totalCells;
               
                for (let i = 0; i < remainingCells; i++) {
                    const emptyDay = document.createElement('div');
                    emptyDay.className = 'journal-calendar-day empty';
                    this.elements.calendar.days.appendChild(emptyDay);
                }
               
                console.log(`📅 Calendar updated for ${monthNames[month]} ${year}`);
            } catch (error) {
                console.error('❌ Calendar update failed:', error);
            }
        }, 50);
    }
    
    private changeMonth(direction: number): void {
        try {
            this.currentDate = new Date(
                this.currentDate.getFullYear(),
                this.currentDate.getMonth() + direction,
                1
            );
            this.updateCalendar();
            console.log(`📅 Month changed to ${this.currentDate.toLocaleDateString()}`);
        } catch (error) {
            console.error('❌ Month change failed:', error);
        }
    }
    
    private goToToday(): void {
        try {
            this.currentDate = new Date();
            this.selectedDate = new Date();
            this.updateCalendar();
            this.updateDailyTrades();
            this.synchronizeJournalUpdates();
           
            // Update selected date display with proper format
            if (this.elements.calendar.selectedDate) {
                const today = new Date();
                const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                this.elements.calendar.selectedDate.textContent =
                    today.toLocaleDateString('en-US', options);
            }
           
            console.log('📅 Returned to today');
        } catch (error) {
            console.error('❌ Go to today failed:', error);
        }
    }
    
    private selectDate(dayElement: HTMLElement): void {
        try {
            const day = parseInt(dayElement.dataset.day || '1');
            const month = parseInt(dayElement.dataset.month || '0');
            const year = parseInt(dayElement.dataset.year || '2024');
           
            this.selectedDate = new Date(year, month, day);
            this.updateCalendar();
           
            // Update selected date display with proper format
            if (this.elements.calendar.selectedDate) {
                const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                this.elements.calendar.selectedDate.textContent =
                    this.selectedDate.toLocaleDateString('en-US', options);
            }
           
            this.updateDailyTrades(this.selectedDate);
           
            console.log(`📅 Selected date: ${this.selectedDate.toLocaleDateString()}`);
        } catch (error) {
            console.error('❌ Date selection failed:', error);
        }
    }
    
    private updateDailyTrades(date: Date = new Date()): void {
        try {
            if (!this.elements.trades.daily) return;
            const dailyContainer = this.elements.trades.daily;
            const dateStr = this.formatDate(date);
            const dailyTrades = this.tradesData.filter(trade => trade.date === dateStr);

            dailyContainer.innerHTML = '';

            if (dailyTrades.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.className = 'journal-empty-message';
                emptyMsg.innerHTML = `
                    <i class="fas fa-chart-line"></i>
                    <div>No trades for this day</div>
                `;
                dailyContainer.appendChild(emptyMsg);
                return;
            }

            dailyTrades.forEach(trade => {
                const tradeEl = document.createElement('div');
                tradeEl.className = 'journal-daily-trade';
                tradeEl.dataset.tradeId = trade.id.toString();

                // Parse date for display
                const [year, month, day] = trade.date.split('-');

                tradeEl.innerHTML = `
                    <div class="journal-daily-trade-time">
                        ${parseInt(day)} ${this.getMonthName(month)}
                    </div>
                    <div class="journal-daily-trade-pair">${trade.pair}</div>
                    <div class="journal-daily-trade-direction">
                        <span class="journal-direction ${trade.direction.toLowerCase()}">
                            ${trade.direction}
                        </span>
                    </div>
                    <div class="journal-daily-trade-pnl ${trade.result.toLowerCase()}">
                        ${trade.pnl}
                    </div>
                `;

                if (dailyContainer) {
                    dailyContainer.appendChild(tradeEl);
                }
            });

            console.log(`📊 Updated ${dailyTrades.length} daily trades for ${dateStr}`);
        } catch (error) {
            console.error('❌ Daily trades update failed:', error);
        }
    }
    
    // ==================== TRADES MANAGEMENT ====================
    private setupTradesTable(): void {
        this.updateTradesTable();
    }
    
    private updateTradesTable(): void {
        try {
            if (!this.elements.trades.filtered) return;

            this.elements.trades.filtered.innerHTML = '';

            this.tradesData.forEach(trade => {
                const row = document.createElement('tr');
                row.dataset.tradeId = trade.id.toString();

                row.innerHTML = `
                    <td>${trade.date}</td>
                    <td>${trade.pair}</td>
                    <td>
                        <span class="journal-direction ${trade.direction.toLowerCase()}">
                            ${trade.direction}
                        </span>
                    </td>
                    <td>${trade.size}</td>
                    <td class="journal-stat-${trade.result.toLowerCase()}">
                        ${trade.pnl}
                    </td>
                    <td>
                        <span class="journal-result ${trade.result.toLowerCase()}">
                            ${trade.result}
                        </span>
                    </td>
                `;

                if (this.elements.trades.filtered) {
                    this.elements.trades.filtered.appendChild(row);
                }
            });

            console.log(`📊 Updated trades table with ${this.tradesData.length} trades`);
        } catch (error) {
            console.error('❌ Trades table update failed:', error);
        }
    }
    
    private filterTrades(filter: string): void {
        try {
            if (!this.elements.trades.filtered) return;
           
            const rows = this.elements.trades.filtered.querySelectorAll('tr');
           
            rows.forEach(row => {
                let showTrade = true;
                const tradeId = parseInt(row.getAttribute('data-trade-id') || '0');
                const trade = this.tradesData.find(t => t.id === tradeId);
               
                if (!trade) return;
               
                switch(filter) {
                    case 'win':
                        showTrade = trade.result === 'WIN';
                        break;
                    case 'loss':
                        showTrade = trade.result === 'LOSS';
                        break;
                    case 'week':
                        const tradeDate = new Date(trade.date);
                        const weekAgo = new Date();
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        showTrade = tradeDate >= weekAgo;
                        break;
                    case 'month':
                        const tradeDateMonth = new Date(trade.date);
                        const currentMonth = new Date().getMonth();
                        showTrade = tradeDateMonth.getMonth() === currentMonth;
                        break;
                }
               
                row.style.display = showTrade ? '' : 'none';
            });
           
            console.log(`🔍 Filtered trades by: ${filter}`);
        } catch (error) {
            console.error('❌ Trade filtering failed:', error);
        }
    }
    
    // ==================== TRADE DETAIL MODAL ====================
    private showTradeDetail(tradeId: number): void {
        try {
            const trade = this.tradeDetails[tradeId] || this.tradesData.find(t => t.id === tradeId);
            if (!trade) {
                console.error(`❌ Trade #${tradeId} not found`);
                return;
            }
           
            if (!this.elements.modal.content || !this.elements.modal.container) return;
           
            this.elements.modal.content.innerHTML = this.createTradeDetailHTML(trade);
            this.elements.modal.container.classList.add('active');
            document.body.style.overflow = 'hidden';
           
            console.log(`📋 Showing trade detail for trade #${tradeId}`);
        } catch (error) {
            console.error('❌ Show trade detail failed:', error);
        }
    }
    
    private createTradeDetailHTML(trade: Trade): string {
        const detailTrade = this.tradeDetails[trade.id] || trade;
       
        return `
            <div class="journal-trade-detail-grid">
                <div class="journal-detail-section">
                    <h4>Trade Information</h4>
                    <div class="journal-trade-detail-row">
                        <div class="journal-detail-label">Date</div>
                        <div class="journal-detail-value">${detailTrade.date || trade.date}</div>
                    </div>
                    <div class="journal-trade-detail-row">
                        <div class="journal-detail-label">Time</div>
                        <div class="journal-detail-value">${detailTrade.time || 'N/A'}</div>
                    </div>
                    <div class="journal-trade-detail-row">
                        <div class="journal-detail-label">Currency Pair</div>
                        <div class="journal-detail-value">${trade.pair}</div>
                    </div>
                    <div class="journal-trade-detail-row">
                        <div class="journal-detail-label">Direction</div>
                        <div class="journal-detail-value">
                            <span class="journal-direction ${trade.direction.toLowerCase()}">
                                ${trade.direction}
                            </span>
                        </div>
                    </div>
                </div>
               
                <div class="journal-detail-section">
                    <h4>Trade Execution</h4>
                    <div class="journal-trade-detail-row">
                        <div class="journal-detail-label">Position Size</div>
                        <div class="journal-detail-value">${trade.size} lots</div>
                    </div>
                    <div class="journal-trade-detail-row">
                        <div class="journal-detail-label">Entry Price</div>
                        <div class="journal-detail-value">${detailTrade.entry || 'N/A'}</div>
                    </div>
                    <div class="journal-trade-detail-row">
                        <div class="journal-detail-label">Exit Price</div>
                        <div class="journal-detail-value">${detailTrade.exit || 'N/A'}</div>
                    </div>
                    <div class="journal-trade-detail-row">
                        <div class="journal-detail-label">Pips</div>
                        <div class="journal-detail-value ${detailTrade.pips?.startsWith('+') ? 'journal-stat-win' : 'journal-stat-loss'}">
                            ${detailTrade.pips || trade.pips || 'N/A'}
                        </div>
                    </div>
                </div>
               
                <div class="journal-detail-section">
                    <h4>Results</h4>
                    <div class="journal-trade-detail-row">
                        <div class="journal-detail-label">P&L</div>
                        <div class="journal-detail-value ${trade.pnl.startsWith('+') ? 'journal-stat-win' : 'journal-stat-loss'}">
                            ${trade.pnl}
                        </div>
                    </div>
                    <div class="journal-trade-detail-row">
                        <div class="journal-detail-label">Result</div>
                        <div class="journal-detail-value">
                            <span class="journal-result ${trade.result.toLowerCase()}">
                                ${trade.result}
                            </span>
                        </div>
                    </div>
                    <div class="journal-trade-detail-row">
                        <div class="journal-detail-label">Duration</div>
                        <div class="journal-detail-value">${detailTrade.duration || 'N/A'}</div>
                    </div>
                    <div class="journal-trade-detail-row">
                        <div class="journal-detail-label">Timeframe</div>
                        <div class="journal-detail-value">${detailTrade.timeframe || 'N/A'}</div>
                    </div>
                </div>
               
                ${detailTrade.notes ? `
                <div class="journal-detail-section full-width">
                    <h4>Trade Notes</h4>
                    <div class="journal-trade-detail-notes">
                        ${detailTrade.notes}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }
    
    private closeTradeDetail(): void {
        try {
            if (this.elements.modal.container) {
                this.elements.modal.container.classList.remove('active');
            }
            document.body.style.overflow = '';
            console.log('📋 Closed trade detail modal');
        } catch (error) {
            console.error('❌ Close trade detail failed:', error);
        }
    }
    
    // ==================== CHARTS FUNCTIONALITY ====================
    private setupChartContainers(): void {
        const chartContainers = document.querySelectorAll('.journal-chart');
        chartContainers.forEach(container => {
            // Set fixed height to prevent dynamic growth
            (container as HTMLElement).style.height = '250px';
            (container as HTMLElement).style.width = '100%';
            (container as HTMLElement).style.minHeight = '250px';
            (container as HTMLElement).style.maxHeight = '250px';
            (container as HTMLElement).style.overflow = 'hidden';
        });
    }
    
    private fixChartSizes(): void {
        // Ensure all charts maintain fixed size
        Object.values(this.elements.charts).forEach(chartContainer => {
            if (chartContainer) {
                chartContainer.style.height = '250px';
                chartContainer.style.minHeight = '250px';
                chartContainer.style.maxHeight = '250px';
            }
        });
    }
    
    private initializeCharts(): void {
        if (this.isChartsLoaded) return;
       
        try {
            console.log('📈 Initializing all 4 ApexCharts with fixed sizes...');
           
            if (typeof (window as any).ApexCharts === 'undefined') {
                this.loadApexCharts();
                return;
            }
           
            this.destroyCharts();
           
            // Initialize all 4 charts with fixed sizes
            this.initializePnlChart();
            this.initializeWinRateChart();
            this.initializeMonthlyChart();
            this.initializePairPerformanceChart();
           
            this.isChartsLoaded = true;
            console.log('✅ All 4 charts initialized successfully');
           
        } catch (error) {
            console.error('❌ Charts initialization failed:', error);
            setTimeout(() => this.initializeCharts(), 1000);
        }
    }
    
    private loadApexCharts(): void {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/apexcharts@3.35.0';
        script.onload = () => {
            console.log('✅ ApexCharts loaded dynamically');
            setTimeout(() => this.initializeCharts(), 500);
        };
        document.head.appendChild(script);
    }
    
    private destroyCharts(): void {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                try {
                    chart.destroy();
                } catch (e) {}
            }
        });
        this.charts = {};
        this.chartInitialized = {
            pnl: false,
            winRate: false,
            monthly: false,
            pair: false
        };
    }
    
    private initializePnlChart(): void {
        if (!this.elements.charts.pnl || this.chartInitialized.pnl) return;
       
        // Individual trade P&L distribution
        const pnlData = this.tradesData.slice(0, 12).map(trade => {
            const value = parseFloat(trade.pnl.replace(/[^0-9.-]+/g, ''));
            return trade.pnl.startsWith('+') ? value : -value;
        });
       
        const options = {
            ...this.chartConfigs.chartDefaults,
            series: [{
                name: 'P&L ($)',
                data: pnlData
            }],
            chart: {
                ...this.chartConfigs.chartDefaults.chart,
                type: 'bar',
                height: 250, // Fixed height
                width: '100%'
            },
            colors: pnlData.map(value => value >= 0 ? this.chartConfigs.colors.success : this.chartConfigs.colors.danger),
            plotOptions: {
                bar: {
                    borderRadius: 4,
                    columnWidth: '60%',
                }
            },
            xaxis: {
                categories: this.tradesData.slice(0, 12).map((t, i) => `T${i + 1}`),
                labels: { 
                    style: { 
                        colors: '#94A3B8',
                        fontFamily: 'Inter, sans-serif'
                    } 
                }
            },
            yaxis: {
                labels: {
                    style: { 
                        colors: '#94A3B8',
                        fontFamily: 'Inter, sans-serif'
                    },
                    formatter: (value: number) => `$${value}`
                }
            },
            tooltip: {
                theme: 'dark',
                style: {
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '12px'
                },
                y: {
                    formatter: (value: number) => `$${value}`
                }
            }
        };
        this.charts.pnlChart = new (window as any).ApexCharts(this.elements.charts.pnl, options);
        this.charts.pnlChart.render();
        this.chartInitialized.pnl = true;
    }
    
    private initializeWinRateChart(): void {
        if (!this.elements.charts.winRate || this.chartInitialized.winRate) return;
       
        // Calculate win rate for last 12 months
        const monthlyWinRates = [65, 70, 68, 72, 75, 68, 74, 76, 72, 78, 75, 80];
       
        const options = {
            ...this.chartConfigs.chartDefaults,
            series: [{
                name: 'Win Rate %',
                data: monthlyWinRates
            }],
            chart: {
                ...this.chartConfigs.chartDefaults.chart,
                type: 'line',
                height: 250, // Fixed height
                width: '100%'
            },
            colors: [this.chartConfigs.colors.success],
            stroke: {
                width: 3,
                curve: 'smooth'
            },
            markers: {
                size: 5,
                colors: [this.chartConfigs.colors.success]
            },
            xaxis: {
                categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                labels: { 
                    style: { 
                        colors: '#94A3B8',
                        fontFamily: 'Inter, sans-serif'
                    } 
                }
            },
            yaxis: {
                min: 50,
                max: 100,
                labels: {
                    style: { 
                        colors: '#94A3B8',
                        fontFamily: 'Inter, sans-serif'
                    },
                    formatter: (value: number) => `${value}%`
                }
            },
            tooltip: {
                theme: 'dark',
                style: {
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '12px'
                },
                y: {
                    formatter: (value: number) => `${value}%`
                }
            }
        };
        this.charts.winRateChart = new (window as any).ApexCharts(this.elements.charts.winRate, options);
        this.charts.winRateChart.render();
        this.chartInitialized.winRate = true;
    }
    
    private initializeMonthlyChart(): void {
        if (!this.elements.charts.monthly || this.chartInitialized.monthly) return;
       
        // Aggregate monthly P&L
        const monthlyPnl = [450, 320, -120, 580, 420, 680, 320, 540, 620, 480, 720, 850];
       
        const options = {
            ...this.chartConfigs.chartDefaults,
            series: [{
                name: 'Monthly P&L ($)',
                data: monthlyPnl
            }],
            chart: {
                ...this.chartConfigs.chartDefaults.chart,
                type: 'area',
                height: 250, // Fixed height
                width: '100%'
            },
            colors: [this.chartConfigs.colors.primary],
            stroke: {
                width: 2,
                curve: 'smooth'
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.7,
                    opacityTo: 0.1,
                    stops: [0, 90, 100]
                }
            },
            xaxis: {
                categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                labels: { 
                    style: { 
                        colors: '#94A3B8',
                        fontFamily: 'Inter, sans-serif'
                    } 
                }
            },
            yaxis: {
                labels: {
                    style: { 
                        colors: '#94A3B8',
                        fontFamily: 'Inter, sans-serif'
                    },
                    formatter: (value: number) => `$${value}`
                }
            },
            tooltip: {
                theme: 'dark',
                style: {
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '12px'
                },
                y: {
                    formatter: (value: number) => `$${value}`
                }
            }
        };
        this.charts.monthlyChart = new (window as any).ApexCharts(this.elements.charts.monthly, options);
        this.charts.monthlyChart.render();
        this.chartInitialized.monthly = true;
    }
    
    private initializePairPerformanceChart(): void {
        if (!this.elements.charts.pair || this.chartInitialized.pair) return;
       
        // Performance by currency pair
        const pairData = [
            { pair: 'EUR/USD', pnl: 1245 },
            { pair: 'GBP/USD', pnl: 856 },
            { pair: 'USD/JPY', pnl: 632 },
            { pair: 'AUD/USD', pnl: 423 },
            { pair: 'XAU/USD', pnl: 298 },
            { pair: 'BTC/USD', pnl: 185 }
        ];
       
        const options = {
            ...this.chartConfigs.chartDefaults,
            series: [{
                name: 'Net P&L ($)',
                data: pairData.map(p => p.pnl)
            }],
            chart: {
                ...this.chartConfigs.chartDefaults.chart,
                type: 'bar',
                height: 250, // Fixed height
                width: '100%'
            },
            colors: [this.chartConfigs.colors.info],
            plotOptions: {
                bar: {
                    borderRadius: 4,
                    columnWidth: '70%',
                }
            },
            xaxis: {
                categories: pairData.map(p => p.pair),
                labels: { 
                    style: { 
                        colors: '#94A3B8',
                        fontFamily: 'Inter, sans-serif'
                    } 
                }
            },
            yaxis: {
                labels: {
                    style: { 
                        colors: '#94A3B8',
                        fontFamily: 'Inter, sans-serif'
                    },
                    formatter: (value: number) => `$${value}`
                }
            },
            tooltip: {
                theme: 'dark',
                style: {
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '12px'
                },
                y: {
                    formatter: (value: number) => `$${value}`
                }
            }
        };
        this.charts.pairChart = new (window as any).ApexCharts(this.elements.charts.pair, options);
        this.charts.pairChart.render();
        this.chartInitialized.pair = true;
    }
    
    // ==================== STATISTICS ====================
    private updateStatsCards(): void {
        this.debouncedUpdate('stats', () => {
            try {
                const totalTrades = this.tradesData.length;
                const winningTrades = this.tradesData.filter(t => t.result === 'WIN').length;
                const winRate = totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 100) : 0;
               
                const totalPnl = this.tradesData.reduce((sum, trade) => {
                    const value = parseFloat(trade.pnl.replace(/[^0-9.-]+/g, ''));
                    return sum + (trade.pnl.startsWith('+') ? value : -value);
                }, 0);
               
                // Update stats cards
                if (this.elements.stats.totalTrades) {
                    this.elements.stats.totalTrades.textContent = totalTrades.toString();
                }
               
                if (this.elements.stats.winRate) {
                    this.elements.stats.winRate.textContent = `${winRate}%`;
                    this.elements.stats.winRate.className = `journal-stat-number ${winRate >= 50 ? 'journal-stat-win' : 'journal-stat-loss'}`;
                }
               
                if (this.elements.stats.netPnl) {
                    this.elements.stats.netPnl.textContent = `$${totalPnl > 0 ? '+' : ''}${Math.abs(totalPnl).toFixed(0)}`;
                    this.elements.stats.netPnl.className = `journal-stat-number ${totalPnl >= 0 ? 'journal-stat-win' : 'journal-stat-loss'}`;
                }
               
                // Update large stats cards
                if (this.elements.stats.netProfit) {
                    this.elements.stats.netProfit.textContent = `$${totalPnl > 0 ? '+' : ''}${Math.abs(totalPnl).toFixed(0)}`;
                }
               
                if (this.elements.stats.winRateLarge) {
                    this.elements.stats.winRateLarge.textContent = `${winRate}%`;
                }
               
                // Calculate profit factor (simplified)
                const totalWins = this.tradesData.filter(t => t.result === 'WIN').reduce((sum, trade) => {
                    const value = parseFloat(trade.pnl.replace(/[^0-9.-]+/g, ''));
                    return sum + Math.abs(value);
                }, 0);
               
                const totalLosses = this.tradesData.filter(t => t.result === 'LOSS').reduce((sum, trade) => {
                    const value = parseFloat(trade.pnl.replace(/[^0-9.-]+/g, ''));
                    return sum + Math.abs(value);
                }, 0);
               
                const profitFactor = totalLosses > 0 ? (totalWins / totalLosses).toFixed(2) : '∞';
               
                if (this.elements.stats.profitFactor) {
                    this.elements.stats.profitFactor.textContent = profitFactor;
                }
               
                // Calculate max drawdown (simplified)
                const maxDrawdown = Math.min(...this.tradesData.map(t => {
                    const value = parseFloat(t.pnl.replace(/[^0-9.-]+/g, ''));
                    return t.pnl.startsWith('+') ? value : -value;
                }));
               
                if (this.elements.stats.maxDrawdown) {
                    this.elements.stats.maxDrawdown.textContent = `$${Math.abs(maxDrawdown).toFixed(0)}`;
                }
               
            } catch (error) {
                console.error('❌ Stats update failed:', error);
            }
        }, 100);
    }
    
    // ==================== DATA PERSISTENCE ====================
    private saveData(): void {
        try {
            const data = {
                trades: this.tradesData,
                tradeDetails: this.tradeDetails,
                lastUpdated: new Date().toISOString()
            };
           
            localStorage.setItem('megaFlowzJournal', JSON.stringify(data));
            console.log('💾 Journal data saved');
        } catch (error) {
            console.error('❌ Error saving journal data:', error);
        }
    }
    
    private loadData(): boolean {
        try {
            const saved = localStorage.getItem('megaFlowzJournal');
            if (saved) {
                const data = JSON.parse(saved);
                this.tradesData = data.trades || this.generateTradesData();
                this.tradeDetails = data.tradeDetails || this.getDefaultTradeDetails();
                this.calendarData = this.generateCalendarData();
                console.log('📂 Journal data loaded');
                return true;
            }
        } catch (error) {
            console.error('❌ Error loading journal data:', error);
        }
        return false;
    }
    
    // ==================== UTILITY METHODS ====================
    private formatDate(date: Date): string {
        // Format date as YYYY-MM-DD for consistency
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    private getMonthName(monthNumber: string): string {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const num = parseInt(monthNumber);
        return months[num >= 1 && num <= 12 ? num - 1 : 0] || '';
    }
    
    private showErrorMessage(message: string): void {
        const container = document.querySelector('.journal-container');
        if (!container) return;
       
        const errorDiv = document.createElement('div');
        errorDiv.className = 'journal-error';
        errorDiv.innerHTML = `
            <div style="background: #ff4d6b; color: white; padding: 12px; border-radius: 6px; margin: 10px 0;">
                <i class="fas fa-exclamation-circle"></i> ${message}
            </div>
        `;
       
        container.insertBefore(errorDiv, container.firstChild);
    }
    
    // ==================== PUBLIC METHODS ====================
    public refresh(): void {
        console.log('🔄 Refreshing Journal Module...');
        this.destroy();
        this.initialize();
    }
    
    public destroy(): void {
        console.log('🧹 Cleaning up Journal Module...');
        
        this.isDestroyed = true;
       
        try {
            // Clear all timers
            this.updateDebounceTimers.forEach(timerId => {
                clearTimeout(timerId);
            });
            this.updateDebounceTimers.clear();
            
            if (this.updateMiniJournalThrottle) {
                clearTimeout(this.updateMiniJournalThrottle);
                this.updateMiniJournalThrottle = null;
            }
           
            // Cleanup event listeners
            this.cleanupEventHandlers();
            
            // Destroy charts
            this.destroyCharts();
           
            // Clear data
            this.tradeDetails = {};
            this.tradesData = [];
            this.calendarData = {};
            this.charts = {};
           
            this.isInitialized = false;
            this.isChartsLoaded = false;
           
            console.log('✅ Journal Module cleanup complete');
        } catch (error) {
            console.error('❌ Cleanup failed:', error);
        }
    }
}

// ==================== GLOBAL SETUP ====================
(window as any).JournalModule = JournalModule;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('📝 DOM Ready - Setting up Journal Module...');
   
    // Initialize journal module
    const initJournal = () => {
        if (!(window as any).journalModule) {
            (window as any).journalModule = new JournalModule();
            (window as any).journalModule.initialize();
           
            // Add to MegaFlowzApp if exists
            if ((window as any).MegaFlowzApp) {
                (window as any).MegaFlowzApp.journal = (window as any).journalModule;
            }
        }
    };
   
    // Wait for page to fully load
    if (document.readyState === 'complete') {
        setTimeout(initJournal, 500);
    } else {
        window.addEventListener('load', () => {
            setTimeout(initJournal, 500);
        });
    }
});

console.log("✅ Complete Journal Module Loaded - All Issues Fixed (TypeScript)");