// ================================================================
// 🎨 TOOL PROPERTIES MODAL - Floating properties editor
// ================================================================

import {
  PropertyField,
  getSchemaForTool,
  getPropertyValue,
  setPropertyValue,
  saveToolTemplate,
  loadToolTemplate,
  getToolDefaults
} from './tool-schemas';

export class ToolPropertiesModal {
  private modal:        HTMLElement | null = null;
  private modalContent: HTMLElement | null = null;
  private modalHeader:  HTMLElement | null = null;
  private currentTool:  any = null;
  private drawingModule: any = null;

  private isDragging:  boolean = false;
  private dragOffsetX: number  = 0;
  private dragOffsetY: number  = 0;

  private liveColorValues: Record<string, { hex: string; opacity: number }> = {};

  private onToolUpdate?: (toolId: string, updates: any) => void;
  private onToolLock?:   (toolId: string, locked: boolean) => void;
  private onToolDelete?: (toolId: string) => void;

  constructor(
    drawingModule: any,
    callbacks?: {
      onToolUpdate?: (toolId: string, updates: any) => void;
      onToolLock?:   (toolId: string, locked: boolean) => void;
      onToolDelete?: (toolId: string) => void;
    }
  ) {
    this.drawingModule = drawingModule;
    this.onToolUpdate  = callbacks?.onToolUpdate;
    this.onToolLock    = callbacks?.onToolLock;
    this.onToolDelete  = callbacks?.onToolDelete;
    this.injectStyles();
    this.createModal();
  }

  // ==================== STYLES ====================

