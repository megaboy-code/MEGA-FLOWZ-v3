// ================================================================
// 🎨 TOOL PROPERTIES MODAL - Floating properties editor
// ================================================================
import {
  getSchemaForTool,
  getPropertyValue,
  setPropertyValue,
  saveToolTemplate,
  loadToolTemplate,
  ToolSchema,
  PropertyField
} from './tool-schemas';

// ==================== NAMED TEMPLATE STORAGE ====================

const NAMED_TEMPLATES_KEY = 'drawing_tool_named_templates';

function loadNamedTemplates(toolType: string): Record<string, any> {
  try {
    const all = JSON.parse(localStorage.getItem(NAMED_TEMPLATES_KEY) || '{}');
    return all[toolType] || {};
  } catch { return {}; }
}

function saveNamedTemplate(toolType: string, name: string, options: any): void {
  try {
    const all = JSON.parse(localStorage.getItem(NAMED_TEMPLATES_KEY) || '{}');
    if (!all[toolType]) all[toolType] = {};
    all[toolType][name] = JSON.parse(JSON.stringify(options));
    localStorage.setItem(NAMED_TEMPLATES_KEY, JSON.stringify(all));
  } catch {}
}

function deleteNamedTemplate(toolType: string, name: string): void {
  try {
    const all = JSON.parse(localStorage.getItem(NAMED_TEMPLATES_KEY) || '{}');
    if (all[toolType]) {
      delete all[toolType][name];
      localStorage.setItem(NAMED_TEMPLATES_KEY, JSON.stringify(all));
    }
  } catch {}
}

export class ToolPropertiesModal {
  private modal:         HTMLElement | null = null;
  private currentTool:   any = null;
  private drawingModule: any = null;

  private isDragging:  boolean = false;
  private dragOffsetX: number  = 0;
  private dragOffsetY: number  = 0;

  private activeTab:    string             = 'style';
  private openDropdown: HTMLElement | null = null;

  private liveColorValues: Record<string, { hex: string; opacity: number }> = {};

  private onToolUpdate?: (toolId: string, updates: any) => void;
  private onToolLock?:   (toolId: string, locked: boolean) => void;
  private onToolDelete?: (toolId: string) => void;
  private onClose?:      () => void;

  constructor(
    drawingModule: any,
    callbacks?: {
      onToolUpdate?: (toolId: string, updates: any) => void;
      onToolLock?:   (toolId: string, locked: boolean) => void;
      onToolDelete?: (toolId: string) => void;
      onClose?:      () => void;
    }
  ) {
    this.drawingModule = drawingModule;
    this.onToolUpdate  = callbacks?.onToolUpdate;
    this.onToolLock    = callbacks?.onToolLock;
    this.onToolDelete  = callbacks?.onToolDelete;
    this.onClose       = callbacks?.onClose;
  }

  // ==================== SHOW / HIDE ====================

  public show(tool: any): void {
    if (!tool) return;

    const toolType = tool.toolType;

    const savedTemplate = loadToolTemplate(toolType);
    if (savedTemplate) {
      tool = {
        ...tool,
        options: this.deepMerge(savedTemplate, tool.options || {})
      };
    }

    this.currentTool     = tool;
    this.activeTab       = 'style';
    this.liveColorValues = {};

    if (this.modal) this.destroyModal();
    this.buildModal(tool);
    this.centerModal();

    setTimeout(() => {
      document.addEventListener('mousedown', this.handleOutsideClick);
    }, 0);
  }

  public hide(): void {
    document.removeEventListener('mousedown', this.handleOutsideClick);
    this.destroyModal();
    this.currentTool     = null;
    this.liveColorValues = {};
    this.onClose?.();
  }

  private destroyModal(): void {
    if (this.modal && document.body.contains(this.modal)) {
      document.body.removeChild(this.modal);
    }
    this.modal        = null;
    this.openDropdown = null;
  }

  // ==================== BUILD MODAL ====================

