// ================================================================
// ⚡ TAB MANAGER - TradingView-style tab interface
// ================================================================

interface Tab {
    id: string;
    title: string;
    icon?: string;
    type: 'chart' | 'analytics' | 'component';
    closable: boolean;
    active: boolean;
}

export class TabManager {
    private static instance: TabManager;
    private tabs: Tab[] = [];
    private activeTabId: string = '';
    private container: HTMLElement | null = null;

    // ==================== LIVE TAB STATE ====================
    private currentSymbol: string = localStorage.getItem('last_symbol') || 'EURUSD';
    private currentTimeframe: string = localStorage.getItem('last_timeframe') || 'H1';
    private currentPrice: string = '';
    private priceDirection: 'up' | 'down' | 'flat' = 'flat';
    private lastPrice: number = 0;
    private lastDirectionChange: number = 0;
    private readonly DIRECTION_COOLDOWN = 300;

    // ✅ Strategy removed from defaultTabs — opens on demand only
    private readonly defaultTabs: Tab[] = [
        {
            id: 'chart',
            title: 'Chart',
            type: 'chart',
            closable: false,
            active: true
        }
    ];

    private constructor() {
        this.tabs = [...this.defaultTabs];
        this.activeTabId = 'chart';
    }

    static getInstance(): TabManager {
        if (!TabManager.instance) {
            TabManager.instance = new TabManager();
        }
        return TabManager.instance;
    }

    public initialize(): void {
        if (document.getElementById('electron-tab-strip')) return;

        this.createTabStrip();
        this.setupEventListeners();
        this.setupLiveTabListeners();
        this.updateBodyTabClass();

        console.log('✅ Tab Manager initialized');
    }

    // ==================== LIVE TAB LISTENERS ====================

    private setupLiveTabListeners(): void {

        document.addEventListener('price-update', (e: Event) => {
            const { bid } = (e as CustomEvent).detail;
            if (!bid) return;

            const newPrice = bid;
            const now = Date.now();

            if (this.lastPrice !== 0 && now - this.lastDirectionChange > this.DIRECTION_COOLDOWN) {
                if (newPrice > this.lastPrice) {
                    this.priceDirection = 'up';
                    this.lastDirectionChange = now;
                } else if (newPrice < this.lastPrice) {
                    this.priceDirection = 'down';
                    this.lastDirectionChange = now;
                }
            }

            this.lastPrice = newPrice;
            this.currentPrice = newPrice.toFixed(5);
            this.updateChartTabLabel();
        });

        document.addEventListener('symbol-changed', (e: Event) => {
            const { symbol } = (e as CustomEvent).detail;
            if (symbol) {
                this.currentSymbol = symbol;
                this.currentPrice = '';
                this.lastPrice = 0;
                this.priceDirection = 'flat';
                this.lastDirectionChange = 0;
                this.updateChartTabLabel();
            }
        });

        document.addEventListener('timeframe-changed', (e: Event) => {
            const { timeframe } = (e as CustomEvent).detail;
            if (timeframe) {
                this.currentTimeframe = timeframe;
                this.updateChartTabLabel();
            }
        });

        // ✅ Listen for on-demand tab open requests from other modules
        document.addEventListener('open-strategy-tab', () => this.openStrategyTab());
        document.addEventListener('open-journal-tab', () => this.openJournalTab());
    }

    // ==================== CHART TAB LABEL UPDATE ====================

    private updateChartTabLabel(): void {
        const tabEl = this.container?.querySelector('[data-tab-id="chart"]');
        if (!tabEl) return;

        const titleEl = tabEl.querySelector('.tab-title') as HTMLElement;
        const priceEl = tabEl.querySelector('.tab-live-price') as HTMLElement;
        const arrowEl = tabEl.querySelector('.tab-live-arrow') as HTMLElement;

        if (titleEl) {
            titleEl.textContent = `${this.currentSymbol} · ${this.currentTimeframe}`;
        }

        if (priceEl) {
            priceEl.textContent = this.currentPrice;
            priceEl.className = `tab-live-price ${this.priceDirection}`;
        }

        if (arrowEl) {
            arrowEl.className = `tab-live-arrow ${this.priceDirection}`;
            arrowEl.textContent = this.priceDirection === 'up' ? '▲'
                                : this.priceDirection === 'down' ? '▼' : '';
        }
    }

