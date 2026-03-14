// ================================================================
// 🔔 ALERTS MODULE - Mock
// ================================================================

type AlertCondition = 'above' | 'below' | 'crosses';
type AlertAction    = 'notify' | 'buy' | 'sell';

interface PriceAlert {
    id:        string;
    symbol:    string;
    condition: AlertCondition;
    price:     number;
    action:    AlertAction;
    tag:       string;
    lot?:      number;
    tp?:       number;
    sl?:       number;
    triggered: boolean;
    chartVisible: boolean;
}

export class AlertsModule {

    private container:    HTMLElement | null = null;
    private listEl:       HTMLElement | null = null;
    private formEl:       HTMLElement | null = null;
    private activeCountEl:HTMLElement | null = null;
    private footerCountEl:HTMLElement | null = null;
    private confirmBtn:   HTMLButtonElement | null = null;

    private alerts: PriceAlert[] = [];
    private idCounter = 1;

    // ── Mock defaults ──
    private readonly MOCK_ALERTS: PriceAlert[] = [
        { id: 'a1', symbol: 'EUR/USD', condition: 'above',   price: 1.09500, action: 'notify', tag: 'sr',        triggered: false, chartVisible: true  },
        { id: 'a2', symbol: 'EUR/USD', condition: 'below',   price: 1.08000, action: 'buy',    tag: 'auto-buy',  triggered: false, chartVisible: false },
        { id: 'a3', symbol: 'XAU/USD', condition: 'crosses', price: 2000.00, action: 'sell',   tag: 'auto-sell', triggered: false, chartVisible: true  },
        { id: 'a4', symbol: 'GBP/USD', condition: 'above',   price: 1.27000, action: 'notify', tag: '',          triggered: true,  chartVisible: false },
    ];

    // ================================================================
    // INITIALIZE
    // ================================================================

    public initialize(): void {
        this.container     = document.querySelector('.alerts-panel');
        this.listEl        = document.getElementById('alertList');
        this.formEl        = document.getElementById('alertAddForm');
        this.activeCountEl = document.getElementById('alertActiveCount');
        this.footerCountEl = document.getElementById('alertFooterCount');
        this.confirmBtn    = document.getElementById('alertConfirmBtn') as HTMLButtonElement;

        if (!this.container || !this.listEl) {
            console.warn('⚠️ Alerts: container not found');
            return;
        }

        this.alerts = [...this.MOCK_ALERTS];
        this.bindEvents();
        this.renderAll();

        console.log('✅ Alerts Module initialized (mock)');
    }

    // ================================================================
    // DESTROY
    // ================================================================

    public destroy(): void {
        console.log('🗑️ Alerts Module destroyed');
    }

    // ================================================================
    // BIND EVENTS
    // ================================================================

