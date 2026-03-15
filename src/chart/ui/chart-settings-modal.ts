// ================================================================
// ⚙️ SETTINGS MODAL
// ================================================================

import { SettingsModalConfig, ChartColors, DEFAULT_CHART_COLORS, DARK_CHART_COLORS, LIGHT_CHART_COLORS } from '../chart-types';

const TEMPLATES_KEY       = 'mega_flowz_chart_templates';
const ACTIVE_TEMPLATE_KEY = 'mega_flowz_active_template';

const CANDLE_ICON = `
<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="4" width="4" height="8" fill="currentColor" rx="0.5"/>
    <line x1="5" y1="1" x2="5" y2="4" stroke="currentColor" stroke-width="1.2"/>
    <line x1="5" y1="12" x2="5" y2="15" stroke="currentColor" stroke-width="1.2"/>
    <rect x="9" y="5.5" width="4" height="6" fill="currentColor" rx="0.5" opacity="0.45"/>
    <line x1="11" y1="2.5" x2="11" y2="5.5" stroke="currentColor" stroke-width="1.2" opacity="0.45"/>
    <line x1="11" y1="11.5" x2="11" y2="14" stroke="currentColor" stroke-width="1.2" opacity="0.45"/>
</svg>`;

interface SavedTemplate {
    name:     string;
    settings: Partial<AllSettings>;
}

interface AllSettings {
    // Canvas
    bgMode:           'solid' | 'gradient';
    bgColor:          string;
    bgColor2:         string;
    accent:           string;
    gridColor:        string;
    gridVertical:     boolean;
    gridHorizontal:   boolean;
    crosshairColor:   string;
    crosshairStyle:   string;
    textColor:        string;
    fontSize:         number;
    // Symbol
    bull:             string;
    bear:             string;
    wickBull:         string;
    wickBear:         string;
    borderBull:       string;
    borderBear:       string;
    lineColor:        string;
    // Scales
    scaleMode:        'normal' | 'log' | 'percent';
    autoScale:        boolean;
    scalePosition:    'right' | 'left';
    marginTop:        number;
    marginBottom:     number;
    // Time Scale
    showTimeScale:    boolean;
    showTime:         boolean;
    barSpacing:       number;
    // Trading
    showAsk:          boolean;
    askColor:         string;
    showBid:          boolean;
    bidColor:         string;
    showSpread:       boolean;
    showDepth:        boolean;
    showBuyArrows:    boolean;
    buyArrowColor:    string;
    showSellArrows:   boolean;
    sellArrowColor:   string;
    // Watermark
    showWatermark:    boolean;
    watermarkColor:   string;
    watermarkOpacity: number;
    // Legend
    legendPosition:   'top-left' | 'top-right';
    legendSize:       'small' | 'medium' | 'large';
    showSymbol:       boolean;
    showPrice:        boolean;
    showTimeframe:    boolean;
    showDot:          boolean;
    showVolume:       boolean;
}

export class ChartSettingsModal {
    private config:         SettingsModalConfig;
    private overlay:        HTMLElement | null = null;
    private activeCategory: string = 'symbol';
    private liveColors:     Record<string, any> = {};
    private bgMode:         'solid' | 'gradient' = 'solid';

    private boundKeyDown:      (e: KeyboardEvent) => void;
    private boundOutsideClick: (e: MouseEvent)    => void;

    constructor(config: SettingsModalConfig) {
        this.config     = { ...config };
        this.liveColors = { ...config.colors };
        this.boundKeyDown      = this.handleKeyDown.bind(this);
        this.boundOutsideClick = this.handleOutsideClick.bind(this);
    }

    // ==================== OPEN / CLOSE ====================

    public open(): void {
        if (document.getElementById('settingsOverlay')) return;
        this.createModal();
        this.setupHandlers();
        this.switchCategory(this.activeCategory);
    }

    public close(): void {
        if (!this.overlay) return;

        const modal = this.overlay.querySelector('.settings-modal') as HTMLElement;
        if ((modal as any)._dragCleanup) {
            (modal as any)._dragCleanup();
        }

        this.overlay.classList.add('closing');
        setTimeout(() => {
            this.overlay?.remove();
            this.overlay = null;
        }, 180);

        document.removeEventListener('keydown', this.boundKeyDown);
        document.removeEventListener('click',   this.boundOutsideClick);
    }

    // ==================== CREATE MODAL ====================