    // ==================== TAB STRIP ====================

    private createTabStrip(): void {
        const tabStrip = document.createElement('div');
        tabStrip.id = 'electron-tab-strip';
        tabStrip.className = 'electron-tab-strip';

        const leftSection = document.createElement('div');
        leftSection.className = 'tab-strip-left';

        // ✅ LOGO REMOVED — replaced with user icon menu
        this.createUserMenu(leftSection);

        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'tabs-container';
        leftSection.appendChild(tabsContainer);

        const rightSection = document.createElement('div');
        rightSection.className = 'tab-strip-right';

        // AUTO TRADE TOGGLE
        const autoTradeToggle = document.createElement('div');
        autoTradeToggle.className = 'auto-toggle-tab';
        autoTradeToggle.title = 'Auto Trading';
        autoTradeToggle.innerHTML = `
            <label class="switch tab-switch">
                <input type="checkbox" id="autoTradeToggleTab">
                <span class="slider"></span>
            </label>
        `;
        rightSection.appendChild(autoTradeToggle);

        // NOTIFICATION BELL
        const notificationBellTab = document.createElement('div');
        notificationBellTab.className = 'notification-bell-tab';
        notificationBellTab.id = 'notificationBell';
        notificationBellTab.title = 'Notifications';
        notificationBellTab.innerHTML = `
            <i class="fas fa-bell"></i>
            <span class="alert-count" id="alertCount">0</span>
        `;
        rightSection.appendChild(notificationBellTab);

        // ADD TAB BUTTON
        const addTabBtn = document.createElement('button');
        addTabBtn.className = 'tab-control-btn add-tab-btn';
        addTabBtn.innerHTML = '<i class="fas fa-plus"></i>';
        addTabBtn.title = 'New Tab';
        addTabBtn.addEventListener('click', () => this.addNewTab());
        rightSection.appendChild(addTabBtn);

        // WINDOW CONTROLS
        const windowControls = document.createElement('div');
        windowControls.className = 'window-controls';

        const minimizeBtn = document.createElement('button');
        minimizeBtn.className = 'window-control-btn minimize-btn';
        minimizeBtn.innerHTML = '🗕';
        minimizeBtn.title = 'Minimize';
        minimizeBtn.addEventListener('click', () => this.minimizeWindow());

        const maximizeBtn = document.createElement('button');
        maximizeBtn.className = 'window-control-btn maximize-btn';
        maximizeBtn.innerHTML = '🗖';
        maximizeBtn.title = 'Maximize';
        maximizeBtn.addEventListener('click', () => this.toggleMaximize());

        const closeBtn = document.createElement('button');
        closeBtn.className = 'window-control-btn close-btn';
        closeBtn.innerHTML = '✕';
        closeBtn.title = 'Close';
        closeBtn.addEventListener('click', () => this.closeWindow());

        windowControls.appendChild(minimizeBtn);
        windowControls.appendChild(maximizeBtn);
        windowControls.appendChild(closeBtn);
        rightSection.appendChild(windowControls);

        tabStrip.appendChild(leftSection);
        tabStrip.appendChild(rightSection);

        document.body.insertBefore(tabStrip, document.body.firstChild);
        this.container = tabStrip;

        this.renderTabs();
        this.setupAutoTradeToggle();
    }

    // ==================== USER MENU ====================

