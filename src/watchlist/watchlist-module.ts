// ================================================================
// 📋 WATCHLIST MODULE - Mock
// ================================================================

interface WatchlistSymbol {
    id:       string;
    name:     string;
    cat:      string;
    type:     'forex' | 'metal' | 'crypto' | 'index';
    base?:    string;  // forex only
    quote?:   string;  // forex only
    img?:     string;  // non-forex icon
    price:    string;
    chg:      string;
}

export class WatchlistModule {

    private container:    HTMLElement | null = null;
    private itemsEl:      HTMLElement | null = null;
    private searchEl:     HTMLElement | null = null;
    private searchInput:  HTMLInputElement | null = null;
    private searchResults:HTMLElement | null = null;

    private added: Set<string> = new Set(['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD', 'US30']);
    private currentSort: 'az' | 'chg' = 'az';

    // ── Mock symbol database ──
    private readonly SYMBOLS: WatchlistSymbol[] = [
        { id: 'EURUSD',  name: 'EUR/USD',  cat: 'Forex · Major',   type: 'forex',  base: 'eu', quote: 'us', price: '1.08497', chg: '+0.12' },
        { id: 'GBPUSD',  name: 'GBP/USD',  cat: 'Forex · Major',   type: 'forex',  base: 'gb', quote: 'us', price: '1.26854', chg: '-0.08' },
        { id: 'USDJPY',  name: 'USD/JPY',  cat: 'Forex · Major',   type: 'forex',  base: 'us', quote: 'jp', price: '151.240', chg: '+0.24' },
        { id: 'AUDUSD',  name: 'AUD/USD',  cat: 'Forex · Major',   type: 'forex',  base: 'au', quote: 'us', price: '0.65430', chg: '-0.15' },
        { id: 'USDCAD',  name: 'USD/CAD',  cat: 'Forex · Major',   type: 'forex',  base: 'us', quote: 'ca', price: '1.35420', chg: '+0.10' },
        { id: 'NZDUSD',  name: 'NZD/USD',  cat: 'Forex · Major',   type: 'forex',  base: 'nz', quote: 'us', price: '0.60150', chg: '-0.05' },
        { id: 'USDCHF',  name: 'USD/CHF',  cat: 'Forex · Major',   type: 'forex',  base: 'us', quote: 'ch', price: '0.89240', chg: '+0.08' },
        { id: 'EURGBP',  name: 'EUR/GBP',  cat: 'Forex · Cross',   type: 'forex',  base: 'eu', quote: 'gb', price: '0.85420', chg: '+0.03' },
        { id: 'EURJPY',  name: 'EUR/JPY',  cat: 'Forex · Cross',   type: 'forex',  base: 'eu', quote: 'jp', price: '163.850', chg: '+0.36' },
        { id: 'GBPJPY',  name: 'GBP/JPY',  cat: 'Forex · Cross',   type: 'forex',  base: 'gb', quote: 'jp', price: '191.240', chg: '+0.16' },
        { id: 'XAUUSD',  name: 'XAU/USD',  cat: 'Metal · Gold',    type: 'metal',  img: 'https://assets.coincap.io/assets/icons/xau@2x.png',  price: '2024.50', chg: '+0.45' },
        { id: 'XAGUSD',  name: 'XAG/USD',  cat: 'Metal · Silver',  type: 'metal',  img: 'https://assets.coincap.io/assets/icons/xag@2x.png',  price: '22.840',  chg: '+0.22' },
        { id: 'BTCUSD',  name: 'BTC/USD',  cat: 'Crypto',          type: 'crypto', img: 'https://assets.coincap.io/assets/icons/btc@2x.png',  price: '67420',   chg: '-1.23' },
        { id: 'ETHUSD',  name: 'ETH/USD',  cat: 'Crypto',          type: 'crypto', img: 'https://assets.coincap.io/assets/icons/eth@2x.png',  price: '3420',    chg: '-0.87' },
        { id: 'SOLUSD',  name: 'SOL/USD',  cat: 'Crypto',          type: 'crypto', img: 'https://assets.coincap.io/assets/icons/sol@2x.png',  price: '182.40',  chg: '+2.14' },
        { id: 'US30',    name: 'US30',     cat: 'Index · Dow',     type: 'index',  img: 'https://flagcdn.com/w320/us.png',                     price: '38924',   chg: '+0.31' },
        { id: 'US500',   name: 'US500',    cat: 'Index · S&P500',  type: 'index',  img: 'https://flagcdn.com/w320/us.png',                     price: '5248',    chg: '+0.28' },
        { id: 'NAS100',  name: 'NAS100',   cat: 'Index · Nasdaq',  type: 'index',  img: 'https://flagcdn.com/w320/us.png',                     price: '18420',   chg: '+0.42' },
        { id: 'GER40',   name: 'GER40',    cat: 'Index · DAX',     type: 'index',  img: 'https://flagcdn.com/w320/de.png',                     price: '17820',   chg: '+0.18' },
        { id: 'UK100',   name: 'UK100',    cat: 'Index · FTSE',    type: 'index',  img: 'https://flagcdn.com/w320/gb.png',                     price: '7940',    chg: '-0.12' },
    ];

