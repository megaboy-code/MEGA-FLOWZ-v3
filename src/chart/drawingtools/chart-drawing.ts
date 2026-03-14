// ================================================================
// 📐 CHART DRAWING MODULE - Orchestrator
// ================================================================

import { 
  IChartApi, 
  ISeriesApi, 
  SeriesType 
} from 'lightweight-charts';

import { createLineToolsPlugin } from 'lightweight-charts-line-tools-core';
import { DrawingToolbar } from './ui/drawing-toolbar';

// ==================== TOOL GROUP MAP ====================

const TOOL_GROUP_MAP: Record<string, string> = {
  TrendLine:         'lines',
  Ray:               'lines',
  Arrow:             'lines',
  ExtendedLine:      'lines',
  HorizontalLine:    'lines',
  HorizontalRay:     'lines',
  VerticalLine:      'lines',
  CrossLine:         'lines',
  Callout:           'lines',
  Rectangle:         'shapes',
  Circle:            'shapes',
  Triangle:          'shapes',
  Text:              'text',
  ParallelChannel:   'advanced',
  FibRetracement:    'advanced',
  PriceRange:        'advanced',
  Path:              'advanced',
  Brush:             'freehand',
  Highlighter:       'freehand',
  LongShortPosition: 'position',
};

const registeredGroups = new Set<string>();

export interface DrawingToolsConfig {
  precision:      number;
  showLabels:     boolean;
  priceFormatter: (price: number) => string;
}

export class ChartDrawingModule {
  private lineTools:     any = null;
  private chart:         IChartApi | null = null;
  private series:        ISeriesApi<SeriesType> | null = null;
  private config:        DrawingToolsConfig;
  private isInitialized: boolean = false;

  private toolbar: DrawingToolbar | null = null;

  private isDrawingActive:   boolean = false;
  private isSelectionMode:   boolean = false;
  private lastCrosshairTime: number = 0;
  private readonly CROSSHAIR_THROTTLE_MS = 16;

  private pendingToolFormatting: any[] = [];
  private formatBatchTimeout:    number | null = null;

  private eventHandlers: { [key: string]: any } = {};

  private setDrawingStateCallback?:   (active: boolean) => void;
  private setSelectionStateCallback?: (active: boolean) => void;

  // ✅ Dynamic per symbol+TF
  private currentSymbol:    string;
  private currentTimeframe: string;

  private get STORAGE_KEY(): string {
    return `chart_drawings_${this.currentSymbol}_${this.currentTimeframe}`;
  }

