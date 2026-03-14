// ================================================================
// ⚙️ STRATEGY SETTINGS MODAL
// ================================================================

import { LegendItem } from '../chart-types';

export class StrategySettingsModal {
    private modal:      HTMLElement | null = null;
    private item:       LegendItem;
    private fastColor:  string;
    private slowColor:  string;

    constructor(item: LegendItem) {
        this.item      = item;
        this.fastColor = item.values[0]?.color || '#00d394';
        this.slowColor = item.values[1]?.color || '#ff4d6b';
    }

    public open(): void {
        if (document.getElementById('strategy-settings-modal')) return;

        this.modal    = document.createElement('div');
        this.modal.id = 'strategy-settings-modal';
        this.modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(15, 23, 42, 0.98);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(148, 163, 184, 0.3);
            border-radius: 8px;
            padding: 20px;
            width: 280px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
            z-index: 10001;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        this.modal.appendChild(this.createHeader());
        this.modal.appendChild(this.createNameLabel());
        this.modal.appendChild(this.createColorSection());
        this.modal.appendChild(this.createFooter());

        document.body.appendChild(this.modal);
        this.setupCloseOnOutsideClick();
    }

    public close(): void {
        if (this.modal && document.body.contains(this.modal)) {
            document.body.removeChild(this.modal);
        }
        this.modal = null;
    }

    // ==================== HEADER ====================

    private createHeader(): HTMLElement {
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid rgba(148, 163, 184, 0.2);
        `;

        const titleEl = document.createElement('h3');
        titleEl.style.cssText = `
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: #e2e8f0;
        `;
        titleEl.textContent = 'Strategy Settings';

        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: #94a3b8;
            cursor: pointer;
            font-size: 16px;
            padding: 0;
            line-height: 1;
        `;
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', () => this.close());

        header.appendChild(titleEl);
        header.appendChild(closeBtn);
        return header;
    }

    // ==================== NAME LABEL ====================

    private createNameLabel(): HTMLElement {
        const label = document.createElement('div');
        label.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 16px;
            font-size: 11px;
            color: #94a3b8;
        `;

        const icon      = document.createElement('i');
        icon.className  = 'fas fa-robot';
        icon.style.color = this.fastColor;

        const name      = document.createElement('span');
        name.textContent = this.item.name;

        label.appendChild(icon);
        label.appendChild(name);
        return label;
    }

    // ==================== COLOR SECTION ====================

    private createColorSection(): HTMLElement {
        const section = document.createElement('div');
        section.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 20px;
        `;

        section.appendChild(
            this.createColorRow('Fast Line', this.fastColor, (color) => {
                this.fastColor = color;
            })
        );

        section.appendChild(
            this.createColorRow('Slow Line', this.slowColor, (color) => {
                this.slowColor = color;
            })
        );

        return section;
    }

    private createColorRow(
        label:        string,
        defaultColor: string,
        onChange:     (color: string) => void
    ): HTMLElement {
        const row = document.createElement('div');
        row.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
        `;

        const labelEl       = document.createElement('span');
        labelEl.style.cssText = `font-size: 12px; color: #94a3b8;`;
        labelEl.textContent  = label;

        const colorWrap = document.createElement('div');
        colorWrap.style.cssText = `display: flex; align-items: center; gap: 8px;`;

        const preview = document.createElement('div');
        preview.style.cssText = `
            width: 32px;
            height: 24px;
            border-radius: 4px;
            background-color: ${defaultColor};
            border: 1px solid rgba(148, 163, 184, 0.3);
            cursor: pointer;
            transition: border-color 150ms ease;
        `;

        const input   = document.createElement('input');
        input.type    = 'color';
        input.value   = defaultColor;
        input.style.cssText = `opacity: 0; width: 0; height: 0; position: absolute;`;

        const hexLabel = document.createElement('span');
        hexLabel.style.cssText = `
            font-size: 11px;
            font-family: 'JetBrains Mono', monospace;
            color: #64748b;
            min-width: 56px;
        `;
        hexLabel.textContent = defaultColor;

        preview.addEventListener('click', () => input.click());
        preview.addEventListener('mouseenter', () => {
            preview.style.borderColor = 'rgba(148, 163, 184, 0.6)';
        });
        preview.addEventListener('mouseleave', () => {
            preview.style.borderColor = 'rgba(148, 163, 184, 0.3)';
        });

        input.addEventListener('input', (e) => {
            const color                   = (e.target as HTMLInputElement).value;
            preview.style.backgroundColor = color;
            hexLabel.textContent          = color;
            onChange(color);
        });

        colorWrap.appendChild(preview);
        colorWrap.appendChild(input);
        colorWrap.appendChild(hexLabel);

        row.appendChild(labelEl);
        row.appendChild(colorWrap);
        return row;
    }

    // ==================== FOOTER ====================

    private createFooter(): HTMLElement {
        const footer = document.createElement('div');
        footer.style.cssText = `
            display: flex;
            gap: 8px;
            padding-top: 12px;
            border-top: 1px solid rgba(148, 163, 184, 0.2);
        `;

        const cancelBtn       = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            flex: 1;
            padding: 8px;
            background: transparent;
            border: 1px solid rgba(148, 163, 184, 0.2);
            border-radius: 4px;
            color: #94a3b8;
            font-size: 12px;
            cursor: pointer;
            transition: all 150ms ease;
        `;
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.background = 'rgba(148, 163, 184, 0.05)';
            cancelBtn.style.color      = '#e2e8f0';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.background = 'transparent';
            cancelBtn.style.color      = '#94a3b8';
        });
        cancelBtn.addEventListener('click', () => this.close());

        const applyBtn       = document.createElement('button');
        applyBtn.textContent = 'Apply';
        applyBtn.style.cssText = `
            flex: 1;
            padding: 8px;
            background: #3b82f6;
            border: 1px solid #3b82f6;
            border-radius: 4px;
            color: white;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 150ms ease;
        `;
        applyBtn.addEventListener('mouseenter', () => {
            applyBtn.style.background   = '#2563eb';
            applyBtn.style.borderColor  = '#2563eb';
        });
        applyBtn.addEventListener('mouseleave', () => {
            applyBtn.style.background   = '#3b82f6';
            applyBtn.style.borderColor  = '#3b82f6';
        });

        applyBtn.addEventListener('click', () => {
            this.applySettings();
            this.close();
        });

        footer.appendChild(cancelBtn);
        footer.appendChild(applyBtn);
        return footer;
    }

    // ==================== APPLY ====================

    private applySettings(): void {
        // ✅ Single consolidated event — replaces 'strategy-color-change'
        document.dispatchEvent(new CustomEvent('strategy-settings-changed', {
            detail: {
                strategyId: this.item.id,
                fastColor:  this.fastColor,
                slowColor:  this.slowColor
            }
        }));
    }

    // ==================== OUTSIDE CLICK ====================

    private setupCloseOnOutsideClick(): void {
        setTimeout(() => {
            const handler = (e: MouseEvent) => {
                if (this.modal && !this.modal.contains(e.target as Node)) {
                    this.close();
                    document.removeEventListener('click', handler);
                }
            };
            document.addEventListener('click', handler);
        }, 100);
    }
}