    private createUserMenu(leftSection: HTMLElement): void {

        // USER ICON BUTTON
        const userMenuBtn = document.createElement('div');
        userMenuBtn.className = 'user-menu-btn';
        userMenuBtn.id = 'userMenuBtn';
        userMenuBtn.title = 'Account';
        userMenuBtn.innerHTML = `<i class="fas fa-user-circle"></i>`;
        leftSection.appendChild(userMenuBtn);

        // DROPDOWN
        const userDropdown = document.createElement('div');
        userDropdown.className = 'user-menu-dropdown';
        userDropdown.id = 'userMenuDropdown';
        userDropdown.innerHTML = `
            <div class="user-menu-header">
                <i class="fas fa-user-circle user-avatar-icon"></i>
                <div class="user-info">
                    <span class="user-name">Trader</span>
                    <span class="user-role">Pro Account</span>
                </div>
            </div>
            <div class="user-menu-divider"></div>
            <div class="user-menu-item" id="menuProfile">
                <i class="fas fa-id-card"></i> Profile
            </div>
            <div class="user-menu-item" id="menuTheme">
                <i class="fas fa-palette"></i> Theme
            </div>
            <div class="user-menu-divider"></div>
            <div class="user-menu-item" id="menuHotkeys">
                <i class="fas fa-keyboard"></i> Hotkeys
            </div>
            <div class="user-menu-divider"></div>
            <div class="user-menu-item danger" id="menuLogout">
                <i class="fas fa-sign-out-alt"></i> Logout
            </div>
        `;
        document.body.appendChild(userDropdown);

        // TOGGLE DROPDOWN
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('open');
        });

        // CLOSE ON OUTSIDE CLICK
        document.addEventListener('click', () => {
            userDropdown.classList.remove('open');
        });

        // MENU ITEM ACTIONS
        userDropdown.querySelector('#menuProfile')?.addEventListener('click', () => {
            userDropdown.classList.remove('open');
            document.dispatchEvent(new CustomEvent('open-profile'));
        });

        userDropdown.querySelector('#menuTheme')?.addEventListener('click', () => {
            userDropdown.classList.remove('open');
            document.dispatchEvent(new CustomEvent('open-theme'));
        });

        userDropdown.querySelector('#menuHotkeys')?.addEventListener('click', () => {
            userDropdown.classList.remove('open');
            document.dispatchEvent(new CustomEvent('open-hotkeys'));
        });

        userDropdown.querySelector('#menuLogout')?.addEventListener('click', () => {
            userDropdown.classList.remove('open');
            document.dispatchEvent(new CustomEvent('user-logout'));
        });
    }

    // ==================== ON-DEMAND TABS ====================

    // ✅ Opens Strategy tab — triggered by Custom Strategy button in Indicators modal
    public openStrategyTab(): void {
        const existing = this.tabs.find(t => t.id === 'strategy');
        if (existing) {
            this.switchToTab('strategy');
            return;
        }

        const strategyTab: Tab = {
            id: 'strategy',
            title: 'Strategy',
            type: 'analytics',
            closable: true,
            active: false
        };

        this.tabs.push(strategyTab);
        this.switchToTab('strategy');
        console.log('📈 Strategy tab opened');
    }

    // ✅ Opens Journal tab — triggered by "Full Journal" button in right panel
    public openJournalTab(): void {
        const existing = this.tabs.find(t => t.id === 'journal');
        if (existing) {
            this.switchToTab('journal');
            return;
        }

        const journalTab: Tab = {
            id: 'journal',
            title: 'Journal',
            type: 'component',
            closable: true,
            active: false
        };

        this.tabs.push(journalTab);
        this.switchToTab('journal');
        console.log('📓 Journal tab opened');
    }

    // ==================== AUTO TRADE TOGGLE ====================

    private setupAutoTradeToggle(): void {
        const autoTradeToggle = document.getElementById('autoTradeToggleTab') as HTMLInputElement;
        if (!autoTradeToggle) return;

        autoTradeToggle.addEventListener('change', () => {
            const enabled = autoTradeToggle.checked;
            document.dispatchEvent(new CustomEvent('auto-trade-toggled', {
                detail: { enabled }
            }));
            console.log(`🤖 Auto Trade: ${enabled ? 'ENABLED' : 'DISABLED'}`);
        });
    }

    // ==================== RENDER TABS ====================

    private renderTabs(): void {
        const tabsContainer = this.container?.querySelector('.tabs-container');
        if (!tabsContainer) return;

        tabsContainer.innerHTML = '';

        this.tabs.forEach(tab => {
            const tabElement = document.createElement('div');
            tabElement.className = `tab ${tab.active ? 'active' : ''} ${tab.closable ? 'closable' : ''}`;
            tabElement.dataset.tabId = tab.id;

            const title = document.createElement('span');
            title.className = 'tab-title';

            if (tab.id === 'chart') {
                title.textContent = `${this.currentSymbol} · ${this.currentTimeframe}`;
            } else {
                title.textContent = tab.title;
            }

            tabElement.appendChild(title);

            // Live price + arrow — chart tab only
            if (tab.id === 'chart') {
                const priceEl = document.createElement('span');
                priceEl.className = `tab-live-price ${this.priceDirection}`;
                priceEl.textContent = this.currentPrice;
                tabElement.appendChild(priceEl);

                const arrowEl = document.createElement('span');
                arrowEl.className = `tab-live-arrow ${this.priceDirection}`;
                arrowEl.textContent = this.priceDirection === 'up' ? '▲'
                                    : this.priceDirection === 'down' ? '▼' : '';
                tabElement.appendChild(arrowEl);
            }

            if (tab.closable) {
                const closeBtn = document.createElement('button');
                closeBtn.className = 'tab-close-btn';
                closeBtn.innerHTML = '✕';
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.closeTab(tab.id);
                });
                tabElement.appendChild(closeBtn);
            }

            tabElement.addEventListener('click', () => this.switchToTab(tab.id));
            tabsContainer.appendChild(tabElement);
        });
    }

    // ==================== TAB STATE ====================

    private updateBodyTabClass(): void {
        document.body.classList.remove(
            'tab-chart-active',
            'tab-analytics-active',
            'tab-strategy-active',
            'tab-journal-active',
            'tab-component-active'
        );
        document.body.classList.add(`tab-${this.activeTabId}-active`);
    }

    private updateSidebars(tabId: string): void {
        const drawingSidebar = document.querySelector('.drawing-sidebar') as HTMLElement;
        const toolsPanel = document.querySelector('.tools-panel') as HTMLElement;
        const workspaceContainer = document.querySelector('.workspace-container') as HTMLElement;

        // ✅ Hide sidebars for both strategy and journal tabs
        const isFullscreen = tabId === 'strategy' || tabId === 'journal';

        if (isFullscreen) {
            if (drawingSidebar) drawingSidebar.style.display = 'none';
            if (toolsPanel) toolsPanel.style.display = 'none';
            if (workspaceContainer) {
                workspaceContainer.style.left = '0';
                workspaceContainer.style.right = '0';
            }
        } else {
            if (drawingSidebar) drawingSidebar.style.display = '';
            if (toolsPanel) toolsPanel.style.display = '';
            if (workspaceContainer) {
                workspaceContainer.style.left = '';
                workspaceContainer.style.right = '';
            }
        }
    }

    public switchToTab(tabId: string): void {
        this.tabs.forEach(tab => {
            tab.active = tab.id === tabId;
        });

        this.activeTabId = tabId;
        this.renderTabs();
        this.updateBodyTabClass();
        this.updateSidebars(tabId);

        console.log(`🔀 Switched to tab: ${tabId}`);
    }

    public addNewTab(): void {
        const newTab: Tab = {
            id: `tab-${Date.now()}`,
            title: 'New Tab',
            type: 'component',
            closable: true,
            active: false
        };

        this.tabs.push(newTab);
        this.switchToTab(newTab.id);
    }

    public closeTab(tabId: string): void {
        // ✅ Only chart is permanent now
        if (tabId === 'chart') return;

        const tabIndex = this.tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) return;

        this.tabs.splice(tabIndex, 1);

        if (tabId === this.activeTabId) {
            this.switchToTab('chart');
        } else {
            this.renderTabs();
        }
    }

    private setupEventListeners(): void {
        const tabStrip = document.getElementById('electron-tab-strip');
        tabStrip?.addEventListener('dblclick', () => this.toggleMaximize());
    }

    private minimizeWindow(): void {
        console.log('Minimize clicked');
    }

    private toggleMaximize(): void {
        console.log('Maximize clicked');
    }

    private closeWindow(): void {
        console.log('Close clicked');
    }

    public destroy(): void {
        const tabStrip = document.getElementById('electron-tab-strip');
        if (tabStrip) tabStrip.remove();
        document.getElementById('userMenuDropdown')?.remove();
        document.body.classList.remove(
            'tab-chart-active',
            'tab-analytics-active',
            'tab-strategy-active',
            'tab-journal-active',
            'tab-component-active'
        );
    }
}

export function initializeTabManager(): TabManager {
    const manager = TabManager.getInstance();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => manager.initialize());
    } else {
        manager.initialize();
    }

    return manager;
}