// ===============================================================
// 📝 JOURNAL UI - UI Handling & Controls (Following NotificationUI Pattern)
// ===============================================================

import { JournalModule, Trade, TradeDetails, CalendarData } from './journal';

export class JournalUI {
    private isDestroyed: boolean = false;
    private eventListeners: Map<string, EventListener[]> = new Map();
    
    // DOM Elements
    private elements = {
        // Mini-journal elements
        todayPnl: null as HTMLElement | null,
        todayWinRate: null as HTMLElement | null,
        recentTrades: null as HTMLElement | null,
        quickAddBtn: null as HTMLElement | null,
        badge: null as HTMLElement | null,
        openFullJournalBtn: null as HTMLElement | null,
        journalToggleBtn: null as HTMLElement | null,
        
        // Full journal elements
        fullJournalOverlay: null as HTMLElement | null,
        closeFullJournalBtn: null as HTMLElement | null,
        dateRange: null as HTMLElement | null,
        
        // Tabs
        tabButtons: [] as Element[],
        tabs: {
            calendar: null as HTMLElement | null,
            trades: null as HTMLElement | null,
            stats: null as HTMLElement | null
        },
        
        // Calendar
        calendarTitle: null as HTMLElement | null,
        calendarDays: null as HTMLElement | null,
        selectedDate: null as HTMLElement | null,
        navButtons: [] as Element[],
        todayBtn: null as Element | null,
        viewAllBtn: null as Element | null,
        
        // Trades
        dailyTrades: null as HTMLElement | null,
        filteredTrades: null as HTMLElement | null,
        tradeFilter: null as HTMLSelectElement | null,
        
        // Stats
        statsElements: {
            totalTrades: null as HTMLElement | null,
            winRate: null as HTMLElement | null,
            netPnl: null as HTMLElement | null,
            netProfit: null as HTMLElement | null,
            winRateLarge: null as HTMLElement | null,
            profitFactor: null as HTMLElement | null,
            maxDrawdown: null as HTMLElement | null
        },
        
        // Charts
        charts: {
            pnl: null as HTMLElement | null,
            winRate: null as HTMLElement | null,
            monthly: null as HTMLElement | null,
            pair: null as HTMLElement | null
        },
        
        // Modal
        tradeModal: {
            container: null as HTMLElement | null,
            content: null as HTMLElement | null,
            close: null as Element | null
        }
    };
    
    // State
    private currentDate: Date = new Date();
    private selectedDate: Date = new Date();
    private charts: { [key: string]: any } = {};
    private isChartsLoaded: boolean = false;
    private chartInitialized = {
        pnl: false,
        winRate: false,
        monthly: false,
        pair: false
    };

    constructor(private journalModule: JournalModule) {
        console.log("🎨 Journal UI Initialized");
        this.cacheElements();
        this.setupEventHandlers();
        this.updateMiniJournal();
    }

    // ==================== ELEMENT CACHING ====================
    
