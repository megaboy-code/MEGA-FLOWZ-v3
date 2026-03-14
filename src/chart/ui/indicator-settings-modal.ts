// ================================================================
// ⚙️ INDICATOR SETTINGS MODAL
// ================================================================

import { LegendItem } from '../chart-types';
import { getIndicatorConfig, IndicatorFieldConfig } from '../indicator/indicator-configs';

export class IndicatorSettingsModal {
    private modal:    HTMLElement | null = null;
    private item:     LegendItem;
    private settings: Record<string, any> = {};
    private color:    string;

    constructor(item: LegendItem) {
        this.item     = item;
        this.color    = item.color;
        // ✅ Read from settings object — no more ID parsing
        this.settings = item.settings ? { ...item.settings } : this.extractSettingsFallback();
    }

    public open(): void {
        if (document.getElementById('indicator-settings-modal')) return;

        const type   = this.item.id.split('_')[0];
        const config = getIndicatorConfig(type);

        this.modal    = document.createElement('div');
        this.modal.id = 'indicator-settings-modal';
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
            width: 320px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
            z-index: 10001;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        this.modal.appendChild(this.createHeader(config?.name || this.item.name));
        this.modal.appendChild(this.createColorRow());

        if (config) {
            config.fields.forEach(field => {
                const currentValue = this.settings[field.key] ?? field.defaultValue;
                this.modal!.appendChild(this.createField(field, currentValue));
            });
        }

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

    // ==================== SETTINGS FALLBACK ====================

    // ✅ Fallback only if settings not passed in LegendItem
    private extractSettingsFallback(): Record<string, any> {
        const parts    = this.item.id.split('_');
        const settings: Record<string, any> = {};
        if (parts.length >= 2) settings.period = parseInt(parts[1]) || 20;
        if (parts.length >= 3) settings.source = parts[2] || 'close';
        return settings;
    }

    // ==================== HEADER ====================

    private createHeader(title: string): HTMLElement {
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
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
        titleEl.textContent = title;

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

    // ==================== COLOR ROW ====================

    private createColorRow(): HTMLElement {
        const row = document.createElement('div');
        row.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
        `;

        const label = document.createElement('span');
        label.style.cssText = `font-size: 12px; color: #94a3b8;`;
        label.textContent   = 'Color';

        const colorWrap = document.createElement('div');
        colorWrap.style.cssText = `display: flex; align-items: center; gap: 8px;`;

        const preview = document.createElement('div');
        preview.style.cssText = `
            width: 32px;
            height: 24px;
            border-radius: 4px;
            background-color: ${this.color};
            border: 1px solid rgba(148, 163, 184, 0.3);
            cursor: pointer;
        `;

        const input   = document.createElement('input');
        input.type    = 'color';
        input.value   = this.color;
        input.style.cssText = `opacity: 0; width: 0; height: 0; position: absolute;`;

        const hexLabel = document.createElement('span');
        hexLabel.style.cssText = `
            font-size: 11px;
            font-family: 'JetBrains Mono', monospace;
            color: #64748b;
        `;
        hexLabel.textContent = this.color;

        preview.addEventListener('click', () => input.click());
        input.addEventListener('input', (e) => {
            this.color                    = (e.target as HTMLInputElement).value;
            preview.style.backgroundColor = this.color;
            hexLabel.textContent          = this.color;
        });

        colorWrap.appendChild(preview);
        colorWrap.appendChild(input);
        colorWrap.appendChild(hexLabel);

        row.appendChild(label);
        row.appendChild(colorWrap);
        return row;
    }

    // ==================== DYNAMIC FIELDS ====================

    private createField(field: IndicatorFieldConfig, value: any): HTMLElement {
        const row = document.createElement('div');
        row.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
        `;

        const label = document.createElement('span');
        label.style.cssText  = `font-size: 12px; color: #94a3b8;`;
        label.textContent    = field.label;

        let input: HTMLElement;

        if (field.type === 'select' && Array.isArray(field.options)) {
            input = this.createSelect(field, value);
        } else if (field.type === 'checkbox') {
            input = this.createCheckbox(field, value);
        } else {
            input = this.createNumberInput(field, value);
        }

        row.appendChild(label);
        row.appendChild(input);
        return row;
    }

    private createNumberInput(field: IndicatorFieldConfig, value: any): HTMLElement {
        const input   = document.createElement('input');
        input.type    = 'number';
        input.value   = value?.toString() || '';
        input.style.cssText = `
            width: 80px;
            padding: 4px 8px;
            background: rgba(30, 41, 59, 0.8);
            border: 1px solid rgba(148, 163, 184, 0.3);
            border-radius: 4px;
            color: #e2e8f0;
            font-size: 12px;
            text-align: right;
        `;

        if (field.options && !Array.isArray(field.options)) {
            const opts  = field.options as { min: number; max: number; step: number };
            input.min   = opts.min.toString();
            input.max   = opts.max.toString();
            input.step  = opts.step.toString();
        }

        input.addEventListener('change', () => {
            this.settings[field.key] = parseFloat(input.value);
        });

        return input;
    }

    private createSelect(field: IndicatorFieldConfig, value: any): HTMLElement {
        const select = document.createElement('select');
        select.style.cssText = `
            padding: 4px 8px;
            background: rgba(30, 41, 59, 0.8);
            border: 1px solid rgba(148, 163, 184, 0.3);
            border-radius: 4px;
            color: #e2e8f0;
            font-size: 12px;
            cursor: pointer;
        `;

        (field.options as string[]).forEach(opt => {
            const option       = document.createElement('option');
            option.value       = opt;
            option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
            if (opt === value) option.selected = true;
            select.appendChild(option);
        });

        select.addEventListener('change', () => {
            this.settings[field.key] = select.value;
        });

        return select;
    }

    private createCheckbox(field: IndicatorFieldConfig, value: any): HTMLElement {
        const input     = document.createElement('input');
        input.type      = 'checkbox';
        input.checked   = value === true;
        input.style.cssText = `width: 16px; height: 16px; cursor: pointer;`;
        input.addEventListener('change', () => {
            this.settings[field.key] = input.checked;
        });
        return input;
    }

    // ==================== FOOTER ====================

    private createFooter(): HTMLElement {
        const footer = document.createElement('div');
        footer.style.cssText = `
            display: flex;
            gap: 8px;
            margin-top: 20px;
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

        applyBtn.addEventListener('mouseenter', () => applyBtn.style.background = '#2563eb');
        applyBtn.addEventListener('mouseleave', () => applyBtn.style.background = '#3b82f6');

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
        const detail: Record<string, any> = {
            indicatorId: this.item.id
        };

        // ✅ Only include what changed
        if (this.color !== this.item.color) {
            detail.color = this.color;
        }

        if (Object.keys(this.settings).length > 0) {
            detail.settings = { ...this.settings };
        }

        // ✅ Single consolidated event
        document.dispatchEvent(new CustomEvent('indicator-settings-changed', { detail }));
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