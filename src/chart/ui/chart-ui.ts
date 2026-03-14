// ================================================================
// ⚡ CHART UI - Professional controls (symbol, timeframe, chart type, indicators)
// ================================================================

const FAVORITES_KEY = 'mega_flowz_indicator_favorites';

export interface ChartUICallbacks {
  onSymbolChange: (symbol: string) => void;
  onTimeframeChange: (timeframe: string) => void;
  onChartTypeChange: (chartType: string) => void;
}

export class ChartUI {
  private callbacks: ChartUICallbacks;
  private isInitialized: boolean = false;
  private currentSymbol: string;
  private currentTimeframe: string;
  private currentChartType: string;

  // ✅ Store bound listeners for cleanup
  private boundClickOutside: (e: Event) => void;
  private boundIndicatorClose: (e: Event) => void;
  private boundSymbolModalClose: (e: Event) => void;

  // ✅ Strategy type mapping — modal value → backend name
  private readonly strategyMap: Record<string, string> = {
    'MA_CROSS':   'ma_crossover',
    'EMA_CROSS':  '',
    'MACD_CROSS': '',
    'RSI_OB_OS':  '',
  };

  // ✅ Symbol flag/icon map
  private readonly symbolIconMap: Record<string, {
    base: string;
    quote: string;
    baseType: 'flag' | 'icon';
    quoteType: 'flag' | 'icon';
  }> = {
    'EURUSD': { base: 'https://flagcdn.com/w320/eu.png', quote: 'https://flagcdn.com/w320/us.png', baseType: 'flag', quoteType: 'flag' },
    'GBPUSD': { base: 'https://flagcdn.com/w320/gb.png', quote: 'https://flagcdn.com/w320/us.png', baseType: 'flag', quoteType: 'flag' },
    'USDJPY': { base: 'https://flagcdn.com/w320/us.png', quote: 'https://flagcdn.com/w320/jp.png', baseType: 'flag', quoteType: 'flag' },
    'AUDUSD': { base: 'https://flagcdn.com/w320/au.png', quote: 'https://flagcdn.com/w320/us.png', baseType: 'flag', quoteType: 'flag' },
    'USDCAD': { base: 'https://flagcdn.com/w320/us.png', quote: 'https://flagcdn.com/w320/ca.png', baseType: 'flag', quoteType: 'flag' },
    'USDCHF': { base: 'https://flagcdn.com/w320/us.png', quote: 'https://flagcdn.com/w320/ch.png', baseType: 'flag', quoteType: 'flag' },
    'NZDUSD': { base: 'https://flagcdn.com/w320/nz.png', quote: 'https://flagcdn.com/w320/us.png', baseType: 'flag', quoteType: 'flag' },
    'XAUUSD': { base: 'xau', quote: 'https://flagcdn.com/w320/us.png', baseType: 'icon', quoteType: 'flag' },
    'BTCUSD': { base: 'btc', quote: 'https://flagcdn.com/w320/us.png', baseType: 'icon', quoteType: 'flag' },
    'ETHUSD': { base: 'eth', quote: 'https://flagcdn.com/w320/us.png', baseType: 'icon', quoteType: 'flag' },
    'LTCUSD': { base: 'ltc', quote: 'https://flagcdn.com/w320/us.png', baseType: 'icon', quoteType: 'flag' },
    'XRPUSD': { base: 'xrp', quote: 'https://flagcdn.com/w320/us.png', baseType: 'icon', quoteType: 'flag' },
  };

  private readonly iconCircleMap: Record<string, string> = {
    'btc': '<i class="fab fa-bitcoin"></i>',
    'eth': '<i class="fab fa-ethereum"></i>',
    'ltc': '<span>Ł</span>',
    'xrp': '<span>X</span>',
    'xau': '<i class="fas fa-coins"></i>',
  };

  constructor(
    callbacks: ChartUICallbacks,
    initialSymbol: string,
    initialTimeframe: string,
    initialChartType: string
  ) {
    console.log('🎮 Chart UI Initialized');
    this.callbacks = callbacks;
    this.currentSymbol = initialSymbol;
    this.currentTimeframe = initialTimeframe;
    this.currentChartType = initialChartType;

    this.boundClickOutside = () => this.closeAllDropdowns();
    this.boundIndicatorClose = (e: Event) => this.handleIndicatorClickOutside(e);
    this.boundSymbolModalClose = (e: Event) => this.handleSymbolModalClickOutside(e);
  }

