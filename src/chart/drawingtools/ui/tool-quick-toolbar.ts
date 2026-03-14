// ================================================================
// ⚡ TOOL QUICK TOOLBAR - Floating toolbar for drawn tools
// ================================================================

export interface QuickToolbarCallbacks {
  onColorChange:     (toolId: string, color: string) => void;
  onLineWidthChange: (toolId: string, width: number) => void;
  onLineStyleChange: (toolId: string, style: number) => void;
  onSettingsClick:   (tool: any) => void;
  onLockToggle:      (toolId: string, locked: boolean) => void;
  onDelete:          (toolId: string) => void;
}

export class ToolQuickToolbar {
  private container:    HTMLElement | null = null;
  private currentTool:  any = null;
  private callbacks:    QuickToolbarCallbacks;

  private isDragging:   boolean = false;
  private dragOffsetX:  number  = 0;
  private dragOffsetY:  number  = 0;

  private savedX: number | null = null;
  private savedY: number | null = null;

  private currentColor: string = '#3b82f6';
  private currentWidth: number = 1;
  private currentStyle: number = 0;

  private activeDropdown: 'width' | 'style' | null = null;

  constructor(callbacks: QuickToolbarCallbacks) {
    this.callbacks = callbacks;
    this.injectStyles();
  }

  // ==================== SHOW / HIDE ====================

  public show(tool: any): void {
    if (!tool) return;

    this.currentTool = tool;
    this.extractToolValues(tool);

    if (this.container) {
      this.updateToolbarValues();
      return;
    }

    this.createToolbar();
    this.positionToolbar();
  }

  public hide(): void {
    if (!this.container) return;

    this.container.classList.add('qtb-hiding');
    setTimeout(() => {
      if (this.container && document.body.contains(this.container)) {
        document.body.removeChild(this.container);
      }
      this.container      = null;
      this.activeDropdown = null;
    }, 150);

    document.removeEventListener('mousedown', this.handleOutsideClick);
  }

  public updateTool(tool: any): void {
    if (!tool) return;
    this.currentTool = tool;
    this.extractToolValues(tool);
    if (this.container) this.updateToolbarValues();
  }

  // ==================== EXTRACT TOOL VALUES ====================

  private extractToolValues(tool: any): void {
    const options = tool.options || {};

    this.currentColor =
      options.line?.color   ||
      options.color         ||
      options.border?.color ||
      options.stroke?.color ||
      '#3b82f6';

    this.currentWidth =
      options.line?.width  ||
      options.lineWidth     ||
      options.border?.width ||
      1;

    this.currentStyle =
      options.line?.style  ||
      options.lineStyle     ||
      options.border?.style ||
      0;
  }

  // ==================== CREATE TOOLBAR ====================

  private createToolbar(): void {
    this.container = document.createElement('div');
    this.container.className = 'qtb-container';
    this.container.innerHTML = this.buildHTML();
    document.body.appendChild(this.container);

    this.setupDragging();
    this.setupButtons();
    this.updateToolbarValues();

    setTimeout(() => {
      document.addEventListener('mousedown', this.handleOutsideClick);
    }, 0);
  }

  private buildHTML(): string {
    return `
      <div class="qtb-drag-handle" title="Drag">
        <i class="fas fa-grip-vertical"></i>
      </div>

      <div class="qtb-divider"></div>

      <!-- COLOR -->
      <div class="qtb-item">
        <button class="qtb-color-btn" id="qtbColorBtn" title="Color">
          <div class="qtb-color-dot" id="qtbColorDot"></div>
        </button>
      </div>

      <div class="qtb-divider"></div>

      <!-- LINE WIDTH -->
      <div class="qtb-item qtb-dropdown-wrap" id="qtbWidthWrap">
        <button class="qtb-btn" id="qtbWidthBtn" title="Line Width">
          <div class="qtb-width-preview" id="qtbWidthPreview"></div>
          <i class="fas fa-chevron-down qtb-chevron"></i>
        </button>
        <div class="qtb-dropdown" id="qtbWidthDropdown">
          ${[0.5, 1, 2, 3, 4].map(w => `
            <div class="qtb-dropdown-item qtb-width-item" data-width="${w}">
              <div class="qtb-width-line" style="height: ${Math.max(1, w)}px; opacity: ${w === 0.5 ? 0.6 : 1};"></div>
              <span class="qtb-width-label">${w}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="qtb-divider"></div>

      <!-- LINE STYLE -->
      <div class="qtb-item qtb-dropdown-wrap" id="qtbStyleWrap">
        <button class="qtb-btn" id="qtbStyleBtn" title="Line Style">
          <div class="qtb-style-preview" id="qtbStylePreview"></div>
          <i class="fas fa-chevron-down qtb-chevron"></i>
        </button>
        <div class="qtb-dropdown" id="qtbStyleDropdown">
          <div class="qtb-dropdown-item qtb-style-item" data-style="0">
            <div class="qtb-style-line qtb-style-solid"></div>
            <span class="qtb-style-label">Solid</span>
          </div>
          <div class="qtb-dropdown-item qtb-style-item" data-style="1">
            <div class="qtb-style-line qtb-style-dashed"></div>
            <span class="qtb-style-label">Dashed</span>
          </div>
          <div class="qtb-dropdown-item qtb-style-item" data-style="2">
            <div class="qtb-style-line qtb-style-dotted"></div>
            <span class="qtb-style-label">Dotted</span>
          </div>
        </div>
      </div>

      <div class="qtb-divider"></div>

      <!-- SETTINGS -->
      <div class="qtb-item">
        <button class="qtb-btn" id="qtbSettingsBtn" title="Settings">
          <i class="fas fa-gear"></i>
        </button>
      </div>

      <div class="qtb-divider"></div>

      <!-- LOCK -->
      <div class="qtb-item">
        <button class="qtb-btn" id="qtbLockBtn" title="Lock tool">
          <i class="fas fa-lock-open" id="qtbLockIcon"></i>
        </button>
      </div>

      <div class="qtb-divider"></div>

      <!-- DELETE -->
      <div class="qtb-item">
        <button class="qtb-btn qtb-btn-danger" id="qtbDeleteBtn" title="Delete">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
  }