    private createModal(): void {
        this.overlay = document.createElement('div');
        this.overlay.id = 'settingsOverlay';
        this.overlay.className = 'settings-overlay';

        this.overlay.innerHTML = `
            <div class="settings-modal">

                <!-- Header -->
                <div class="settings-modal-header">
                    <div class="settings-modal-title">
                        <i class="fas fa-sliders"></i>
                        <span>Settings</span>
                    </div>
                    <button class="settings-modal-close" id="settingsClose">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Body -->
                <div class="settings-modal-body">

                    <!-- Sidebar -->
                    <div class="settings-sidebar">
                        <div class="settings-categories">
                            <div class="settings-cat active" data-cat="symbol">
                                <span class="settings-cat-icon">${CANDLE_ICON}</span>
                                Symbol
                            </div>
                            <div class="settings-cat" data-cat="canvas">
                                <i class="fas fa-display"></i> Canvas
                            </div>
                            <div class="settings-cat" data-cat="scales">
                                <i class="fas fa-ruler-combined"></i> Scales
                            </div>
                            <div class="settings-cat" data-cat="trading">
                                <i class="fas fa-arrow-trend-up"></i> Trading
                            </div>
                            <div class="settings-cat" data-cat="alerts">
                                <i class="fas fa-bell"></i> Alerts
                            </div>
                            <div class="settings-cat" data-cat="watermark">
                                <i class="fas fa-copyright"></i> Watermark
                            </div>
                            <div class="settings-cat" data-cat="legend">
                                <i class="fas fa-layer-group"></i> Legend
                            </div>
                        </div>

                        <!-- Themes -->
                        <div class="settings-themes">
                            <div class="settings-themes-title">Themes</div>
                            <div class="settings-theme-item" data-theme="system">
                                <div class="settings-theme-dot" style="background:#0f1724; border-color:#2a384a;"></div>
                                System
                                <i class="fas fa-check"></i>
                            </div>
                            <div class="settings-theme-item" data-theme="dark">
                                <div class="settings-theme-dot" style="background:#0a0e13; border-color:#1e2a3a;"></div>
                                Dark
                                <i class="fas fa-check"></i>
                            </div>
                            <div class="settings-theme-item" data-theme="light">
                                <div class="settings-theme-dot" style="background:#f8f9fc; border-color:#ccd3e0;"></div>
                                Light
                                <i class="fas fa-check"></i>
                            </div>
                        </div>
                    </div>

                    <!-- Panel -->
                    <div class="settings-panel">

                        <!-- SYMBOL -->
                        <div class="settings-content active" data-content="symbol">
                            <div class="settings-section">
                                <div class="settings-section-title">Candles</div>
                                ${this.dualRow('Body Color',   'bull',       'bear',       this.c('bull'),       this.c('bear'))}
                                ${this.dualRow('Wick Color',   'wickBull',   'wickBear',   this.c('wickBull'),   this.c('wickBear'))}
                                ${this.dualRow('Border Color', 'borderBull', 'borderBear', this.c('borderBull'), this.c('borderBear'))}
                            </div>
                            <div class="settings-section">
                                <div class="settings-section-title">Line / Area</div>
                                ${this.colorRow('Line Color', 'line', this.c('line'))}
                            </div>
                        </div>

                        <!-- CANVAS -->
                        <div class="settings-content" data-content="canvas">
                            <div class="settings-section">
                                <div class="settings-section-title">Background</div>
                                <div class="settings-row">
                                    <span class="settings-row-label">Background Color</span>
                                    <div class="settings-bg-control">
                                        <div class="settings-bg-tabs">
                                            <button class="settings-bg-tab active" data-mode="solid">Solid</button>
                                            <button class="settings-bg-tab" data-mode="gradient">Gradient</button>
                                        </div>
                                        <div class="settings-bg-swatches" id="bgSwatches">
                                            <button class="settings-color-swatch" data-key="background" style="background:${this.c('background')};"></button>
                                        </div>
                                    </div>
                                </div>
                                ${this.colorRow('Accent Color', 'accent', this.c('accent') || 'var(--accent-info)')}
                            </div>
                            <div class="settings-section">
                                <div class="settings-section-title">Grid</div>
                                ${this.colorRow('Grid Color', 'grid', this.c('grid'))}
                                ${this.toggleRow('Vertical Grid',   'gridVertical',   true)}
                                ${this.toggleRow('Horizontal Grid', 'gridHorizontal', true)}
                            </div>
                            <div class="settings-section">
                                <div class="settings-section-title">Crosshair</div>
                                ${this.colorRow('Crosshair Color', 'crosshair', this.c('crosshair'))}
                                <div class="settings-row">
                                    <span class="settings-row-label">Line Style</span>
                                    <select class="settings-select" data-key="crosshairStyle">
                                        <option value="dotted">Dotted</option>
                                        <option value="dashed" selected>Dashed</option>
                                        <option value="solid">Solid</option>
                                    </select>
                                </div>
                            </div>
                            <div class="settings-section">
                                <div class="settings-section-title">Text</div>
                                ${this.colorRow('Axis Text Color', 'textColor', this.c('textColor'))}
                                ${this.rangeRow('Font Size', 'fontSize', 8, 16, 11, 'px')}
                            </div>
                        </div>

                        <!-- SCALES -->
                        <div class="settings-content" data-content="scales">
                            <div class="settings-section">
                                <div class="settings-section-title">Price Scale</div>
                                <div class="settings-row">
                                    <span class="settings-row-label">Scale Mode</span>
                                    <div class="settings-mode-group">
                                        <button class="settings-mode-btn active" data-scale="normal">Normal</button>
                                        <button class="settings-mode-btn" data-scale="log">Log</button>
                                        <button class="settings-mode-btn" data-scale="percent">%</button>
                                    </div>
                                </div>
                                ${this.toggleRow('Auto Scale', 'autoScale', true)}
                                <div class="settings-row">
                                    <span class="settings-row-label">Scale Position</span>
                                    <div class="settings-radio-group">
                                        <label class="settings-radio-label">
                                            <input type="radio" name="scalePos" value="right" checked> Right
                                        </label>
                                        <label class="settings-radio-label">
                                            <input type="radio" name="scalePos" value="left"> Left
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div class="settings-section">
                                <div class="settings-section-title">Margins</div>
                                ${this.rangeRow('Top Margin',    'marginTop',    0, 50, 10, '%')}
                                ${this.rangeRow('Bottom Margin', 'marginBottom', 0, 50, 10, '%')}
                            </div>
                            <div class="settings-section">
                                <div class="settings-section-title">Time Scale</div>
                                ${this.toggleRow('Show Time Scale', 'timescaleVisible', true)}
                                ${this.toggleRow('Show Time',       'timeVisible',      true)}
                                ${this.rangeRow('Bar Spacing', 'barSpacing', 1, 50, 6, 'px')}
                            </div>
                        </div>

                        <!-- TRADING -->
                        <div class="settings-content" data-content="trading">
                            <div class="settings-section">
                                <div class="settings-section-title">Price Display</div>
                                ${this.toggleColorRow('Show Ask Price',  'showAsk',  true,  'askColor',  this.c('bull'))}
                                ${this.toggleColorRow('Show Bid Price',  'showBid',  true,  'bidColor',  this.c('bear'))}
                                ${this.toggleRow('Show Spread Body', 'showSpread', false)}
                            </div>
                            <div class="settings-section">
                                <div class="settings-section-title">Market Depth</div>
                                ${this.toggleRow('Show Market Depth', 'showDepth', false)}
                            </div>
                            <div class="settings-section">
                                <div class="settings-section-title">Trade Arrows</div>
                                ${this.toggleColorRow('Buy Arrows',  'showBuyArrows',  true, 'buyArrowColor',  this.c('bull'))}
                                ${this.toggleColorRow('Sell Arrows', 'showSellArrows', true, 'sellArrowColor', this.c('bear'))}
                            </div>
                        </div>

                        <!-- ALERTS -->
                        <div class="settings-content" data-content="alerts">
                            <div class="settings-alerts-placeholder">
                                <i class="fas fa-bell"></i>
                                <p>Alerts Coming Soon</p>
                                <small>Price alert settings will appear here in a future update</small>
                            </div>
                        </div>

                        <!-- WATERMARK -->
                        <div class="settings-content" data-content="watermark">
                            <div class="settings-section">
                                <div class="settings-section-title">Watermark</div>
                                ${this.toggleRow('Show Watermark', 'showWatermark', false)}
                                ${this.colorRow('Color', 'watermarkColor', 'rgba(255,255,255,0.08)')}
                                ${this.rangeRow('Opacity', 'watermarkOpacity', 1, 100, 5, '%')}
                            </div>
                        </div>

                        <!-- LEGEND -->
                        <div class="settings-content" data-content="legend">
                            <div class="settings-section">
                                <div class="settings-section-title">Position & Size</div>
                                <div class="settings-row">
                                    <span class="settings-row-label">Position</span>
                                    <div class="settings-radio-group">
                                        <label class="settings-radio-label">
                                            <input type="radio" name="legendPos" value="top-left" checked> Top Left
                                        </label>
                                        <label class="settings-radio-label">
                                            <input type="radio" name="legendPos" value="top-right"> Top Right
                                        </label>
                                    </div>
                                </div>
                                <div class="settings-row">
                                    <span class="settings-row-label">Size</span>
                                    <div class="settings-mode-group">
                                        <button class="settings-mode-btn" data-size="small">Small</button>
                                        <button class="settings-mode-btn active" data-size="medium">Medium</button>
                                        <button class="settings-mode-btn" data-size="large">Large</button>
                                    </div>
                                </div>
                            </div>
                            <div class="settings-section">
                                <div class="settings-section-title">Visibility</div>
                                ${this.toggleRow('Show Symbol',         'showSymbol',    true)}
                                ${this.toggleRow('Show Price',          'showPrice',     true)}
                                ${this.toggleRow('Show Timeframe',      'showTimeframe', true)}
                                ${this.toggleRow('Show Connection Dot', 'showDot',       true)}
                                ${this.toggleRow('Show Volume Row',     'showVolume',    true)}
                            </div>
                        </div>

                    </div>
                </div>

                <!-- Footer -->
                <div class="settings-modal-footer">
                    <button class="settings-btn settings-btn-save" id="settingsSaveTemplate">
                        <i class="fas fa-bookmark"></i> Save Template
                    </button>
                    <button class="settings-btn settings-btn-cancel" id="settingsCancel">Cancel</button>
                    <button class="settings-btn settings-btn-apply"  id="settingsApply">Apply</button>
                    <button class="settings-btn settings-btn-ok"     id="settingsOk">OK</button>

                    <!-- Save Template Popup -->
                    <div class="settings-template-popup" id="settingsTemplatePopup" style="display:none;">
                        <div class="settings-template-popup-header">My Templates</div>
                        <div class="settings-template-list" id="settingsTemplateList">
                            <div class="settings-template-empty" id="settingsTemplateEmpty">No saved templates yet</div>
                        </div>
                        <div class="settings-template-save-row">
                            <input type="text" class="settings-template-input" id="settingsTemplateInput" placeholder="Name your template...">
                            <button class="settings-template-save-btn" id="settingsTemplateSave">Save</button>
                        </div>
                    </div>
                </div>

            </div>
        `;

        document.body.appendChild(this.overlay);

        // ✅ Sync active theme item on open
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'system';
        this.overlay.querySelectorAll('.settings-theme-item').forEach(item => {
            item.classList.toggle('active', (item as HTMLElement).dataset.theme === currentTheme);
        });

        // Center on open
        const modal  = this.overlay.querySelector('.settings-modal') as HTMLElement;
        const handle = this.overlay.querySelector('.settings-modal-header') as HTMLElement;

        requestAnimationFrame(() => {
            const rect = modal.getBoundingClientRect();
            modal.style.left = `${(window.innerWidth  - rect.width)  / 2}px`;
            modal.style.top  = `${(window.innerHeight - rect.height) / 2}px`;
        });

        this.makeDraggable(modal, handle);
    }

