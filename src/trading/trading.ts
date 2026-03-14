// ================================================================
// ⚡ TRADING MODULE
// Handles: account display, lot size, risk %, TP/SL,
//          trade execution, positions modal, inline editor
// ================================================================

import { AccountInfo, PositionData, WebSocketMessage } from '../types';

// ════════════════════════════════════════
// INTERFACES
// ════════════════════════════════════════

interface TradingState {
    balance:     number;
    equity:      number;
    freeMargin:  number;
    margin:      number;
    leverage:    number;
    floatingPnl: number;

    bid:         number;
    ask:         number;
    symbol:      string;

    lotSize:     number;
    safeMode:    boolean;
    maxSafeLots: number;

    riskPct:     number;

    tpEnabled:   boolean;
    slEnabled:   boolean;
    tpPrice:     number;
    slPrice:     number;

    positions:   PositionData[];
}

// ════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════

const CONTRACT_SIZE   = 100_000;
const MAX_BROKER_LOTS = 50;
const PIP_SIZE        = 0.0001;
const PIP_VALUE       = 10;
const TPSL_DEFAULT_PIPS = 20;

// ════════════════════════════════════════
// TRADING MODULE
// ════════════════════════════════════════

export class TradingModule {

    private state: TradingState = {
        balance:     10_000,
        equity:      10_000,
        freeMargin:  10_000,
        margin:      0,
        leverage:    30,
        floatingPnl: 0,

        bid:         0,
        ask:         0,
        symbol:      'EURUSD',

        lotSize:     0.01,
        safeMode:    true,
        maxSafeLots: 2.72,

        riskPct:     0,

        tpEnabled:   false,
        slEnabled:   false,
        tpPrice:     0,
        slPrice:     0,

        positions:   [],
    };

    private tpSlUpdateInterval: ReturnType<typeof setInterval> | null = null;

    private boundPriceUpdate:    EventListener | null = null;
    private boundSafeModeToggle: EventListener | null = null;
    private boundSlider:         EventListener | null = null;
    private boundTpToggle:       EventListener | null = null;
    private boundSlToggle:       EventListener | null = null;
    private boundTpInput:        EventListener | null = null;
    private boundSlInput:        EventListener | null = null;
    private boundRiskPctInput:   EventListener | null = null;
    private boundBuyBtn:         EventListener | null = null;
    private boundSellBtn:        EventListener | null = null;
    private boundCloseAll:       EventListener | null = null;
    private boundHedge:          EventListener | null = null;
    private boundReverse:        EventListener | null = null;
    private boundOpenPositions:  EventListener | null = null;
    private boundLotPresets:     Map<HTMLElement, EventListener> = new Map();
    private boundTpSlPresets:    Map<HTMLElement, EventListener> = new Map();
    private boundRiskPctBtns:    Map<HTMLElement, EventListener> = new Map();

    constructor() {
        this.initialize();
    }

    // ════════════════════════════════════════
    // INITIALIZATION
    // ════════════════════════════════════════

    private initialize(): void {
        console.log('⚡ Trading Module initializing...');
        try {
            this.setupPriceListener();
            this.setupSafeMode();
            this.setupLotControls();
            this.setupRiskPct();
            this.setupTpSlControls();
            this.setupTradeButtons();
            this.setupQuickActions();
            this.setupPositionsButton();
            this.startTpSlBackgroundUpdate();
            this.renderAll();
            console.log('✅ Trading Module initialized');
        } catch (error) {
            console.error('❌ Trading Module failed:', error);
        }
    }

    // ════════════════════════════════════════
    // PRICE LISTENER
    // ════════════════════════════════════════

    private setupPriceListener(): void {
        this.boundPriceUpdate = (e: Event) => {
            const { bid, ask, symbol } = (e as CustomEvent).detail;

            this.state.bid    = bid    ?? this.state.bid;
            this.state.ask    = ask    ?? this.state.ask;
            this.state.symbol = symbol ?? this.state.symbol;

            this.renderBuySellPrices();
            this.renderTpSlPips();
            this.renderLotStats();

            if (this.state.riskPct > 0 && this.state.slEnabled) {
                this.applyRiskPct(this.state.riskPct);
            }
        };

        document.addEventListener('price-update', this.boundPriceUpdate);
    }

    // ════════════════════════════════════════
    // TP/SL BACKGROUND UPDATE
    // Updates silently every 1min when toggles are OFF
    // ════════════════════════════════════════

    private startTpSlBackgroundUpdate(): void {
        this.tpSlUpdateInterval = setInterval(() => {
            if (!this.state.tpEnabled && this.state.ask > 0) {
                this.state.tpPrice = this.state.ask + TPSL_DEFAULT_PIPS * PIP_SIZE;
            }
            if (!this.state.slEnabled && this.state.ask > 0) {
                this.state.slPrice = this.state.ask - TPSL_DEFAULT_PIPS * PIP_SIZE;
            }
        }, 60_000);
    }

    private stopTpSlBackgroundUpdate(): void {
        if (this.tpSlUpdateInterval) {
            clearInterval(this.tpSlUpdateInterval);
            this.tpSlUpdateInterval = null;
        }
    }

    // ════════════════════════════════════════
    // SAFE MODE
    // ════════════════════════════════════════

    private setupSafeMode(): void {
        const toggle = document.getElementById('safeModeToggle');
        if (!toggle) return;

        this.boundSafeModeToggle = () => {
            this.state.safeMode = !this.state.safeMode;
            this.applySafeMode();
        };

        toggle.addEventListener('click', this.boundSafeModeToggle);
    }