  private injectStyles(): void {
    if (document.getElementById('tool-modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'tool-modal-styles';
    style.textContent = `
      .tpm-modal {
        position: fixed;
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: 8px;
        width: 300px;
        max-height: 500px;
        box-shadow: var(--card-shadow);
        display: none;
        flex-direction: column;
        color: var(--text-primary);
        font-family: var(--text-sans);
        font-size: var(--text-base);
        z-index: 10001;
      }

      .tpm-modal.tpm-visible {
        display: flex;
      }

      .tpm-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 12px;
        background: var(--bg-card);
        border-bottom: 1px solid var(--border);
        border-radius: 8px 8px 0 0;
        cursor: move;
        user-select: none;
        flex-shrink: 0;
      }

      .tpm-header-title {
        margin: 0;
        font-size: var(--text-md);
        font-weight: 600;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .tpm-header-title i {
        color: var(--accent-info);
        font-size: var(--text-base);
      }

      .tpm-close {
        background: none;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        font-size: var(--text-md);
        padding: 2px 6px;
        border-radius: 4px;
        transition: color 0.15s, background 0.15s;
        line-height: 1;
      }

      .tpm-close:hover {
        color: var(--text-primary);
        background: var(--bg-hover);
      }

      .tpm-content {
        padding: 10px 12px;
        overflow-y: auto;
        flex: 1;
      }

      .tpm-section {
        margin-bottom: 14px;
      }

      .tpm-section-title {
        font-size: var(--text-xs);
        color: var(--text-muted);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
        padding-bottom: 4px;
        border-bottom: 1px solid var(--border);
      }

      .tpm-field {
        margin-bottom: 10px;
      }

      .tpm-label {
        display: block;
        font-size: var(--text-xs);
        color: var(--text-secondary);
        margin-bottom: 4px;
      }

      .tpm-input,
      .tpm-select,
      .tpm-textarea {
        width: 100%;
        padding: 6px 8px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 4px;
        color: var(--text-primary);
        font-size: var(--text-sm);
        font-family: var(--text-sans);
        transition: border-color 0.15s;
        box-sizing: border-box;
      }

      .tpm-input:focus,
      .tpm-select:focus,
      .tpm-textarea:focus {
        outline: none;
        border-color: var(--accent-info);
      }

      .tpm-textarea { resize: vertical; }

      .tpm-range-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .tpm-range-wrap input[type="range"] {
        flex: 1;
        accent-color: var(--accent-info);
      }

      .tpm-range-value {
        min-width: 36px;
        font-size: var(--text-xs);
        color: var(--text-muted);
        text-align: right;
        font-family: var(--text-mono);
      }

      .tpm-checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: var(--text-sm);
        color: var(--text-secondary);
        cursor: pointer;
      }

      .tpm-checkbox-label input[type="checkbox"] {
        width: 14px;
        height: 14px;
        cursor: pointer;
        accent-color: var(--accent-info);
        flex-shrink: 0;
      }

      .tpm-color-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .tpm-color-swatch {
        width: 32px;
        height: 22px;
        border-radius: 4px;
        border: 1px solid var(--border);
        cursor: pointer;
        flex-shrink: 0;
        transition: border-color 0.15s;
      }

      .tpm-color-swatch:hover {
        border-color: var(--accent-info);
      }

      .tpm-color-opacity {
        font-size: var(--text-xs);
        color: var(--text-muted);
        margin-left: auto;
        font-family: var(--text-mono);
      }

      .tpm-footer {
        display: flex;
        gap: 6px;
        padding: 10px 12px;
        background: var(--bg-card);
        border-top: 1px solid var(--border);
        border-radius: 0 0 8px 8px;
        flex-shrink: 0;
        flex-wrap: wrap;
      }

      .tpm-btn {
        padding: 6px 10px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: var(--text-xs);
        font-family: var(--text-sans);
        display: flex;
        align-items: center;
        gap: 4px;
        transition: filter 0.15s, opacity 0.15s;
        color: var(--text-primary);
        font-weight: 500;
      }

      .tpm-btn:hover    { filter: brightness(1.15); }
      .tpm-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        filter: none;
      }

      .tpm-btn-lock {
        flex: 1;
        justify-content: center;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        color: var(--text-secondary);
      }

      .tpm-btn-lock.locked {
        background: rgba(var(--accent-buy-rgb), 0.12);
        border-color: rgba(var(--accent-buy-rgb), 0.3);
        color: var(--accent-buy);
      }

      .tpm-btn-delete {
        background: rgba(var(--accent-sell-rgb), 0.15);
        color: var(--accent-sell);
        border: 1px solid rgba(var(--accent-sell-rgb), 0.3);
      }

      .tpm-btn-reset {
        background: rgba(var(--accent-warn-rgb), 0.15);
        color: var(--accent-warning);
        border: 1px solid rgba(var(--accent-warn-rgb), 0.3);
      }

      .tpm-btn-apply {
        background: rgba(var(--accent-info-rgb), 0.15);
        color: var(--accent-info);
        border: 1px solid rgba(var(--accent-info-rgb), 0.3);
      }

      .tpm-fib-wrap {
        max-height: 160px;
        overflow-y: auto;
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 6px;
        background: var(--bg-card);
      }

      .tpm-fib-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
        padding: 5px 6px;
        background: var(--bg-elevated);
        border-radius: 4px;
      }

      .tpm-fib-coeff {
        min-width: 40px;
        font-size: var(--text-xs);
        color: var(--text-muted);
        font-family: var(--text-mono);
      }

      .tpm-fib-opacity {
        min-width: 32px;
        font-size: var(--text-xs);
        color: var(--text-muted);
        text-align: right;
        font-family: var(--text-mono);
      }

      .tpm-no-schema {
        text-align: center;
        padding: 30px 20px;
        color: var(--text-muted);
      }

      .tpm-no-schema i {
        font-size: 1.5rem;
        margin-bottom: 10px;
        display: block;
        color: var(--accent-warning);
      }
    `;

    document.head.appendChild(style);
  }

  // ==================== MODAL CREATION ====================

  private createModal(): void {
    this.modal = document.createElement('div');
    this.modal.className = 'tpm-modal';

    // Header
    this.modalHeader = document.createElement('div');
    this.modalHeader.className = 'tpm-header';

    const title = document.createElement('h3');
    title.className = 'tpm-header-title';
    title.innerHTML = `<i class="fas fa-sliders-h"></i><span id="tpmTitle">Properties</span>`;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tpm-close';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.addEventListener('click', () => this.hide());

    this.modalHeader.appendChild(title);
    this.modalHeader.appendChild(closeBtn);

    // Content
    this.modalContent = document.createElement('div');
    this.modalContent.className = 'tpm-content';

    // Footer — Lock, Delete, Reset, Apply only
    const footer = document.createElement('div');
    footer.className = 'tpm-footer';

    const lockBtn   = this.makeBtn('tpmLockBtn',  '<i class="fas fa-lock"></i> Lock',    'tpm-btn tpm-btn-lock');
    const deleteBtn = this.makeBtn('tpmDeleteBtn', '<i class="fas fa-trash"></i> Delete', 'tpm-btn tpm-btn-delete');
    const resetBtn  = this.makeBtn('tpmResetBtn',  '<i class="fas fa-undo"></i> Reset',  'tpm-btn tpm-btn-reset');
    const applyBtn  = this.makeBtn('tpmApplyBtn',  '<i class="fas fa-check"></i> Apply', 'tpm-btn tpm-btn-apply');

    lockBtn.addEventListener('click',   () => this.toggleLock());
    deleteBtn.addEventListener('click', () => this.deleteTool());
    resetBtn.addEventListener('click',  () => this.resetToDefaults());
    applyBtn.addEventListener('click',  () => this.applyChanges());

    footer.appendChild(lockBtn);
    footer.appendChild(deleteBtn);
    footer.appendChild(resetBtn);
    footer.appendChild(applyBtn);

    this.modal.appendChild(this.modalHeader);
    this.modal.appendChild(this.modalContent);
    this.modal.appendChild(footer);

    document.body.appendChild(this.modal);
    this.setupDragging();
  }

  private makeBtn(id: string, html: string, className: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.id        = id;
    btn.className = className;
    btn.innerHTML = html;
    return btn;
  }

  // ==================== DRAGGING ====================

  private setupDragging(): void {
    if (!this.modalHeader || !this.modal) return;

    this.modalHeader.addEventListener('mousedown', (e: MouseEvent) => {
      this.isDragging  = true;
      const rect       = this.modal!.getBoundingClientRect();
      this.dragOffsetX = e.clientX - rect.left;
      this.dragOffsetY = e.clientY - rect.top;
      document.body.style.cursor = 'move';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isDragging || !this.modal) return;
      const x    = e.clientX - this.dragOffsetX;
      const y    = e.clientY - this.dragOffsetY;
      const maxX = window.innerWidth  - this.modal.offsetWidth;
      const maxY = window.innerHeight - this.modal.offsetHeight;
      this.modal.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
      this.modal.style.top  = `${Math.max(0, Math.min(y, maxY))}px`;
    });

    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        document.body.style.cursor = '';
      }
    });
  }

  // ==================== SHOW / HIDE ====================

  public show(tool: any): void {
    if (!this.modal || !this.modalContent || !tool) return;

    const toolType = tool.toolType;

    // ✅ Merge saved template silently
    const savedTemplate = loadToolTemplate(toolType);
    if (savedTemplate) {
      tool = {
        ...tool,
        options: this.deepMerge(savedTemplate, tool.options || {})
      };
    }

    this.currentTool     = tool;
    this.liveColorValues = {};

    // Title — tool name only, no ID
    const schema  = getSchemaForTool(toolType);
    const titleEl = this.modal.querySelector('#tpmTitle');
    if (titleEl) {
      titleEl.textContent = schema
        ? `${schema.displayName} Properties`
        : `${toolType} Properties`;
    }

    if (!this.modal.style.left) this.centerModal();

    this.modal.classList.add('tpm-visible');
    this.renderProperties(tool);
    this.updateLockButton(tool);
    this.updateDeleteButton(tool);
  }

  public hide(): void {
    if (!this.modal) return;
    this.modal.classList.remove('tpm-visible');
    this.currentTool     = null;
    this.liveColorValues = {};
  }

  private centerModal(): void {
    if (!this.modal) return;
    requestAnimationFrame(() => {
      if (!this.modal) return;
      const w = this.modal.offsetWidth  || 300;
      const h = this.modal.offsetHeight || 400;
      this.modal.style.left = `${Math.max(0, (window.innerWidth  - w) / 2)}px`;
      this.modal.style.top  = `${Math.max(0, (window.innerHeight - h) / 2)}px`;
    });
  }

  // ==================== COLOR HELPERS ====================

  private parseRgba(rgba: string): { hex: string; opacity: number } {
    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      const r   = parseInt(match[1]);
      const g   = parseInt(match[2]);
      const b   = parseInt(match[3]);
      const a   = match[4] ? parseFloat(match[4]) : 1;
      const hex = `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
      return { hex, opacity: a };
    }
    if (rgba.startsWith('#')) return { hex: rgba, opacity: 1 };
    return { hex: '#3b82f6', opacity: 1 };
  }

  private hexToRgba(hex: string, opacity: number): string {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  private deepMerge(base: any, override: any): any {
    const result = { ...base };
    for (const key of Object.keys(override)) {
      if (
        override[key] &&
        typeof override[key] === 'object' &&
        !Array.isArray(override[key]) &&
        base[key] &&
        typeof base[key] === 'object'
      ) {
        result[key] = this.deepMerge(base[key], override[key]);
      } else {
        result[key] = override[key];
      }
    }
    return result;
  }

  // ==================== RENDER ====================

  private async renderProperties(tool: any): Promise<void> {
    if (!this.modalContent) return;

    const toolType = tool.toolType;
    const schema   = getSchemaForTool(toolType);

    if (!schema) {
      this.modalContent.innerHTML = `
        <div class="tpm-no-schema">
          <i class="fas fa-exclamation-triangle"></i>
          <p>No schema available for ${toolType}</p>
        </div>
      `;
      return;
    }

    // Group into sections
    const sections: Record<string, PropertyField[]> = {};
    schema.properties.forEach(prop => {
      const s = prop.section || 'General';
      if (!sections[s]) sections[s] = [];
      sections[s].push(prop);
    });

    let html = '';
    for (const [sectionName, properties] of Object.entries(sections)) {
      html += `
        <div class="tpm-section">
          <div class="tpm-section-title">${sectionName}</div>
          ${properties.map(prop => this.renderField(prop, tool)).join('')}
        </div>
      `;
    }

    this.modalContent.innerHTML = html;
    this.attachRangeListeners(schema.properties);
    this.attachFibListeners();
    await this.attachColorListeners(schema.properties);
  }

  private renderField(prop: PropertyField, tool: any): string {
    const currentValue = getPropertyValue(tool.options, prop.key);
    const value        = currentValue !== undefined ? currentValue : prop.defaultValue;

    const rgbaFields = [
      'rectangle.background.color', 'circle.background.color',
      'triangle.background.color',  'text.box.background.color',
      'entryStopLossRectangle.background.color',
      'entryPtRectangle.background.color'
    ];

    switch (prop.type) {
      case 'color': {
        const isRgba = rgbaFields.includes(prop.key) && typeof value === 'string';
        const parsed = isRgba
          ? this.parseRgba(value)
          : {
              hex:     typeof value === 'string' && value.startsWith('rgba')
                         ? this.parseRgba(value).hex
                         : (value || '#3b82f6'),
              opacity: 1
            };

        this.liveColorValues[prop.key] = { hex: parsed.hex, opacity: parsed.opacity };

        return `
          <div class="tpm-field">
            <label class="tpm-label">${prop.label}</label>
            <div class="tpm-color-row">
              <button
                class="tpm-color-swatch"
                data-property="${prop.key}"
                data-is-rgba="${isRgba}"
                style="background: ${parsed.hex};"
              ></button>
              ${isRgba
                ? `<span data-color-opacity="${prop.key}" class="tpm-color-opacity">${Math.round(parsed.opacity * 100)}%</span>`
                : ''
              }
            </div>
          </div>
        `;
      }

      case 'range': {
        const v = value !== undefined ? value : (prop.defaultValue || prop.min || 0);
        return `
          <div class="tpm-field">
            <label class="tpm-label">${prop.label}</label>
            <div class="tpm-range-wrap">
              <input type="range"
                data-property="${prop.key}"
                min="${prop.min || 0}"
                max="${prop.max || 100}"
                step="${prop.step || 1}"
                value="${v}"
              />
              <span data-property-value="${prop.key}" class="tpm-range-value">
                ${v}${prop.key.includes('opacity') ? '' : 'px'}
              </span>
            </div>
          </div>
        `;
      }

      case 'select':
        return `
          <div class="tpm-field">
            <label class="tpm-label">${prop.label}</label>
            <select data-property="${prop.key}" class="tpm-select">
              ${prop.options?.map(opt =>
                `<option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>${opt.label}</option>`
              ).join('')}
            </select>
          </div>
        `;

      case 'checkbox':
        return `
          <div class="tpm-field">
            <label class="tpm-checkbox-label">
              <input type="checkbox" data-property="${prop.key}" ${value ? 'checked' : ''} />
              ${prop.label}
            </label>
          </div>
        `;

      case 'text':
        return `
          <div class="tpm-field">
            <label class="tpm-label">${prop.label}</label>
            <input type="text" data-property="${prop.key}" value="${value || ''}" class="tpm-input" />
          </div>
        `;

      case 'textarea':
        return `
          <div class="tpm-field">
            <label class="tpm-label">${prop.label}</label>
            <textarea data-property="${prop.key}" rows="3" class="tpm-textarea">${value || ''}</textarea>
          </div>
        `;

      case 'levelArray':
        return this.renderFibLevels(tool);

      default:
        return '';
    }
  }

  private renderFibLevels(tool: any): string {
    const levels = tool.options?.levels || [];
    let html = `
      <div class="tpm-field">
        <label class="tpm-label">Fibonacci Levels</label>
        <div class="tpm-fib-wrap">
    `;
    levels.forEach((level: any, index: number) => {
      this.liveColorValues[`fib_${index}`] = { hex: level.color, opacity: level.opacity };
      html += `
        <div class="tpm-fib-row">
          <span class="tpm-fib-coeff">${level.coeff}</span>
          <button
            class="tpm-color-swatch"
            data-fib-level="${index}"
            style="width: 26px; height: 18px; background: ${level.color};"
          ></button>
          <input
            type="range"
            data-fib-level="${index}"
            data-fib-property="opacity"
            min="0" max="1" step="0.1"
            value="${level.opacity}"
            style="flex: 1; accent-color: var(--accent-info);"
          />
          <span data-fib-opacity="${index}" class="tpm-fib-opacity">
            ${(level.opacity * 100).toFixed(0)}%
          </span>
        </div>
      `;
    });
    html += `</div></div>`;
    return html;
  }

  // ==================== LISTENERS ====================

  private attachRangeListeners(properties: PropertyField[]): void {
    if (!this.modalContent) return;
    properties.forEach(prop => {
      if (prop.type !== 'range') return;
      const input = this.modalContent!.querySelector(`[data-property="${prop.key}"]`) as HTMLInputElement;
      if (!input) return;
      input.addEventListener('input', () => {
        const display = this.modalContent!.querySelector(`[data-property-value="${prop.key}"]`);
        if (display) {
          display.textContent = `${input.value}${prop.key.includes('opacity') ? '' : 'px'}`;
        }
      });
    });
  }

  private attachFibListeners(): void {
    if (!this.modalContent) return;
    this.modalContent.querySelectorAll('[data-fib-level][data-fib-property="opacity"]').forEach(input => {
      input.addEventListener('input', (e) => {
        const target  = e.target as HTMLInputElement;
        const index   = target.getAttribute('data-fib-level');
        const display = this.modalContent!.querySelector(`[data-fib-opacity="${index}"]`);
        if (display) display.textContent = `${(parseFloat(target.value) * 100).toFixed(0)}%`;
        if (index !== null) {
          if (!this.liveColorValues[`fib_${index}`]) {
            this.liveColorValues[`fib_${index}`] = { hex: '#ffffff', opacity: 1 };
          }
          this.liveColorValues[`fib_${index}`].opacity = parseFloat(target.value);
        }
      });
    });
  }

  private async attachColorListeners(properties: PropertyField[]): Promise<void> {
    if (!this.modalContent) return;
    const { ColorPicker } = await import('../../../core/color-picker');

    // Standard color swatches
    this.modalContent.querySelectorAll('.tpm-color-swatch[data-property]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const button  = btn as HTMLElement;
        const propKey = button.dataset.property!;
        const isRgba  = button.dataset.isRgba === 'true';
        const current = this.liveColorValues[propKey] || { hex: '#3b82f6', opacity: 1 };

        const picker = new ColorPicker({
          color:   current.hex,
          opacity: isRgba ? current.opacity : 1,
          onChange: (hex: string, opacity: number) => {
            this.liveColorValues[propKey] = { hex, opacity };
            button.style.background = hex;
            const opLabel = this.modalContent?.querySelector(`[data-color-opacity="${propKey}"]`);
            if (opLabel) opLabel.textContent = `${Math.round(opacity * 100)}%`;
          }
        });
        picker.open(button);
      });
    });

    // Fib color swatches
    this.modalContent.querySelectorAll('.tpm-color-swatch[data-fib-level]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const button  = btn as HTMLElement;
        const index   = button.dataset.fibLevel!;
        const current = this.liveColorValues[`fib_${index}`] || { hex: '#ffffff', opacity: 1 };

        const picker = new ColorPicker({
          color:   current.hex,
          opacity: current.opacity,
          onChange: (hex: string) => {
            this.liveColorValues[`fib_${index}`] = {
              ...this.liveColorValues[`fib_${index}`],
              hex
            };
            button.style.background = hex;
          }
        });
        picker.open(button);
      });
    });
  }

  // ==================== APPLY ====================

  private applyChanges(): void {
    if (!this.currentTool || !this.modalContent) return;

    const toolId   = this.currentTool.id;
    const toolType = this.currentTool.toolType;
    const schema   = getSchemaForTool(toolType);
    if (!schema) return;

    const updates: any = {};

    const rgbaFields = [
      'rectangle.background.color', 'circle.background.color',
      'triangle.background.color',  'text.box.background.color',
      'entryStopLossRectangle.background.color',
      'entryPtRectangle.background.color'
    ];

    // Non-color fields
    schema.properties.forEach(prop => {
      if (prop.type === 'levelArray' || prop.type === 'color') return;
      const input = this.modalContent!.querySelector(`[data-property="${prop.key}"]`) as HTMLInputElement;
      if (!input) return;
      let value: any;
      if      (prop.type === 'checkbox') value = input.checked;
      else if (prop.type === 'range' || prop.type === 'number') value = parseFloat(input.value);
      else if (prop.type === 'select')   value = parseInt(input.value);
      else                               value = input.value;
      setPropertyValue(updates, prop.key, value);
    });

    // Color fields
    schema.properties.forEach(prop => {
      if (prop.type !== 'color') return;
      const live   = this.liveColorValues[prop.key];
      if (!live) return;
      const isRgba = rgbaFields.includes(prop.key);
      setPropertyValue(
        updates,
        prop.key,
        isRgba ? this.hexToRgba(live.hex, live.opacity) : live.hex
      );
    });

    // Fib levels
    if (toolType === 'FibRetracement') {
      const levels = [...(this.currentTool.options?.levels || [])];
      this.modalContent.querySelectorAll('[data-fib-level][data-fib-property="opacity"]').forEach((input: any) => {
        const index = parseInt(input.getAttribute('data-fib-level'));
        if (levels[index]) levels[index].opacity = parseFloat(input.value);
      });
      Object.keys(this.liveColorValues).forEach(key => {
        if (!key.startsWith('fib_')) return;
        const index = parseInt(key.replace('fib_', ''));
        if (levels[index]) levels[index].color = this.liveColorValues[key].hex;
      });
      updates.levels = levels;
    }

    // ✅ Pass to drawing-toolbar which handles applyLineToolOptions correctly
    if (this.onToolUpdate) this.onToolUpdate(toolId, updates);
  }

  // ==================== ACTIONS ====================

  private toggleLock(): void {
    if (!this.currentTool) return;
    const newLocked = !(this.currentTool.options?.locked || false);
    if (this.onToolLock) this.onToolLock(this.currentTool.id, newLocked);
    this.currentTool.options         = this.currentTool.options || {};
    this.currentTool.options.locked  = newLocked;
    this.updateLockButton(this.currentTool);
    this.updateDeleteButton(this.currentTool);
  }

  private deleteTool(): void {
    if (!this.currentTool) return;
    if (this.currentTool.options?.locked) return;
    if (confirm('Delete this tool?')) {
      if (this.onToolDelete) this.onToolDelete(this.currentTool.id);
      this.hide();
    }
  }

  private resetToDefaults(): void {
    if (!this.currentTool) return;
    const toolId   = this.currentTool.id;
    const toolType = this.currentTool.toolType;
    if (confirm('Reset to default settings?')) {
      const defaults = getToolDefaults(toolType);
      if (this.onToolUpdate) this.onToolUpdate(toolId, defaults);
      setTimeout(() => {
        if (this.drawingModule && typeof this.drawingModule.getLineToolByID === 'function') {
          try {
            const json = this.drawingModule.getLineToolByID(toolId);
            if (json) {
              const parsed = JSON.parse(json);
              if (Array.isArray(parsed) && parsed.length > 0) {
                this.currentTool = parsed[0];
                this.renderProperties(this.currentTool);
              }
            }
          } catch (e) {}
        }
      }, 100);
    }
  }

  private updateLockButton(tool: any): void {
    const btn = this.modal?.querySelector('#tpmLockBtn') as HTMLButtonElement;
    if (!btn) return;
    const isLocked = tool.options?.locked || false;
    btn.innerHTML  = isLocked
      ? '<i class="fas fa-unlock"></i> Unlock'
      : '<i class="fas fa-lock"></i> Lock';
    btn.classList.toggle('locked', isLocked);
  }

  private updateDeleteButton(tool: any): void {
    const btn = this.modal?.querySelector('#tpmDeleteBtn') as HTMLButtonElement;
    if (!btn) return;
    const isLocked    = tool.options?.locked || false;
    btn.disabled      = isLocked;
    btn.style.opacity = isLocked ? '0.4' : '1';
    btn.style.cursor  = isLocked ? 'not-allowed' : 'pointer';
  }

  public destroy(): void {
    if (this.modal?.parentNode) this.modal.parentNode.removeChild(this.modal);
    this.modal        = null;
    this.modalContent = null;
    this.modalHeader  = null;
    this.currentTool  = null;
    this.liveColorValues = {};
  }
}