  // ==================== POSITION ====================

  private positionToolbar(): void {
    if (!this.container) return;

    if (this.savedX !== null && this.savedY !== null) {
      this.container.style.left = `${this.savedX}px`;
      this.container.style.top  = `${this.savedY}px`;
      return;
    }

    const chartArea    = document.getElementById('mainChartArea') || document.body;
    const rect         = chartArea.getBoundingClientRect();
    const toolbarWidth = 340;
    const x = rect.left + (rect.width - toolbarWidth) / 2;
    const y = rect.top + 48;

    this.container.style.left = `${x}px`;
    this.container.style.top  = `${y}px`;
  }

  // ==================== UPDATE VALUES ====================

  private updateToolbarValues(): void {
    if (!this.container) return;

    const colorDot = this.container.querySelector('#qtbColorDot') as HTMLElement;
    if (colorDot) colorDot.style.background = this.currentColor;

    this.updateWidthPreview();
    this.updateStylePreview();

    const lockIcon = this.container.querySelector('#qtbLockIcon') as HTMLElement;
    const lockBtn  = this.container.querySelector('#qtbLockBtn')  as HTMLElement;
    if (lockIcon && lockBtn) {
      const isLocked = this.currentTool?.options?.locked || false;

      if (isLocked) {
        // ✅ Tool is locked — show closed lock, highlight, tooltip says unlock
        lockIcon.className = 'fas fa-lock';
        lockBtn.title      = 'Unlock tool';
        lockBtn.classList.add('qtb-btn-active');
      } else {
        // ✅ Tool is unlocked — show open lock, tooltip says lock
        lockIcon.className = 'fas fa-lock-open';
        lockBtn.title      = 'Lock tool';
        lockBtn.classList.remove('qtb-btn-active');
      }
    }
  }

  private updateWidthPreview(): void {
    const preview = this.container?.querySelector('#qtbWidthPreview') as HTMLElement;
    if (!preview) return;
    preview.style.cssText = `
      width: 20px;
      height: ${Math.max(1, this.currentWidth)}px;
      background: var(--text-primary);
      border-radius: 1px;
      opacity: ${this.currentWidth === 0.5 ? 0.5 : 0.8};
    `;
  }

  private updateStylePreview(): void {
    const preview = this.container?.querySelector('#qtbStylePreview') as HTMLElement;
    if (!preview) return;
    const styles: Record<number, string> = { 0: 'solid', 1: 'dashed', 2: 'dotted' };
    preview.style.cssText = `
      width: 22px;
      height: 0;
      border-top: 2px ${styles[this.currentStyle] || 'solid'} var(--text-secondary);
      margin: auto 0;
    `;
  }

  // ==================== BUTTONS ====================

