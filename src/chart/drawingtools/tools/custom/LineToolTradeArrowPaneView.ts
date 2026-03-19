// src/chart/drawing/tools/custom/LineToolTradeArrowPaneView.ts

import {
    IChartApiBase,
    ISeriesApi,
    SeriesType,
    Coordinate,
} from 'lightweight-charts';

import {
    BaseLineTool,
    LineToolPaneView,
    CompositeRenderer,
    SegmentRenderer,
    TextRenderer,
    AnchorPoint,
    PaneCursorType,
    getToolCullingState,
    OffScreenState,
    deepCopy,
    LineStyle,
    LineJoin,
    LineCap,
    LineEnd,
    BoxVerticalAlignment,
    BoxHorizontalAlignment,
    TextAlignment,
    IPrimitivePaneRenderer,
} from 'lightweight-charts-line-tools-core';

import { IChartApiBase, ISeriesApi } from 'lightweight-charts';
import { LineToolTradeArrow, TradeArrowFullOptions } from './LineToolTradeArrow';

// ================================================================
// 🎯 TRADE ARROW — Pane View
// ================================================================

export class LineToolTradeArrowPaneView<HorzScaleItem> extends LineToolPaneView<HorzScaleItem> {

    // # Segment renderers — safe to cache (no text width issue)
    // Triangle head — 3 sides
    private _triLeft:  SegmentRenderer<HorzScaleItem> = new SegmentRenderer();
    private _triRight: SegmentRenderer<HorzScaleItem> = new SegmentRenderer();
    private _triBase:  SegmentRenderer<HorzScaleItem> = new SegmentRenderer();
    // Stem
    private _stem:     SegmentRenderer<HorzScaleItem> = new SegmentRenderer();
    // Price dashed line
    private _priceLine: SegmentRenderer<HorzScaleItem> = new SegmentRenderer();

    // # Hover state — controls price line + axis label visibility
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

    // ================================================================
    // # Set hover state — called from outside on mouse events
    // ================================================================
    public setHovered(hovered: boolean): void {
        if (this._isHovered === hovered) return;
        this._isHovered = hovered;
        this._invalidated = true;
    }