    private cacheElements(): void {
        console.log("🔍 Caching journal UI elements...");
        
        // Mini-journal elements
        this.elements.todayPnl = document.getElementById('todayPnl');
        this.elements.todayWinRate = document.getElementById('todayWinRate');
        this.elements.recentTrades = document.getElementById('journalRecentTrades');
        this.elements.quickAddBtn = document.getElementById('quickAddTradeBtn');
        this.elements.badge = document.getElementById('journalBadge');
        this.elements.openFullJournalBtn = document.getElementById('openFullJournalFromPanel');
        this.elements.journalToggleBtn = document.getElementById('journalToggleBtn');
        
        // Full journal elements
        this.elements.fullJournalOverlay = document.getElementById('fullJournalOverlay');
        this.elements.closeFullJournalBtn = document.getElementById('closeFullJournalBtn');
        this.elements.dateRange = document.getElementById('journalDateRange');
        
        // Tabs
        this.elements.tabButtons = Array.from(document.querySelectorAll('.journal-tab'));
        this.elements.tabs.calendar = document.getElementById('journal-calendar-tab');
        this.elements.tabs.trades = document.getElementById('journal-trades-tab');
        this.elements.tabs.stats = document.getElementById('journal-stats-tab');
        
        // Calendar
        this.elements.calendarTitle = document.getElementById('journal-calendar-title');
        this.elements.calendarDays = document.getElementById('journal-calendar-days');
        this.elements.selectedDate = document.getElementById('journal-selected-date');
        this.elements.navButtons = Array.from(document.querySelectorAll('.journal-nav-btn'));
        this.elements.todayBtn = document.querySelector('.journal-today-btn');
        this.elements.viewAllBtn = document.querySelector('.journal-view-all');
        
        // Trades
        this.elements.dailyTrades = document.getElementById('journal-daily-trades');
        this.elements.filteredTrades = document.getElementById('journal-filtered-trades');
        this.elements.tradeFilter = document.getElementById('journal-filter-dropdown') as HTMLSelectElement;
        
        // Stats
        this.elements.statsElements.totalTrades = document.getElementById('totalTradesStat');
        this.elements.statsElements.winRate = document.getElementById('winRateStat');
        this.elements.statsElements.netPnl = document.getElementById('netPnlStat');
        this.elements.statsElements.netProfit = document.getElementById('netProfitStat');
        this.elements.statsElements.winRateLarge = document.getElementById('winRateLargeStat');
        this.elements.statsElements.profitFactor = document.getElementById('profitFactorStat');
        this.elements.statsElements.maxDrawdown = document.getElementById('maxDrawdownStat');
        
        // Charts
        this.elements.charts.pnl = document.getElementById('journal-pnlChart');
        this.elements.charts.winRate = document.getElementById('journal-winRateChart');
        this.elements.charts.monthly = document.getElementById('journal-monthlyChart');
        this.elements.charts.pair = document.getElementById('journal-pairPerformanceChart');
        
        // Modal
        this.elements.tradeModal.container = document.getElementById('journal-trade-modal');
        this.elements.tradeModal.content = document.getElementById('journal-trade-detail-content');
        this.elements.tradeModal.close = document.querySelector('.journal-close-modal');
        
        console.log("✅ Journal UI elements cached");
    }

    // ==================== EVENT HANDLERS ====================
    
