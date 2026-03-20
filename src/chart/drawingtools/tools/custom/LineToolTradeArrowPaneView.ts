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
    SegmentRenderer,
    TextRenderer,
    AnchorPoint,
    PaneCursorType,
    LineJoin,
    LineCap,
    LineEnd,
    BoxVerticalAlignment,
    BoxHorizontalAlignment,
    TextAlignment,
    IPrimitivePaneRenderer,
} from 'lightweight-charts-line-tools-core';

import { LineToolTradeArrow, TradeArrowFullOptions } from './LineToolTradeArrow';

export class LineToolTradeArrowPaneView<HorzScaleItem> extends LineToolPaneView<HorzScaleItem> {

    private _triLeft:   SegmentRenderer<HorzScaleItem> = new SegmentRenderer();
    private _triRight:  SegmentRenderer<HorzScaleItem> = new SegmentRenderer();
    private _triBase:   SegmentRenderer<HorzScaleItem> = new SegmentRenderer();
    private _stem:      SegmentRenderer<HorzScaleItem> = new SegmentRenderer();
    private _priceLine: SegmentRenderer<HorzScaleItem> = new SegmentRenderer();

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
        const size   = arrow.size;
        const stem   = arrow.stemHeight;

        const cx          = anchor.x as number;
        const cy          = anchor.y as number;
        const triHeight   = size * 1.4;
        const labelOffset = 6;

        let tipY:        number;
        let baseY:       number;
        let stemTopY:    number;
        let stemBottomY: number;
        let labelY:      number;

        if (isBuy) {
            baseY       = cy - stem;
            tipY        = baseY - triHeight;
            stemTopY    = baseY;
            stemBottomY = cy;
            labelY      = cy + labelOffset;
        } else {
            baseY       = cy + stem;
            tipY        = baseY + triHeight;
            stemTopY    = cy;
            stemBottomY = baseY;
            labelY      = tipY + labelOffset;
        }

        const baseLeft  = cx - size;
        const baseRight = cx + size;

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

        // ✅ 3 args — working version
        this._triLeft.setData({
            points: [
                new AnchorPoint(cx       as Coordinate, tipY  as Coordinate, 0),
                new AnchorPoint(baseLeft as Coordinate, baseY as Coordinate, 0),
            ],
            line: lineOpts,
            ...cursor,
        });

        this._triRight.setData({
            points: [
                new AnchorPoint(cx        as Coordinate, tipY  as Coordinate, 0),
                new AnchorPoint(baseRight as Coordinate, baseY as Coordinate, 0),
            ],
            line: lineOpts,
            ...cursor,
        });

        this._triBase.setData({
            points: [
                new AnchorPoint(baseLeft  as Coordinate, baseY as Coordinate, 0),
                new AnchorPoint(baseRight as Coordinate, baseY as Coordinate, 0),
            ],
            line: lineOpts,
            ...cursor,
        });

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

        // ✅ Fresh TextRenderer every frame
        const labelText = new TextRenderer<HorzScaleItem>();
        labelText.setData({
            points: [new AnchorPoint(cx as Coordinate, labelY as Coordinate, 0)],
            text: {
                value:                      isBuy ? 'Buy' : 'Sell',
                padding:                    0,
                wordWrapWidth:              0,
                forceTextAlign:             false,
                forceCalculateMaxLineWidth: false,
                alignment:                  TextAlignment.Center,
                font: {
                    color,
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

        const showPriceLine =
            arrow.priceLine === 'always' ||
            (arrow.priceLine === 'hover' && this._isHovered);

        if (showPriceLine && arrow.priceLabel) {

            this._priceLine.setData({
                points: [
                    new AnchorPoint(0     as Coordinate, cy as Coordinate, 0),
                    new AnchorPoint(width as Coordinate, cy as Coordinate, 0),
                ],
                line: {
                    color,
                    width:  1 as any,
                    style:  1 as any,
                    extend: { left: false, right: false },
                    end:    { left: LineEnd.Normal, right: LineEnd.Normal },
                    join:   LineJoin.Miter,
                    cap:    LineCap.Butt,
                },
                ...cursor,
            });
            r.append(this._priceLine);

            const axisLabel = new TextRenderer<HorzScaleItem>();
            axisLabel.setData({
                points: [new AnchorPoint((width - 4) as Coordinate, cy as Coordinate, 0)],
                text: {
                    value:                      arrow.priceLabel,
                    padding:                    4,
                    wordWrapWidth:              0,
                    forceTextAlign:             false,
                    forceCalculateMaxLineWidth: false,
                    alignment:                  TextAlignment.Center,
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
                            color,
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

    protected override _addAnchors(): void {}
}