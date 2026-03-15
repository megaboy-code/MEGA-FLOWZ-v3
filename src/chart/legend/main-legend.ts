// ================================================================
// 📊 MAIN LEGEND - Symbol, Timeframe, OHLC, Status
// ================================================================

import { getSymbolName, formatPrice } from './utils';
import { ConnectionStatus } from '../chart-types';

const STATUS_COLORS: Record<ConnectionStatus, string> = {
    connected:    '#10b981',
    disconnected: '#ef4444',
    connecting:   '#f59e0b',
    error:        '#dc2626'
};

function injectPulseStyle(): void {
    if (document.getElementById('legend-pulse-style')) return;
    const style = document.createElement('style');
    style.id = 'legend-pulse-style';
    style.textContent = `
        @keyframes legend-pulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.4; }
        }
    `;
    document.head.appendChild(style);
}

export class MainLegend {
    private container:    HTMLElement | null = null;
    private nameEl:       HTMLElement | null = null;
    private timeframeEl:  HTMLElement | null = null;
    private dotEl:        HTMLElement | null = null;
    private arrowEl:      HTMLElement | null = null;
    private arrowWrapper: HTMLElement | null = null;
    private precision:    number = 5;

    private ohlcEls: {
        o: HTMLElement | null;
        h: HTMLElement | null;
        l: HTMLElement | null;
        c: HTMLElement | null;
    } = { o: null, h: null, l: null, c: null };

    public onToggleCollapse: (() => void) | null = null;

    public create(): HTMLElement {
        injectPulseStyle();

        this.container = document.createElement('div');
        this.container.style.cssText = `
            display: flex;
            align-items: center;
            gap: 5px;
            font-family: 'Inter', sans-serif;
            font-size: 11px;
            line-height: 16px;
            height: 16px;
            pointer-events: none;
            user-select: none;
        `;

        // ── Full symbol name ──
        this.nameEl = document.createElement('span');
        this.nameEl.style.cssText = `
            color: var(--text-primary);
            font-weight: 700;
            white-space: nowrap;
        `;

        const sep1 = this.makeSep();

        // ── Timeframe ──
        this.timeframeEl = document.createElement('span');
        this.timeframeEl.style.cssText = `
            color: var(--text-muted);
            font-weight: 700;
            white-space: nowrap;
        `;

        const sep2 = this.makeSep();

        // ── Connection dot ──
        this.dotEl = document.createElement('div');
        this.dotEl.style.cssText = `
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background-color: #ef4444;
            flex-shrink: 0;
        `;

        const sep3 = this.makeSep();

        // ── OHLC ──
        const ohlcO = this.makeOhlcItem('O:');
        const ohlcH = this.makeOhlcItem('H:');
        const ohlcL = this.makeOhlcItem('L:');
        const ohlcC = this.makeOhlcItem('C:');

        this.ohlcEls.o = ohlcO.val;
        this.ohlcEls.h = ohlcH.val;
        this.ohlcEls.l = ohlcL.val;
        this.ohlcEls.c = ohlcC.val;

        // ── Collapse arrow wrapper ──
        this.arrowWrapper = document.createElement('div');
        this.arrowWrapper.style.cssText = `
            width: 20px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            pointer-events: auto;
            cursor: pointer;
            margin-left: 2px;
            overflow: hidden;
        `;

        this.arrowEl = document.createElement('span');
        this.arrowEl.style.cssText = `
            color: var(--text-muted);
            font-size: 30px;
            cursor: pointer;
            pointer-events: auto;
            transition: transform 200ms ease;
            line-height: 1;
            user-select: none;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        this.arrowEl.textContent = '▾';

        this.arrowWrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (this.onToggleCollapse) this.onToggleCollapse();
        });

        this.arrowWrapper.addEventListener('mouseenter', (e) => {
            e.stopPropagation();
        });

        this.arrowWrapper.addEventListener('mouseleave', (e) => {
            e.stopPropagation();
        });

        this.arrowWrapper.appendChild(this.arrowEl);

        // ── Assemble: pair · tf · dot · O H L C · arrow ──
        this.container.appendChild(this.nameEl);
        this.container.appendChild(sep1);
        this.container.appendChild(this.timeframeEl);
        this.container.appendChild(sep2);
        this.container.appendChild(this.dotEl);
        this.container.appendChild(sep3);
        [ohlcO, ohlcH, ohlcL, ohlcC].forEach(({ cell }) => this.container!.appendChild(cell));
        this.container.appendChild(this.arrowWrapper);

        return this.container;
    }

    // ==================== HELPERS ====================

    private makeSep(): HTMLElement {
        const sep = document.createElement('span');
        sep.style.cssText = `
            color: var(--border);
            font-weight: 400;
            flex-shrink: 0;
        `;
        sep.textContent = '·';
        return sep;
    }

    private makeOhlcItem(label: string): { cell: HTMLElement; val: HTMLElement } {
        const cell = document.createElement('span');
        cell.style.cssText = `
            display: inline-flex;
            align-items: baseline;
            gap: 2px;
            margin-right: 1px;
        `;

        const lbl = document.createElement('span');
        lbl.style.cssText = `
            color: var(--text-muted);
            font-size: 9px;
            font-weight: 600;
        `;
        lbl.textContent = label;

        const val = document.createElement('span');
        val.style.cssText = `
            color: var(--text-primary);
            font-weight: 600;
            font-variant-numeric: tabular-nums;
            font-size: 10px;
            white-space: nowrap;
        `;
        val.textContent = '--';

        cell.appendChild(lbl);
        cell.appendChild(val);
        return { cell, val };
    }

    // ==================== PUBLIC UPDATE ====================

    public updateSymbol(symbol: string): void {
        if (this.nameEl) this.nameEl.textContent = getSymbolName(symbol);
    }

    public updateTimeframe(timeframe: string): void {
        if (this.timeframeEl) this.timeframeEl.textContent = timeframe;
    }

    public updatePrecision(precision: number): void {
        this.precision = precision;
    }

    public updateOHLC(
        o: number | null,
        h: number | null,
        l: number | null,
        c: number | null
    ): void {
        // ✅ If all null — crosshair left, keep last known values
        if (o === null && h === null && l === null && c === null) return;

        const fmt = (v: number | null) => v !== null ? formatPrice(v, this.precision) : '--';

        if (this.ohlcEls.o) this.ohlcEls.o.textContent = fmt(o);
        if (this.ohlcEls.h) this.ohlcEls.h.textContent = fmt(h);
        if (this.ohlcEls.l) this.ohlcEls.l.textContent = fmt(l);
        if (this.ohlcEls.c) this.ohlcEls.c.textContent = fmt(c);
    }

    public updateStatus(status: ConnectionStatus): void {
        if (!this.dotEl) return;
        const color = STATUS_COLORS[status] || '#ef4444';
        this.dotEl.style.backgroundColor = color;
        this.dotEl.style.animation = (status === 'connected' || status === 'connecting')
            ? 'legend-pulse 2s ease-in-out infinite'
            : 'none';
    }

    public setCollapsed(collapsed: boolean): void {
        if (!this.arrowEl) return;
        this.arrowEl.style.transform = collapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    }

    // ==================== DESTROY ====================

    public destroy(): void {
        this.container    = null;
        this.nameEl       = null;
        this.timeframeEl  = null;
        this.dotEl        = null;
        this.arrowEl      = null;
        this.arrowWrapper = null;
        this.ohlcEls      = { o: null, h: null, l: null, c: null };
        this.onToggleCollapse = null;
    }
}