  public initialize(): void {
    if (this.isInitialized) return;

    console.log('🖱️ Setting up chart UI controls...');

    this.setupSymbolControls();
    this.setupTimeframeControls();
    this.setupChartTypeControls();
    this.setupIndicatorsModal();
    this.setupActionButtons();
    this.setupClickOutside();

    this.isInitialized = true;
    console.log('✅ Chart UI ready');
  }

  // ==================== SYMBOL CONTROLS ====================

  private setupSymbolControls(): void {
    const symbolPill = document.getElementById('symbolPill');
    const hiddenSelect = document.getElementById('chartPairsSelect') as HTMLSelectElement;

    if (!symbolPill || !hiddenSelect) {
      console.warn('⚠️ Symbol pill or select not found');
      return;
    }

    this.updateSymbolPill(this.currentSymbol);
    hiddenSelect.value = this.currentSymbol;

    symbolPill.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      this.openSymbolModal();
    });

    hiddenSelect.addEventListener('change', (e: Event) => {
      const newSymbol = (e.target as HTMLSelectElement).value;
      if (newSymbol !== this.currentSymbol) {
        this.currentSymbol = newSymbol;
        this.updateSymbolPill(newSymbol);
        this.callbacks.onSymbolChange(newSymbol);
      }
    });

    this.setupSymbolModal();
  }

  // ==================== SYMBOL SEARCH MODAL ====================

  private setupSymbolModal(): void {
    const overlay = document.getElementById('symbolModalOverlay');
    const closeBtn = document.getElementById('symbolModalClose');
    const searchInput = document.getElementById('symbolSearchInput') as HTMLInputElement;
    const hiddenSelect = document.getElementById('chartPairsSelect') as HTMLSelectElement;

    if (!overlay) {
      console.warn('⚠️ Symbol modal not found');
      return;
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        this.closeSymbolModal();
      });
    }

    document.addEventListener('click', this.boundSymbolModalClose);

    if (searchInput) {
      searchInput.addEventListener('input', (e: Event) => {
        const query = (e.target as HTMLInputElement).value.toLowerCase();
        this.filterSymbolModal(query);
      });
      searchInput.addEventListener('click', (e: Event) => e.stopPropagation());
    }

    const modalBody = document.getElementById('symbolModalBody');
    if (modalBody) {
      modalBody.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        const item = target.closest('.symbol-modal-item') as HTMLElement;
        if (!item) return;

        const value = item.dataset.value;
        if (!value) return;

        modalBody.querySelectorAll('.symbol-modal-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');

        this.updateSymbolPill(value);
        if (hiddenSelect) hiddenSelect.value = value;
        this.closeSymbolModal();

        this.currentSymbol = value;
        this.callbacks.onSymbolChange(value);

        console.log('🔄 Symbol changed via modal:', value);
      });
    }
  }

  private openSymbolModal(): void {
    const overlay = document.getElementById('symbolModalOverlay');
    const searchInput = document.getElementById('symbolSearchInput') as HTMLInputElement;
    if (!overlay) return;

    overlay.classList.add('open');
    this.filterSymbolModal('');

    if (searchInput) {
      searchInput.value = '';
      setTimeout(() => searchInput.focus(), 50);
    }

    const modalBody = document.getElementById('symbolModalBody');
    if (modalBody) {
      modalBody.querySelectorAll('.symbol-modal-item').forEach(el => {
        el.classList.toggle('active', (el as HTMLElement).dataset.value === this.currentSymbol);
      });
    }
  }

  private closeSymbolModal(): void {
    const overlay = document.getElementById('symbolModalOverlay');
    if (overlay) overlay.classList.remove('open');
  }

  private handleSymbolModalClickOutside(e: Event): void {
    const overlay = document.getElementById('symbolModalOverlay');
    if (!overlay || !overlay.classList.contains('open')) return;
    const modal = document.getElementById('symbolModal');
    const symbolPill = document.getElementById('symbolPill');
    if (modal && !modal.contains(e.target as Node) && e.target !== symbolPill) {
      this.closeSymbolModal();
    }
  }

  private filterSymbolModal(query: string): void {
    const modalBody = document.getElementById('symbolModalBody');
    const emptyState = document.getElementById('symbolModalEmpty');
    if (!modalBody) return;

    const items = modalBody.querySelectorAll('.symbol-modal-item');
    const groups = modalBody.querySelectorAll('.symbol-modal-group');
    let totalVisible = 0;

    items.forEach(item => {
      const name = (item as HTMLElement).dataset.value?.toLowerCase() || '';
      const desc = item.querySelector('.symbol-modal-desc')?.textContent?.toLowerCase() || '';
      const match = query === '' || name.includes(query) || desc.includes(query);
      (item as HTMLElement).style.display = match ? '' : 'none';
      if (match) totalVisible++;
    });

    groups.forEach(group => {
      const visibleItems = Array.from(group.querySelectorAll('.symbol-modal-item'))
        .some(item => (item as HTMLElement).style.display !== 'none');
      (group as HTMLElement).style.display = visibleItems ? '' : 'none';
    });

    if (emptyState) {
      emptyState.style.display = totalVisible === 0 && query !== '' ? 'block' : 'none';
    }
  }

  // ==================== SYMBOL PILL UPDATE ====================

  private updateSymbolPill(symbol: string): void {
    const symbolText = document.getElementById('symbolText');
    if (symbolText) symbolText.textContent = symbol;
    this.updateSymbolFlags(symbol);
  }

  private updateSymbolFlags(symbol: string): void {
    const baseEl = document.getElementById('symbolFlagBase');
    const quoteEl = document.getElementById('symbolFlagQuote');
    if (!baseEl || !quoteEl) return;

    const config = this.symbolIconMap[symbol];
    if (!config) return;

    if (config.baseType === 'flag') {
      baseEl.className = 'flag-circle flag-base';
      baseEl.style.backgroundImage = `url('${config.base}')`;
      baseEl.innerHTML = '';
    } else {
      baseEl.className = `flag-circle flag-base icon-circle ${config.base}`;
      baseEl.style.backgroundImage = '';
      baseEl.innerHTML = this.iconCircleMap[config.base] || '';
    }

    if (config.quoteType === 'flag') {
      quoteEl.className = 'flag-circle flag-quote';
      quoteEl.style.backgroundImage = `url('${config.quote}')`;
      quoteEl.innerHTML = '';
    } else {
      quoteEl.className = `flag-circle flag-quote icon-circle ${config.quote}`;
      quoteEl.style.backgroundImage = '';
      quoteEl.innerHTML = this.iconCircleMap[config.quote] || '';
    }
  }

  // ==================== TIMEFRAME CONTROLS ====================

  private setupTimeframeControls(): void {
    const tfGroup = document.getElementById('tfGroup');
    const tfMoreBtn = document.getElementById('tfMoreBtn');
    const tfMore = document.getElementById('tfMore');
    const tfMoreDropdown = document.getElementById('tfMoreDropdown');
    const hiddenSelect = document.getElementById('timeframeSelect') as HTMLSelectElement;

    if (!tfGroup || !hiddenSelect) {
      console.warn('⚠️ Timeframe group or select not found');
      return;
    }

    hiddenSelect.value = this.currentTimeframe;
    this.updateTimeframeButtons(this.currentTimeframe);

    tfGroup.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('.tf-btn:not(.tf-more-btn)') as HTMLElement;
      if (!btn) return;

      const tf = btn.dataset.tf;
      if (!tf) return;

      this.closeAllDropdowns();
      this.updateTimeframeButtons(tf);
      hiddenSelect.value = tf;
      this.currentTimeframe = tf;
      this.callbacks.onTimeframeChange(tf);

      console.log('🔄 Timeframe changed via buttons:', tf);
    });

    if (tfMoreBtn && tfMore) {
      tfMoreBtn.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        const isOpen = tfMore.classList.contains('open');
        this.closeAllDropdowns();
        if (!isOpen) tfMore.classList.add('open');
      });
    }

    if (tfMoreDropdown) {
      tfMoreDropdown.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        const item = target.closest('.tf-more-item') as HTMLElement;
        if (!item) return;

        const tf = item.dataset.tf;
        if (!tf) return;

        this.closeAllDropdowns();
        this.updateTimeframeButtons(tf);
        hiddenSelect.value = tf;
        this.currentTimeframe = tf;
        this.callbacks.onTimeframeChange(tf);

        console.log('🔄 Timeframe changed via more dropdown:', tf);
      });
    }

    hiddenSelect.addEventListener('change', (e: Event) => {
      const newTf = (e.target as HTMLSelectElement).value;
      if (newTf !== this.currentTimeframe) {
        this.currentTimeframe = newTf;
        this.updateTimeframeButtons(newTf);
        this.callbacks.onTimeframeChange(newTf);
      }
    });
  }

  private updateTimeframeButtons(timeframe: string): void {
    document.querySelectorAll('.tf-btn:not(.tf-more-btn)').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tf-more-item').forEach(item => item.classList.remove('active'));

    const matchingBtn = document.querySelector(`.tf-btn[data-tf="${timeframe}"]`) as HTMLElement;
    if (matchingBtn) {
      matchingBtn.classList.add('active');
      return;
    }

    const matchingMoreItem = document.querySelector(`.tf-more-item[data-tf="${timeframe}"]`) as HTMLElement;
    if (matchingMoreItem) {
      matchingMoreItem.classList.add('active');
      const tfMoreBtn = document.getElementById('tfMoreBtn');
      if (tfMoreBtn) tfMoreBtn.classList.add('active');
    }
  }

  // ==================== CHART TYPE CONTROLS ====================

  private setupChartTypeControls(): void {
    const chartTypePill = document.getElementById('chartTypePill');
    const chartTypeDropdown = document.getElementById('chartTypeDropdown');
    const hiddenSelect = document.getElementById('chartTypeSelect') as HTMLSelectElement;

    if (!chartTypePill || !hiddenSelect) {
      console.warn('⚠️ Chart type pill or select not found');
      return;
    }

    hiddenSelect.value = this.currentChartType;
    this.updateChartTypePill(this.currentChartType);

    chartTypePill.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      const isOpen = chartTypePill.classList.contains('open');
      this.closeAllDropdowns();
      if (!isOpen) chartTypePill.classList.add('open');
    });

    if (chartTypeDropdown) {
      chartTypeDropdown.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        const item = target.closest('.chart-type-item') as HTMLElement;
        if (!item) return;

        const type = item.dataset.type;
        const icon = item.dataset.icon;
        const label = item.dataset.label;
        if (!type) return;

        chartTypeDropdown.querySelectorAll('.chart-type-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');

        this.updateChartTypePill(type, icon, label);
        hiddenSelect.value = type;
        chartTypePill.classList.remove('open');

        this.currentChartType = type;
        this.callbacks.onChartTypeChange(type);

        console.log('🔄 Chart type changed via pill:', type);
      });
    }

    hiddenSelect.addEventListener('change', (e: Event) => {
      const newType = (e.target as HTMLSelectElement).value;
      if (newType !== this.currentChartType) {
        this.currentChartType = newType;
        this.updateChartTypePill(newType);
        this.callbacks.onChartTypeChange(newType);
      }
    });
  }

  private updateChartTypePill(type: string, icon?: string, label?: string): void {
    const chartTypeIcon = document.getElementById('chartTypeIcon');
    const chartTypeText = document.getElementById('chartTypeText');

    const typeMap: Record<string, { icon: string; label: string }> = {
      'candlestick': { icon: 'fa-chart-candlestick', label: 'Candles'  },
      'bar':         { icon: 'fa-chart-bar',         label: 'Bars'     },
      'line':        { icon: 'fa-chart-line',         label: 'Line'     },
      'area':        { icon: 'fa-chart-area',         label: 'Area'     },
      'baseline':    { icon: 'fa-minus',              label: 'Baseline' }
    };

    const mapped = typeMap[type] || typeMap['candlestick'];
    const finalIcon = icon || mapped.icon;
    const finalLabel = label || mapped.label;

    if (chartTypeIcon) chartTypeIcon.className = `fas ${finalIcon} chart-type-icon`;
    if (chartTypeText) chartTypeText.textContent = finalLabel;

    document.querySelectorAll('.chart-type-item').forEach(item => {
      item.classList.toggle('active', (item as HTMLElement).dataset.type === type);
    });
  }

  // ==================== INDICATORS MODAL ====================

  private setupIndicatorsModal(): void {
    const indicatorsBtn = document.getElementById('indicatorsBtn');
    const overlay = document.getElementById('indicatorsModalOverlay');
    const closeBtn = document.getElementById('indicatorsModalClose');
    const searchInput = document.getElementById('indicatorSearchInput') as HTMLInputElement;

    if (!indicatorsBtn || !overlay) {
      console.warn('⚠️ Indicators button or modal not found');
      return;
    }

    indicatorsBtn.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      overlay.classList.add('open');
      this.renderFavorites();
      this.syncFavoriteStars();
      if (searchInput) {
        searchInput.value = '';
        this.filterIndicators('');
        setTimeout(() => searchInput.focus(), 50);
      }
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        overlay.classList.remove('open');
      });
    }

    document.addEventListener('click', this.boundIndicatorClose);

    if (searchInput) {
      searchInput.addEventListener('input', (e: Event) => {
        const query = (e.target as HTMLInputElement).value.toLowerCase();
        this.filterIndicators(query);
      });
    }

    const modalBody = document.getElementById('indicatorsModalBody');
    if (modalBody) {
      modalBody.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;

        // ✅ Category header toggle
        const categoryHeader = target.closest('.indicators-category-header') as HTMLElement;
        if (categoryHeader) {
          const category = categoryHeader.closest('.indicators-category') as HTMLElement;
          if (category) category.classList.toggle('open');
          return;
        }

        // ✅ Star toggle — stop here, don't proceed to item click
        if (target.classList.contains('indicator-fav-star')) {
          e.stopPropagation();
          const item = target.closest('.indicator-item') as HTMLElement;
          if (!item) return;
          const value = item.dataset.value;
          const name = item.dataset.name;
          if (!value || !name) return;
          this.toggleFavorite(value, name, target);
          return;
        }

        // ✅ Indicator / Strategy item click
        const item = target.closest('.indicator-item') as HTMLElement;
        if (!item) return;
        if (target.classList.contains('indicator-fav-star')) return;

        const value = item.dataset.value;
        const type  = item.dataset.type;
        if (!value) return;

        if (type === 'strategy') {
          this.deployStrategyFromModal(value);
        } else {
          document.dispatchEvent(new CustomEvent('add-indicator', {
            detail: { type: value }
          }));
        }

        overlay.classList.remove('open');
        console.log(`📊 ${type === 'strategy' ? 'Strategy' : 'Indicator'} selected:`, value);
      });
    }

    // ✅ Apply button — just closes modal
    const applyBtn = document.getElementById('indicatorsApplyBtn');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        overlay.classList.remove('open');
      });
    }

    // ✅ ONLY CHANGE — Custom Strategy button opens Strategy tab
    const customStrategyBtn = document.getElementById('indicatorsCreateBtn');
    if (customStrategyBtn) {
      customStrategyBtn.addEventListener('click', () => {
        overlay.classList.remove('open');
        document.dispatchEvent(new CustomEvent('open-strategy-tab'));
      });
    }

    this.renderFavorites();
    this.syncFavoriteStars();
  }

  // ==================== FAVORITES ====================

  private loadFavorites(): string[] {
    try {
      return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    } catch {
      return [];
    }
  }

  private saveFavorites(favorites: string[]): void {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }

  private toggleFavorite(value: string, name: string, starEl: HTMLElement): void {
    const favorites = this.loadFavorites();
    const index = favorites.indexOf(value);

    if (index === -1) {
      favorites.push(value);
      starEl.classList.add('active');
    } else {
      favorites.splice(index, 1);
      starEl.classList.remove('active');
    }

    this.saveFavorites(favorites);
    this.renderFavorites();

    console.log(`⭐ Favorite ${index === -1 ? 'added' : 'removed'}:`, value);
  }

  private renderFavorites(): void {
    const favList = document.getElementById('indicatorsFavoritesList');
    if (!favList) return;

    const favorites = this.loadFavorites();

    if (favorites.length === 0) {
      favList.innerHTML = `
        <div class="indicators-fav-empty">
          <i class="fas fa-star"></i>
          <span>Star an indicator to add it here</span>
        </div>
      `;
      return;
    }

    const nameMap: Record<string, { name: string; type: string }> = {};
    document.querySelectorAll('.indicator-item').forEach(item => {
      const el = item as HTMLElement;
      const v = el.dataset.value;
      const n = el.dataset.name;
      const t = el.dataset.type;
      if (v && n && t) nameMap[v] = { name: n, type: t };
    });

    favList.innerHTML = '';
    favorites.forEach(value => {
      const info = nameMap[value];
      if (!info) return;

      const favItem = document.createElement('div');
      favItem.className = 'indicator-item favorite-item';
      favItem.dataset.value = value;
      favItem.dataset.type  = info.type;
      favItem.dataset.name  = info.name;
      favItem.innerHTML = `
        <i class="fas fa-star" style="color: #FFD700;"></i>
        <span class="indicator-name">${info.name}</span>
        ${info.type === 'strategy' ? '<span class="indicator-badge strategy">strategy</span>' : ''}
      `;

      favList.appendChild(favItem);
    });
  }

  private syncFavoriteStars(): void {
    const favorites = this.loadFavorites();
    document.querySelectorAll('.indicator-fav-star').forEach(star => {
      const item = star.closest('.indicator-item') as HTMLElement;
      if (!item) return;
      const value = item.dataset.value;
      star.classList.toggle('active', !!value && favorites.includes(value));
    });
  }

  // ==================== CLICK OUTSIDE ====================

  private handleIndicatorClickOutside(e: Event): void {
    const overlay = document.getElementById('indicatorsModalOverlay');
    const indicatorsBtn = document.getElementById('indicatorsBtn');
    if (!overlay || !overlay.classList.contains('open')) return;
    const modal = overlay.querySelector('.indicators-modal') as HTMLElement;
    if (modal && !modal.contains(e.target as Node) && e.target !== indicatorsBtn) {
      overlay.classList.remove('open');
    }
  }

  private setupClickOutside(): void {
    document.addEventListener('click', this.boundClickOutside);
  }

  private closeAllDropdowns(): void {
    document.getElementById('symbolPill')?.classList.remove('open');
    document.getElementById('chartTypePill')?.classList.remove('open');
    document.getElementById('tfMore')?.classList.remove('open');
  }

  // ==================== STRATEGY DEPLOY ====================

  // ✅ Unchanged — deploys directly on chart as before
  private deployStrategyFromModal(modalValue: string): void {
    const backendName = this.strategyMap[modalValue];

    if (backendName === undefined) {
      console.warn(`⚠️ No backend mapping for strategy: ${modalValue}`);
      document.dispatchEvent(new CustomEvent('show-notification', {
        detail: { type: 'error', title: 'Strategy Error', message: `Unknown strategy: ${modalValue}` }
      }));
      return;
    }

    if (backendName === '') {
      document.dispatchEvent(new CustomEvent('show-notification', {
        detail: { type: 'info', title: 'Coming Soon', message: 'This strategy will be available soon' }
      }));
      return;
    }

    document.dispatchEvent(new CustomEvent('deploy-strategy', {
      detail: {
        strategyType: backendName,
        symbol:       this.currentSymbol,
        timeframe:    this.currentTimeframe,
        params:       {}
      }
    }));

    console.log(`🚀 Deploying strategy: ${backendName} on ${this.currentSymbol} ${this.currentTimeframe}`);
  }

  // ==================== FILTER ====================

  private filterIndicators(query: string): void {
    const categories = document.querySelectorAll('.indicators-category');
    const emptySearch = document.getElementById('indicatorsEmptySearch');
    let totalVisible = 0;

    categories.forEach(category => {
      const items = category.querySelectorAll('.indicator-item');
      let hasVisible = false;

      items.forEach(item => {
        const text = item.textContent?.toLowerCase() || '';
        const match = query === '' || text.includes(query);
        (item as HTMLElement).style.display = match ? '' : 'none';
        if (match) { hasVisible = true; totalVisible++; }
      });

      (category as HTMLElement).style.display = hasVisible ? '' : 'none';
    });

    if (emptySearch) {
      emptySearch.style.display = totalVisible === 0 && query !== '' ? 'block' : 'none';
    }
  }

  // ==================== ACTION BUTTONS ====================

  private setupActionButtons(): void {
    const resetBtn = document.getElementById('resetChartBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('chart-reset-request'));
      });
    }

    const downloadBtn = document.getElementById('downloadChartBtn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('chart-download-request'));
      });
    }
  }

  // ==================== PUBLIC UPDATE METHODS ====================

  public updateSymbol(symbol: string): void {
    this.currentSymbol = symbol;
    const select = document.getElementById('chartPairsSelect') as HTMLSelectElement;
    if (select && select.value !== symbol) select.value = symbol;
    this.updateSymbolPill(symbol);
  }

  public updateTimeframe(timeframe: string): void {
    this.currentTimeframe = timeframe;
    const select = document.getElementById('timeframeSelect') as HTMLSelectElement;
    if (select && select.value !== timeframe) select.value = timeframe;
    this.updateTimeframeButtons(timeframe);
  }

  public updateChartType(chartType: string): void {
    this.currentChartType = chartType;
    const select = document.getElementById('chartTypeSelect') as HTMLSelectElement;
    if (select && select.value !== chartType) select.value = chartType;
    this.updateChartTypePill(chartType);
  }

  // ==================== DESTROY ====================

  public destroy(): void {
    document.removeEventListener('click', this.boundClickOutside);
    document.removeEventListener('click', this.boundIndicatorClose);
    document.removeEventListener('click', this.boundSymbolModalClose);
    this.isInitialized = false;
    console.log('🎮 Chart UI destroyed');
  }
}