    // ==================== ROW BUILDERS ====================

    private c(key: string): string {
        return (this.config.colors as any)[key] || '#2962FF';
    }

    private colorRow(label: string, key: string, value: string): string {
        return `
            <div class="settings-row">
                <span class="settings-row-label">${label}</span>
                <button class="settings-color-swatch" data-key="${key}" style="background:${value};"></button>
            </div>
        `;
    }

    private dualRow(label: string, keyA: string, keyB: string, valA: string, valB: string): string {
        return `
            <div class="settings-row">
                <span class="settings-row-label">${label}</span>
                <div class="settings-dual-swatch">
                    <button class="settings-color-swatch" data-key="${keyA}" style="background:${valA};" title="Bull"></button>
                    <button class="settings-color-swatch" data-key="${keyB}" style="background:${valB};" title="Bear"></button>
                </div>
            </div>
        `;
    }

    private toggleRow(label: string, key: string, checked: boolean): string {
        return `
            <div class="settings-row">
                <span class="settings-row-label">${label}</span>
                <label class="settings-toggle">
                    <input type="checkbox" data-key="${key}" ${checked ? 'checked' : ''}>
                    <span class="settings-toggle-slider"></span>
                </label>
            </div>
        `;
    }

    private toggleColorRow(label: string, toggleKey: string, checked: boolean, colorKey: string, color: string): string {
        return `
            <div class="settings-row">
                <span class="settings-row-label">${label}</span>
                <div class="settings-row-controls">
                    <label class="settings-toggle">
                        <input type="checkbox" data-key="${toggleKey}" ${checked ? 'checked' : ''}>
                        <span class="settings-toggle-slider"></span>
                    </label>
                    <button class="settings-color-swatch" data-key="${colorKey}" style="background:${color};"></button>
                </div>
            </div>
        `;
    }