    private bindEvents(): void {
        // Toggle form
        document.getElementById('alertAddBtn')
            ?.addEventListener('click', () => this.toggleForm());

        document.getElementById('alertCancelBtn')
            ?.addEventListener('click', () => this.closeForm());

        // Confirm
        this.confirmBtn?.addEventListener('click', () => this.handleConfirm());

        // Source tabs
        document.querySelectorAll('.alert-source-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.alert-source-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const source = tab.getAttribute('data-source');
                const manualWrap = document.getElementById('alertManualWrap');
                const levelWrap  = document.getElementById('alertLevelWrap');
                if (source === 'level') {
                    manualWrap?.classList.add('hidden');
                    levelWrap?.classList.remove('hidden');
                } else {
                    manualWrap?.classList.remove('hidden');
                    levelWrap?.classList.add('hidden');
                }
            });
        });

        // Action select
        document.getElementById('alertAction')
            ?.addEventListener('change', (e) => {
                const val = (e.target as HTMLSelectElement).value as AlertAction;
                this.handleActionChange(val);
            });

        // Clear all
        document.getElementById('alertClearAll')
            ?.addEventListener('click', () => this.clearAll());
    }

    // ================================================================
    // FORM
    // ================================================================

    private toggleForm(): void {
        const isHidden = this.formEl?.classList.contains('hidden');
        if (isHidden) {
            this.formEl?.classList.remove('hidden');
        } else {
            this.closeForm();
        }
    }

    private closeForm(): void {
        this.formEl?.classList.add('hidden');
        this.resetForm();
    }

    private resetForm(): void {
        (document.getElementById('alertPrice') as HTMLInputElement).value = '';
        (document.getElementById('alertAction') as HTMLSelectElement).value = 'notify';
        const autoFields = document.getElementById('alertAutoFields');
        autoFields?.classList.add('hidden');
        if (this.confirmBtn) {
            this.confirmBtn.classList.remove('sell');
            this.confirmBtn.innerHTML = '<i class="fas fa-check"></i> Set Alert';
        }
        // Reset source tabs
        document.querySelectorAll('.alert-source-tab').forEach((t, i) => {
            t.classList.toggle('active', i === 0);
        });
        document.getElementById('alertManualWrap')?.classList.remove('hidden');
        document.getElementById('alertLevelWrap')?.classList.add('hidden');
    }

    private handleActionChange(val: AlertAction): void {
        const autoFields  = document.getElementById('alertAutoFields');
        const actionSelect = document.getElementById('alertAction') as HTMLSelectElement;

        autoFields?.classList.toggle('hidden', val === 'notify');
        actionSelect.classList.remove('action-buy', 'action-sell');

        if (val === 'buy')  actionSelect.classList.add('action-buy');
        if (val === 'sell') actionSelect.classList.add('action-sell');

        if (this.confirmBtn) {
            this.confirmBtn.classList.remove('sell');
            this.confirmBtn.innerHTML = val === 'notify'
                ? '<i class="fas fa-check"></i> Set Alert'
                : val === 'buy'
                ? '<i class="fas fa-bolt"></i> Set Auto Buy'
                : '<i class="fas fa-bolt"></i> Set Auto Sell';
            if (val === 'sell') this.confirmBtn.classList.add('sell');
        }
    }

    // ================================================================
    // CONFIRM — ADD ALERT
    // ================================================================

    private handleConfirm(): void {
        const symbol    = (document.getElementById('alertSymbol')    as HTMLSelectElement).value;
        const condition = (document.getElementById('alertCondition') as HTMLSelectElement).value as AlertCondition;
        const action    = (document.getElementById('alertAction')    as HTMLSelectElement).value as AlertAction;
        const isLevel   = document.getElementById('alertLevelWrap')?.classList.contains('hidden') === false;

        let price: number;
        let tag = '';

        if (isLevel) {
            const levelSelect = document.getElementById('alertLevel') as HTMLSelectElement;
            price = parseFloat(levelSelect.value);
            const label = levelSelect.options[levelSelect.selectedIndex].text;
            tag = label.split('·')[0].trim().toLowerCase().replace(' ', '-');
            tag = tag === 'resistance' || tag === 'support' ? 'sr' : tag;
        } else {
            const priceVal = (document.getElementById('alertPrice') as HTMLInputElement).value;
            if (!priceVal) return;
            price = parseFloat(priceVal);
        }

        if (action === 'buy')  tag = 'auto-buy';
        if (action === 'sell') tag = 'auto-sell';

        const lot = parseFloat((document.getElementById('alertLot') as HTMLInputElement)?.value || '0');
        const tp  = parseFloat((document.getElementById('alertTP')  as HTMLInputElement)?.value || '0');
        const sl  = parseFloat((document.getElementById('alertSL')  as HTMLInputElement)?.value || '0');

        const alert: PriceAlert = {
            id:           `alert-${this.idCounter++}`,
            symbol, condition, price, action, tag,
            lot:          lot || undefined,
            tp:           tp  || undefined,
            sl:           sl  || undefined,
            triggered:    false,
            chartVisible: true,
        };

        this.alerts.unshift(alert);
        this.renderAll();
        this.closeForm();

        // Fire event → chart plugin draws line
        document.dispatchEvent(new CustomEvent('alert-added', { detail: alert }));
        console.log('🔔 Alert added:', alert);
    }

    // ================================================================
    // RENDER ALL
    // ================================================================

    private renderAll(): void {
        if (!this.listEl) return;
        this.listEl.innerHTML = '';

        if (!this.alerts.length) {
            this.listEl.innerHTML = `
                <div class="alert-empty">
                    <i class="fas fa-bell-slash"></i>
                    <p>No alerts set.<br>Click + to add one.</p>
                </div>`;
            this.updateCounts();
            return;
        }

        this.alerts.forEach(alert => {
            this.listEl!.appendChild(this.buildAlertItem(alert));
        });

        this.updateCounts();
    }

    // ================================================================
    // BUILD ALERT ITEM
    // ================================================================

    private buildAlertItem(alert: PriceAlert): HTMLElement {
        const icons  = { above: 'fa-arrow-up', below: 'fa-arrow-down', crosses: 'fa-arrows-left-right' };
        const labels = { above: 'Above', below: 'Below', crosses: 'Crosses' };

        const tagHTML = alert.tag
            ? `<span class="alert-tag ${alert.tag}">${this.tagLabel(alert.tag)}</span>`
            : '';

        const eyeClass = alert.chartVisible ? '' : 'hidden-from-chart';
        const eyeIcon  = alert.chartVisible ? 'fa-eye' : 'fa-eye-slash';
        const eyeTitle = alert.chartVisible ? 'Hide from chart' : 'Show on chart';

        const item = document.createElement('div');
        item.className = `alert-item${alert.triggered ? ' triggered' : ''}`;
        item.setAttribute('data-alert-id', alert.id);
        item.innerHTML = `
            <div class="alert-icon ${alert.condition}">
                <i class="fas ${icons[alert.condition]}"></i>
            </div>
            <div class="alert-info">
                <div class="alert-symbol">${alert.symbol}</div>
                <div class="alert-condition">
                    ${labels[alert.condition]}
                    <span class="alert-price-val ${alert.condition}">${alert.price.toFixed(5)}</span>
                    ${tagHTML}
                </div>
            </div>
            <div class="alert-actions">
                <button class="alert-eye-btn ${eyeClass}" title="${eyeTitle}">
                    <i class="fas ${eyeIcon}"></i>
                </button>
                <button class="alert-delete-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Eye toggle
        item.querySelector('.alert-eye-btn')!.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleChartVisibility(alert.id, item);
        });

        // Delete
        item.querySelector('.alert-delete-btn')!.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteAlert(alert.id);
        });

        return item;
    }

    // ================================================================
    // EYE TOGGLE
    // ================================================================

    private toggleChartVisibility(id: string, item: HTMLElement): void {
        const alert = this.alerts.find(a => a.id === id);
        if (!alert) return;

        alert.chartVisible = !alert.chartVisible;

        const btn  = item.querySelector('.alert-eye-btn')!;
        const icon = btn.querySelector('i')!;

        if (alert.chartVisible) {
            btn.classList.remove('hidden-from-chart');
            icon.className = 'fas fa-eye';
            btn.setAttribute('title', 'Hide from chart');
        } else {
            btn.classList.add('hidden-from-chart');
            icon.className = 'fas fa-eye-slash';
            btn.setAttribute('title', 'Show on chart');
        }

        // Fire event → chart plugin shows/hides line
        document.dispatchEvent(new CustomEvent('alert-chart-visibility', {
            detail: { id, visible: alert.chartVisible }
        }));
    }

    // ================================================================
    // DELETE
    // ================================================================

    private deleteAlert(id: string): void {
        this.alerts = this.alerts.filter(a => a.id !== id);
        this.renderAll();

        // Fire event → chart plugin removes line
        document.dispatchEvent(new CustomEvent('alert-removed', { detail: { id } }));
        console.log('🗑️ Alert removed:', id);
    }

    // ================================================================
    // CLEAR ALL
    // ================================================================

    private clearAll(): void {
        this.alerts = [];
        this.renderAll();
        document.dispatchEvent(new CustomEvent('alert-clear-all'));
    }

    // ================================================================
    // UPDATE COUNTS
    // ================================================================

    private updateCounts(): void {
        const total     = this.alerts.length;
        const triggered = this.alerts.filter(a => a.triggered).length;
        const active    = total - triggered;

        if (this.activeCountEl) this.activeCountEl.textContent = String(active);
        if (this.footerCountEl) {
            this.footerCountEl.textContent = triggered > 0
                ? `${total} total · ${triggered} triggered`
                : `${total} total`;
        }
    }

    // ================================================================
    // HELPERS
    // ================================================================

    private tagLabel(tag: string): string {
        const map: Record<string, string> = {
            'sr':        'S/R',
            'auto-buy':  'Auto Buy',
            'auto-sell': 'Auto Sell',
        };
        return map[tag] || tag;
    }

    // ================================================================
    // PUBLIC — called by chart plugin delegate
    // ================================================================

    public markTriggered(id: string): void {
        const alert = this.alerts.find(a => a.id === id);
        if (!alert) return;
        alert.triggered = true;
        this.renderAll();
    }
}