// src/chart/drawing/tools/custom/LineToolTradeArrowPaneView.ts

import {
    IChartApiBase,
    ISeriesApi,
    SeriesType,
    LineStyle,
    Coordinate,
} from 'lightweight-charts';

import {
    BaseLineTool,
    LineToolPaneView,
    CompositeRenderer,
    PolygonRenderer,
    PolygonRendererData,
    AnchorPoint,
    PaneCursorType,
    LineJoin,
    LineCap,
    LineEnd,
    IPrimitivePaneRenderer,
} from 'lightweight-charts-line-tools-core';

import { LineToolTradeArrow, TradeArrowFullOptions } from './LineToolTradeArrow';

// ================================================================
// 🎯 TRADE ARROW — Pane View
// ================================================================

export class LineToolTradeArrowPaneView<HorzScaleItem> extends LineToolPaneView<HorzScaleItem> {

    // ✅ PolygonRenderer for filled solid arrow head
    private _arrowRenderer: PolygonRenderer<HorzScaleItem> = new PolygonRenderer();
    // ✅ PolygonRenderer for filled solid stem
    private _stemRenderer: PolygonRenderer<HorzScaleItem> = new PolygonRenderer();

    private _isHovered: boolean = false;

    public constructor(
        source: LineToolTradeArrow<HorzScaleItem>,
        chart:  IChartApiBase<any>,
        series: ISeriesApi<SeriesType, any>
    ) {
        super(source as BaseLineTool<any>, chart, series);
    }

    public override renderer(): IPrimitivePaneRenderer | null {
        if (this._invalidated) this._updateImpl(0, 0);
        return this._renderer;
    }

    public setHovered(hovered: boolean): void {
        if (this._isHovered === hovered) return;
        this._isHovered = hovered;
        this._invalidated = true;
    }

    // ================================================================
    // Core rendering
    // ================================================================

    protected override _updateImpl(height: number, width: number): void {
        this._invalidated = false;

        const r = this._renderer as CompositeRenderer<HorzScaleItem>;
        r.clear();

        const options = this._tool.options() as TradeArrowFullOptions;
        if (!options.visible) return;
        if (this._tool.points().length < 1) return;

        const hasPoints = this._updatePoints();
        if (!hasPoints || this._points.length < 1) return;

        const anchor = this._points[0];
        const arrow  = options.arrow;
        const color  = arrow.color;
        const isBuy  = arrow.type === 'buy';

        const cx = anchor.x as number;
        const cy = anchor.y as number; // ✅ Tip is at the exact price level

        // ── GEOMETRY ──────────────────────────────────────────────
        //
        // BUY (points UP):
        //   tip at cy (exact price)          ← anchor point
        //   triangle grows downward from tip
        //   stem below triangle
        //
        // SELL (points DOWN):
        //   tip at cy (exact price)          ← anchor point
        //   triangle grows upward from tip
        //   stem above triangle

        const triHeight = 14; // Triangle height in pixels
        const triWidth  = 10; // Triangle half-width in pixels
        const stemW     = 3;  // Stem half-width in pixels
        const stemH     = 12; // Stem height in pixels

        let triP0: AnchorPoint; // tip
        let triP1: AnchorPoint; // base left
        let triP2: AnchorPoint; // base right

        let stemP0: AnchorPoint; // stem top-left
        let stemP1: AnchorPoint; // stem top-right
        let stemP2: AnchorPoint; // stem bottom-right
        let stemP3: AnchorPoint; // stem bottom-left

        if (isBuy) {
            // ✅ Tip at top (exact price), base below, stem below base
            const baseY   = cy + triHeight;
            const stemTopY = baseY;
            const stemBotY = baseY + stemH;

            triP0 = new AnchorPoint(cx            as Coordinate, cy      as Coordinate, 0);
            triP1 = new AnchorPoint((cx - triWidth) as Coordinate, baseY  as Coordinate, 0);
            triP2 = new AnchorPoint((cx + triWidth) as Coordinate, baseY  as Coordinate, 0);

            stemP0 = new AnchorPoint((cx - stemW) as Coordinate, stemTopY as Coordinate, 0);
            stemP1 = new AnchorPoint((cx + stemW) as Coordinate, stemTopY as Coordinate, 0);
            stemP2 = new AnchorPoint((cx + stemW) as Coordinate, stemBotY as Coordinate, 0);
            stemP3 = new AnchorPoint((cx - stemW) as Coordinate, stemBotY as Coordinate, 0);
        } else {
            // ✅ Tip at bottom (exact price), base above, stem above base
            const baseY    = cy - triHeight;
            const stemBotY = baseY;
            const stemTopY = baseY - stemH;

            triP0 = new AnchorPoint(cx              as Coordinate, cy      as Coordinate, 0);
            triP1 = new AnchorPoint((cx - triWidth)  as Coordinate, baseY  as Coordinate, 0);
            triP2 = new AnchorPoint((cx + triWidth)  as Coordinate, baseY  as Coordinate, 0);

            stemP0 = new AnchorPoint((cx - stemW) as Coordinate, stemTopY as Coordinate, 0);
            stemP1 = new AnchorPoint((cx + stemW) as Coordinate, stemTopY as Coordinate, 0);
            stemP2 = new AnchorPoint((cx + stemW) as Coordinate, stemBotY as Coordinate, 0);
            stemP3 = new AnchorPoint((cx - stemW) as Coordinate, stemBotY as Coordinate, 0);
        }

        // ── SHARED OPTIONS ─────────────────────────────────────────
        const lineOpts = {
            color,
            width:  1 as any,
            style:  LineStyle.Solid,
            extend: { left: false, right: false },
            end:    { left: LineEnd.Normal, right: LineEnd.Normal },
            join:   LineJoin.Miter,
            cap:    LineCap.Butt,
        };

        const cursor = {
            toolDefaultHoverCursor: PaneCursorType.Pointer,
            toolDefaultDragCursor:  PaneCursorType.Pointer,
        };

        // ── FILLED TRIANGLE ────────────────────────────────────────
        const arrowData: PolygonRendererData = {
            points:                  [triP0, triP1, triP2],
            line:                    lineOpts,
            background:              { color }, // ✅ Solid fill
            hitTestBackground:       true,
            enclosePerimeterWithLine: true,
            ...cursor,
        };

        this._arrowRenderer.setData(arrowData);
        r.append(this._arrowRenderer);

        // ── FILLED STEM ────────────────────────────────────────────
        const stemData: PolygonRendererData = {
            points:                  [stemP0, stemP1, stemP2, stemP3],
            line:                    lineOpts,
            background:              { color }, // ✅ Solid fill
            hitTestBackground:       true,
            enclosePerimeterWithLine: true,
            ...cursor,
        };

        this._stemRenderer.setData(stemData);
        r.append(this._stemRenderer);
    }

    // ✅ No anchors — programmatic tool
    protected override _addAnchors(): void {}
}