    private rangeRow(label: string, key: string, min: number, max: number, value: number, suffix: string): string {
        return `
            <div class="settings-row">
                <span class="settings-row-label">${label}</span>
                <div class="settings-range-wrap">
                    <input type="range" class="settings-range" data-key="${key}" data-suffix="${suffix}" min="${min}" max="${max}" value="${value}">
                    <span class="settings-range-value" data-range-val="${key}">${value}${suffix}</span>
                </div>
            </div>
        `;
    }

    // ==================== CATEGORY SWITCHING ====================

    private switchCategory(id: string): void {
        if (!this.overlay) return;
        this.activeCategory = id;
        this.overlay.querySelectorAll('.settings-cat').forEach(el => {
            el.classList.toggle('active', (el as HTMLElement).dataset.cat === id);
        });
        this.overlay.querySelectorAll('.settings-content').forEach(el => {
            el.classList.toggle('active', (el as HTMLElement).dataset.content === id);
        });
    }

    // ==================== HANDLERS ====================

    private setupHandlers(): void {
        if (!this.overlay) return;

        // Category switching
        this.overlay.querySelectorAll('.settings-cat').forEach(cat => {
            cat.addEventListener('click', () => {
                const id = (cat as HTMLElement).dataset.cat;
                if (id) this.switchCategory(id);
            });
        });

        // Close
        this.overlay.querySelector('#settingsClose')?.addEventListener('click',  () => this.close());
        this.overlay.querySelector('#settingsCancel')?.addEventListener('click', () => this.close());

        // Apply
        this.overlay.querySelector('#settingsApply')?.addEventListener('click', () => this.applyChanges());

        // OK
        this.overlay.querySelector('#settingsOk')?.addEventListener('click', () => {
            this.applyChanges();
            this.close();
        });

        // Color swatches
        this.overlay.querySelectorAll('.settings-color-swatch').forEach(swatch => {
            swatch.addEventListener('click', async (e) => {
                e.stopPropagation();
                const btn     = swatch as HTMLElement;
                const key     = btn.dataset.key!;
                const current = this.liveColors[key] || '#2962FF';

                const { ColorPicker } = await import('../../core/color-picker');
                const picker = new ColorPicker({
                    color:    current,
                    opacity:  1,
                    onChange: (hex: string) => {
                        this.liveColors[key] = hex;
                        btn.style.background = hex;

                        if (key === 'accent') {
                            document.documentElement.style.setProperty('--accent', hex);
                            document.dispatchEvent(new CustomEvent('accent-color-change', {
                                detail: { color: hex }
                            }));
                            return;
                        }

                        document.dispatchEvent(new CustomEvent('chart-colors-change', {
                            detail: { colors: { ...this.liveColors } }
                        }));
                    }
                });
                picker.open(btn);
            });
        });

        // Background solid/gradient
        this.overlay.querySelectorAll('.settings-bg-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.overlay?.querySelectorAll('.settings-bg-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.bgMode = (tab as HTMLElement).dataset.mode as 'solid' | 'gradient';
                this.updateBgSwatches();
            });
        });

        // Range sliders
        this.overlay.querySelectorAll('.settings-range').forEach(range => {
            range.addEventListener('input', (e) => {
                const input  = e.target as HTMLInputElement;
                const key    = input.dataset.key!;
                const suffix = input.dataset.suffix || '';
                const val    = this.overlay?.querySelector(`[data-range-val="${key}"]`);
                if (val) val.textContent = `${input.value}${suffix}`;
                this.handleRangeLive(key, parseInt(input.value));
            });
        });

        // Toggles
        this.overlay.querySelectorAll('.settings-toggle input').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const input = e.target as HTMLInputElement;
                this.handleToggleLive(input.dataset.key!, input.checked);
            });
        });

        // Select
        this.overlay.querySelectorAll('.settings-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const el = e.target as HTMLSelectElement;
                if (el.dataset.key === 'crosshairStyle') {
                    document.dispatchEvent(new CustomEvent('chart-crosshair-style', {
                        detail: { style: el.value }
                    }));
                }
            });
        });

        // Scale mode buttons
        this.overlay.querySelectorAll('.settings-mode-btn[data-scale]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.overlay?.querySelectorAll('.settings-mode-btn[data-scale]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const mode = (btn as HTMLElement).dataset.scale!;
                document.dispatchEvent(new CustomEvent('chart-scale-change', {
                    detail: {
                        logScale:     mode === 'log',
                        percentScale: mode === 'percent',
                    }
                }));
            });
        });

        // Legend size buttons
        this.overlay.querySelectorAll('.settings-mode-btn[data-size]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.overlay?.querySelectorAll('.settings-mode-btn[data-size]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.dispatchEvent(new CustomEvent('legend-size-change', {
                    detail: { size: (btn as HTMLElement).dataset.size }
                }));
            });
        });

        // Themes
        this.overlay.querySelectorAll('.settings-theme-item').forEach(item => {
            item.addEventListener('click', () => {
                this.overlay?.querySelectorAll('.settings-theme-item').forEach(t => t.classList.remove('active'));
                item.classList.add('active');
                this.applyTheme((item as HTMLElement).dataset.theme!);
            });
        });

        // Template popup
        this.setupTemplatePopup();

        // Keyboard
        document.addEventListener('keydown', this.boundKeyDown);
    }

    // ==================== LIVE HANDLERS ====================

    private handleRangeLive(key: string, value: number): void {
        const map: Record<string, string> = {
            barSpacing: 'chart-bar-spacing',
            fontSize:   'chart-font-size',
        };
        if (map[key]) {
            document.dispatchEvent(new CustomEvent(map[key], {
                detail: { [key === 'barSpacing' ? 'spacing' : 'size']: value }
            }));
        } else if (key === 'marginTop' || key === 'marginBottom') {
            const top    = parseInt((this.overlay?.querySelector('[data-key="marginTop"]')    as HTMLInputElement)?.value || '10');
            const bottom = parseInt((this.overlay?.querySelector('[data-key="marginBottom"]') as HTMLInputElement)?.value || '10');
            document.dispatchEvent(new CustomEvent('chart-scale-margins', {
                detail: { top: top / 100, bottom: bottom / 100 }
            }));
        } else if (key === 'watermarkOpacity') {
            document.dispatchEvent(new CustomEvent('chart-watermark', {
                detail: { opacity: value / 100 }
            }));
        }
    }

    private handleToggleLive(key: string, value: boolean): void {
        const map: Record<string, string> = {
            gridVertical:     'chart-toggle-grid-vertical',
            gridHorizontal:   'chart-toggle-grid-horizontal',
            timescaleVisible: 'chart-toggle-timescale',
        };
        if (map[key]) {
            document.dispatchEvent(new CustomEvent(map[key]));
        } else if (key === 'timeVisible') {
            document.dispatchEvent(new CustomEvent('chart-time-visible',  { detail: { visible: value } }));
        } else if (key === 'showWatermark') {
            document.dispatchEvent(new CustomEvent('chart-watermark',     { detail: { visible: value } }));
        } else if (key === 'autoScale') {
            document.dispatchEvent(new CustomEvent('chart-scale-change',  { detail: { autoScale: value } }));
        } else {
            document.dispatchEvent(new CustomEvent('chart-setting-toggle', { detail: { key, value } }));
        }
    }

    // ==================== BACKGROUND SWATCHES ====================

    private updateBgSwatches(): void {
        const container = this.overlay?.querySelector('#bgSwatches');
        if (!container) return;

        if (this.bgMode === 'gradient') {
            container.innerHTML = `
                <button class="settings-color-swatch" data-key="background"  style="background:${this.liveColors['background']  || '#131722'};"></button>
                <button class="settings-color-swatch" data-key="background2" style="background:${this.liveColors['background2'] || '#1E3A5F'};"></button>
            `;
        } else {
            container.innerHTML = `
                <button class="settings-color-swatch" data-key="background" style="background:${this.liveColors['background'] || '#131722'};"></button>
            `;
        }

        container.querySelectorAll('.settings-color-swatch').forEach(swatch => {
            swatch.addEventListener('click', async (e) => {
                e.stopPropagation();
                const btn = swatch as HTMLElement;
                const key = btn.dataset.key!;
                const { ColorPicker } = await import('../../core/color-picker');
                const picker = new ColorPicker({
                    color:    this.liveColors[key] || '#131722',
                    opacity:  1,
                    onChange: (hex: string) => {
                        this.liveColors[key] = hex;
                        btn.style.background = hex;
                        document.dispatchEvent(new CustomEvent('chart-colors-change', {
                            detail: { colors: { ...this.liveColors } }
                        }));
                    }
                });
                picker.open(btn);
            });
        });
    }

    // ==================== THEMES ====================

    private applyTheme(theme: string): void {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('app-theme', theme);

        // ✅ Clear active template — theme resets everything
        localStorage.removeItem(ACTIVE_TEMPLATE_KEY);

        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', (btn as HTMLElement).dataset.theme === theme);
        });

        const presetMap: Record<string, ChartColors> = {
            system: DEFAULT_CHART_COLORS,
            dark:   DARK_CHART_COLORS,
            light:  LIGHT_CHART_COLORS,
        };

        const preset = presetMap[theme];
        if (!preset) return;

        this.liveColors = { ...preset };

        this.overlay?.querySelectorAll('.settings-color-swatch').forEach(swatch => {
            const key = (swatch as HTMLElement).dataset.key;
            if (key && (this.liveColors as any)[key]) {
                (swatch as HTMLElement).style.background = (this.liveColors as any)[key];
            }
        });

        document.dispatchEvent(new CustomEvent('chart-colors-change', {
            detail: { colors: { ...this.liveColors } }
        }));
        document.dispatchEvent(new CustomEvent('theme-changed', {
            detail: { theme }
        }));
    }

    // ==================== APPLY ====================

    private applyChanges(): void {
        document.dispatchEvent(new CustomEvent('chart-colors-change', {
            detail: { colors: { ...this.liveColors } }
        }));

        if (!this.overlay) return;

        const scalePos = this.overlay.querySelector('input[name="scalePos"]:checked') as HTMLInputElement;
        if (scalePos) {
            document.dispatchEvent(new CustomEvent('chart-scale-position', {
                detail: { position: scalePos.value }
            }));
        }

        const legendPos = this.overlay.querySelector('input[name="legendPos"]:checked') as HTMLInputElement;
        if (legendPos) {
            document.dispatchEvent(new CustomEvent('legend-position-change', {
                detail: { position: legendPos.value }
            }));
        }
    }

    // ==================== TEMPLATES ====================

    private setupTemplatePopup(): void {
        const btn   = this.overlay?.querySelector('#settingsSaveTemplate') as HTMLElement;
        const popup = this.overlay?.querySelector('#settingsTemplatePopup') as HTMLElement;
        const input = this.overlay?.querySelector('#settingsTemplateInput') as HTMLInputElement;
        const save  = this.overlay?.querySelector('#settingsTemplateSave') as HTMLElement;

        if (!btn || !popup) return;

        // ✅ Prevent popup clicks from bubbling to outside click handler
        popup.addEventListener('click', (e) => e.stopPropagation());

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = popup.style.display !== 'none';
            popup.style.display = isOpen ? 'none' : 'block';
            if (!isOpen) {
                this.renderTemplates();
                setTimeout(() => input?.focus(), 50);
            }
        });

        save?.addEventListener('click', (e) => {
            e.stopPropagation();
            const name = input?.value.trim();
            if (!name) return;
            const currentSettings = this.captureCurrentSettings();
            const all = this.loadTemplates();
            all.push({ name, settings: currentSettings });
            this.saveTemplates(all);
            if (input) input.value = '';
            this.renderTemplates();
        });

        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') save?.click();
        });

        document.addEventListener('click', this.boundOutsideClick);
    }

    // ✅ Capture all current modal state into AllSettings
    private captureCurrentSettings(): Partial<AllSettings> {
        if (!this.overlay) return { ...this.liveColors } as any;

        const settings: Partial<AllSettings> = {};

        // Colors from liveColors
        Object.assign(settings, this.liveColors);

        // Toggles
        this.overlay.querySelectorAll('.settings-toggle input').forEach(el => {
            const input = el as HTMLInputElement;
            const key   = input.dataset.key;
            if (key) (settings as any)[key] = input.checked;
        });

        // Ranges
        this.overlay.querySelectorAll('.settings-range').forEach(el => {
            const input = el as HTMLInputElement;
            const key   = input.dataset.key;
            if (key) (settings as any)[key] = parseInt(input.value);
        });

        // Scale mode
        const activeScale = this.overlay.querySelector('.settings-mode-btn[data-scale].active') as HTMLElement;
        if (activeScale) (settings as any).scaleMode = activeScale.dataset.scale;

        // Scale position
        const scalePos = this.overlay.querySelector('input[name="scalePos"]:checked') as HTMLInputElement;
        if (scalePos) settings.scalePosition = scalePos.value as 'right' | 'left';

        // Legend position
        const legendPos = this.overlay.querySelector('input[name="legendPos"]:checked') as HTMLInputElement;
        if (legendPos) settings.legendPosition = legendPos.value as 'top-left' | 'top-right';

        // Legend size
        const activeSize = this.overlay.querySelector('.settings-mode-btn[data-size].active') as HTMLElement;
        if (activeSize) settings.legendSize = activeSize.dataset.size as 'small' | 'medium' | 'large';

        // Crosshair style
        const crosshairSelect = this.overlay.querySelector('[data-key="crosshairStyle"]') as HTMLSelectElement;
        if (crosshairSelect) settings.crosshairStyle = crosshairSelect.value;

        // BG mode
        settings.bgMode = this.bgMode;

        return settings;
    }

    private handleOutsideClick(e: MouseEvent): void {
        const popup = this.overlay?.querySelector('#settingsTemplatePopup') as HTMLElement;
        const btn   = this.overlay?.querySelector('#settingsSaveTemplate') as HTMLElement;
        if (popup?.style.display !== 'none' &&
            !popup?.contains(e.target as Node) &&
            e.target !== btn) {
            popup.style.display = 'none';
        }
    }

    private renderTemplates(): void {
        const list  = this.overlay?.querySelector('#settingsTemplateList')  as HTMLElement;
        const empty = this.overlay?.querySelector('#settingsTemplateEmpty') as HTMLElement;
        if (!list) return;

        list.querySelectorAll('.settings-template-item').forEach(el => el.remove());

        const templates = this.loadTemplates();
        if (templates.length === 0) {
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        templates.forEach((t, i) => {
            const item = document.createElement('div');
            item.className = 'settings-template-item';
            item.innerHTML = `
                <i class="fas fa-sliders"></i>
                <span>${t.name}</span>
                <i class="fas fa-times settings-template-delete"></i>
            `;

            // ✅ Click anywhere on item except delete — applies template
            item.addEventListener('click', (e) => {
                if ((e.target as HTMLElement).classList.contains('settings-template-delete')) return;
                e.stopPropagation();
                this.applyTemplateSettings(t.settings);
                const popup = this.overlay?.querySelector('#settingsTemplatePopup') as HTMLElement;
                if (popup) popup.style.display = 'none';
            });

            // ✅ Delete button
            item.querySelector('.settings-template-delete')?.addEventListener('click', (e) => {
                e.stopPropagation();
                const all = this.loadTemplates();
                all.splice(i, 1);
                this.saveTemplates(all);
                this.renderTemplates();
            });

            list.insertBefore(item, empty);
        });
    }

    // ✅ Apply all settings from template and save as active
    private applyTemplateSettings(settings: Partial<AllSettings>): void {

        // Colors
        const colorKeys = ['background', 'grid', 'bull', 'bear', 'line', 'volumeBull', 'volumeBear',
                           'scaleBorder', 'crosshair', 'textColor', 'wickBull', 'wickBear',
                           'borderBull', 'borderBear'];
        colorKeys.forEach(key => {
            if ((settings as any)[key] !== undefined) {
                this.liveColors[key] = (settings as any)[key];
            }
        });

        // Update swatch buttons
        this.overlay?.querySelectorAll('.settings-color-swatch').forEach(swatch => {
            const key = (swatch as HTMLElement).dataset.key;
            if (key && this.liveColors[key]) {
                (swatch as HTMLElement).style.background = this.liveColors[key];
            }
        });

        // Dispatch chart colors
        document.dispatchEvent(new CustomEvent('chart-colors-change', {
            detail: { colors: { ...this.liveColors } }
        }));

        // Toggles
        const toggleMap: Record<string, string> = {
            gridVertical:     'chart-toggle-grid-vertical',
            gridHorizontal:   'chart-toggle-grid-horizontal',
            timescaleVisible: 'chart-toggle-timescale',
        };
        const toggleKeys = ['gridVertical', 'gridHorizontal', 'timescaleVisible', 'timeVisible',
                            'showWatermark', 'autoScale', 'showAsk', 'showBid', 'showSpread',
                            'showDepth', 'showBuyArrows', 'showSellArrows'];
        toggleKeys.forEach(key => {
            if ((settings as any)[key] !== undefined) {
                const value = (settings as any)[key] as boolean;
                if (toggleMap[key]) {
                    document.dispatchEvent(new CustomEvent(toggleMap[key]));
                } else if (key === 'timeVisible') {
                    document.dispatchEvent(new CustomEvent('chart-time-visible', { detail: { visible: value } }));
                } else if (key === 'showWatermark') {
                    document.dispatchEvent(new CustomEvent('chart-watermark', { detail: { visible: value } }));
                } else if (key === 'autoScale') {
                    document.dispatchEvent(new CustomEvent('chart-scale-change', { detail: { autoScale: value } }));
                } else {
                    document.dispatchEvent(new CustomEvent('chart-setting-toggle', { detail: { key, value } }));
                }
            }
        });

        // Ranges
        if (settings.barSpacing !== undefined) {
            document.dispatchEvent(new CustomEvent('chart-bar-spacing', { detail: { spacing: settings.barSpacing } }));
        }
        if (settings.fontSize !== undefined) {
            document.dispatchEvent(new CustomEvent('chart-font-size', { detail: { size: settings.fontSize } }));
        }
        if (settings.marginTop !== undefined || settings.marginBottom !== undefined) {
            document.dispatchEvent(new CustomEvent('chart-scale-margins', {
                detail: {
                    top:    (settings.marginTop    ?? 10) / 100,
                    bottom: (settings.marginBottom ?? 10) / 100
                }
            }));
        }
        if (settings.watermarkOpacity !== undefined) {
            document.dispatchEvent(new CustomEvent('chart-watermark', {
                detail: { opacity: settings.watermarkOpacity / 100 }
            }));
        }

        // Scale mode
        if (settings.scaleMode) {
            document.dispatchEvent(new CustomEvent('chart-scale-change', {
                detail: {
                    logScale:     settings.scaleMode === 'log',
                    percentScale: settings.scaleMode === 'percent',
                }
            }));
        }

        // Scale position
        if (settings.scalePosition) {
            document.dispatchEvent(new CustomEvent('chart-scale-position', {
                detail: { position: settings.scalePosition }
            }));
        }

        // Crosshair style
        if (settings.crosshairStyle) {
            document.dispatchEvent(new CustomEvent('chart-crosshair-style', {
                detail: { style: settings.crosshairStyle }
            }));
        }

        // Legend
        if (settings.legendPosition) {
            document.dispatchEvent(new CustomEvent('legend-position-change', {
                detail: { position: settings.legendPosition }
            }));
        }
        if (settings.legendSize) {
            document.dispatchEvent(new CustomEvent('legend-size-change', {
                detail: { size: settings.legendSize }
            }));
        }

        // ✅ Save as active template for refresh survival
        localStorage.setItem(ACTIVE_TEMPLATE_KEY, JSON.stringify(settings));

        console.log('✅ Template applied:', settings);
    }

    // ✅ Public static — called on chart ready to restore last template
    public static restoreActiveTemplate(): void {
        try {
            const saved = localStorage.getItem(ACTIVE_TEMPLATE_KEY);
            if (!saved) return;
            const settings = JSON.parse(saved) as Partial<AllSettings>;

            const colorKeys = ['background', 'grid', 'bull', 'bear', 'line', 'volumeBull', 'volumeBear',
                               'scaleBorder', 'crosshair', 'textColor', 'wickBull', 'wickBear',
                               'borderBull', 'borderBear'];
            const colors: Record<string, string> = {};
            colorKeys.forEach(key => {
                if ((settings as any)[key]) colors[key] = (settings as any)[key];
            });

            if (Object.keys(colors).length > 0) {
                document.dispatchEvent(new CustomEvent('chart-colors-change', {
                    detail: { colors }
                }));
            }
        } catch (e) {}
    }

    private loadTemplates(): SavedTemplate[] {
        try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]'); }
        catch { return []; }
    }

    private saveTemplates(t: SavedTemplate[]): void {
        localStorage.setItem(TEMPLATES_KEY, JSON.stringify(t));
    }

    // ==================== DRAGGABLE ====================

    private makeDraggable(modal: HTMLElement, handle: HTMLElement): void {
        let isDragging = false;
        let startX     = 0;
        let startY     = 0;
        let startLeft  = 0;
        let startTop   = 0;

        const onMouseDown = (e: MouseEvent) => {
            if ((e.target as HTMLElement).closest('button')) return;
            isDragging = true;
            startX     = e.clientX;
            startY     = e.clientY;
            const rect = modal.getBoundingClientRect();
            startLeft  = rect.left;
            startTop   = rect.top;
            modal.style.left      = `${startLeft}px`;
            modal.style.top       = `${startTop}px`;
            modal.style.transform = 'none';
            modal.style.margin    = '0';
            e.preventDefault();
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            let newLeft = startLeft + (e.clientX - startX);
            let newTop  = startTop  + (e.clientY - startY);
            const rect  = modal.getBoundingClientRect();
            newLeft = Math.max(0, Math.min(newLeft, window.innerWidth  - rect.width));
            newTop  = Math.max(0, Math.min(newTop,  window.innerHeight - rect.height));
            modal.style.left = `${newLeft}px`;
            modal.style.top  = `${newTop}px`;
        };

        const onMouseUp = () => { isDragging = false; };

        handle.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup',   onMouseUp);

        (modal as any)._dragCleanup = () => {
            handle.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup',   onMouseUp);
        };
    }

    // ==================== KEYBOARD ====================

    private handleKeyDown(e: KeyboardEvent): void {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        const popup = this.overlay?.querySelector('#settingsTemplatePopup') as HTMLElement;
        if (popup?.style.display !== 'none') {
            popup.style.display = 'none';
        } else {
            this.close();
        }
    }

    // ==================== DESTROY ====================

    public destroy(): void {
        this.close();
    }
}