    // ── Price tick listener reference for cleanup ──
    private priceUpdateHandler: ((e: Event) => void) | null = null;

    // ── Mock tick interval for testing ──
    private mockTickInterval: ReturnType<typeof setInterval> | null = null;

    // ================================================================
    // INITIALIZE
    // ================================================================

    public initialize(): void {
        this.container     = document.querySelector('.watchlist-panel');
        this.itemsEl       = document.getElementById('watchlistItems');
        this.searchEl      = document.getElementById('watchlistSearch');
        this.searchInput   = document.getElementById('watchlistSearchInput') as HTMLInputElement;
        this.searchResults = document.getElementById('watchlistSearchResults');

        if (!this.container || !this.itemsEl) {
            console.warn('⚠️ Watchlist: container not found');
            return;
        }

        this.renderDefaultSymbols();
        this.bindEvents();
        this.startMockTicks(); // remove when real WebSocket is wired

        console.log('✅ Watchlist Module initialized (mock)');
    }

    // ================================================================
    // DESTROY
    // ================================================================

    public destroy(): void {
        if (this.priceUpdateHandler) {
            document.removeEventListener('price-update', this.priceUpdateHandler);
            this.priceUpdateHandler = null;
        }

        if (this.mockTickInterval) {
            clearInterval(this.mockTickInterval);
            this.mockTickInterval = null;
        }

        console.log('🗑️ Watchlist Module destroyed');
    }

    // ================================================================
    // RENDER
    // ================================================================

    private renderDefaultSymbols(): void {
        if (!this.itemsEl) return;
        this.itemsEl.innerHTML = '';

        const defaults = this.SYMBOLS.filter(s => this.added.has(s.id));
        defaults.forEach((sym, idx) => {
            const item = this.buildWatchItem(sym);
            if (idx === 0) item.classList.add('active');
            this.itemsEl!.appendChild(item);
        });
    }