  constructor(
    chart:     IChartApi,
    series:    ISeriesApi<SeriesType>,
    config:    DrawingToolsConfig,
    callbacks?: {
      setDrawingState?:   (active: boolean) => void;
      setSelectionState?: (active: boolean) => void;
    },
    initialSymbol?:    string,
    initialTimeframe?: string
  ) {
    this.chart   = chart;
    this.series  = series;
    this.config  = config;
    this.setDrawingStateCallback   = callbacks?.setDrawingState;
    this.setSelectionStateCallback = callbacks?.setSelectionState;

    this.currentSymbol    = initialSymbol    || 'EURUSD';
    this.currentTimeframe = initialTimeframe || 'H1';

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.saveDrawings());
    }
  }

  // ==================== INITIALIZATION ====================

  public async initialize(): Promise<boolean> {
    try {
      console.log('🔧 Initializing drawing module...');

      if (!this.chart || !this.series) {
        console.error('❌ Chart or series not provided');
        return false;
      }

      this.lineTools = createLineToolsPlugin(this.chart, this.series);

      if (!this.lineTools) {
        console.error('❌ Failed to create line tools plugin');
        return false;
      }

      this.setupToolOptions();
      this.wireChartEvents();
      this.subscribeToToolEvents();

      await this.initializeToolbar();

      this.isInitialized = true;

      // ✅ Initial load only — safe here because chart already
      // has data at this point (called from onChartReady)
      await this.loadDrawings();

      console.log('✅ Drawing module initialized');
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize drawing tools:', error);
      return false;
    }
  }

  // ==================== LAZY TOOL REGISTRATION ====================

  private async loadAndRegisterGroup(groupName: string): Promise<void> {
    if (registeredGroups.has(groupName)) return;

    try {
      switch (groupName) {
        case 'lines': {
          const { registerLinesPlugin } = await import('./tools/lines');
          registerLinesPlugin(this.lineTools);
          break;
        }
        case 'shapes': {
          const { SHAPE_TOOLS } = await import('./tools/shapes');
          Object.entries(SHAPE_TOOLS).forEach(([name, tool]) => {
            try {
              this.lineTools.registerLineTool(name, tool);
            } catch (error) {
              console.warn(`⚠️ Failed to register tool ${name}:`, error);
            }
          });
          break;
        }
        case 'text': {
          const { TEXT_TOOLS } = await import('./tools/text');
          Object.entries(TEXT_TOOLS).forEach(([name, tool]) => {
            try {
              this.lineTools.registerLineTool(name, tool);
            } catch (error) {
              console.warn(`⚠️ Failed to register tool ${name}:`, error);
            }
          });
          break;
        }
        case 'advanced': {
          const { ADVANCED_TOOLS } = await import('./tools/advanced');
          Object.entries(ADVANCED_TOOLS).forEach(([name, tool]) => {
            try {
              this.lineTools.registerLineTool(name, tool);
            } catch (error) {
              console.warn(`⚠️ Failed to register tool ${name}:`, error);
            }
          });
          break;
        }
        case 'freehand': {
          const { FREEHAND_TOOLS } = await import('./tools/freehand');
          Object.entries(FREEHAND_TOOLS).forEach(([name, tool]) => {
            try {
              this.lineTools.registerLineTool(name, tool);
            } catch (error) {
              console.warn(`⚠️ Failed to register tool ${name}:`, error);
            }
          });
          break;
        }
        case 'position': {
          const { POSITION_TOOLS } = await import('./tools/position');
          Object.entries(POSITION_TOOLS).forEach(([name, tool]) => {
            try {
              this.lineTools.registerLineTool(name, tool);
            } catch (error) {
              console.warn(`⚠️ Failed to register tool ${name}:`, error);
            }
          });
          break;
        }
        default:
          console.warn(`⚠️ Unknown tool group: ${groupName}`);
          return;
      }

      registeredGroups.add(groupName);
      console.log(`✅ Tool group loaded: ${groupName}`);

    } catch (error) {
      console.error(`❌ Failed to load tool group ${groupName}:`, error);
    }
  }

  // ==================== SETUP ====================

  private setupToolOptions(): void {
    if (!this.lineTools) return;

    const globalOptions = {
      precision:  this.config.precision,
      showLabels: this.config.showLabels,
      lineStyle: {
        color:     '#3b82f6',
        lineWidth: 2,
        lineStyle: 0
      },
      textStyle: {
        fontSize:   12,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color:      '#e2e8f0'
      }
    };

    if (typeof this.lineTools.setOptions === 'function') {
      this.lineTools.setOptions(globalOptions);
    }
  }

  private wireChartEvents(): void {
    if (!this.chart || !this.lineTools) return;

    const clickHandler = (param: any) => {
      if (this.isDrawingActive || this.isSelectionMode) {
        if (typeof this.lineTools.onClick === 'function') {
          this.lineTools.onClick(param);
        }
      }
    };

    const dblClickHandler = (param: any) => {
      if (typeof this.lineTools.onDoubleClick === 'function') {
        this.lineTools.onDoubleClick(param);
      }
    };

    this.chart.subscribeClick(clickHandler);
    this.eventHandlers.click = clickHandler;

    this.chart.subscribeDblClick(dblClickHandler);
    this.eventHandlers.dblClick = dblClickHandler;
  }

  private subscribeToToolEvents(): void {
    if (!this.lineTools) return;

    if (typeof this.lineTools.on === 'function') {
      this.lineTools.on('line-tool-created', (tool: any) => {
        this.pendingToolFormatting.push(tool);
        this.scheduleBatchFormatting();
        this.saveDrawings();
      });
    }

    if (typeof this.lineTools.subscribeLineToolsAfterEdit === 'function') {
      this.lineTools.subscribeLineToolsAfterEdit(() => {
        this.saveDrawings();
      });
    }
  }

  private async initializeToolbar(): Promise<void> {
    this.toolbar = new DrawingToolbar(
      this.lineTools,
      {
        setDrawingState:      (active: boolean)                 => this.setDrawingState(active),
        setSelectionState:    (active: boolean)                 => this.setSelectionState(active),
        clearAllDrawings:     ()                                => this.clearAllDrawings(),
        startDrawing:         (toolType: string, options?: any) => this.startDrawing(toolType, options),
        updateToolProperties: (toolId: string, updates: any)   => this.updateToolProperties(toolId, updates),
        lockTool:             (toolId: string, locked: boolean) => this.lockTool(toolId, locked),
        deleteTool:           (toolId: string)                  => this.deleteTool(toolId)
      }
    );
    await this.toolbar.initialize();
  }

  private scheduleBatchFormatting(): void {
    if (this.formatBatchTimeout) clearTimeout(this.formatBatchTimeout);

    this.formatBatchTimeout = window.setTimeout(() => {
      if (this.pendingToolFormatting.length > 0) {
        this.pendingToolFormatting.forEach(tool => this.applyPriceFormattingToTool(tool));
        this.pendingToolFormatting = [];
      }
      this.formatBatchTimeout = null;
    }, 100);
  }

  // ==================== DRAWING STATE ====================

  public setDrawingState(active: boolean): void {
    this.isDrawingActive = active;
    if (this.setDrawingStateCallback) this.setDrawingStateCallback(active);
  }

  public setSelectionState(active: boolean): void {
    this.isSelectionMode = active;
    if (this.setSelectionStateCallback) this.setSelectionStateCallback(active);
  }

  public activateDrawingMode(toolType?: string): void {
    this.setDrawingState(true);
    this.setSelectionState(false);
    if (toolType) this.startDrawing(toolType);
  }

  public deactivateDrawingMode(): void {
    this.setDrawingState(false);
    this.setSelectionState(false);
  }

  public activateSelectionMode(): void {
    this.setSelectionState(true);
    this.setDrawingState(false);
  }

  public deactivateSelectionMode(): void {
    this.setSelectionState(false);
  }

  public isUserInteracting(): boolean {
    return this.isDrawingActive || this.isSelectionMode;
  }

  // ==================== SYMBOL + TF SWITCHING ====================

  public async onTimeframeChange(timeframe: string): Promise<void> {
    if (this.currentTimeframe === timeframe) return
    this.saveDrawings()
    this.currentTimeframe = timeframe
    console.log(`📐 TF tracking updated: ${timeframe}`)
  }

  public async onSymbolChange(symbol: string): Promise<void> {
    if (this.currentSymbol === symbol) return
    this.saveDrawings()
    this.currentSymbol = symbol
    console.log(`📐 Symbol tracking updated: ${symbol}`)
  }

  // ✅ Called from onBeforeSeriesRemoved
  // Clears tools BEFORE series is destroyed
  // Does NOT touch localStorage — drawings are preserved
  public clearToolsOnly(): void {
    if (!this.lineTools || !this.isInitialized) return
    try {
      if (typeof this.lineTools.removeAllLineTools === 'function') {
        this.lineTools.removeAllLineTools()
        console.log('🧹 Tools cleared before series removal')
      }
    } catch (error) {
      console.error('❌ clearToolsOnly failed:', error)
    }
  }

  // ✅ Called from onSeriesDataReady
  // Series has data — safe to load drawings
  // Double rAF ensures render cycle fully completes before mutating tools
  public async onDataReady(): Promise<void> {
    if (!this.lineTools || !this.isInitialized) return
    try {
      // ✅ First rAF — lets current render cycle complete
      // ✅ Second rAF — guarantees we're in a clean new frame
      await new Promise<void>(resolve => requestAnimationFrame(() =>
          requestAnimationFrame(() => resolve())
      ))

      // ✅ Guard after async gap — module may have been destroyed
      if (!this.lineTools || !this.isInitialized) return

      await this.loadDrawings()
      console.log(`📐 Drawings restored for ${this.currentSymbol} ${this.currentTimeframe}`)
    } catch (error) {
      console.error('❌ onDataReady failed:', error)
    }
  }

  // ==================== PUBLIC API ====================

  public async startDrawing(toolType: string, options?: any): Promise<void> {
    if (!this.lineTools || !this.isInitialized) {
      console.warn('⚠️ Drawing tools not initialized');
      return;
    }

    try {
      const groupName = TOOL_GROUP_MAP[toolType];
      if (groupName) {
        await this.loadAndRegisterGroup(groupName);
      }

      console.log(`🖍️ Starting drawing tool: ${toolType}`);

      if (options) {
        this.lineTools.addLineTool(toolType, [], options);
      } else {
        this.lineTools.addLineTool(toolType);
      }

    } catch (error) {
      console.error(`❌ Failed to start drawing tool ${toolType}:`, error);
    }
  }

  public clearAllDrawings(): void {
    if (!this.lineTools || !this.isInitialized) return;
    try {
      if (typeof this.lineTools.removeAllLineTools === 'function') {
        this.lineTools.removeAllLineTools();
      }
      localStorage.removeItem(this.STORAGE_KEY);
      console.log(`🗑️ Drawings cleared for ${this.currentSymbol} ${this.currentTimeframe}`);
    } catch (error) {
      console.error('❌ Failed to clear drawings:', error);
    }
  }

  public removeSelectedDrawings(): void {
    if (!this.lineTools || !this.isInitialized) return;
    try {
      if (typeof this.lineTools.removeSelectedLineTools === 'function') {
        this.lineTools.removeSelectedLineTools();
        this.saveDrawings();
      }
    } catch (error) {
      console.error('❌ Failed to remove selected drawings:', error);
    }
  }

  // ==================== TOOL PROPERTY MANAGEMENT ====================

  public updateToolProperties(toolId: string, updates: any): void {
    if (!this.lineTools || !this.isInitialized) return;

    try {
      let currentToolData = null;

      if (typeof this.lineTools.getLineToolByID === 'function') {
        const toolDataJson = this.lineTools.getLineToolByID(toolId);
        if (toolDataJson) {
          const parsed = JSON.parse(toolDataJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            currentToolData = parsed[0];
          }
        }
      }

      if (!currentToolData) return;

      const mergedOptions = this.deepMerge(currentToolData.options || {}, updates);

      if (typeof this.lineTools.createOrUpdateLineTool === 'function') {
        this.lineTools.createOrUpdateLineTool(
          currentToolData.toolType,
          currentToolData.points,
          mergedOptions,
          toolId
        );
        this.saveDrawings();
      }
    } catch (error) {
      console.error('❌ Failed to update tool properties:', error);
    }
  }

  public lockTool(toolId: string, locked: boolean): void {
    const toolDataJson = this.lineTools?.getLineToolByID(toolId);
    if (!toolDataJson) return;

    const parsed = JSON.parse(toolDataJson);
    if (!Array.isArray(parsed) || parsed.length === 0) return;

    const currentToolData = parsed[0];
    this.updateToolProperties(toolId, {
      locked,
      editable: !locked,
      defaultHoverCursor: locked
        ? 'default'
        : (currentToolData.options?.defaultHoverCursor || 'pointer')
    });
  }

  public deleteTool(toolId: string): void {
    if (!this.lineTools || !this.isInitialized) return;

    try {
      if (typeof this.lineTools.getLineToolByID === 'function') {
        const toolDataJson = this.lineTools.getLineToolByID(toolId);
        if (toolDataJson) {
          const parsed = JSON.parse(toolDataJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (parsed[0].options?.locked) return;
          }
        }
      }

      if (typeof this.lineTools.removeLineToolsById === 'function') {
        this.lineTools.removeLineToolsById([toolId]);
        this.saveDrawings();
      }
    } catch (error) {
      console.error('❌ Failed to delete tool:', error);
    }
  }

  // ==================== CROSSHAIR ====================

  public onCrosshairMove(param: any): void {
    if (!this.lineTools || typeof this.lineTools.onCrosshairMove !== 'function') return;

    const now = Date.now();
    if (now - this.lastCrosshairTime < this.CROSSHAIR_THROTTLE_MS) return;
    this.lastCrosshairTime = now;

    this.lineTools.onCrosshairMove(param);
  }

  // ==================== LINE TOOLS CORE API ====================

  public getLineTools(): any                 { return this.lineTools; }
  public addLineTool(toolType: string): void { this.startDrawing(toolType); }
  public removeAllLineTools(): void          { this.clearAllDrawings(); }
  public removeSelectedLineTools(): void     { this.removeSelectedDrawings(); }
  public isReady(): boolean                  { return this.isInitialized; }
  public isUserDrawing(): boolean            { return this.isUserInteracting(); }
  public getAvailableToolTypes(): string[]   { return Object.keys(TOOL_GROUP_MAP); }

  public subscribeLineToolsAfterEdit(callback: (tools: any) => void): void {
    if (!this.lineTools || !this.isInitialized) return;
    try {
      if (typeof this.lineTools.subscribeLineToolsAfterEdit === 'function') {
        this.lineTools.subscribeLineToolsAfterEdit(callback);
      }
    } catch (error) {
      console.error('❌ Failed to subscribe to AfterEdit:', error);
    }
  }

  public subscribeLineToolsDoubleClick(callback: (tools: any) => void): void {
    if (!this.lineTools || !this.isInitialized) return;
    try {
      if (typeof this.lineTools.subscribeLineToolsDoubleClick === 'function') {
        this.lineTools.subscribeLineToolsDoubleClick(callback);
      }
    } catch (error) {
      console.error('❌ Failed to subscribe to DoubleClick:', error);
    }
  }

  public getLineToolByID(id: string): string {
    if (!this.lineTools || !this.isInitialized) return '[]';
    try {
      if (typeof this.lineTools.getLineToolByID === 'function') {
        return this.lineTools.getLineToolByID(id);
      }
    } catch (error) {
      console.error('❌ Failed to get line tool by ID:', error);
    }
    return '[]';
  }

  public createOrUpdateLineTool(type: string, points: any[], options: any, id: string): void {
    if (!this.lineTools || !this.isInitialized) return;
    try {
      if (typeof this.lineTools.createOrUpdateLineTool === 'function') {
        this.lineTools.createOrUpdateLineTool(type, points, options, id);
        this.saveDrawings();
      }
    } catch (error) {
      console.error('❌ Failed to create/update line tool:', error);
    }
  }

  public applyLineToolOptions(toolData: any): void {
    if (!this.lineTools || !this.isInitialized) return;
    try {
      if (typeof this.lineTools.applyLineToolOptions === 'function') {
        this.lineTools.applyLineToolOptions(toolData);
        this.saveDrawings();
      }
    } catch (error) {
      console.error('❌ Failed to apply line tool options:', error);
    }
  }

  public getToolCount(): number {
    if (!this.lineTools || !this.isInitialized) return 0;
    try {
      if (typeof this.lineTools.getAllTools === 'function') {
        const tools = this.lineTools.getAllTools();
        return Array.isArray(tools) ? tools.length : 0;
      }
    } catch (error) {
      console.error('❌ Failed to get tool count:', error);
    }
    return 0;
  }

  // ==================== PERSISTENCE ====================

  public saveDrawings(): void {
    if (!this.lineTools || !this.isInitialized) return;
    try {
      const drawings = this.exportDrawings();
      localStorage.setItem(this.STORAGE_KEY, drawings);
    } catch (error) {
      console.error('❌ Failed to save drawings:', error);
    }
  }

  private async loadDrawings(): Promise<void> {
    if (!this.lineTools || !this.isInitialized) return;
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);

      // ✅ Always clear first — guarantees clean slate before import
      // Protects against non-destructive bleed from importLineTools
      this.lineTools.removeAllLineTools();

      if (saved && saved !== '[]') {
        const tools = JSON.parse(saved);
        if (Array.isArray(tools) && tools.length > 0) {
          const groupsNeeded = new Set<string>();
          tools.forEach((tool: any) => {
            const group = TOOL_GROUP_MAP[tool.toolType];
            if (group) groupsNeeded.add(group);
          });

          await Promise.all(
            Array.from(groupsNeeded).map(g => this.loadAndRegisterGroup(g))
          );
        }

        this.importDrawings(saved);
        console.log(`✅ Drawings restored for ${this.currentSymbol} ${this.currentTimeframe}`);

      } else {
        console.log(`📋 No drawings for ${this.currentSymbol} ${this.currentTimeframe}`);
      }

    } catch (error) {
      console.error('❌ Failed to load drawings:', error);
    }
  }

  public clearSavedDrawings(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('🗑️ Saved drawings cleared');
    } catch (error) {
      console.error('❌ Failed to clear saved drawings:', error);
    }
  }

  public exportDrawings(): string {
    if (!this.lineTools || !this.isInitialized) return '[]';
    try {
      if (typeof this.lineTools.exportLineTools === 'function') {
        return this.lineTools.exportLineTools();
      }
    } catch (error) {
      console.error('❌ Failed to export drawings:', error);
    }
    return '[]';
  }

  public importDrawings(json: string): void {
    if (!this.lineTools || !this.isInitialized) return;
    try {
      if (typeof this.lineTools.importLineTools === 'function') {
        this.lineTools.importLineTools(json);
        console.log('✅ Drawings imported successfully');
      }
    } catch (error) {
      console.error('❌ Failed to import drawings:', error);
    }
  }

  // ==================== CONFIG ====================

  public updateConfig(newConfig: Partial<DrawingToolsConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (this.lineTools && typeof this.lineTools.setOptions === 'function') {
      this.lineTools.setOptions({
        precision:  this.config.precision,
        showLabels: this.config.showLabels
      });
    }

    this.updateAllToolsPriceFormatting();
  }

  private updateAllToolsPriceFormatting(): void {
    if (!this.lineTools || !this.isInitialized) return;
    try {
      if (typeof this.lineTools.getAllTools === 'function') {
        const tools = this.lineTools.getAllTools();
        if (Array.isArray(tools)) {
          tools.forEach(tool => this.applyPriceFormattingToTool(tool));
        }
      }
    } catch (error) {
      console.error('❌ Failed to update all tools price formatting:', error);
    }
  }

  private applyPriceFormattingToTool(tool: any): void {
    if (!tool || typeof tool !== 'object') return;
    try {
      if (typeof tool.setPriceFormatter === 'function') {
        tool.setPriceFormatter(this.config.priceFormatter);
      }
      if (tool.priceLabels && Array.isArray(tool.priceLabels)) {
        tool.priceLabels.forEach((label: any) => {
          if (label && typeof label.update === 'function') {
            const currentPrice = label.getPrice ? label.getPrice() : null;
            if (currentPrice !== null && currentPrice !== undefined) {
              label.update({ text: this.config.priceFormatter(currentPrice) });
            }
          }
        });
      }
    } catch (error) {}
  }

  // ==================== UPDATE SERIES ====================

  public updateSeries(newSeries: ISeriesApi<SeriesType>): void {
    if (!this.chart || !this.lineTools) return;

    const savedDrawings = this.exportDrawings();
    this.series = newSeries;

    try {
      if (typeof this.lineTools.destroy === 'function') {
        this.lineTools.destroy();
      }
    } catch (error) {
      console.error('❌ Error destroying old line tools:', error);
    }

    this.lineTools = createLineToolsPlugin(this.chart, this.series);

    if (this.lineTools) {
      registeredGroups.clear();
      this.setupToolOptions();
      this.subscribeToToolEvents();

      if (savedDrawings && savedDrawings !== '[]') {
        this.importDrawings(savedDrawings);
      }
    }
  }

  // ==================== HELPERS ====================

  private deepMerge(target: any, source: any): any {
    const output = { ...target };
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }

  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  // ==================== DESTROY ====================

  public destroy(): void {
    console.log('🧹 Destroying drawing module...');

    this.saveDrawings();

    if (this.toolbar) {
      this.toolbar.destroy();
      this.toolbar = null;
    }

    if (this.formatBatchTimeout) {
      clearTimeout(this.formatBatchTimeout);
      this.formatBatchTimeout = null;
    }

    this.pendingToolFormatting = [];

    const oldLineTools = this.lineTools;
    this.lineTools     = null;

    this.isDrawingActive = false;
    this.isSelectionMode = false;

    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.saveDrawings);
    }

    setTimeout(() => {
      if (oldLineTools && typeof oldLineTools.destroy === 'function') {
        try { oldLineTools.destroy(); } catch (error) {}
      }
    }, 100);

    this.chart         = null;
    this.series        = null;
    this.isInitialized = false;
    this.eventHandlers = {};

    console.log('✅ Drawing module destroyed');
  }
}