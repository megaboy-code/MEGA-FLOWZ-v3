// src/chart/drawing/tools/custom/LineToolTradeArrow.ts

import {
    IChartApiBase,
    ISeriesApi,
    IHorzScaleBehavior,
    SeriesType,
    Coordinate,
} from 'lightweight-charts';

import {
    BaseLineTool,
    LineToolPoint,
    LineToolType,
    DeepPartial,
    LineToolsCorePlugin,
    merge,
    deepCopy,
    PriceAxisLabelStackingManager,
    HitTestResult,
    LineToolHitTestData,
    PaneCursorType,
    CompositeRenderer,
} from 'lightweight-charts-line-tools-core';

import { LineToolTradeArrowPaneView } from './LineToolTradeArrowPaneView';

// ================================================================
// 🎯 TRADE ARROW — Default Options
// ================================================================

export interface TradeArrowSpecificOptions {
    type:        'buy' | 'sell';
    color:       string;
    size:        number;
    stemHeight:  number;
    priceLine:   'hover' | 'always';
    priceLabel:  string;
}

export type TradeArrowFullOptions = {
    visible:                    boolean;
    editable:                   boolean;
    locked:                     boolean;
    defaultHoverCursor:         PaneCursorType;
    defaultDragCursor:          PaneCursorType;
    defaultAnchorHoverCursor:   PaneCursorType;
    defaultAnchorDragCursor:    PaneCursorType;
    notEditableCursor:          PaneCursorType;
    showPriceAxisLabels:        boolean;
    showTimeAxisLabels:         boolean;
    priceAxisLabelAlwaysVisible:boolean;
    timeAxisLabelAlwaysVisible: boolean;
    arrow:                      TradeArrowSpecificOptions;
};

export const TradeArrowDefaults: TradeArrowFullOptions = {
    visible:                     true,
    editable:                    false,   // Programmatic only — not user editable
    locked:                      true,    // Cannot be dragged by user
    defaultHoverCursor:          PaneCursorType.Pointer,
    defaultDragCursor:           PaneCursorType.Pointer,
    defaultAnchorHoverCursor:    PaneCursorType.Pointer,
    defaultAnchorDragCursor:     PaneCursorType.Pointer,
    notEditableCursor:           PaneCursorType.Pointer,
    showPriceAxisLabels:         false,   // We draw our own
    showTimeAxisLabels:          false,
    priceAxisLabelAlwaysVisible: false,
    timeAxisLabelAlwaysVisible:  false,
    arrow: {
        type:       'buy',
        color:      '#238636',
        size:       10,         // Triangle half-width in px
        stemHeight: 20,         // Stem length in px
        priceLine:  'hover',
        priceLabel: '',
    },
};

// ================================================================
// 🎯 TRADE ARROW — Model
// ================================================================

export class LineToolTradeArrow<HorzScaleItem> extends BaseLineTool<HorzScaleItem> {

    // # Model Identity
    public override readonly toolType: LineToolType = 'TradeArrow';
    public override readonly pointsCount: number    = 1;

    public constructor(
        coreApi:                      LineToolsCorePlugin<HorzScaleItem>,
        chart:                        IChartApiBase<HorzScaleItem>,
        series:                       ISeriesApi<SeriesType, HorzScaleItem>,
        horzScaleBehavior:            IHorzScaleBehavior<HorzScaleItem>,
        options:                      DeepPartial<TradeArrowFullOptions> = {},
        points:                       LineToolPoint[]                    = [],
        priceAxisLabelStackingManager:PriceAxisLabelStackingManager<HorzScaleItem>
    ) {
        // 1. Deep copy defaults — never mutate the static constant
        const finalOptions = deepCopy(TradeArrowDefaults) as TradeArrowFullOptions;

        // 2. Merge user options on top of defaults
        merge(finalOptions, options as DeepPartial<TradeArrowFullOptions>);

        // 3. Call super
        super(
            coreApi,
            chart,
            series,
            horzScaleBehavior,
            finalOptions as any,
            points,
            'TradeArrow',
            1,
            priceAxisLabelStackingManager
        );

        // 4. Link the View
        this._setPaneViews([
            new LineToolTradeArrowPaneView(this, this._chart, this._series)
        ]);
    }

    // # No normalization needed for single point tool
    public override normalize(): void {}

    // # Single point — no anchors shown (programmatic tool)
    public override maxAnchorIndex(): number { return -1; }

    // # Creation flags — programmatic only
    public supportsClickClickCreation(): boolean { return false; }
    public supportsClickDragCreation():  boolean { return false; }

    // # Hit test delegates to view's composite renderer
    public override _internalHitTest(
        x: Coordinate,
        y: Coordinate
    ): HitTestResult<LineToolHitTestData> | null {
        if (!this._paneViews?.length) return null;

        const paneView = this._paneViews[0] as LineToolTradeArrowPaneView<HorzScaleItem>;
        const renderer = paneView.renderer() as CompositeRenderer<HorzScaleItem>;

        if (!renderer?.hitTest) return null;
        return renderer.hitTest(x, y);
    }

    // # Single point tools
    public override isFinished():     boolean { return this._points.length >= 1; }
    public override maxAnchorIndex(): number  { return 0; }
}