  private setupButtons(): void {
    if (!this.container) return;

    // Color
    const colorBtn = this.container.querySelector('#qtbColorBtn');
    colorBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      this.closeDropdowns();

      const { ColorPicker } = await import('../../../core/color-picker');
      const picker = new ColorPicker({
        color:   this.currentColor,
        opacity: 1,
        onChange: (hex: string) => {
          this.currentColor = hex;
          const dot = this.container?.querySelector('#qtbColorDot') as HTMLElement;
          if (dot) dot.style.background = hex;
          if (this.currentTool) this.callbacks.onColorChange(this.currentTool.id, hex);
        }
      });
      picker.open(colorBtn as HTMLElement);
    });

    // Width button
    const widthBtn = this.container.querySelector('#qtbWidthBtn');
    widthBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown('width');
    });

    // Width items
    this.container.querySelectorAll('.qtb-width-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const width = parseFloat((item as HTMLElement).dataset.width || '1');
        this.currentWidth = width;
        this.updateWidthPreview();
        this.closeDropdowns();
        if (this.currentTool) this.callbacks.onLineWidthChange(this.currentTool.id, width);
      });
    });

    // Style button
    const styleBtn = this.container.querySelector('#qtbStyleBtn');
    styleBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown('style');
    });

    // Style items
    this.container.querySelectorAll('.qtb-style-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const style = parseInt((item as HTMLElement).dataset.style || '0');
        this.currentStyle = style;
        this.updateStylePreview();
        this.closeDropdowns();
        if (this.currentTool) this.callbacks.onLineStyleChange(this.currentTool.id, style);
      });
    });

    // Settings
    const settingsBtn = this.container.querySelector('#qtbSettingsBtn');
    settingsBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeDropdowns();
      if (this.currentTool) this.callbacks.onSettingsClick(this.currentTool);
    });

    // Lock
    const lockBtn = this.container.querySelector('#qtbLockBtn');
    lockBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeDropdowns();
      if (this.currentTool) {
        const isLocked = this.currentTool.options?.locked || false;
        this.currentTool.options        = this.currentTool.options || {};
        this.currentTool.options.locked = !isLocked;
        this.updateToolbarValues();
        this.callbacks.onLockToggle(this.currentTool.id, !isLocked);
      }
    });

    // Delete
    const deleteBtn = this.container.querySelector('#qtbDeleteBtn');
    deleteBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeDropdowns();
      if (this.currentTool) {
        if (this.currentTool.options?.locked) {
          alert('This tool is locked. Unlock it first to delete.');
          return;
        }
        this.callbacks.onDelete(this.currentTool.id);
        this.hide();
      }
    });
  }

  // ==================== DROPDOWNS ====================

  private toggleDropdown(type: 'width' | 'style'): void {
    if (this.activeDropdown === type) {
      this.closeDropdowns();
      return;
    }
    this.closeDropdowns();
    this.activeDropdown = type;

    const dropdownId = type === 'width' ? 'qtbWidthDropdown' : 'qtbStyleDropdown';
    const dropdown   = this.container?.querySelector(`#${dropdownId}`) as HTMLElement;
    if (dropdown) dropdown.classList.add('qtb-dropdown-open');

    const wrapId = type === 'width' ? 'qtbWidthWrap' : 'qtbStyleWrap';
    const wrap   = this.container?.querySelector(`#${wrapId}`) as HTMLElement;
    if (wrap) wrap.classList.add('qtb-wrap-active');
  }

  private closeDropdowns(): void {
    if (!this.container) return;
    this.container.querySelectorAll('.qtb-dropdown').forEach(d => d.classList.remove('qtb-dropdown-open'));
    this.container.querySelectorAll('.qtb-dropdown-wrap').forEach(w => w.classList.remove('qtb-wrap-active'));
    this.activeDropdown = null;
  }

  // ==================== DRAGGING ====================

  private setupDragging(): void {
    const handle = this.container?.querySelector('.qtb-drag-handle') as HTMLElement;
    if (!handle || !this.container) return;

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      this.isDragging  = true;
      const rect       = this.container!.getBoundingClientRect();
      this.dragOffsetX = e.clientX - rect.left;
      this.dragOffsetY = e.clientY - rect.top;
      this.container!.classList.add('qtb-dragging');
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isDragging || !this.container) return;
      const x      = e.clientX - this.dragOffsetX;
      const y      = e.clientY - this.dragOffsetY;
      const maxX   = window.innerWidth  - this.container.offsetWidth;
      const maxY   = window.innerHeight - this.container.offsetHeight;
      const boundX = Math.max(0, Math.min(x, maxX));
      const boundY = Math.max(0, Math.min(y, maxY));
      this.container.style.left = `${boundX}px`;
      this.container.style.top  = `${boundY}px`;
      this.savedX = boundX;
      this.savedY = boundY;
    });

    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.container?.classList.remove('qtb-dragging');
        document.body.style.userSelect = '';
      }
    });
  }

  // ==================== OUTSIDE CLICK ====================