    // ================================================================
    // # Core rendering
    // ================================================================
    protected override _updateImpl(height: number, width: number): void {
        this._invalidated = false;

        const r = this._renderer as CompositeRenderer<HorzScaleItem>;
        r.clear();

        const options = this._tool.options() as TradeArrowFullOptions;

        if (!options.visible) return;
        if (this._tool.points().length < 1) return;

        // # Culling
        const points = this._tool.points();
        const cullingState = getToolCullingState(
            points,
            this._tool as BaseLineTool<HorzScaleItem>
        );
        if (cullingState !== OffScreenState.Visible) return;

        // # Convert logical point to screen
        const hasPoints = this._updatePoints();
        if (!hasPoints || this._points.length < 1) return;

        const anchor = this._points[0];
        const arrow  = options.arrow;
        const color  = arrow.color;
        const isBuy  = arrow.type === 'buy';
        const size   = arrow.size;       // Triangle half-width
        const stem   = arrow.stemHeight; // Stem length

        // ── GEOMETRY ──────────────────────────────────────────────
        //
        // BUY  (points up):
        //   tip at (cx, anchorY - stem - triangleHeight)
        //   base at (cx ± size, anchorY - stem)
        //   stem from (cx, anchorY) to (cx, anchorY - stem)
        //   label below (cx, anchorY + labelOffset)
        //
        // SELL (points down):
        //   tip at (cx, anchorY + stem + triangleHeight)
        //   base at (cx ± size, anchorY + stem)
        //   stem from (cx, anchorY) to (cx, anchorY + stem)
        //   label below (cx, anchorY + stem + triangleHeight + labelOffset)
        //
        const cx            = anchor.x as number;
        const cy            = anchor.y as number;
        const triHeight     = size * 1.4; // Slightly taller than wide for good arrow shape
        const labelOffset   = 6;

        // ── CALCULATE POINTS ──────────────────────────────────────

        let tipY:   number;
        let baseY:  number;
        let stemTopY:    number;
        let stemBottomY: number;
        let labelY: number;

        if (isBuy) {
            // Arrow points UP
            baseY       = cy - stem;
            tipY        = baseY - triHeight;
            stemTopY    = baseY;
            stemBottomY = cy;
            labelY      = cy + labelOffset;
        } else {
            // Arrow points DOWN
            baseY       = cy + stem;
            tipY        = baseY + triHeight;
            stemTopY    = cy;
            stemBottomY = baseY;
            labelY      = tipY + labelOffset;
        }

        const baseLeft  = cx - size;
        const baseRight = cx + size;

        // ── SHARED LINE OPTIONS ────────────────────────────────────
        const lineOpts = {
            color,
            width:  2 as any,
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

        // ── TRIANGLE — 3 sides ─────────────────────────────────────
        // Left side: tip → base-left
        this._triLeft.setData({
            points: [
                new AnchorPoint(cx       as Coordinate, tipY  as Coordinate, 0),
                new AnchorPoint(baseLeft as Coordinate, baseY as Coordinate, 0),
            ],
            line: lineOpts,
            ...cursor,
        });

        // Right side: tip → base-right
        this._triRight.setData({
            points: [
                new AnchorPoint(cx        as Coordinate, tipY  as Coordinate, 0),
                new AnchorPoint(baseRight as Coordinate, baseY as Coordinate, 0),
            ],
            line: lineOpts,
            ...cursor,
        });

        // Base: base-left → base-right
        this._triBase.setData({
            points: [
                new AnchorPoint(baseLeft  as Coordinate, baseY as Coordinate, 0),
                new AnchorPoint(baseRight as Coordinate, baseY as Coordinate, 0),
            ],
            line: lineOpts,
            ...cursor,
        });

        // ── STEM ───────────────────────────────────────────────────
        this._stem.setData({
            points: [
                new AnchorPoint(cx as Coordinate, stemTopY    as Coordinate, 0),
                new AnchorPoint(cx as Coordinate, stemBottomY as Coordinate, 0),
            ],
            line: lineOpts,
            ...cursor,
        });

        r.append(this._triLeft);
        r.append(this._triRight);
        r.append(this._triBase);
        r.append(this._stem);

        // ── LABEL (Buy / Sell) ─────────────────────────────────────
        // Fresh TextRenderer every frame — never cache
        const labelText = new TextRenderer<HorzScaleItem>();
        labelText.setData({
            points: [new AnchorPoint(cx as Coordinate, labelY as Coordinate, 0)],
            text: {
                value:    isBuy ? 'Buy' : 'Sell',
                padding:  0,
                wordWrapWidth: 0,
                forceTextAlign: false,
                forceCalculateMaxLineWidth: false,
                alignment: TextAlignment.Center,
                font: {
                    color:  color,
                    size:   9,
                    bold:   true,
                    italic: false,
                    family: 'sans-serif',
                },
                box: {
                    scale: 1,
                    angle: 0,
                    alignment: {
                        vertical:   BoxVerticalAlignment.Top,
                        horizontal: BoxHorizontalAlignment.Center,
                    },
                    background: { color: 'rgba(0,0,0,0)', inflation: { x: 0, y: 0 } },
                    border: {
                        color:     'rgba(0,0,0,0)',
                        width:     0,
                        style:     LineStyle.Solid,
                        radius:    0,
                        highlight: false,
                    },
                    shadow: undefined,
                },
            },
            hitTestBackground: true,
            ...cursor,
        });
        r.append(labelText);

        // ── PRICE LINE + AXIS LABEL ────────────────────────────────
        // Show based on priceLine setting or hover state
        const showPriceLine =
            arrow.priceLine === 'always' ||
            (arrow.priceLine === 'hover' && this._isHovered);

        if (showPriceLine && arrow.priceLabel) {
            // Dashed line full width at anchor Y
            this._priceLine.setData({
                points: [
                    new AnchorPoint(0     as Coordinate, cy as Coordinate, 0),
                    new AnchorPoint(width as Coordinate, cy as Coordinate, 0),
                ],
                line: {
                    color,
                    width:  1 as any,
                    style:  LineStyle.Dashed,
                    extend: { left: false, right: false },
                    end:    { left: LineEnd.Normal, right: LineEnd.Normal },
                    join:   LineJoin.Miter,
                    cap:    LineCap.Butt,
                },
                ...cursor,
            });
            r.append(this._priceLine);

            // Axis label — pinned to right edge
            const axisLabel = new TextRenderer<HorzScaleItem>();
            axisLabel.setData({
                points: [new AnchorPoint((width - 4) as Coordinate, cy as Coordinate, 0)],
                text: {
                    value:   arrow.priceLabel,
                    padding: 4,
                    wordWrapWidth: 0,
                    forceTextAlign: false,
                    forceCalculateMaxLineWidth: false,
                    alignment: TextAlignment.Center,
                    font: {
                        color:  '#ffffff',
                        size:   10,
                        bold:   false,
                        italic: false,
                        family: 'sans-serif',
                    },
                    box: {
                        scale: 1,
                        angle: 0,
                        alignment: {
                            vertical:   BoxVerticalAlignment.Middle,
                            horizontal: BoxHorizontalAlignment.Right,
                        },
                        background: { color, inflation: { x: 4, y: 2 } },
                        border: {
                            color:     color,
                            width:     1,
                            style:     LineStyle.Solid,
                            radius:    2,
                            highlight: false,
                        },
                        shadow: undefined,
                    },
                },
                hitTestBackground: false,
                ...cursor,
            });
            r.append(axisLabel);
        }
    }

    // # No anchors — programmatic tool
    protected override _addAnchors(): void {}
}