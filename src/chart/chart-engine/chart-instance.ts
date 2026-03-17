// ================================================================
// ⚡ CHART INSTANCE - Core chart creation and lifecycle 
// ================================================================

import {
    createChart,
    IChartApi,
    ColorType,
    CrosshairMode,
    LineStyle
} from 'lightweight-charts';
import { createDynamicPriceFormatter } from '../chart-utils';
import { ChartColors, DEFAULT_CHART_COLORS, DARK_CHART_COLORS, LIGHT_CHART_COLORS } from '../chart-types';

const DEFAULT_FONT_SIZE = 9;

export class ChartInstance {
    private chart: IChartApi | null = null;
    private container: HTMLElement | null = null;
    private currentSymbol: string;

    private gridVertVisible: boolean = true;
    private gridHorzVisible: boolean = true;

    private chartColors: ChartColors = { ...DEFAULT_CHART_COLORS };

    constructor(symbol: string) {
        this.currentSymbol = symbol;

        // ✅ Restore chart colors from saved theme
        const savedTheme = localStorage.getItem('app-theme') || 'system';
        const presetMap: Record<string, ChartColors> = {
            system: DEFAULT_CHART_COLORS,
            dark:   DARK_CHART_COLORS,
            light:  LIGHT_CHART_COLORS,
        };
        this.chartColors = { ...(presetMap[savedTheme] || DEFAULT_CHART_COLORS) };
    }

    public async create(container: HTMLElement): Promise<IChartApi | null> {
        this.container = container;

        // ✅ Pre-set background immediately — prevents flash
        const bgMap: Record<string, string> = {
            system: '#0f1724',
            dark:   '#0b111b',
            light:  '#f8f9fc',
        };
        const savedTheme = localStorage.getItem('app-theme') || 'system';
        container.style.backgroundColor = bgMap[savedTheme] || this.chartColors.background;

        const containerWidth  = container.clientWidth;
        const containerHeight = container.clientHeight;

        this.chart = createChart(container, {
            autoSize: false,
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor:  this.chartColors.textColor || '#c8d4e8',
                fontSize:   DEFAULT_FONT_SIZE,
                fontFamily: 'Inter, sans-serif'
            },
            grid: {
                vertLines: { color: this.chartColors.grid, visible: true, style: 1 },
                horzLines: { color: this.chartColors.grid, visible: true, style: 1 },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: {
                    width: 1,
                    color: this.chartColors.crosshair || '#3a4a5c',
                    style: LineStyle.Dashed
                },
                horzLine: {
                    width: 1,
                    color: this.chartColors.crosshair || '#3a4a5c',
                    style: LineStyle.Dashed
                }
            },
            rightPriceScale: {
                borderColor:    this.chartColors.scaleBorder,
                scaleMargins:   { top: 0.08, bottom: 0.08 },
                entireTextOnly: false,
                autoScale:      true,
                invertScale:    false,
                alignLabels:    true,
                borderVisible:  true,
                minimumWidth:   50,
            },
            timeScale: {
                borderColor:                  this.chartColors.scaleBorder,
                timeVisible:                  true,
                secondsVisible:               false,
                rightOffset:                  5,
                barSpacing:                   5,
                minBarSpacing:                0.5,
                fixLeftEdge:                  false,
                fixRightEdge:                 false,
                lockVisibleTimeRangeOnResize: true,
                rightBarStaysOnScroll:        true,
                borderVisible:                true,
                visible:                      true,
            },
            handleScroll: {
                mouseWheel:       true,
                pressedMouseMove: true,
                horzTouchDrag:    true,
                vertTouchDrag:    true,
            },
            handleScale: {
                axisPressedMouseMove: true,
                mouseWheel:           true,
                pinch:                true,
            },
        });

        if (!this.chart) return null;

        if (containerWidth > 0 && containerHeight > 0) {
            this.chart.resize(containerWidth, containerHeight);
        }

        this.chart.applyOptions({
            localization: { priceFormatter: createDynamicPriceFormatter(() => this.currentSymbol) }
        });