private handleOutsideClick = (e: MouseEvent): void => {
    if (!this.container) return;
    if (this.container.contains(e.target as Node)) return;
    
    // ✅ Hide entire toolbar on outside click
    this.hide();
};

  // ==================== STYLES ====================

  private injectStyles(): void {
    if (document.getElementById('qtb-styles')) return;

    const style = document.createElement('style');
    style.id = 'qtb-styles';
    style.textContent = `
      .qtb-container {
        position: fixed;
        display: flex;
        align-items: center;
        gap: 2px;
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 4px 6px;
        box-shadow: var(--card-shadow);
        z-index: 10002;
        user-select: none;
        animation: qtbFadeIn 0.15s ease;
        min-height: 34px;
        font-family: var(--text-sans);
      }

      .qtb-container.qtb-hiding {
        animation: qtbFadeOut 0.15s ease forwards;
      }

      .qtb-container.qtb-dragging {
        box-shadow: 0 16px 40px rgba(0,0,0,0.6);
        transform: scale(1.02);
      }

      @keyframes qtbFadeIn {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      @keyframes qtbFadeOut {
        from { opacity: 1; transform: translateY(0); }
        to   { opacity: 0; transform: translateY(-4px); }
      }

      .qtb-drag-handle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 26px;
        color: var(--text-muted);
        cursor: grab;
        border-radius: 4px;
        transition: color 0.15s ease;
        flex-shrink: 0;
        font-size: var(--text-xs);
      }

      .qtb-drag-handle:hover  { color: var(--text-secondary); background: var(--bg-hover); }
      .qtb-drag-handle:active { cursor: grabbing; color: var(--text-primary); }

      .qtb-divider {
        width: 1px;
        height: 18px;
        background: var(--border);
        flex-shrink: 0;
        margin: 0 2px;
      }

      .qtb-item {
        position: relative;
        display: flex;
        align-items: center;
      }

      .qtb-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        height: 26px;
        padding: 0 6px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 5px;
        color: var(--text-secondary);
        font-size: var(--text-sm);
        cursor: pointer;
        transition: all 0.15s ease;
        min-width: 26px;
        font-family: var(--text-sans);
      }

      .qtb-btn:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
        border-color: var(--border-light);
      }

      .qtb-btn-active {
        background: var(--bg-active) !important;
        color: var(--accent-info) !important;
        border-color: var(--border-light) !important;
      }

      .qtb-btn-danger:hover {
        background: rgba(var(--accent-sell-rgb), 0.12) !important;
        color: var(--accent-sell) !important;
        border-color: rgba(var(--accent-sell-rgb), 0.3) !important;
      }

      .qtb-color-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 5px;
        cursor: pointer;
        transition: all 0.15s ease;
        padding: 0;
      }

      .qtb-color-btn:hover {
        background: var(--bg-hover);
        border-color: var(--border-light);
      }

      .qtb-color-dot {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 2px solid var(--border-light);
        transition: border-color 0.15s ease;
        flex-shrink: 0;
      }

      .qtb-color-btn:hover .qtb-color-dot { border-color: var(--text-muted); }

      .qtb-chevron { font-size: 0.5rem !important; color: var(--text-muted); }

      .qtb-dropdown-wrap { position: relative; }

      .qtb-wrap-active .qtb-btn {
        background: var(--bg-hover);
        border-color: var(--border-light);
        color: var(--text-primary);
      }

      .qtb-dropdown {
        position: absolute;
        top: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%);
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: 8px;
        box-shadow: var(--card-shadow);
        padding: 4px;
        display: none;
        flex-direction: column;
        gap: 2px;
        min-width: 100px;
        z-index: 10003;
      }

      .qtb-dropdown-open { display: flex !important; }

      .qtb-dropdown-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 7px 10px;
        border-radius: 5px;
        cursor: pointer;
        transition: background 0.15s ease;
        white-space: nowrap;
      }

      .qtb-dropdown-item:hover { background: var(--bg-hover); }

      .qtb-width-line {
        width: 50px;
        background: var(--text-secondary);
        border-radius: 1px;
        flex-shrink: 0;
      }

      .qtb-width-label {
        font-size: var(--text-xs);
        color: var(--text-muted);
        font-family: var(--text-mono);
        min-width: 20px;
      }

      .qtb-style-line  { width: 50px; height: 0; flex-shrink: 0; }
      .qtb-style-solid  { border-top: 2px solid var(--text-secondary); }
      .qtb-style-dashed { border-top: 2px dashed var(--text-secondary); }
      .qtb-style-dotted { border-top: 2px dotted var(--text-secondary); }

      .qtb-style-label {
        font-size: var(--text-xs);
        color: var(--text-muted);
        font-family: var(--text-sans);
      }
    `;

    document.head.appendChild(style);
  }

  // ==================== DESTROY ====================

  public destroy(): void {
    this.hide();
    document.removeEventListener('mousedown', this.handleOutsideClick);
  }
}