    private applySafeMode(): void {
        const toggle   = document.getElementById('safeModeToggle');
        const icon     = document.getElementById('safeModeIcon');
        const label    = document.getElementById('safeModeLabel');
        const slider   = document.getElementById('lotSlider')  as HTMLInputElement;
        const maxBadge = document.getElementById('lotMaxBadge');
        const maxLabel = document.getElementById('sliderMaxLabel');

        if (this.state.safeMode) {
            toggle?.classList.remove('off');
            if (icon)  icon.className    = 'fas fa-lock';
            if (label) label.textContent = 'SAFE';

            const max = this.state.maxSafeLots;
            if (slider)   slider.max          = String(max);
            if (maxBadge) maxBadge.textContent = `Max: ${max}`;
            if (maxLabel) maxLabel.textContent = String(max);

            if (this.state.lotSize > max) {
                this.applyLotSize(max);
            }

            this.hideMarginWarning();

        } else {
            toggle?.classList.add('off');
            if (icon)  icon.className    = 'fas fa-lock-open';
            if (label) label.textContent = 'FREE';

            if (slider)   slider.max          = String(MAX_BROKER_LOTS);
            if (maxBadge) maxBadge.textContent = `Max: ${MAX_BROKER_LOTS}`;
            if (maxLabel) maxLabel.textContent = String(MAX_BROKER_LOTS);
        }

        this.checkMarginWarning();
    }

    // ════════════════════════════════════════
    // LOT SIZE
    // ════════════════════════════════════════

    private setupLotControls(): void {
        const slider = document.getElementById('lotSlider') as HTMLInputElement;

        if (slider) {
            this.boundSlider = () => {
                this.applyLotSize(parseFloat(slider.value));
                this.clearPresetActive();
                this.clearRiskPct();
            };
            slider.addEventListener('input', this.boundSlider);
        }

        document.querySelectorAll<HTMLElement>('.preset-btn').forEach(btn => {
            const handler: EventListener = () => {
                const lot = parseFloat(btn.dataset.lot ?? '0.01');
                this.applyLotSize(lot);
                this.clearPresetActive();
                this.clearRiskPct();
                btn.classList.add('active');
            };
            btn.addEventListener('click', handler);
            this.boundLotPresets.set(btn, handler);
        });
    }

    private applyLotSize(value: number): void {
        this.state.lotSize = parseFloat(value.toFixed(2));

        const display = document.getElementById('lotDisplay');
        const slider  = document.getElementById('lotSlider') as HTMLInputElement;

        if (display) display.textContent = this.state.lotSize.toFixed(2);
        if (slider)  slider.value        = String(this.state.lotSize);

        this.renderLotStats();
        this.checkMarginWarning();
    }

    private clearPresetActive(): void {
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    }

    // ════════════════════════════════════════
    // RISK %
    // ════════════════════════════════════════

