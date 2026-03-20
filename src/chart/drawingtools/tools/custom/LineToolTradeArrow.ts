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
// 🎯 TRADE ARROW — Options
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
    visible:                     boolean;
    editable:                    boolean;
    locked:                      boolean;
    defaultHoverCursor:          PaneCursorType;
    defaultDragCursor:           PaneCursorType;
    defaultAnchorHoverCursor:    PaneCursorType;
    defaultAnchorDragCursor:     PaneCursorType;
    notEditableCursor:           PaneCursorType;
    showPriceAxisLabels:         boolean;
    showTimeAxisLabels:          boolean;
    priceAxisLabelAlwaysVisible: boolean;
    timeAxisLabelAlwaysVisible:  boolean;
    arrow:                       TradeArrowSpecificOptions;
};

export const TradeArrowDefaults: TradeArrowFullOptions = {
    visible:                     true,
    editable:                    false,
    locked:                      true,
    defaultHoverCursor:          PaneCursorType.Pointer,
    defaultDragCursor:           PaneCursorType.Pointer,
    defaultAnchorHoverCursor:    PaneCursorType.Pointer,
    defaultAnchorDragCursor:     PaneCursorType.Pointer,
    notEditableCursor:           PaneCursorType.Pointer,
    showPriceAxisLabels:         false,
    showTimeAxisLabels:          false,
    priceAxisLabelAlwaysVisible: false,
    timeAxisLabelAlwaysVisible:  false,
    arrow: {
        type:       'buy',
        color:      '#238636',
        size:       10,
        stemHeight: 20,
        priceLine:  'hover',
        priceLabel: '',
    },
};

// ================================================================
// 🎯 TRADE ARROW — Model
// ================================================================

export class LineToolTradeArrow<HorzScaleItem> extends BaseLineTool<HorzScaleItem> {

    // ✅ Cast to any — 'TradeArrow' is not in core's LineToolOptionsMap
    public override readonly toolType: LineToolType = 'TradeArrow' as any;
    public override readonly pointsCount: number    = 1;

    public constructor(
        coreApi:                       LineToolsCorePlugin<HorzScaleItem>,
        chart:                         IChartApiBase<HorzScaleItem>,
        series:                        ISeriesApi<SeriesType, HorzScaleItem>,
        horzScaleBehavior:             IHorzScaleBehavior<HorzScaleItem>,
        options:                       DeepPartial<TradeArrowFullOptions> = {},
        points:                        LineToolPoint[]                    = [],
        priceAxisLabelStackingManager: PriceAxisLabelStackingManager<HorzScaleItem>
    ) {
        const finalOptions = deepCopy(TradeArrowDefaults) as TradeArrowFullOptions;
        merge(finalOptions, options as DeepPartial<TradeArrowFullOptions>);

        super(
            coreApi,
            chart,
            series,
            horzScaleBehavior,
            finalOptions as any,
            points,
            'TradeArrow' as any, // ✅ Cast to any — not in core's type map
            1,
            priceAxisLabelStackingManager
        );

        this._setPaneViews([
            new LineToolTradeArrowPaneView(this, this._chart, this._series)
        ]);
    }

    // ✅ No override — normalize() not declared on BaseLineTool
    public normalize(): void {}

    // ✅ No override — maxAnchorIndex() not declared on BaseLineTool
    public maxAnchorIndex(): number { return 0; }

    public supportsClickClickCreation(): boolean { return false; }
    public supportsClickDragCreation():  boolean { return false; }

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
}