    private buildWatchItem(sym: WatchlistSymbol): HTMLElement {
        const chgNum   = parseFloat(sym.chg);
        const chgClass = chgNum >= 0 ? 'up' : 'down';
        const chgText  = (chgNum >= 0 ? '+' : '') + sym.chg + '%';

        const item = document.createElement('div');
        item.className = 'watch-item';
        item.setAttribute('data-symbol', sym.id);
        item.innerHTML = `
            ${this.buildIconHTML(sym)}
            <div class="watch-symbol-wrap">
                <div class="watch-symbol">${sym.name}</div>
                <div class="watch-category">${sym.cat}</div>
            </div>
            <div class="watch-price" data-price-id="${sym.id}">${sym.price}</div>
            <div class="watch-change ${chgClass}" data-chg-id="${sym.id}">${chgText}</div>
            <button class="watch-delete"><i class="fas fa-times"></i></button>
        `;

        // Click → switch chart symbol
        item.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('.watch-delete')) return;
            this.setActive(sym.id);
            this.switchChartSymbol(sym.name);
        });

        // Delete
        item.querySelector('.watch-delete')!.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeSymbol(sym.id, item);
        });

        return item;
    }

    private buildIconHTML(sym: WatchlistSymbol): string {
        if (sym.type === 'forex') {
            return `
                <div class="wl-flag-container">
                    <div class="wl-flag-circle wl-flag-base"
                         style="background-image:url('https://flagcdn.com/w320/${sym.base}.png');"></div>
                    <div class="wl-flag-circle wl-flag-quote"
                         style="background-image:url('https://flagcdn.com/w320/${sym.quote}.png');"></div>
                </div>`;
        }

        const iconClass = sym.type === 'metal'
            ? (sym.id.includes('XAU') ? 'gold' : 'silver')
            : sym.type;

        return `
            <div class="wl-symbol-icon-wrap">
                <div class="wl-symbol-icon ${iconClass}">
                    <img src="${sym.img}"
                         onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
                         alt="${sym.name}">
                    <i class="fas fa-circle-dot" style="display:none;"></i>
                </div>
            </div>`;
    }

    // ================================================================
    // EVENTS
    // ================================================================

    private bindEvents(): void {
        // Add button
        document.getElementById('watchlistAddBtn')
            ?.addEventListener('click', () => this.toggleSearch());

        // Search input
        this.searchInput?.addEventListener('input', () => this.handleSearch());

        // Sort buttons
        document.querySelectorAll('.wl-sort-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const sort = btn.getAttribute('data-sort') as 'az' | 'chg';
                this.setSort(sort);
                document.querySelectorAll('.wl-sort-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Close search on outside click
        document.addEventListener('click', (e) => {
            if (!this.searchEl?.contains(e.target as Node) &&
                !(e.target as HTMLElement).closest('#watchlistAddBtn')) {
                this.closeSearch();
            }
        });

        // Price update from WebSocket (real)
        this.priceUpdateHandler = (e: Event) => {
            const { symbol, bid, chg } = (e as CustomEvent).detail;
            this.updatePrice(symbol, bid, chg);
        };
        document.addEventListener('price-update', this.priceUpdateHandler);
    }

    // ================================================================
    // SEARCH
    // ================================================================

    private toggleSearch(): void {
        const isOpen = this.searchEl?.classList.contains('show');
        if (isOpen) {
            this.closeSearch();
        } else {
            this.searchEl?.classList.add('show');
            this.searchInput?.focus();
        }
    }

    private closeSearch(): void {
        this.searchEl?.classList.remove('show');
        if (this.searchInput)   this.searchInput.value = '';
        if (this.searchResults) this.searchResults.innerHTML = '';
    }

    private handleSearch(): void {
        const q = this.searchInput?.value.trim().toLowerCase() || '';
        if (!this.searchResults) return;
        this.searchResults.innerHTML = '';

        if (!q) return;

        const matches = this.SYMBOLS.filter(s =>
            !this.added.has(s.id) &&
            (s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q))
        ).slice(0, 5);

        if (!matches.length) {
            this.searchResults.innerHTML = `
                <div style="font-size:0.65rem; color:var(--text-muted); padding:4px 8px;">
                    No results found
                </div>`;
            return;
        }

        matches.forEach(sym => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `
                ${this.buildIconHTML(sym)}
                <span class="search-result-name">${sym.name}</span>
                <span class="search-result-cat">${sym.cat}</span>
            `;
            item.addEventListener('click', () => this.addSymbol(sym));
            this.searchResults!.appendChild(item);
        });
    }

    // ================================================================
    // ADD / REMOVE
    // ================================================================

    private addSymbol(sym: WatchlistSymbol): void {
        this.added.add(sym.id);
        const item = this.buildWatchItem(sym);
        this.itemsEl?.appendChild(item);
        this.closeSearch();
    }

    private removeSymbol(id: string, el: HTMLElement): void {
        this.added.delete(id);
        el.remove();

        // If removed item was active — set first item as active
        const first = this.itemsEl?.querySelector('.watch-item');
        if (first && !this.itemsEl?.querySelector('.watch-item.active')) {
            first.classList.add('active');
        }
    }

    // ================================================================
    // ACTIVE STATE
    // ================================================================

    private setActive(id: string): void {
        this.itemsEl?.querySelectorAll('.watch-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-symbol') === id);
        });
    }

    // ================================================================
    // CHART SWITCH
    // ================================================================

    private switchChartSymbol(symbolName: string): void {
        // Normalize: EUR/USD → EURUSD for chart
        const symbol = symbolName.replace('/', '');
        document.dispatchEvent(new CustomEvent('symbol-changed', {
            detail: { symbol }
        }));
        console.log(`📊 Watchlist → switch chart to ${symbol}`);
    }

    // ================================================================
    // PRICE UPDATE (real WebSocket)
    // ================================================================

    public updatePrice(symbolId: string, price: number, chg?: number): void {
        const priceEl = this.itemsEl?.querySelector(`[data-price-id="${symbolId}"]`);
        const chgEl   = this.itemsEl?.querySelector(`[data-chg-id="${symbolId}"]`);

        if (!priceEl) return;

        const currentPrice = parseFloat(priceEl.textContent || '0');
        const goUp = price >= currentPrice;

        priceEl.textContent = price.toString();
        priceEl.classList.remove('flash-up', 'flash-down');
        priceEl.classList.add(goUp ? 'flash-up' : 'flash-down');
        setTimeout(() => priceEl.classList.remove('flash-up', 'flash-down'), 400);

        if (chgEl && chg !== undefined) {
            const chgClass = chg >= 0 ? 'up' : 'down';
            const chgText  = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
            chgEl.textContent = chgText;
            chgEl.className = `watch-change ${chgClass}`;
        }
    }

    // ================================================================
    // SORT
    // ================================================================

    private setSort(sort: 'az' | 'chg'): void {
        this.currentSort = sort;
        if (!this.itemsEl) return;

        const items = Array.from(this.itemsEl.querySelectorAll('.watch-item'));

        items.sort((a, b) => {
            if (sort === 'az') {
                const nameA = a.querySelector('.watch-symbol')?.textContent || '';
                const nameB = b.querySelector('.watch-symbol')?.textContent || '';
                return nameA.localeCompare(nameB);
            } else {
                const chgA = parseFloat(a.querySelector('.watch-change')?.textContent || '0');
                const chgB = parseFloat(b.querySelector('.watch-change')?.textContent || '0');
                return chgB - chgA;
            }
        });

        items.forEach(item => this.itemsEl!.appendChild(item));
    }

    // ================================================================
    // MOCK TICKS — remove when real WebSocket is wired
    // ================================================================

    private startMockTicks(): void {
        this.mockTickInterval = setInterval(() => {
            this.itemsEl?.querySelectorAll('.watch-item').forEach(item => {
                const id      = item.getAttribute('data-symbol') || '';
                const priceEl = item.querySelector('.watch-price');
                if (!priceEl) return;

                const current = parseFloat(priceEl.textContent || '0');
                const delta   = (Math.random() - 0.5) * 0.001 * current;
                const newPrice = (current + delta);

                this.updatePrice(id, parseFloat(newPrice.toFixed(5)));
            });
        }, 1500);
    }
}