    private setupRiskPct(): void {
        document.querySelectorAll<HTMLElement>('.risk-pct-btn').forEach(btn => {
            const handler: EventListener = () => {
                document.querySelectorAll('.risk-pct-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const pct   = parseFloat(btn.dataset.pct ?? '0');
                const input = document.getElementById('riskPctInput') as HTMLInputElement;
                if (input) input.value = String(pct);
                this.applyRiskPct(pct);
            };
            btn.addEventListener('click', handler);
            this.boundRiskPctBtns.set(btn, handler);
        });

        const riskPctInput = document.getElementById('riskPctInput') as HTMLInputElement;
        if (riskPctInput) {
            this.boundRiskPctInput = () => {
                document.querySelectorAll('.risk-pct-btn').forEach(b => b.classList.remove('active'));
                const pct = parseFloat(riskPctInput.value);
                if (!isNaN(pct) && pct > 0) this.applyRiskPct(pct);
            };
            riskPctInput.addEventListener('input', this.boundRiskPctInput);
        }
    }

    private applyRiskPct(pct: number): void {
        this.state.riskPct = pct;

        const badge = document.getElementById('riskPctBadge');
        const note  = document.getElementById('riskPctNote');

        if (badge) badge.textContent = `${pct}%`;

        if (!this.state.slEnabled) {
            if (note) {
                note.textContent = 'Enable SL to auto-calculate lot size';
                note.classList.remove('active');
            }
            return;
        }

        const slPips = Math.abs(this.state.ask - this.state.slPrice) / PIP_SIZE;
        if (slPips === 0) return;

        const riskAmount = this.state.balance * (pct / 100);
        const lotSize    = riskAmount / (slPips * PIP_VALUE);
        const rounded    = Math.max(0.01, parseFloat(lotSize.toFixed(2)));

        const finalLot = this.state.safeMode
            ? Math.min(rounded, this.state.maxSafeLots)
            : Math.min(rounded, MAX_BROKER_LOTS);

        this.applyLotSize(finalLot);

        if (note) {
            note.textContent = `Lot auto-set to ${finalLot.toFixed(2)} for ${pct}% risk`;
            note.classList.add('active');
        }
    }

    private clearRiskPct(): void {
        this.state.riskPct = 0;

        const badge = document.getElementById('riskPctBadge');
        const input = document.getElementById('riskPctInput') as HTMLInputElement;
        const note  = document.getElementById('riskPctNote');

        if (badge) badge.textContent = '0.00%';
        if (input) input.value       = '';
        if (note) {
            note.textContent = 'Enable SL to auto-calculate lot size';
            note.classList.remove('active');
        }

        document.querySelectorAll('.risk-pct-btn').forEach(b => b.classList.remove('active'));
    }

    private renderRiskPctNote(): void {
        if (this.state.riskPct > 0) {
            this.applyRiskPct(this.state.riskPct);
        }
    }

    // ════════════════════════════════════════
    // LOT STATS
    // ════════════════════════════════════════

    private renderLotStats(): void {
        const lot    = this.state.lotSize;
        const margin = lot * CONTRACT_SIZE / this.state.leverage;
        const value  = lot * CONTRACT_SIZE * this.state.ask;

        this.setText('marginAmount',  `$${margin.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
        this.setText('positionValue', `$${Math.round(value).toLocaleString()}`);

        if (this.state.slEnabled) {
            const slPips = Math.abs(this.state.ask - this.state.slPrice) / PIP_SIZE;
            const risk   = lot * PIP_VALUE * slPips;
            this.setText('riskAmount', `$${risk.toFixed(2)}`);
        } else {
            this.setText('riskAmount', '--');
        }

        const overMargin = margin > this.state.freeMargin;
        document.getElementById('riskAmount')?.classList.toggle('over',       overMargin);
        document.getElementById('marginAmount')?.classList.toggle('over',     overMargin);
        document.getElementById('lotSlider')?.classList.toggle('over-margin', overMargin && !this.state.safeMode);
    }

    // ════════════════════════════════════════
    // MARGIN WARNING
    // ════════════════════════════════════════

    private checkMarginWarning(): void {
        const margin     = this.state.lotSize * CONTRACT_SIZE / this.state.leverage;
        const overMargin = margin > this.state.freeMargin;

        if (!this.state.safeMode && overMargin) {
            const shortfall = (margin - this.state.freeMargin).toFixed(2);
            this.setText('marginWarningText',
                `Margin $${margin.toFixed(2)} — exceeds free margin by $${shortfall}`
            );
            this.showMarginWarning();
        } else {
            this.hideMarginWarning();
        }
    }

    private showMarginWarning(): void {
        document.getElementById('marginWarning')?.classList.remove('hidden');
    }

    private hideMarginWarning(): void {
        document.getElementById('marginWarning')?.classList.add('hidden');
    }

    private calcMaxSafeLots(): number {
        const max = this.state.freeMargin / (CONTRACT_SIZE / this.state.leverage);
        return parseFloat(max.toFixed(2));
    }

    // ════════════════════════════════════════
    // TP / SL
    // ════════════════════════════════════════

    private setupTpSlControls(): void {
        const tpToggle = document.getElementById('tpToggle');
        const slToggle = document.getElementById('slToggle');
        const tpInput  = document.getElementById('tpInput') as HTMLInputElement;
        const slInput  = document.getElementById('slInput') as HTMLInputElement;

        if (tpToggle) {
            this.boundTpToggle = () => {
                this.state.tpEnabled = !this.state.tpEnabled;
                tpToggle.classList.toggle('active', this.state.tpEnabled);
                document.getElementById('tpRow')?.classList.toggle('hidden', !this.state.tpEnabled);

                // ✅ Seed with current price + default pips when enabled
                if (this.state.tpEnabled && this.state.ask > 0) {
                    this.state.tpPrice = this.state.ask + TPSL_DEFAULT_PIPS * PIP_SIZE;
                    const input = document.getElementById('tpInput') as HTMLInputElement;
                    if (input) input.value = String(this.state.tpPrice);
                }

                this.checkTpSlEmpty();
                this.renderTpSlPips();
                this.renderRR();
            };
            tpToggle.addEventListener('click', this.boundTpToggle);
        }

        if (slToggle) {
            this.boundSlToggle = () => {
                this.state.slEnabled = !this.state.slEnabled;
                slToggle.classList.toggle('active', this.state.slEnabled);
                document.getElementById('slRow')?.classList.toggle('hidden', !this.state.slEnabled);

                // ✅ Seed with current price - default pips when enabled
                if (this.state.slEnabled && this.state.ask > 0) {
                    this.state.slPrice = this.state.ask - TPSL_DEFAULT_PIPS * PIP_SIZE;
                    const input = document.getElementById('slInput') as HTMLInputElement;
                    if (input) input.value = String(this.state.slPrice);
                }

                this.checkTpSlEmpty();
                this.renderLotStats();
                this.renderTpSlPips();
                this.renderRR();
                this.renderRiskPctNote();
            };
            slToggle.addEventListener('click', this.boundSlToggle);
        }

        if (tpInput) {
            this.boundTpInput = () => {
                this.state.tpPrice = parseFloat(tpInput.value) || this.state.tpPrice;
                this.renderTpSlPips();
                this.renderRR();
            };
            tpInput.addEventListener('input', this.boundTpInput);
        }

        if (slInput) {
            this.boundSlInput = () => {
                this.state.slPrice = parseFloat(slInput.value) || this.state.slPrice;
                this.renderTpSlPips();
                this.renderLotStats();
                this.renderRR();
                if (this.state.riskPct > 0 && this.state.slEnabled) {
                    this.applyRiskPct(this.state.riskPct);
                }
            };
            slInput.addEventListener('input', this.boundSlInput);
        }

        document.querySelectorAll<HTMLElement>('.pip-preset-btn').forEach(btn => {
            const handler: EventListener = () => {
                const pips = parseFloat(btn.dataset.pips ?? '0');
                const rr   = parseFloat(btn.dataset.rr   ?? '0');
                if (pips) this.applyPipPreset(pips);
                if (rr)   this.applyRRPreset(rr);
            };
            btn.addEventListener('click', handler);
            this.boundTpSlPresets.set(btn, handler);
        });
    }

    private applyPipPreset(pips: number): void {
        const price = this.state.ask;

        if (this.state.tpEnabled) {
            const tp = price + pips * PIP_SIZE;
            this.state.tpPrice = tp;
            const tpInput = document.getElementById('tpInput') as HTMLInputElement;
            if (tpInput) tpInput.value = String(tp);
        }

        if (this.state.slEnabled) {
            const sl = price - pips * PIP_SIZE;
            this.state.slPrice = sl;
            const slInput = document.getElementById('slInput') as HTMLInputElement;
            if (slInput) slInput.value = String(sl);
        }

        this.renderTpSlPips();
        this.renderRR();

        if (this.state.riskPct > 0 && this.state.slEnabled) {
            this.applyRiskPct(this.state.riskPct);
        }
    }

    private applyRRPreset(ratio: number): void {
        const price  = this.state.ask;
        const slPips = TPSL_DEFAULT_PIPS;
        const tpPips = slPips * ratio;

        if (this.state.slEnabled) {
            const sl = price - slPips * PIP_SIZE;
            this.state.slPrice = sl;
            const slInput = document.getElementById('slInput') as HTMLInputElement;
            if (slInput) slInput.value = String(sl);
        }

        if (this.state.tpEnabled) {
            const tp = price + tpPips * PIP_SIZE;
            this.state.tpPrice = tp;
            const tpInput = document.getElementById('tpInput') as HTMLInputElement;
            if (tpInput) tpInput.value = String(tp);
        }

        this.renderTpSlPips();
        this.renderRR();

        if (this.state.riskPct > 0 && this.state.slEnabled) {
            this.applyRiskPct(this.state.riskPct);
        }
    }

    private renderTpSlPips(): void {
        const price = this.state.ask;

        if (this.state.tpEnabled) {
            const tpPips = ((this.state.tpPrice - price) / PIP_SIZE).toFixed(1);
            const el = document.getElementById('tpPips');
            if (el) {
                el.textContent = `${parseFloat(tpPips) >= 0 ? '+' : ''}${tpPips}p`;
                el.className   = `tpsl-pips ${parseFloat(tpPips) >= 0 ? 'positive' : 'negative'}`;
            }
        }

        if (this.state.slEnabled) {
            const slPips = ((this.state.slPrice - price) / PIP_SIZE).toFixed(1);
            const el = document.getElementById('slPips');
            if (el) {
                el.textContent = `${parseFloat(slPips) >= 0 ? '+' : ''}${slPips}p`;
                el.className   = `tpsl-pips ${parseFloat(slPips) >= 0 ? 'positive' : 'negative'}`;
            }
        }
    }

    private renderRR(): void {
        const rrDisplay = document.getElementById('rrDisplay');
        if (!this.state.tpEnabled || !this.state.slEnabled) {
            rrDisplay?.classList.add('hidden');
            return;
        }

        rrDisplay?.classList.remove('hidden');

        const price  = this.state.ask;
        const tpPips = Math.abs(this.state.tpPrice - price);
        const slPips = Math.abs(this.state.slPrice - price);

        if (slPips === 0) return;

        const rr = (tpPips / slPips).toFixed(2);
        this.setText('rrValue', `1 : ${rr}`);
    }

    private checkTpSlEmpty(): void {
        const bothOff = !this.state.tpEnabled && !this.state.slEnabled;
        document.getElementById('tpslEmpty')?.classList.toggle('hidden', !bothOff);
    }

    // ════════════════════════════════════════
    // BUY / SELL
    // ════════════════════════════════════════

    private setupTradeButtons(): void {
        const buyBtn  = document.getElementById('buyButton');
        const sellBtn = document.getElementById('sellButton');

        if (buyBtn) {
            this.boundBuyBtn = () => this.executeTrade('BUY');
            buyBtn.addEventListener('click', this.boundBuyBtn);
        }

        if (sellBtn) {
            this.boundSellBtn = () => this.executeTrade('SELL');
            sellBtn.addEventListener('click', this.boundSellBtn);
        }
    }

    private executeTrade(direction: 'BUY' | 'SELL'): void {
        const price  = direction === 'BUY' ? this.state.ask : this.state.bid;
        const symbol = this.state.symbol;
        const volume = this.state.lotSize;
        const tp     = this.state.tpEnabled ? this.state.tpPrice : null;
        const sl     = this.state.slEnabled ? this.state.slPrice  : null;

        const command = `TRADE_${direction}_${symbol}_${volume}_${price}`;

        document.dispatchEvent(new CustomEvent('execute-trade', {
            detail: { command, tp, sl }
        }));

        console.log(`🚀 Trade dispatched: ${command} TP:${tp} SL:${sl}`);
    }

    // ════════════════════════════════════════
    // QUICK ACTIONS
    // ════════════════════════════════════════

    private setupQuickActions(): void {
        const closeAllBtn = document.getElementById('closeAllBtn');
        const hedgeBtn    = document.getElementById('hedgeBtn');
        const reverseBtn  = document.getElementById('reverseBtn');

        if (closeAllBtn) {
            this.boundCloseAll = () => {
                document.dispatchEvent(new CustomEvent('close-all-positions'));
            };
            closeAllBtn.addEventListener('click', this.boundCloseAll);
        }

        if (hedgeBtn) {
            this.boundHedge = () => this.executeHedge();
            hedgeBtn.addEventListener('click', this.boundHedge);
        }

        if (reverseBtn) {
            this.boundReverse = () => this.executeReverse();
            reverseBtn.addEventListener('click', this.boundReverse);
        }
    }

    private executeHedge(): void {
        const positions = this.state.positions;
        if (positions.length === 0) return;

        const lastPos   = positions[positions.length - 1];
        const direction = lastPos.type === 'BUY' ? 'SELL' : 'BUY';

        document.dispatchEvent(new CustomEvent('execute-trade', {
            detail: {
                command: JSON.stringify({
                    action: 'TRADE', direction,
                    symbol: this.state.symbol,
                    volume: this.state.lotSize,
                    tp: null, sl: null,
                })
            }
        }));
    }

    private executeReverse(): void {
        document.dispatchEvent(new CustomEvent('close-all-positions'));

        setTimeout(() => {
            const direction = this.state.positions.length > 0
                ? (this.state.positions[0].type === 'BUY' ? 'SELL' : 'BUY')
                : 'BUY';

            document.dispatchEvent(new CustomEvent('execute-trade', {
                detail: {
                    command: JSON.stringify({
                        action: 'TRADE', direction,
                        symbol: this.state.symbol,
                        volume: this.state.lotSize,
                        tp: null, sl: null,
                    })
                }
            }));
        }, 300);
    }

    // ════════════════════════════════════════
    // POSITIONS BUTTON
    // ════════════════════════════════════════

    private setupPositionsButton(): void {
        const btn = document.getElementById('openPositionsBtn');
        if (!btn) return;

        this.boundOpenPositions = () => this.openPositionsModal();
        btn.addEventListener('click', this.boundOpenPositions);
    }

    // ════════════════════════════════════════
    // POSITIONS MODAL
    // ════════════════════════════════════════

    private activeRowTicket: string | null = null;

    private openPositionsModal(): void {
        const modal = document.getElementById('positionsModal');
        if (!modal) return;

        modal.classList.remove('hidden');
        this.renderPositionsTable();
        this.setupModalControls();
        this.setupDrag();
    }

    private closePositionsModal(): void {
        const modal = document.getElementById('positionsModal');
        modal?.classList.add('hidden');
        this.collapseInlineEditor();
        this.activeRowTicket = null;
    }

    private setupModalControls(): void {
        const closeBtn    = document.getElementById('positionsModalClose');
        const closeAllBtn = document.getElementById('modalCloseAllBtn');

        closeBtn?.addEventListener('click', () => this.closePositionsModal());

        closeAllBtn?.addEventListener('click', () => {
            document.dispatchEvent(new CustomEvent('close-all-positions'));
        });

        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Escape') this.closePositionsModal();
        }, { once: true });
    }

    // ════════════════════════════════════════
    // DRAG
    // ════════════════════════════════════════

    private setupDrag(): void {
        const modal  = document.getElementById('positionsModal') as HTMLElement;
        const header = document.getElementById('positionsModalHeader') as HTMLElement;
        if (!modal || !header) return;

        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop  = 0;

        modal.style.position  = 'fixed';
        modal.style.transform = 'none';

        const onMouseDown = (e: MouseEvent) => {
            if ((e.target as HTMLElement).closest('button')) return;

            isDragging = true;
            startX     = e.clientX;
            startY     = e.clientY;
            startLeft  = modal.offsetLeft;
            startTop   = modal.offsetTop;

            header.style.cursor = 'grabbing';
            e.preventDefault();
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            let newLeft = startLeft + dx;
            let newTop  = startTop  + dy;

            const maxLeft = window.innerWidth  - modal.offsetWidth;
            const maxTop  = window.innerHeight - modal.offsetHeight;

            // ✅ Allow full overlap including tab strip
            newLeft = Math.max(0, Math.min(newLeft, maxLeft));
            newTop  = Math.max(0, Math.min(newTop,  maxTop));

            modal.style.left = `${newLeft}px`;
            modal.style.top  = `${newTop}px`;
        };

        const onMouseUp = () => {
            isDragging          = false;
            header.style.cursor = 'grab';
        };

        header.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup',   onMouseUp);
    }

    // ════════════════════════════════════════
    // POSITIONS TABLE — full rebuild on open
    // ════════════════════════════════════════

    private renderPositionsTable(): void {
        const tbody = document.getElementById('positionsTableBody');
        const empty = document.getElementById('positionsEmpty');
        const table = document.getElementById('positionsTable');

        if (!tbody) return;

        if (this.state.positions.length === 0) {
            empty?.classList.remove('hidden');
            table?.classList.add('hidden');
            this.collapseInlineEditor();
            return;
        }

        empty?.classList.add('hidden');
        table?.classList.remove('hidden');

        tbody.innerHTML = '';

        this.state.positions.forEach(pos => {
            const pnl       = pos.profit ?? 0;
            const pnlClass  = pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
            const typeClass = pos.type === 'BUY' ? 'type-buy' : 'type-sell';
            const pnlStr    = `${pnl >= 0 ? '+$' : '-$'}${Math.abs(pnl).toFixed(2)}`;
            const isSelected = this.activeRowTicket === String(pos.ticket);

            const tr = document.createElement('tr');
            tr.dataset.ticket = String(pos.ticket);
            if (isSelected) tr.classList.add('selected');

            // ✅ X button replaces pen button — click row for editor, X to close
            tr.innerHTML = `
                <td>${pos.symbol}</td>
                <td class="${typeClass}">${pos.type}</td>
                <td>${pos.volume ?? '—'}</td>
                <td>${(pos.openPrice ?? pos.entry_price ?? pos.price_open) ?? '—'}</td>
                <td>${pos.current_price ?? '—'}</td>
                <td>${pos.sl ?? '—'}</td>
                <td>${pos.tp ?? '—'}</td>
                <td class="${pnlClass}">${pnlStr}</td>
                <td>
                    <button class="row-close-btn" data-ticket="${pos.ticket}" title="Close trade">
                        <i class="fas fa-xmark"></i>
                    </button>
                </td>
            `;

            // Click row → open inline editor
            tr.addEventListener('click', (e) => {
                if ((e.target as HTMLElement).closest('.row-close-btn')) return;
                this.toggleInlineEditor(pos);
            });

            // Click ✕ → close trade directly
            tr.querySelector('.row-close-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.submitClosePosition(pos);
            });

            tbody.appendChild(tr);
        });

        this.renderSummaryBar();
    }

    // ════════════════════════════════════════
    // UPDATE ROWS — no flicker on live updates
    // ════════════════════════════════════════

    private updatePositionRows(): void {
        const tbody = document.getElementById('positionsTableBody');
        const empty = document.getElementById('positionsEmpty');
        const table = document.getElementById('positionsTable');

        if (!tbody) return;

        if (this.state.positions.length === 0) {
            empty?.classList.remove('hidden');
            table?.classList.add('hidden');
            this.collapseInlineEditor();
            this.renderSummaryBar();
            return;
        }

        empty?.classList.add('hidden');
        table?.classList.remove('hidden');

        const existingTickets = new Set(
            Array.from(tbody.querySelectorAll('tr')).map(tr => (tr as HTMLElement).dataset.ticket)
        );
        const newTickets = new Set(this.state.positions.map(p => String(p.ticket)));

        // Remove closed positions
        existingTickets.forEach(ticket => {
            if (!newTickets.has(ticket)) {
                tbody.querySelector(`tr[data-ticket="${ticket}"]`)?.remove();
            }
        });

        this.state.positions.forEach(pos => {
            const ticket   = String(pos.ticket);
            const pnl      = pos.profit ?? 0;
            const pnlClass = pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
            const pnlStr   = `${pnl >= 0 ? '+$' : '-$'}${Math.abs(pnl).toFixed(2)}`;
            const existing = tbody.querySelector(`tr[data-ticket="${ticket}"]`) as HTMLElement;

            if (existing) {
                // ✅ Only update current price and pnl — no flicker
                const cells = existing.querySelectorAll('td');
                if (cells[4]) cells[4].textContent = String(pos.current_price ?? '—');
                if (cells[7]) {
                    cells[7].textContent = pnlStr;
                    cells[7].className   = pnlClass;
                }
            } else {
                // New position appeared — full rebuild
                this.renderPositionsTable();
            }
        });

        this.renderSummaryBar();
    }

    // ════════════════════════════════════════
    // SUMMARY BAR
    // ════════════════════════════════════════

    private renderSummaryBar(): void {
        const positions = this.state.positions;
        const totalPnl  = positions.reduce((sum, p) => sum + (p.profit ?? 0), 0);
        const totalLots = positions.reduce((sum, p) => sum + (p.volume ?? 0), 0);
        const winning   = positions.filter(p => (p.profit ?? 0) >= 0).length;
        const losing    = positions.filter(p => (p.profit ?? 0) <  0).length;

        const pnlEl = document.getElementById('summaryTotalPnl');
        if (pnlEl) {
            // ✅ Fixed: minus sign on loss
            pnlEl.textContent = `${totalPnl >= 0 ? '+$' : '-$'}${Math.abs(totalPnl).toFixed(2)}`;
            pnlEl.classList.toggle('positive', totalPnl >= 0);
            pnlEl.classList.toggle('negative', totalPnl <  0);
        }

        this.setText('summaryTotalLots', totalLots.toFixed(2));
        this.setText('summaryWinning',   String(winning));
        this.setText('summaryLosing',    String(losing));
    }

    // ════════════════════════════════════════
    // INLINE EDITOR
    // ════════════════════════════════════════

    private toggleInlineEditor(pos: PositionData): void {
        const ticket = String(pos.ticket);

        if (this.activeRowTicket === ticket) {
            this.collapseInlineEditor();
            return;
        }

        this.activeRowTicket = ticket;

        document.querySelectorAll('#positionsTableBody tr').forEach(tr => {
            tr.classList.remove('selected');
        });
        document.querySelector(`tr[data-ticket="${ticket}"]`)?.classList.add('selected');

        this.setText('inlineEditorTicket', `#${ticket}`);
        this.setText('inlineEditorTime',   this.formatTime(pos.open_time));

        const slInput = document.getElementById('inlineSlInput') as HTMLInputElement;
        const tpInput = document.getElementById('inlineTpInput') as HTMLInputElement;

        if (slInput) slInput.value = pos.sl ? String(pos.sl) : '';
        if (tpInput) tpInput.value = pos.tp ? String(pos.tp) : '';

        // ✅ Freeze current price at moment of opening editor
        const frozenPrice = pos.current_price ?? this.state.ask;
        this.renderInlinePips(pos);
        this.setupInlinePipPresets(pos, frozenPrice);

        document.getElementById('inlineEditor')?.classList.remove('hidden');

        const updateBtn     = document.getElementById('inlineUpdateBtn');
        const closeTradeBtn = document.getElementById('inlineCloseTradeBtn');
        const cancelBtn     = document.getElementById('inlineCancelBtn');

        const newUpdate = updateBtn?.cloneNode(true)     as HTMLElement;
        const newClose  = closeTradeBtn?.cloneNode(true) as HTMLElement;
        const newCancel = cancelBtn?.cloneNode(true)     as HTMLElement;

        updateBtn?.parentNode?.replaceChild(newUpdate, updateBtn);
        closeTradeBtn?.parentNode?.replaceChild(newClose, closeTradeBtn);
        cancelBtn?.parentNode?.replaceChild(newCancel, cancelBtn);

        newUpdate?.addEventListener('click', () => this.submitModifyPosition(pos));
        newClose?.addEventListener('click',  () => this.submitClosePosition(pos));
        newCancel?.addEventListener('click', () => this.collapseInlineEditor());

        document.getElementById('inlineSlInput')?.addEventListener('input', () => this.renderInlinePips(pos));
        document.getElementById('inlineTpInput')?.addEventListener('input', () => this.renderInlinePips(pos));
    }

    // ════════════════════════════════════════
    // INLINE PIP PRESETS
    // Frozen price — not live updating
    // ════════════════════════════════════════

    private setupInlinePipPresets(pos: PositionData, frozenPrice: number): void {
        const container = document.getElementById('inlinePipPresets');
        if (!container) return;

        container.innerHTML = '';

        const isBuy    = pos.type === 'BUY' || pos.type === 0;
        const pipList  = [10, 20, 30, 50, 100];
        const rrList   = [1, 1.5, 2, 3];

        // Pip presets
        pipList.forEach(pips => {
            const btn = document.createElement('button');
            btn.className   = 'inline-pip-btn';
            btn.textContent = `${pips}p`;
            btn.addEventListener('click', () => {
                const slInput = document.getElementById('inlineSlInput') as HTMLInputElement;
                const tpInput = document.getElementById('inlineTpInput') as HTMLInputElement;

                if (slInput) slInput.value = String(
                    isBuy
                        ? frozenPrice - pips * PIP_SIZE
                        : frozenPrice + pips * PIP_SIZE
                );
                if (tpInput) tpInput.value = String(
                    isBuy
                        ? frozenPrice + pips * PIP_SIZE
                        : frozenPrice - pips * PIP_SIZE
                );

                this.renderInlinePips(pos);
            });
            container.appendChild(btn);
        });

        // RR presets
        rrList.forEach(rr => {
            const btn = document.createElement('button');
            btn.className   = 'inline-pip-btn rr';
            btn.textContent = `1:${rr}`;
            btn.addEventListener('click', () => {
                const slInput = document.getElementById('inlineSlInput') as HTMLInputElement;
                const tpInput = document.getElementById('inlineTpInput') as HTMLInputElement;
                const slPips  = 20;
                const tpPips  = slPips * rr;

                if (slInput) slInput.value = String(
                    isBuy
                        ? frozenPrice - slPips * PIP_SIZE
                        : frozenPrice + slPips * PIP_SIZE
                );
                if (tpInput) tpInput.value = String(
                    isBuy
                        ? frozenPrice + tpPips * PIP_SIZE
                        : frozenPrice - tpPips * PIP_SIZE
                );

                this.renderInlinePips(pos);
            });
            container.appendChild(btn);
        });
    }

    private renderInlinePips(pos: PositionData): void {
        const price   = pos.current_price ?? this.state.ask;
        const slInput = document.getElementById('inlineSlInput') as HTMLInputElement;
        const tpInput = document.getElementById('inlineTpInput') as HTMLInputElement;

        if (slInput?.value) {
            const slPips = ((parseFloat(slInput.value) - price) / PIP_SIZE).toFixed(1);
            const el     = document.getElementById('inlineSlPips');
            if (el) {
                el.textContent = `${parseFloat(slPips) >= 0 ? '+' : ''}${slPips}p`;
                el.className   = `inline-field-pips ${parseFloat(slPips) >= 0 ? 'positive' : 'negative'}`;
            }
        }

        if (tpInput?.value) {
            const tpPips = ((parseFloat(tpInput.value) - price) / PIP_SIZE).toFixed(1);
            const el     = document.getElementById('inlineTpPips');
            if (el) {
                el.textContent = `${parseFloat(tpPips) >= 0 ? '+' : ''}${tpPips}p`;
                el.className   = `inline-field-pips ${parseFloat(tpPips) >= 0 ? 'positive' : 'negative'}`;
            }
        }
    }

    private submitModifyPosition(pos: PositionData): void {
        const slInput = document.getElementById('inlineSlInput') as HTMLInputElement;
        const tpInput = document.getElementById('inlineTpInput') as HTMLInputElement;

        document.dispatchEvent(new CustomEvent('modify-position', {
            detail: {
                ticket: pos.ticket,
                sl:     slInput?.value ? parseFloat(slInput.value) : null,
                tp:     tpInput?.value ? parseFloat(tpInput.value) : null,
            }
        }));

        this.collapseInlineEditor();
    }

    private submitClosePosition(pos: PositionData): void {
        document.dispatchEvent(new CustomEvent('close-position', {
            detail: { ticket: pos.ticket }
        }));

        this.collapseInlineEditor();
    }

    private collapseInlineEditor(): void {
        document.getElementById('inlineEditor')?.classList.add('hidden');
        document.querySelectorAll('#positionsTableBody tr').forEach(tr => {
            tr.classList.remove('selected');
        });
        this.activeRowTicket = null;
    }

    // ════════════════════════════════════════
    // RENDER ALL
    // ════════════════════════════════════════

    private renderAll(): void {
        this.renderHero();
        this.renderMetrics();
        this.renderBuySellPrices();
        this.renderLotStats();
        this.renderTpSlPips();
        this.renderRR();
        this.updatePositionsCount();
    }

    // ════════════════════════════════════════
    // RENDER HERO
    // ════════════════════════════════════════

    private renderHero(): void {
        const pnl      = this.state.floatingPnl;
        const positive = pnl >= 0;

        // ✅ Fixed: Math.abs prevents double minus on percentage
        const pct = this.state.balance > 0
            ? (Math.abs(pnl / this.state.balance) * 100).toFixed(2)
            : '0.00';

        const pnlEl = document.getElementById('heroPnl');
        const pctEl = document.getElementById('heroPct');

        if (pnlEl) {
            pnlEl.textContent = `${positive ? '+' : '-'}$${Math.abs(pnl).toFixed(2)}`;
            pnlEl.classList.toggle('positive', positive);
            pnlEl.classList.toggle('negative', !positive);
        }

        if (pctEl) {
            pctEl.textContent = `${positive ? '+' : '-'}${pct}%`;
            pctEl.classList.toggle('positive', positive);
            pctEl.classList.toggle('negative', !positive);
        }
    }

    // ════════════════════════════════════════
    // RENDER METRICS
    // ════════════════════════════════════════

    private renderMetrics(): void {
        this.setText('accountBalance',    this.formatCurrency(this.state.balance));
        this.setText('accountEquity',     this.formatCurrency(this.state.equity));
        this.setText('accountMargin',     this.formatCurrency(this.state.margin));
        this.setText('accountFreeMargin', this.formatCurrency(this.state.freeMargin));
    }

    // ════════════════════════════════════════
    // RENDER BUY / SELL PRICES
    // ════════════════════════════════════════

    private renderBuySellPrices(): void {
        // ✅ Backend formats price — just display as-is
        this.setText('buyBtnPrice',  String(this.state.ask));
        this.setText('sellBtnPrice', String(this.state.bid));
    }

    // ════════════════════════════════════════
    // POSITIONS COUNT
    // ════════════════════════════════════════

    private updatePositionsCount(): void {
        const count = this.state.positions.length;
        this.setText('positionsCount',     String(count));
        this.setText('modalPositionCount', String(count));
    }

    // ════════════════════════════════════════
    // PUBLIC API
    // ════════════════════════════════════════

    public updateAccountInfo(account: AccountInfo): void {
        this.state.balance     = account.balance     ?? this.state.balance;
        this.state.equity      = account.equity      ?? this.state.equity;
        this.state.freeMargin  = account.free_margin ?? this.state.freeMargin;
        this.state.margin      = account.margin      ?? this.state.margin;
        this.state.leverage    = account.leverage    ?? this.state.leverage;
        this.state.floatingPnl = (account.equity ?? 0) - (account.balance ?? 0);

        this.state.maxSafeLots = this.calcMaxSafeLots();
        this.applySafeMode();

        this.renderHero();
        this.renderMetrics();
        this.renderLotStats();

        if (this.state.riskPct > 0 && this.state.slEnabled) {
            this.applyRiskPct(this.state.riskPct);
        }
    }

    public updatePositions(positions: PositionData[]): void {
        this.state.positions = positions;
        this.updatePositionsCount();

        // ✅ Reset hero PnL when all positions closed
        if (positions.length === 0) {
            this.state.floatingPnl = 0;
            this.renderHero();
        }

        const modal = document.getElementById('positionsModal');
        if (modal && !modal.classList.contains('hidden')) {
            this.updatePositionRows();
        }
    }

    public handleTradeConfirmation(data: WebSocketMessage): void {
        console.log('✅ Trade confirmed:', data);
    }

    // ════════════════════════════════════════
    // UTILITIES
    // ════════════════════════════════════════

    private setText(id: string, value: string): void {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    private formatCurrency(value: number): string {
        return `$${value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    private formatTime(timestamp?: string | number): string {
        if (!timestamp) return '—';
        const d = new Date(timestamp);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    // ════════════════════════════════════════
    // CLEANUP
    // ════════════════════════════════════════

    public destroy(): void {
        console.log('🗑️ Cleaning up Trading Module');

        this.stopTpSlBackgroundUpdate(); // ✅ clear interval

        if (this.boundPriceUpdate)    document.removeEventListener('price-update',     this.boundPriceUpdate);
        if (this.boundSafeModeToggle) document.getElementById('safeModeToggle')?.removeEventListener('click',  this.boundSafeModeToggle);
        if (this.boundSlider)         document.getElementById('lotSlider')?.removeEventListener('input',       this.boundSlider);
        if (this.boundTpToggle)       document.getElementById('tpToggle')?.removeEventListener('click',        this.boundTpToggle);
        if (this.boundSlToggle)       document.getElementById('slToggle')?.removeEventListener('click',        this.boundSlToggle);
        if (this.boundTpInput)        document.getElementById('tpInput')?.removeEventListener('input',         this.boundTpInput);
        if (this.boundSlInput)        document.getElementById('slInput')?.removeEventListener('input',         this.boundSlInput);
        if (this.boundRiskPctInput)   document.getElementById('riskPctInput')?.removeEventListener('input',    this.boundRiskPctInput);
        if (this.boundBuyBtn)         document.getElementById('buyButton')?.removeEventListener('click',       this.boundBuyBtn);
        if (this.boundSellBtn)        document.getElementById('sellButton')?.removeEventListener('click',      this.boundSellBtn);
        if (this.boundCloseAll)       document.getElementById('closeAllBtn')?.removeEventListener('click',     this.boundCloseAll);
        if (this.boundHedge)          document.getElementById('hedgeBtn')?.removeEventListener('click',        this.boundHedge);
        if (this.boundReverse)        document.getElementById('reverseBtn')?.removeEventListener('click',      this.boundReverse);
        if (this.boundOpenPositions)  document.getElementById('openPositionsBtn')?.removeEventListener('click', this.boundOpenPositions);

        this.boundLotPresets.forEach((handler, el)  => el.removeEventListener('click', handler));
        this.boundTpSlPresets.forEach((handler, el) => el.removeEventListener('click', handler));
        this.boundRiskPctBtns.forEach((handler, el) => el.removeEventListener('click', handler));

        this.boundLotPresets.clear();
        this.boundTpSlPresets.clear();
        this.boundRiskPctBtns.clear();
    }
}