  private buildModal(tool: any): void {
    const schema    = getSchemaForTool(tool.toolType);
    const hasText   = schema?.properties.some(p => p.tab === 'text');
    const hasCoords = tool.points && tool.points.length > 0;

    this.modal = document.createElement('div');
    this.modal.className = 'tpm-modal';

    this.modal.innerHTML = `
      <div class="tpm-header" id="tpmHeader">
        <div class="tpm-title">${schema?.displayName || tool.toolType} Properties</div>
        <button class="tpm-close" id="tpmClose">✕</button>
      </div>

      <div class="tpm-tabs">
        <button class="tpm-tab active" data-tab="style">Style</button>
        ${hasText   ? `<button class="tpm-tab" data-tab="text">Text</button>`          : ''}
        ${hasCoords ? `<button class="tpm-tab" data-tab="coords">Coordinates</button>` : ''}
      </div>

      <div class="tpm-content">
        <div class="tpm-panel active" id="panel-style">
          ${this.buildStylePanel(tool, schema)}
        </div>
        ${hasText ? `
        <div class="tpm-panel" id="panel-text">
          ${this.buildTextPanel(tool, schema)}
        </div>` : ''}
        ${hasCoords ? `
        <div class="tpm-panel" id="panel-coords">
          ${this.buildCoordsPanel(tool)}
        </div>` : ''}
      </div>

      <div class="tpm-footer">
        <div class="tpm-footer-left">
          <div class="tpm-template-wrap">
            <button class="tpm-btn tpm-btn-template" id="tpmTemplateBtn">
              Template <span class="tpm-chevron">▼</span>
            </button>
            <div class="tpm-template-menu" id="tpmTemplateMenu">
              <div class="tpm-template-item" id="tmplApplyDefault">✓ Apply Default</div>
              <div class="tpm-template-item" id="tmplSaveAs">＋ Save as...</div>
              <div class="tpm-template-divider" id="tmplDivider" style="display:none;"></div>
              <div id="tmplNamedList"></div>
            </div>
          </div>
        </div>
        <div class="tpm-footer-right">
          <button class="tpm-btn tpm-btn-cancel" id="tpmCancel">Cancel</button>
          <button class="tpm-btn tpm-btn-ok"     id="tpmOk">OK</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.setupEvents(tool, schema);
    this.setupDragging();
    this.seedLiveColorValues(tool, schema);
    this.attachColorListeners(schema);
    this.renderNamedTemplates();
  }

  // ==================== NAMED TEMPLATES ====================

  private renderNamedTemplates(): void {
    if (!this.modal || !this.currentTool) return;
    const toolType  = this.currentTool.toolType;
    const templates = loadNamedTemplates(toolType);
    const names     = Object.keys(templates);
    const divider   = this.modal.querySelector('#tmplDivider') as HTMLElement;
    const list      = this.modal.querySelector('#tmplNamedList') as HTMLElement;

    if (names.length === 0) {
      if (divider) divider.style.display = 'none';
      if (list)    list.innerHTML = '';
      return;
    }

    if (divider) divider.style.display = 'block';
    if (list) {
      list.innerHTML = names.map(name => `
        <div class="tpm-template-item tpm-template-named" data-name="${name}">
          <span class="tpm-template-name">${name}</span>
          <button class="tpm-template-delete" data-name="${name}">✕</button>
        </div>
      `).join('');

      list.querySelectorAll('.tpm-template-named').forEach(item => {
        item.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          if (target.classList.contains('tpm-template-delete')) return;
          const name = (item as HTMLElement).dataset.name!;
          this.applyNamedTemplate(name);
        });
      });

      list.querySelectorAll('.tpm-template-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const name = (btn as HTMLElement).dataset.name!;
          deleteNamedTemplate(toolType, name);
          this.renderNamedTemplates();
        });
      });
    }
  }

  private applyNamedTemplate(name: string): void {
    if (!this.currentTool) return;
    const toolType  = this.currentTool.toolType;
    const templates = loadNamedTemplates(toolType);
    const options   = templates[name];
    if (!options) return;

    if (this.onToolUpdate) {
      this.onToolUpdate(this.currentTool.id, options);
    }

    this.currentTool.options = this.deepMerge(this.currentTool.options || {}, options);
    this.liveColorValues = {};
    const schema = getSchemaForTool(toolType);
    this.seedLiveColorValues(this.currentTool, schema);

    const stylePanel = this.modal?.querySelector('#panel-style');
    const textPanel  = this.modal?.querySelector('#panel-text');

    if (stylePanel) stylePanel.innerHTML = this.buildStylePanel(this.currentTool, schema);
    if (textPanel)  textPanel.innerHTML  = this.buildTextPanel(this.currentTool, schema);

    this.attachColorListeners(schema);
    this.closeDropdowns();
  }

  private showSaveAsModal(): void {
    if (!this.currentTool) return;

    const overlay = document.createElement('div');
    overlay.className = 'tpm-saveas-overlay';
    overlay.innerHTML = `
      <div class="tpm-saveas-modal">
        <div class="tpm-saveas-title">Save Drawing Template</div>
        <div class="tpm-saveas-field">
          <label class="tpm-saveas-label">Template Name</label>
          <input class="tpm-saveas-input" id="tmplNameInput" type="text"
                 placeholder="Enter template name..." autocomplete="off">
        </div>
        <div class="tpm-saveas-footer">
          <button class="tpm-btn tpm-btn-cancel" id="tmplSaveAsCancel">Cancel</button>
          <button class="tpm-btn tpm-btn-ok"     id="tmplSaveAsConfirm">Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input   = overlay.querySelector('#tmplNameInput')     as HTMLInputElement;
    const cancel  = overlay.querySelector('#tmplSaveAsCancel')  as HTMLButtonElement;
    const confirm = overlay.querySelector('#tmplSaveAsConfirm') as HTMLButtonElement;

    input.focus();

    const doSave = () => {
      const name = input.value.trim();
      if (!name) { input.focus(); return; }
      const options = this.collectValues();
      saveNamedTemplate(this.currentTool.toolType, name, options);
      this.renderNamedTemplates();
      document.body.removeChild(overlay);
      this.closeDropdowns();
    };

    cancel.addEventListener('click',  () => document.body.removeChild(overlay));
    confirm.addEventListener('click', doSave);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  doSave();
      if (e.key === 'Escape') document.body.removeChild(overlay);
    });

    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) document.body.removeChild(overlay);
    });
  }

  // ==================== SEED LIVE COLOR VALUES ====================

  private seedLiveColorValues(tool: any, schema: ToolSchema | null): void {
    if (!schema) return;

    schema.properties.forEach(prop => {
      if (prop.type !== 'color') return;
      const value  = getPropertyValue(tool.options, prop.key) ?? prop.defaultValue;
      this.liveColorValues[prop.key] = this.parseColor(value);
    });

    const hasFib = schema.properties.some(p => p.type === 'levelArray');
    if (hasFib) {
      const levels = getPropertyValue(tool.options, 'levels') || [];
      levels.forEach((level: any, index: number) => {
        this.liveColorValues[`fib_level_${index}`] = {
          hex:     this.parseColor(level.color || '#ffffff').hex,
          opacity: level.opacity !== undefined ? level.opacity : 1
        };
      });
    }
  }

  // ==================== ATTACH COLOR LISTENERS ====================

  private async attachColorListeners(schema: ToolSchema | null): Promise<void> {
    if (!this.modal || !schema) return;
    const { ColorPicker } = await import('../../../core/color-picker');

    this.modal.querySelectorAll('.tpm-color-swatch-wrap[data-key]:not([data-fib-index])').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const wrap    = el as HTMLElement;
        const key     = wrap.dataset.key!;
        const current = this.liveColorValues[key] || { hex: '#3b82f6', opacity: 1 };

        const picker = new ColorPicker({
          color:   current.hex,
          opacity: current.opacity,
          onChange: (hex: string, opacity: number) => {
            this.liveColorValues[key] = { hex, opacity };

            const inner = wrap.querySelector('.tpm-color-swatch-inner') as HTMLElement;
            if (inner) {
              inner.style.background = hex;
              inner.style.opacity    = `${opacity}`;
            }

            const safeKey = key.replace(/\./g, '_');
            const opLabel = this.modal?.querySelector(`#op_${safeKey}`) as HTMLElement;
            if (opLabel) opLabel.textContent = `${Math.round(opacity * 100)}%`;

            if (this.currentTool && this.onToolUpdate) {
              const preview: any = {};
              setPropertyValue(preview, key, opacity < 1 ? this.hexToRgba(hex, opacity) : hex);
              this.onToolUpdate(this.currentTool.id, preview);
            }
          }
        });

        picker.open(wrap);
      });
    });

    this.modal.querySelectorAll('.tpm-color-swatch-wrap[data-fib-index]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const wrap  = el as HTMLElement;
        const index = parseInt(wrap.dataset.fibIndex!);
        const key   = `fib_level_${index}`;
        const current = this.liveColorValues[key] || { hex: '#ffffff', opacity: 1 };

        const picker = new ColorPicker({
          color:   current.hex,
          opacity: current.opacity,
          onChange: (hex: string, opacity: number) => {
            this.liveColorValues[key] = { hex, opacity };

            const inner = wrap.querySelector('.tpm-color-swatch-inner') as HTMLElement;
            if (inner) {
              inner.style.background = hex;
              inner.style.opacity    = `${opacity}`;
            }

            if (this.currentTool && this.onToolUpdate) {
              const levels = JSON.parse(JSON.stringify(
                getPropertyValue(this.currentTool.options, 'levels') || []
              ));
              if (levels[index]) {
                levels[index].color   = hex;
                levels[index].opacity = opacity;
              }
              this.onToolUpdate(this.currentTool.id, { levels });
            }
          }
        });

        picker.open(wrap);
      });
    });
  }

  // ==================== STYLE PANEL ====================

  private buildStylePanel(tool: any, schema: ToolSchema | null): string {
    if (!schema) return `<div class="tpm-no-schema">No schema for ${tool.toolType}</div>`;

    const styleProps = schema.properties.filter(p => p.tab === 'style' || !p.tab);
    if (styleProps.length === 0) return '<div class="tpm-no-schema">No style properties</div>';

    const sections: Record<string, PropertyField[]> = {};
    styleProps.forEach(prop => {
      const s = prop.section || 'General';
      if (!sections[s]) sections[s] = [];
      sections[s].push(prop);
    });

    let html = '';
    const keys = Object.keys(sections);
    keys.forEach((sectionName, idx) => {
      sections[sectionName].forEach(prop => {
        html += this.buildPropertyRow(prop, tool);
      });
      if (idx < keys.length - 1) html += `<div class="tpm-section-divider"></div>`;
    });

    return html;
  }

  // ==================== TEXT PANEL ====================

  private buildTextPanel(tool: any, schema: ToolSchema | null): string {
    if (!schema) return '';
    const textProps = schema.properties.filter(p => p.tab === 'text');
    if (textProps.length === 0) return '';

    const sections: Record<string, PropertyField[]> = {};
    textProps.forEach(prop => {
      const s = prop.section || 'Text';
      if (!sections[s]) sections[s] = [];
      sections[s].push(prop);
    });

    let html = '';
    const keys = Object.keys(sections);
    keys.forEach((sectionName, idx) => {
      sections[sectionName].forEach(prop => {
        html += this.buildPropertyRow(prop, tool);
      });
      if (idx < keys.length - 1) html += `<div class="tpm-section-divider"></div>`;
    });

    return html;
  }

  // ==================== COORDS PANEL ====================

  private buildCoordsPanel(tool: any): string {
    const points = tool.points || [];
    if (points.length === 0) return '<div class="tpm-no-schema">No coordinates available</div>';

    return points.map((point: any, i: number) => `
      <div class="tpm-coord-row">
        <span class="tpm-coord-label">Point ${i + 1}</span>
        <span class="tpm-coord-value">${point.price ?? point.value ?? '—'}</span>
        <span class="tpm-coord-value">${point.time ?? '—'}</span>
      </div>
    `).join('');
  }

  // ==================== PROPERTY ROW ====================

  private buildPropertyRow(prop: PropertyField, tool: any): string {
    const value  = getPropertyValue(tool.options, prop.key) ?? prop.defaultValue;
    const rowId  = `row_${prop.key.replace(/\./g, '_')}`;
    const ctrlId = `ctrl_${prop.key.replace(/\./g, '_')}`;
    const chkId  = `chk_${prop.key.replace(/\./g, '_')}`;

    switch (prop.type) {

      case 'color': {
        const parsed = this.parseColor(value);
        return `
          <div class="tpm-row" id="${rowId}" data-key="${prop.key}">
            <input type="checkbox" class="tpm-checkbox tpm-row-chk" id="${chkId}" checked
                   data-ctrl="${ctrlId}">
            <span class="tpm-row-label">${prop.label}</span>
            <div class="tpm-row-controls" id="${ctrlId}">
              <div class="tpm-color-swatch-wrap" data-key="${prop.key}">
                <div class="tpm-color-swatch-inner"
                     style="background:${parsed.hex};opacity:${parsed.opacity};"></div>
              </div>
              <span class="tpm-opacity-label" id="op_${prop.key.replace(/\./g,'_')}">${Math.round(parsed.opacity * 100)}%</span>
            </div>
          </div>
        `;
      }

      case 'line-width': {
        const ddId = `dd_${prop.key.replace(/\./g, '_')}`;
        return `
          <div class="tpm-row" id="${rowId}" data-key="${prop.key}">
            <input type="checkbox" class="tpm-checkbox tpm-row-chk" id="${chkId}" checked
                   data-ctrl="${ctrlId}">
            <span class="tpm-row-label">${prop.label}</span>
            <div class="tpm-row-controls" id="${ctrlId}">
              ${this.buildDropdownHTML(ddId, [0.5,1,2,3,4].map(w => ({
                value: `${w}`,
                html:  `<div class="tpm-width-preview" style="height:${Math.max(1,w)}px;opacity:${w===0.5?0.5:0.8}"></div><span>${w}</span>`
              })), `${value}`, `${value}px`)}
            </div>
          </div>
        `;
      }

      case 'line-style': {
        const ddId    = `dd_${prop.key.replace(/\./g, '_')}`;
        const labels  = ['Solid','Dashed','Dotted'];
        const classes = ['tpm-style-solid','tpm-style-dashed','tpm-style-dotted'];
        return `
          <div class="tpm-row" id="${rowId}" data-key="${prop.key}">
            <input type="checkbox" class="tpm-checkbox tpm-row-chk" id="${chkId}" checked
                   data-ctrl="${ctrlId}">
            <span class="tpm-row-label">${prop.label}</span>
            <div class="tpm-row-controls" id="${ctrlId}">
              ${this.buildDropdownHTML(ddId, [0,1,2].map(s => ({
                value: `${s}`,
                html:  `<div class="tpm-style-line ${classes[s]}"></div><span>${labels[s]}</span>`
              })), `${value}`, labels[value] || 'Solid')}
            </div>
          </div>
        `;
      }

      case 'corner-radius': {
        const ddId = `dd_${prop.key.replace(/\./g, '_')}`;
        return `
          <div class="tpm-row" id="${rowId}" data-key="${prop.key}">
            <input type="checkbox" class="tpm-checkbox tpm-row-chk" id="${chkId}" checked
                   data-ctrl="${ctrlId}">
            <span class="tpm-row-label">${prop.label}</span>
            <div class="tpm-row-controls" id="${ctrlId}">
              ${this.buildDropdownHTML(ddId, [0,2,4,8,12,20].map(r => ({
                value: `${r}`, html: `<span>${r}px</span>`
              })), `${value}`, `${value}px`)}
            </div>
          </div>
        `;
      }

      case 'font-size': {
        const ddId = `dd_${prop.key.replace(/\./g, '_')}`;
        return `
          <div class="tpm-row" id="${rowId}" data-key="${prop.key}">
            <input type="checkbox" class="tpm-checkbox tpm-row-chk" id="${chkId}" checked
                   data-ctrl="${ctrlId}">
            <span class="tpm-row-label">${prop.label}</span>
            <div class="tpm-row-controls" id="${ctrlId}">
              ${this.buildDropdownHTML(ddId, [8,10,12,14,16,18,20,24,28,32].map(f => ({
                value: `${f}`, html: `<span>${f}px</span>`
              })), `${value}`, `${value}px`)}
            </div>
          </div>
        `;
      }

      case 'select': {
        const ddId     = `dd_${prop.key.replace(/\./g, '_')}`;
        const opts     = prop.options || [];
        const selLabel = opts.find(o => o.value === value)?.label || `${value}`;
        return `
          <div class="tpm-row" id="${rowId}" data-key="${prop.key}">
            <input type="checkbox" class="tpm-checkbox tpm-row-chk" id="${chkId}" checked
                   data-ctrl="${ctrlId}">
            <span class="tpm-row-label">${prop.label}</span>
            <div class="tpm-row-controls" id="${ctrlId}">
              ${this.buildDropdownHTML(ddId, opts.map(o => ({
                value: `${o.value}`, html: `<span>${o.label}</span>`
              })), `${value}`, selLabel)}
            </div>
          </div>
        `;
      }

      case 'checkbox': {
        return `
          <div class="tpm-row" id="${rowId}" data-key="${prop.key}">
            <input type="checkbox" class="tpm-checkbox tpm-row-chk" id="${chkId}" checked
                   data-ctrl="${ctrlId}">
            <span class="tpm-row-label">${prop.label}</span>
            <div class="tpm-row-controls" id="${ctrlId}">
              <input type="checkbox" class="tpm-checkbox" id="val_${chkId}"
                     ${value ? 'checked' : ''} data-key="${prop.key}">
            </div>
          </div>
        `;
      }

      case 'extend': {
        const ddId     = `dd_${prop.key.replace(/\./g, '_')}`;
        const prefix   = prop.keyPrefix !== undefined ? prop.keyPrefix : '';
        const leftKey  = prefix ? `${prefix}.extend.left`  : 'extend.left';
        const rightKey = prefix ? `${prefix}.extend.right` : 'extend.right';
        const extLeft  = getPropertyValue(tool.options, leftKey)  || false;
        const extRight = getPropertyValue(tool.options, rightKey) || false;
        const extLabel = extLeft && extRight ? 'Both' : extLeft ? 'Left' : extRight ? 'Right' : 'None';
        return `
          <div class="tpm-row" id="${rowId}" data-key="${prop.key}">
            <input type="checkbox" class="tpm-checkbox tpm-row-chk" id="${chkId}" checked
                   data-ctrl="${ctrlId}">
            <span class="tpm-row-label">${prop.label}</span>
            <div class="tpm-row-controls" id="${ctrlId}">
              <div class="tpm-dropdown-wrap">
                <button class="tpm-dropdown-btn" id="${ddId}Btn">
                  <span id="${ddId}Label">${extLabel}</span>
                  <span class="tpm-chevron">▼</span>
                </button>
                <div class="tpm-dropdown-menu" id="${ddId}Menu" style="min-width:140px;">
                  <label class="tpm-extend-item">
                    <input type="checkbox" class="tpm-ext-chk" id="${ddId}Left"
                           data-side="left"
                           data-leftkey="${leftKey}"
                           data-rightkey="${rightKey}"
                           data-ddid="${ddId}"
                           ${extLeft ? 'checked' : ''}>
                    <span>Extend Left</span>
                  </label>
                  <label class="tpm-extend-item">
                    <input type="checkbox" class="tpm-ext-chk" id="${ddId}Right"
                           data-side="right"
                           data-leftkey="${leftKey}"
                           data-rightkey="${rightKey}"
                           data-ddid="${ddId}"
                           ${extRight ? 'checked' : ''}>
                    <span>Extend Right</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      case 'textarea': {
        return `
          <div class="tpm-row tpm-row-textarea" id="${rowId}" data-key="${prop.key}">
            <input type="checkbox" class="tpm-checkbox tpm-row-chk" id="${chkId}" checked
                   data-ctrl="${ctrlId}" style="margin-top:5px;align-self:flex-start;">
            <span class="tpm-row-label" style="margin-top:5px;align-self:flex-start;">${prop.label}</span>
            <div class="tpm-row-controls" id="${ctrlId}">
              <textarea class="tpm-textarea" id="val_${chkId}"
                        data-key="${prop.key}">${value || ''}</textarea>
            </div>
          </div>
        `;
      }

      case 'text': {
        return `
          <div class="tpm-row" id="${rowId}" data-key="${prop.key}">
            <input type="checkbox" class="tpm-checkbox tpm-row-chk" id="${chkId}" checked
                   data-ctrl="${ctrlId}">
            <span class="tpm-row-label">${prop.label}</span>
            <div class="tpm-row-controls" id="${ctrlId}">
              <input type="text" class="tpm-text-input" id="val_${chkId}"
                     data-key="${prop.key}" value="${value || ''}">
            </div>
          </div>
        `;
      }

      case 'bold-italic': {
        const bold   = getPropertyValue(tool.options, `${prop.keyPrefix}.font.bold`)   || false;
        const italic = getPropertyValue(tool.options, `${prop.keyPrefix}.font.italic`) || false;
        return `
          <div class="tpm-row" id="${rowId}" data-key="${prop.key}">
            <input type="checkbox" class="tpm-checkbox tpm-row-chk" id="${chkId}" checked
                   data-ctrl="${ctrlId}">
            <span class="tpm-row-label">${prop.label}</span>
            <div class="tpm-row-controls" id="${ctrlId}">
              <button class="tpm-toggle-btn ${bold   ? 'active' : ''}"
                      id="btnBold_${prop.key.replace(/\./g,'_')}"
                      data-prefix="${prop.keyPrefix}" data-type="bold">
                <b>B</b>
              </button>
              <button class="tpm-toggle-btn ${italic ? 'active' : ''}"
                      id="btnItalic_${prop.key.replace(/\./g,'_')}"
                      data-prefix="${prop.keyPrefix}" data-type="italic">
                <i>I</i>
              </button>
            </div>
          </div>
        `;
      }

      case 'alignment': {
        const ddVId  = `ddAlignV_${prop.key.replace(/\./g,'_')}`;
        const ddHId  = `ddAlignH_${prop.key.replace(/\./g,'_')}`;
        const alignV = getPropertyValue(tool.options, `${prop.keyPrefix}.box.alignment.vertical`)   || 'top';
        const alignH = getPropertyValue(tool.options, `${prop.keyPrefix}.box.alignment.horizontal`) || 'center';
        const vLabel = alignV.charAt(0).toUpperCase() + alignV.slice(1);
        const hLabel = alignH.charAt(0).toUpperCase() + alignH.slice(1);
        return `
          <div class="tpm-row" id="${rowId}" data-key="${prop.key}">
            <input type="checkbox" class="tpm-checkbox tpm-row-chk" id="${chkId}" checked
                   data-ctrl="${ctrlId}">
            <span class="tpm-row-label">${prop.label}</span>
            <div class="tpm-row-controls" id="${ctrlId}">
              ${this.buildDropdownHTML(ddVId, ['Top','Middle','Bottom'].map(v => ({
                value: v.toLowerCase(), html: `<span>${v}</span>`
              })), alignV, vLabel)}
              ${this.buildDropdownHTML(ddHId, ['Left','Center','Right'].map(h => ({
                value: h.toLowerCase(), html: `<span>${h}</span>`
              })), alignH, hLabel)}
            </div>
          </div>
        `;
      }

      case 'levelArray': {
        const levels = getPropertyValue(tool.options, 'levels') || [];
        if (!levels.length) return '';

        const levelRows = levels.map((level: any, index: number) => {
          const parsed  = this.parseColor(level.color || '#ffffff');
          const opacity = level.opacity !== undefined ? level.opacity : 1;
          return `
            <div class="tpm-fib-row">
              <span class="tpm-fib-coeff">${level.coeff ?? index}</span>
              <div class="tpm-color-swatch-wrap"
                   data-key="fib_level_${index}"
                   data-fib-index="${index}">
                <div class="tpm-color-swatch-inner"
                     style="background:${parsed.hex};opacity:${opacity};"></div>
              </div>
            </div>
          `;
        }).join('');

        return `
          <div class="tpm-row" id="${rowId}" data-key="${prop.key}">
            <input type="checkbox" class="tpm-checkbox tpm-row-chk" id="${chkId}" checked
                   data-ctrl="${ctrlId}">
            <span class="tpm-row-label">${prop.label}</span>
          </div>
          <div class="tpm-row-controls tpm-fib-levels" id="${ctrlId}">
            ${levelRows}
          </div>
        `;
      }

      default:
        return '';
    }
  }

  // ==================== DROPDOWN HTML ====================

  private buildDropdownHTML(
    id: string,
    items: Array<{ value: string; html: string }>,
    selectedValue: string,
    selectedLabel: string
  ): string {
    return `
      <div class="tpm-dropdown-wrap">
        <button class="tpm-dropdown-btn" id="${id}Btn">
          <span id="${id}Label">${selectedLabel}</span>
          <span class="tpm-chevron">▼</span>
        </button>
        <div class="tpm-dropdown-menu" id="${id}Menu">
          ${items.map(item => `
            <div class="tpm-dropdown-item ${item.value === selectedValue ? 'selected' : ''}"
                 data-ddid="${id}" data-value="${item.value}">
              ${item.html}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ==================== POSITION DROPDOWN (fixed) ====================

  private positionDropdown(btn: HTMLElement, menu: HTMLElement): void {
    const rect        = btn.getBoundingClientRect();
    const menuWidth   = menu.offsetWidth  || 120;
    const menuHeight  = menu.offsetHeight || 200;
    const viewW       = window.innerWidth;
    const viewH       = window.innerHeight;

    let top  = rect.bottom + 4;
    let left = rect.left;

    // ✅ Clamp right edge
    if (left + menuWidth > viewW - 8) {
      left = viewW - menuWidth - 8;
    }

    // ✅ Clamp bottom edge — open upward if no space below
    if (top + menuHeight > viewH - 8) {
      top = rect.top - menuHeight - 4;
    }

    menu.style.top  = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.width = 'auto';
  }

  // ==================== POSITION TEMPLATE MENU ====================

  private positionTemplateMenu(): void {
    const btn  = this.modal?.querySelector('#tpmTemplateBtn') as HTMLElement;
    const menu = this.modal?.querySelector('#tpmTemplateMenu') as HTMLElement;
    if (!btn || !menu) return;

    const rect      = btn.getBoundingClientRect();
    const menuWidth = 180;
    const viewW     = window.innerWidth;
    const viewH     = window.innerHeight;

    let top  = rect.bottom + 6;
    let left = rect.left;

    // ✅ Clamp right
    if (left + menuWidth > viewW - 8) {
      left = viewW - menuWidth - 8;
    }

    // ✅ Clamp bottom — open upward if needed
    const menuHeight = menu.offsetHeight || 120;
    if (top + menuHeight > viewH - 8) {
      top = rect.top - menuHeight - 6;
    }

    menu.style.top  = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.width = `${menuWidth}px`;
  }

  // ==================== SETUP EVENTS ====================

  private setupEvents(tool: any, schema: ToolSchema | null): void {
    if (!this.modal) return;

    this.modal.querySelector('#tpmClose')?.addEventListener('click',  () => this.hide());
    this.modal.querySelector('#tpmCancel')?.addEventListener('click', () => this.hide());

    this.modal.querySelector('#tpmOk')?.addEventListener('click', () => {
      this.applyChanges();
      this.hide();
    });

    // Tabs
    this.modal.querySelectorAll('.tpm-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.modal!.querySelectorAll('.tpm-tab').forEach(t  => t.classList.remove('active'));
        this.modal!.querySelectorAll('.tpm-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const tabName = (tab as HTMLElement).dataset.tab!;
        this.modal!.querySelector(`#panel-${tabName}`)?.classList.add('active');
      });
    });

    // Row checkboxes
    this.modal.querySelectorAll('.tpm-row-chk').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const input  = e.target as HTMLInputElement;
        const ctrlId = input.dataset.ctrl!;
        const ctrl   = this.modal!.querySelector(`#${ctrlId}`) as HTMLElement;
        if (ctrl) ctrl.classList.toggle('disabled', !input.checked);
      });
    });

    // ✅ Dropdown buttons — use fixed positioning
    this.modal.querySelectorAll('.tpm-dropdown-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const btnEl  = btn as HTMLElement;
        const menuId = btnEl.id.replace('Btn', 'Menu');
        const menu   = this.modal!.querySelector(`#${menuId}`) as HTMLElement;
        if (!menu) return;
        const isOpen = menu.classList.contains('open');
        this.closeDropdowns();
        if (!isOpen) {
          menu.classList.add('open');
          btnEl.classList.add('open');
          this.openDropdown = menu;
          // ✅ Position after open so offsetHeight is available
          requestAnimationFrame(() => this.positionDropdown(btnEl, menu));
        }
      });
    });

    // Dropdown items — live preview
    this.modal.querySelectorAll('.tpm-dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const el    = item as HTMLElement;
        const ddId  = el.dataset.ddid!;
        const value = el.dataset.value!;
        const menu  = this.modal!.querySelector(`#${ddId}Menu`) as HTMLElement;
        const label = this.modal!.querySelector(`#${ddId}Label`) as HTMLElement;
        if (menu)  menu.querySelectorAll('.tpm-dropdown-item').forEach(i => i.classList.remove('selected'));
        if (label) label.textContent = el.querySelector('span:last-child')?.textContent || value;
        el.classList.add('selected');
        this.closeDropdowns();

        if (this.currentTool && this.onToolUpdate) {
          const currentSchema = getSchemaForTool(this.currentTool.toolType);
          if (!currentSchema) return;

          const preview: any = {};

          // ✅ Alignment — correct core path
          if (ddId.startsWith('ddAlignV_') || ddId.startsWith('ddAlignH_')) {
            const safeKey = ddId.replace(/^ddAlignV_/, '').replace(/^ddAlignH_/, '');
            const prop    = currentSchema.properties.find(p => p.key.replace(/\./g, '_') === safeKey);
            if (prop?.keyPrefix) {
              const subKey = ddId.startsWith('ddAlignV_')
                ? `${prop.keyPrefix}.box.alignment.vertical`
                : `${prop.keyPrefix}.box.alignment.horizontal`;
              setPropertyValue(preview, subKey, value);
              this.onToolUpdate(this.currentTool.id, preview);
            }
            return;
          }

          const safeKey = ddId.replace(/^dd_/, '');
          const prop    = currentSchema.properties.find(p => p.key.replace(/\./g, '_') === safeKey);
          if (!prop) return;

          let parsedValue: any = value;
          if (prop.type === 'line-width' || prop.type === 'corner-radius' || prop.type === 'font-size') {
            parsedValue = parseFloat(value);
          } else if (prop.type === 'line-style') {
            parsedValue = parseInt(value);
          }

          setPropertyValue(preview, prop.key, parsedValue);
          this.onToolUpdate(this.currentTool.id, preview);
        }
      });
    });

    // ✅ Extend checkboxes
    this.modal.querySelectorAll('.tpm-ext-chk').forEach(chk => {
      chk.addEventListener('change', (e) => {
        e.stopPropagation();
        const input    = e.target as HTMLInputElement;
        const ddId     = input.dataset.ddid!;
        const leftKey  = input.dataset.leftkey!;
        const rightKey = input.dataset.rightkey!;
        const leftChk  = this.modal!.querySelector(`[data-ddid="${ddId}"][data-side="left"]`)  as HTMLInputElement;
        const rightChk = this.modal!.querySelector(`[data-ddid="${ddId}"][data-side="right"]`) as HTMLInputElement;
        const labelEl  = this.modal!.querySelector(`#${ddId}Label`) as HTMLElement;

        if (labelEl) {
          const l = leftChk?.checked, r = rightChk?.checked;
          labelEl.textContent = l && r ? 'Both' : l ? 'Left' : r ? 'Right' : 'None';
        }

        if (this.currentTool && this.onToolUpdate) {
          const preview: any = {};
          setPropertyValue(preview, leftKey,  leftChk?.checked  || false);
          setPropertyValue(preview, rightKey, rightChk?.checked || false);
          this.onToolUpdate(this.currentTool.id, preview);
        }
      });
    });

    // Extend menus — prevent close on inner click
    this.modal.querySelectorAll('.tpm-dropdown-menu').forEach(menu => {
      if ((menu as HTMLElement).querySelector('.tpm-extend-item')) {
        menu.addEventListener('mousedown', e => e.stopPropagation());
      }
    });

    // Bold / Italic
    this.modal.querySelectorAll('.tpm-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        if (this.currentTool && this.onToolUpdate) {
          const el     = btn as HTMLElement;
          const prefix = el.dataset.prefix!;
          const type   = el.dataset.type!;
          if (!prefix || !type) return;
          const preview: any = {};
          setPropertyValue(preview, `${prefix}.font.${type}`, el.classList.contains('active'));
          this.onToolUpdate(this.currentTool.id, preview);
        }
      });
    });

    // ✅ Template button — fixed positioning, opens downward
    const tmplBtn  = this.modal.querySelector('#tpmTemplateBtn') as HTMLElement;
    const tmplMenu = this.modal.querySelector('#tpmTemplateMenu') as HTMLElement;

    tmplBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = tmplMenu.classList.contains('open');
      this.closeDropdowns();
      if (!isOpen) {
        tmplMenu.classList.add('open');
        this.openDropdown = tmplMenu;
        requestAnimationFrame(() => this.positionTemplateMenu());
      }
    });

    tmplMenu?.addEventListener('mousedown', e => e.stopPropagation());

    // Apply Default
    this.modal.querySelector('#tmplApplyDefault')?.addEventListener('click', () => {
      if (this.currentTool) {
        const defaults = loadToolTemplate(this.currentTool.toolType);
        if (defaults && this.onToolUpdate) {
          this.onToolUpdate(this.currentTool.id, defaults);
        }
      }
      this.closeDropdowns();
    });

    // Save as...
    this.modal.querySelector('#tmplSaveAs')?.addEventListener('click', () => {
      this.closeDropdowns();
      this.showSaveAsModal();
    });
  }

  // ==================== COLLECT VALUES ====================

  private collectValues(): any {
    if (!this.modal || !this.currentTool) return {};
    const schema = getSchemaForTool(this.currentTool.toolType);
    if (!schema) return {};

    const updates: any = {};

    schema.properties.forEach(prop => {
      const key     = prop.key;
      const safeKey = key.replace(/\./g, '_');

      switch (prop.type) {

        case 'color': {
          const live = this.liveColorValues[key];
          if (live) {
            setPropertyValue(updates, key, live.opacity < 1
              ? this.hexToRgba(live.hex, live.opacity)
              : live.hex
            );
          }
          break;
        }

        case 'line-width':
        case 'corner-radius':
        case 'font-size': {
          const sel = this.modal!.querySelector(`#dd_${safeKey}Menu .tpm-dropdown-item.selected`) as HTMLElement;
          if (sel) setPropertyValue(updates, key, parseFloat(sel.dataset.value!));
          break;
        }

        case 'line-style': {
          const sel = this.modal!.querySelector(`#dd_${safeKey}Menu .tpm-dropdown-item.selected`) as HTMLElement;
          if (sel) setPropertyValue(updates, key, parseInt(sel.dataset.value!));
          break;
        }

        case 'select': {
          const sel = this.modal!.querySelector(`#dd_${safeKey}Menu .tpm-dropdown-item.selected`) as HTMLElement;
          if (sel) setPropertyValue(updates, key, sel.dataset.value!);
          break;
        }

        case 'checkbox': {
          const chk = this.modal!.querySelector(`#val_chk_${safeKey}`) as HTMLInputElement;
          if (chk) setPropertyValue(updates, key, chk.checked);
          break;
        }

        case 'textarea':
        case 'text': {
          const input = this.modal!.querySelector(`#val_chk_${safeKey}`) as HTMLInputElement | HTMLTextAreaElement;
          if (input) setPropertyValue(updates, key, input.value);
          break;
        }

        case 'extend': {
          const prefix   = prop.keyPrefix !== undefined ? prop.keyPrefix : '';
          const leftKey  = prefix ? `${prefix}.extend.left`  : 'extend.left';
          const rightKey = prefix ? `${prefix}.extend.right` : 'extend.right';
          const ddId     = `dd_${safeKey}`;
          const leftChk  = this.modal!.querySelector(`[data-ddid="${ddId}"][data-side="left"]`)  as HTMLInputElement;
          const rightChk = this.modal!.querySelector(`[data-ddid="${ddId}"][data-side="right"]`) as HTMLInputElement;
          setPropertyValue(updates, leftKey,  leftChk?.checked  || false);
          setPropertyValue(updates, rightKey, rightChk?.checked || false);
          break;
        }

        case 'bold-italic': {
          const prefix    = prop.keyPrefix!;
          const boldBtn   = this.modal!.querySelector(`#btnBold_${safeKey}`)   as HTMLElement;
          const italicBtn = this.modal!.querySelector(`#btnItalic_${safeKey}`) as HTMLElement;
          setPropertyValue(updates, `${prefix}.font.bold`,   boldBtn?.classList.contains('active')   || false);
          setPropertyValue(updates, `${prefix}.font.italic`, italicBtn?.classList.contains('active') || false);
          break;
        }

        case 'alignment': {
          const prefix = prop.keyPrefix!;
          const selV   = this.modal!.querySelector(`#ddAlignV_${safeKey}Menu .tpm-dropdown-item.selected`) as HTMLElement;
          const selH   = this.modal!.querySelector(`#ddAlignH_${safeKey}Menu .tpm-dropdown-item.selected`) as HTMLElement;
          if (selV) setPropertyValue(updates, `${prefix}.box.alignment.vertical`,   selV.dataset.value);
          if (selH) setPropertyValue(updates, `${prefix}.box.alignment.horizontal`, selH.dataset.value);
          break;
        }

        case 'levelArray': {
          const levels = JSON.parse(JSON.stringify(
            getPropertyValue(this.currentTool.options, 'levels') || []
          ));
          Object.keys(this.liveColorValues).forEach(liveKey => {
            if (!liveKey.startsWith('fib_level_')) return;
            const index = parseInt(liveKey.replace('fib_level_', ''));
            if (levels[index]) {
              const live = this.liveColorValues[liveKey];
              levels[index].color   = live.hex;
              levels[index].opacity = live.opacity;
            }
          });
          setPropertyValue(updates, 'levels', levels);
          break;
        }
      }
    });

    return updates;
  }

  // ==================== APPLY ====================

  private applyChanges(): void {
    if (!this.currentTool || !this.onToolUpdate) return;
    const updates = this.collectValues();
    this.onToolUpdate(this.currentTool.id, updates);
  }

  // ==================== DRAGGING ====================

  private setupDragging(): void {
    const header = this.modal?.querySelector('#tpmHeader') as HTMLElement;
    if (!header || !this.modal) return;

    header.addEventListener('mousedown', (e: MouseEvent) => {
      if ((e.target as HTMLElement).id === 'tpmClose') return;
      this.isDragging  = true;
      const rect       = this.modal!.getBoundingClientRect();
      this.dragOffsetX = e.clientX - rect.left;
      this.dragOffsetY = e.clientY - rect.top;
      document.body.style.userSelect = 'none';
      header.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isDragging || !this.modal) return;
      const x    = e.clientX - this.dragOffsetX;
      const y    = e.clientY - this.dragOffsetY;
      const maxX = window.innerWidth  - this.modal.offsetWidth;
      const maxY = window.innerHeight - this.modal.offsetHeight;
      this.modal.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
      this.modal.style.top  = `${Math.max(0, Math.min(y, maxY))}px`;
      // ✅ Reposition open dropdown when modal is dragged
      if (this.openDropdown) {
        const btnId = this.openDropdown.id.replace('Menu', 'Btn');
        const btn   = this.modal.querySelector(`#${btnId}`) as HTMLElement;
        if (btn) this.positionDropdown(btn, this.openDropdown);
      }
    });

    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        document.body.style.userSelect = '';
        header.style.cursor = 'grab';
      }
    });
  }

  // ==================== CENTER ====================

  private centerModal(): void {
    if (!this.modal) return;
    requestAnimationFrame(() => {
      if (!this.modal) return;
      const w = this.modal.offsetWidth  || 380;
      const h = this.modal.offsetHeight || 400;
      this.modal.style.left = `${Math.max(0, (window.innerWidth  - w) / 2)}px`;
      this.modal.style.top  = `${Math.max(0, (window.innerHeight - h) / 2)}px`;
    });
  }

  // ==================== CLOSE DROPDOWNS ====================

  private closeDropdowns(): void {
    if (!this.modal) return;
    this.modal.querySelectorAll('.tpm-dropdown-menu').forEach(m => m.classList.remove('open'));
    this.modal.querySelectorAll('.tpm-dropdown-btn').forEach(b  => b.classList.remove('open'));
    this.modal.querySelector('#tpmTemplateMenu')?.classList.remove('open');
    this.openDropdown = null;
  }

  // ==================== OUTSIDE CLICK ====================

  private handleOutsideClick = (e: MouseEvent): void => {
    if (!this.modal) return;

    if ((e.target as HTMLElement).closest('.cp-container'))       return;
    if ((e.target as HTMLElement).closest('.tpm-saveas-overlay')) return;

    if (this.modal.contains(e.target as Node)) {
      const inDropdown = (e.target as HTMLElement).closest('.tpm-dropdown-wrap') ||
                         (e.target as HTMLElement).closest('.tpm-footer-left');
      if (!inDropdown) this.closeDropdowns();
      return;
    }

    // ✅ Also check if click is inside a fixed dropdown menu outside modal
    if ((e.target as HTMLElement).closest('.tpm-dropdown-menu') ||
        (e.target as HTMLElement).closest('.tpm-template-menu')) {
      return;
    }

    this.closeDropdowns();
    this.hide();
  };

  // ==================== COLOR HELPERS ====================

  private parseColor(value: any): { hex: string; opacity: number } {
    if (!value || typeof value !== 'string') return { hex: '#3b82f6', opacity: 1 };
    const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      const r   = parseInt(match[1]);
      const g   = parseInt(match[2]);
      const b   = parseInt(match[3]);
      const a   = match[4] !== undefined ? parseFloat(match[4]) : 1;
      const hex = `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
      return { hex, opacity: a };
    }
    return { hex: value.startsWith('#') ? value : '#3b82f6', opacity: 1 };
  }

  private hexToRgba(hex: string, opacity: number): string {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  // ==================== HELPERS ====================

  private deepMerge(base: any, override: any): any {
    const result = { ...base };
    for (const key of Object.keys(override)) {
      if (
        override[key] && typeof override[key] === 'object' && !Array.isArray(override[key]) &&
        base[key]     && typeof base[key]     === 'object'
      ) {
        result[key] = this.deepMerge(base[key], override[key]);
      } else {
        result[key] = override[key];
      }
    }
    return result;
  }

  // ==================== DESTROY ====================

  public destroy(): void {
    document.removeEventListener('mousedown', this.handleOutsideClick);
    this.destroyModal();
  }
}