    private setupEventHandlers(): void {
        this.cleanupEventHandlers();
        
        // Journal toggle button (corner icon)
        if (this.elements.journalToggleBtn) {
            this.addEventListener('journal-toggle-click', 'click', () => {
                this.toggleFullJournal();
            }, { element: this.elements.journalToggleBtn });
        }
        
        // Open full journal from mini-panel
        if (this.elements.openFullJournalBtn) {
            this.addEventListener('open-full-journal-click', 'click', () => {
                this.openFullJournal();
            }, { element: this.elements.openFullJournalBtn });
        }
        
        // Close full journal button
        if (this.elements.closeFullJournalBtn) {
            this.addEventListener('close-full-journal-click', 'click', () => {
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
        
        // Tab switching
        this.elements.tabButtons.forEach(tab => {
            this.addEventListener(`tab-${tab.getAttribute('data-tab')}-click`, 'click', (e: Event) => {
                const target = e.target as HTMLElement;
                const tabName = target.dataset.tab || target.closest('[data-tab]')?.getAttribute('data-tab');
                if (tabName) {
                    this.switchTab(tabName);
                }
            }, { element: tab });
        });
        
        // Calendar navigation
        this.elements.navButtons.forEach(btn => {
            this.addEventListener('nav-btn-click', 'click', (e: Event) => {
                const target = e.target as HTMLElement;
                const button = target.closest('.journal-nav-btn');
                if (button) {
                    const direction = parseInt(button.getAttribute('data-direction') || '0');
                    this.changeMonth(direction);
                }
            }, { element: btn });
        });
        
        // Today button
        if (this.elements.todayBtn) {
            this.addEventListener('today-btn-click', 'click', () => this.goToToday(), { element: this.elements.todayBtn });
        }
        
        // View all trades button
        if (this.elements.viewAllBtn) {
            this.addEventListener('view-all-click', 'click', (e: Event) => {
                e.preventDefault();
                this.switchTab('trades');
            }, { element: this.elements.viewAllBtn });
        }
        
        // Trade filtering
        if (this.elements.tradeFilter) {
            this.addEventListener('trade-filter-change', 'change', (e: Event) => {
                const target = e.target as HTMLSelectElement;
                this.filterTrades(target.value);
            }, { element: this.elements.tradeFilter });
        }
        
        // Quick add trade button
        if (this.elements.quickAddBtn) {
            this.addEventListener('quick-add-trade-click', 'click', (e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                this.showQuickAddTradeForm();
            }, { element: this.elements.quickAddBtn });
        }
        
        // Trade detail modal close
        if (this.elements.tradeModal.close) {
            this.addEventListener('trade-modal-close', 'click', () => {
                this.closeTradeDetail();
            }, { element: this.elements.tradeModal.close });
        }
        
        // Escape key to close modals
        this.addEventListener('escape-key', 'keydown', (e: Event) => {
            const ke = e as KeyboardEvent;
            if (ke.key === 'Escape') {
                if (this.elements.tradeModal.container?.classList.contains('active')) {
                    this.closeTradeDetail();
                }
                if (this.elements.fullJournalOverlay?.classList.contains('active')) {
                    this.closeFullJournal();
                }
            }
        });
        
        console.log("🔌 Journal UI event handlers setup complete");
    }
    
    private addEventListener(eventName: string, type: string, handler: EventListener, 
                            options?: { selector?: string, element?: Element }): void {
        const element = options?.element || (options?.selector ? document.querySelector(options.selector) : document);
        
        if (!element) return;
        
        const wrappedHandler = (e: Event) => {
            if (this.isDestroyed) return;
            handler(e);
        };
        
        element.addEventListener(type, wrappedHandler);
        
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
                document.removeEventListener(type, handler);
                if (this.elements.fullJournalOverlay) {
                    this.elements.fullJournalOverlay.removeEventListener(type, handler);
                }
                if (this.elements.tradeModal.container) {
                    this.elements.tradeModal.container.removeEventListener(type, handler);
                }
            });
        });
        this.eventListeners.clear();
    }

    // ==================== MINI-JOURNAL UI ====================
    
    public updateMiniJournal(): void {
        try {
            this.updateMiniStats();
            this.updateRecentTrades();
            this.updateJournalBadge();
            console.log("📱 Mini-journal updated");
        } catch (error) {
            console.error('❌ Mini-journal update failed:', error);
        }
    }
    
    private updateMiniStats(): void {
        try {
            const today = this.formatDate(new Date());
            const trades = this.journalModule.getTrades();
            const todayTrades = trades.filter(trade => trade.date === today);
            
            if (todayTrades.length === 0) {
                if (this.elements.todayPnl) {
                    this.elements.todayPnl.textContent = '$0';
                    this.elements.todayPnl.className = 'mini-stat-value';
                }
                if (this.elements.todayWinRate) {
                    this.elements.todayWinRate.textContent = '0%';
                    this.elements.todayWinRate.className = 'mini-stat-value';
                }
                return;
            }
            
            const stats = this.calculateStats(todayTrades);
            
            if (this.elements.todayPnl) {
                this.elements.todayPnl.textContent = stats.formattedPnl;
                this.elements.todayPnl.className = stats.pnlClass;
            }
            
            if (this.elements.todayWinRate) {
                this.elements.todayWinRate.textContent = stats.winRateText;
                this.elements.todayWinRate.className = stats.winRateClass;
            }
            
        } catch (error) {
            console.error('❌ Mini stats update failed:', error);
        }
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
    
    private updateRecentTrades(): void {
        try {
            const trades = this.journalModule.getTrades();
            const recentTrades = trades.slice(0, 5);
            
            if (!this.elements.recentTrades) return;
            
            this.elements.recentTrades.innerHTML = '';
            
            if (recentTrades.length === 0) {
                this.elements.recentTrades.innerHTML = `
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

                this.elements.recentTrades.appendChild(tradeEl);
            });
           
        } catch (error) {
            console.error('❌ Recent trades update failed:', error);
        }
    }
    
    private updateJournalBadge(): void {
        if (!this.elements.badge) return;
       
        const today = this.formatDate(new Date());
        const trades = this.journalModule.getTrades();
        const todayTrades = trades.filter(trade => trade.date === today).length;
       
        this.elements.badge.textContent = todayTrades > 0 ? todayTrades.toString() : '';
        this.elements.badge.style.display = todayTrades > 0 ? 'flex' : 'none';
    }
    
    private showQuickAddTradeForm(): void {
        // Quick add trade form implementation
        console.log("📝 Showing quick add trade form");
        // Implementation from original journal.ts
    }

    // ==================== FULL JOURNAL UI ====================
    
    public toggleFullJournal(): void {
        if (!this.elements.fullJournalOverlay) return;
       
        if (this.elements.fullJournalOverlay.classList.contains('active')) {
            this.closeFullJournal();
        } else {
            this.openFullJournal();
        }
    }
    
    public openFullJournal(): void {
        if (!this.elements.fullJournalOverlay) return;
       
        this.elements.fullJournalOverlay.style.display = 'flex';
        setTimeout(() => this.elements.fullJournalOverlay!.classList.add('active'), 10);
       
        // Update date range display
        if (this.elements.dateRange) {
            const today = new Date();
            const options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
            this.elements.dateRange.textContent = today.toLocaleDateString('en-US', options);
        }
        
        // Initialize active tab
        this.switchTab('calendar');
    }
    
    public closeFullJournal(): void {
        if (!this.elements.fullJournalOverlay) return;
       
        this.elements.fullJournalOverlay.classList.remove('active');
        setTimeout(() => {
            this.elements.fullJournalOverlay!.style.display = 'none';
        }, 300);
    }
    
    private switchTab(tabName: string): void {
        console.log(`📊 Switching to ${tabName} tab`);
       
        try {
            // Remove active class from all tabs and content
            this.elements.tabButtons.forEach(tab => tab.classList.remove('active'));
            Object.values(this.elements.tabs).forEach(tab => {
                if (tab) tab.classList.remove('active');
            });
           
            // Add active class to selected tab and content
            const tabElement = this.elements.tabButtons.find(
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

    // ==================== CALENDAR UI ====================
    
    private updateCalendar(): void {
        try {
            const year = this.currentDate.getFullYear();
            const month = this.currentDate.getMonth();
           
            // Update calendar title
            const monthNames = ["January", "February", "March", "April", "May", "June",
                               "July", "August", "September", "October", "November", "December"];
            if (this.elements.calendarTitle) {
                this.elements.calendarTitle.textContent = `${monthNames[month]} ${year}`;
            }
           
            // Calendar rendering logic from original journal.ts
            // ... (implementation from original updateCalendar method)
           
        } catch (error) {
            console.error('❌ Calendar update failed:', error);
        }
    }
    
    private changeMonth(direction: number): void {
        try {
            this.currentDate = new Date(
                this.currentDate.getFullYear(),
                this.currentDate.getMonth() + direction,
                1
            );
            this.updateCalendar();
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
           
            if (this.elements.selectedDate) {
                const today = new Date();
                const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                this.elements.selectedDate.textContent = today.toLocaleDateString('en-US', options);
            }
        } catch (error) {
            console.error('❌ Go to today failed:', error);
        }
    }
    
    private updateDailyTrades(date: Date = new Date()): void {
        // Implementation from original journal.ts
    }

    // ==================== TRADES UI ====================
    
    private updateTradesTable(): void {
        // Implementation from original journal.ts
    }
    
    private filterTrades(filter: string): void {
        // Implementation from original journal.ts
    }
    
    private showTradeDetail(tradeId: number): void {
        // Implementation from original journal.ts
    }
    
    private closeTradeDetail(): void {
        // Implementation from original journal.ts
    }

    // ==================== STATISTICS UI ====================
    
    private updateStatsCards(): void {
        // Implementation from original journal.ts
    }
    
    private initializeCharts(): void {
        // Chart initialization from original journal.ts
    }

    // ==================== UTILITY METHODS ====================
    
    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    public onDataChanged(): void {
        this.updateMiniJournal();
        if (this.elements.fullJournalOverlay?.classList.contains('active')) {
            this.updateCalendar();
            this.updateTradesTable();
            this.updateStatsCards();
        }
    }

    // ==================== CLEANUP ====================
    
    public destroy(): void {
        console.log('🧹 Cleaning up Journal UI...');
        
        this.isDestroyed = true;
        this.cleanupEventHandlers();
        
        // Clean up charts
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                try {
                    chart.destroy();
                } catch (e) {}
            }
        });
        
        this.charts = {};
        this.isChartsLoaded = false;
        
        console.log('✅ Journal UI cleanup complete');
    }
}