        return this.chart;
    }

    public getChart(): IChartApi | null {
        return this.chart;
    }

    public getColors(): ChartColors {
        return { ...this.chartColors };
    }

    public resize(): void {
        if (!this.chart || !this.container) return;
        this.chart.resize(this.container.clientWidth, this.container.clientHeight);
    }

    public destroy(): void {
        if (this.chart) {
            this.chart.remove();
            this.chart = null;
        }
        this.container = null;
    }

    public updateSymbol(symbol: string): void {
        this.currentSymbol = symbol;
        if (this.chart) {
            this.chart.applyOptions({
                localization: { priceFormatter: createDynamicPriceFormatter(() => this.currentSymbol) },
                watermark: { text: this.currentSymbol }
            });
        }
    }

    public applyColors(colors: Partial<ChartColors>): void {
        if (!this.chart) return;

        Object.assign(this.chartColors, colors);

        const options: any = {};

        if (colors.background && this.container) {
            this.container.style.backgroundColor = colors.background;
        }

        if (colors.grid) {
            options.grid = {
                vertLines: { color: colors.grid },
                horzLines: { color: colors.grid }
            };
        }

        if (colors.textColor) {
            options.layout = {
                ...options.layout,
                textColor: colors.textColor
            };
        }

        if (colors.crosshair) {
            options.crosshair = {
                vertLine: { color: colors.crosshair },
                horzLine: { color: colors.crosshair }
            };
        }

        if (colors.scaleBorder) {
            options.rightPriceScale = { borderColor: colors.scaleBorder };
            options.timeScale       = { borderColor: colors.scaleBorder };
        }

        if (Object.keys(options).length > 0) {
            this.chart.applyOptions(options);
        }

        console.log('🎨 ChartInstance colors applied');
    }

    // ==================== GRID ====================

    public toggleGrid(): void {
        if (!this.chart) return;
        this.gridVertVisible = !this.gridVertVisible;
        this.gridHorzVisible = !this.gridHorzVisible;

        this.chart.applyOptions({
            grid: {
                vertLines: { visible: this.gridVertVisible },
                horzLines: { visible: this.gridHorzVisible }
            }
        });
    }

    public toggleGridVertical(): void {
        if (!this.chart) return;
        this.gridVertVisible = !this.gridVertVisible;
        this.chart.applyOptions({
            grid: { vertLines: { visible: this.gridVertVisible } }
        });
        console.log(`📊 Grid vertical: ${this.gridVertVisible}`);
    }

    public toggleGridHorizontal(): void {
        if (!this.chart) return;
        this.gridHorzVisible = !this.gridHorzVisible;
        this.chart.applyOptions({
            grid: { horzLines: { visible: this.gridHorzVisible } }
        });
        console.log(`📊 Grid horizontal: ${this.gridHorzVisible}`);
    }

    // ==================== FONT SIZE ====================

    public applyFontSize(size: number = DEFAULT_FONT_SIZE): void {
        if (!this.chart) return;
        this.chart.applyOptions({
            layout: { fontSize: size }
        });
        console.log(`📊 Font size: ${size}`);
    }

    // ==================== CROSSHAIR ====================

    public applyCrosshairColor(color: string): void {
        if (!this.chart) return;
        this.chartColors.crosshair = color;
        this.chart.applyOptions({
            crosshair: {
                vertLine: { color },
                horzLine: { color }
            }
        });
        console.log(`📊 Crosshair color: ${color}`);
    }

    public applyCrosshairStyle(style: 'dotted' | 'dashed' | 'solid'): void {
        if (!this.chart) return;
        const styleMap = {
            dotted: LineStyle.Dotted,
            dashed: LineStyle.Dashed,
            solid:  LineStyle.Solid
        };
        this.chart.applyOptions({
            crosshair: {
                vertLine: { style: styleMap[style] },
                horzLine: { style: styleMap[style] }
            }
        });
        console.log(`📊 Crosshair style: ${style}`);
    }

    // ==================== BAR SPACING ====================

    public applyBarSpacing(spacing: number): void {
        if (!this.chart) return;
        this.chart.applyOptions({
            timeScale: { barSpacing: spacing }
        });
        console.log(`📊 Bar spacing: ${spacing}`);
    }

    // ==================== TIME VISIBLE ====================

    public applyTimeVisible(visible: boolean): void {
        if (!this.chart) return;
        this.chart.applyOptions({
            timeScale: { timeVisible: visible }
        });
        console.log(`📊 Time visible: ${visible}`);
    }

    // ==================== WATERMARK ====================

    public applyWatermark(visible: boolean, color?: string): void {
        if (!this.chart) return;
        this.chart.applyOptions({
            watermark: {
                visible,
                text:      this.currentSymbol,
                color:     color || 'rgba(255,255,255,0.05)',
                fontSize:  48,
                horzAlign: 'center',
                vertAlign: 'center'
            }
        });
        console.log(`📊 Watermark: ${visible}`);
    }

    // ==================== TOGGLES ====================

    public toggleCrosshair(): void {
        if (!this.chart) return;
        const options = this.chart.options();
        const currentMode = options?.crosshair?.mode;
        const newMode = currentMode === CrosshairMode.Hidden
            ? CrosshairMode.Normal
            : CrosshairMode.Hidden;
        this.chart.applyOptions({ crosshair: { mode: newMode } });
    }

    public toggleTimeScale(): void {
        if (!this.chart) return;
        const options = this.chart.options();
        const timeScaleVisible = options?.timeScale?.visible ?? true;
        this.chart.applyOptions({ timeScale: { visible: !timeScaleVisible } });
    }

    public resetView(): void {
        if (!this.chart) return;
        this.chart.timeScale().resetTimeScale();
        this.chart.priceScale('right').applyOptions({ autoScale: true });
    }

    // ✅ Composites onto solid background — prevents white on mobile/Telegram
    public downloadChart(): string | null {
        if (!this.chart) return null;

        try {
            const canvas = this.chart.takeScreenshot();
            if (!canvas) return null;

            const offscreen = document.createElement('canvas');
            offscreen.width  = canvas.width;
            offscreen.height = canvas.height;

            const ctx = offscreen.getContext('2d');
            if (!ctx) return canvas.toDataURL('image/png');

            ctx.fillStyle = this.chartColors.background;
            ctx.fillRect(0, 0, offscreen.width, offscreen.height);
            ctx.drawImage(canvas, 0, 0);

            return offscreen.toDataURL('image/png');

        } catch (error) {
            console.error('❌ Download failed:', error);
            return null;
        }
    }
}