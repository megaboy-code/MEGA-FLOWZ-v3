// /src/views/LineToolTrendLinePaneView.ts

import {
	IChartApiBase,
	ISeriesApi,
	SeriesType,
	LineStyle,
} from 'lightweight-charts';

import {
	BaseLineTool,
	LineToolOptionsInternal,
	LineToolPaneView,
	CompositeRenderer,
	SegmentRenderer,
	TextRenderer,
	AnchorPoint,
	OffScreenState,
	getToolCullingState,
	deepCopy,
	TextRendererData,
	PaneCursorType,
	LineJoin,
	LineCap,
	LineOptions,
	BoxHorizontalAlignment,
} from 'lightweight-charts-line-tools-core';
import { LineToolTrendLine } from '../model/LineToolTrendLine';
import { IPrimitivePaneRenderer } from 'lightweight-charts-line-tools-core';

export class LineToolTrendLinePaneView<HorzScaleItem> extends LineToolPaneView<HorzScaleItem> {

	protected _segmentRenderer: SegmentRenderer<HorzScaleItem> = new SegmentRenderer();

	public constructor(
		source: LineToolTrendLine<HorzScaleItem>,
		chart: IChartApiBase<any>,
		series: ISeriesApi<SeriesType, any>,
	) {
		super(source as BaseLineTool<any>, chart, series);
	}

	public getSegmentRenderer(): SegmentRenderer<HorzScaleItem> {
		return this._segmentRenderer;
	}

	public override renderer(): IPrimitivePaneRenderer | null {
		if (this._invalidated) {
			this._updateImpl(0, 0);
		}
		return this._renderer;
	}

	protected override _updateImpl(height: number, width: number): void {
		this._invalidated = false;
		this._renderer.clear();

		const options = this._tool.options() as LineToolOptionsInternal<'TrendLine'>;

		if (!options.visible) return;
		if (this._tool.points().length < this._tool.pointsCount) return;

		const points = this._tool.points();

		// ── CULLING ──
		const cullingState = getToolCullingState(
			points,
			this._tool as BaseLineTool<HorzScaleItem>,
			options.line.extend
		);

		if (cullingState !== OffScreenState.Visible) return;

		const hasScreenPoints = this._updatePoints();
		if (!hasScreenPoints) return;

		const [point0, point1] = this._points;
		const segmentPoints: [AnchorPoint, AnchorPoint] = [point0, point1];

		// ── SEGMENT RENDERER ──
		const lineOptions = deepCopy(options.line) as any;
		lineOptions.join = lineOptions.join || LineJoin.Miter;
		lineOptions.cap  = lineOptions.cap  || LineCap.Butt;

		this._segmentRenderer.setData({
			points: segmentPoints,
			line:   lineOptions as LineOptions,
			toolDefaultHoverCursor: options.defaultHoverCursor,
			toolDefaultDragCursor:  options.defaultDragCursor,
		});
		(this._renderer as CompositeRenderer<HorzScaleItem>).append(this._segmentRenderer);

		// ── TEXT RENDERER ──
		if (options.text.value) {

			// ── 1. Horizontal attachment point ──
			const horizontalAlignment = (
				options.text.box?.alignment?.horizontal || ''
			).toLowerCase();

			let attachX: number;
			let attachY: number;

			if (horizontalAlignment === 'left') {
				attachX = point0.x;
				attachY = point0.y;
			} else if (horizontalAlignment === 'right') {
				attachX = point1.x;
				attachY = point1.y;
			} else {
				attachX = (point0.x + point1.x) / 2;
				attachY = (point0.y + point1.y) / 2;
			}

			const attachmentPoint = new AnchorPoint(attachX, attachY, 0);

			// ── 2. Line angle ──
			const dx           = point1.x - point0.x;
			const dy           = point1.y - point0.y;
			const angleRadians = Math.atan2(dy, dx);
			const finalAngle   = (-angleRadians * (180 / Math.PI)) + (options.text.box?.angle || 0);

			// ── 3. Text options ──
			const textOptions = deepCopy(options.text);
			textOptions.box   = {
				...textOptions.box,
				angle: finalAngle,
				// ✅ Explicitly no box — belt and suspenders over model defaults
				background: { color: 'rgba(0,0,0,0)', inflation: { x: 0, y: 0 } },
				border:     { color: 'rgba(0,0,0,0)', width: 0, style: LineStyle.Solid, radius: 0, highlight: false },
				shadow:     undefined,
			};

			// ── 4. Fresh TextRenderer every frame ──
			const freshTextRenderer = new TextRenderer<HorzScaleItem>();

			const textRendererData: TextRendererData = {
				points:            [attachmentPoint, attachmentPoint],
				text:              textOptions,
				hitTestBackground: true,
				toolDefaultHoverCursor: options.defaultHoverCursor,
				toolDefaultDragCursor:  options.defaultDragCursor,
			};

			freshTextRenderer.setData(textRendererData);
			(this._renderer as CompositeRenderer<HorzScaleItem>).append(freshTextRenderer);
		}

		// ── ANCHORS ──
		if (this.areAnchorsVisible()) {
			this._addAnchors(this._renderer as CompositeRenderer<HorzScaleItem>);
		}
	}

	protected override _addAnchors(renderer: CompositeRenderer<HorzScaleItem>): void {
		if (this._points.length < 2) return;

		const options = this._tool.options() as LineToolOptionsInternal<'TrendLine'>;

		if (options.locked) return;

		const [point0, point1] = this._points;

		const anchorData = {
			points: [point0, point1],
			pointsCursorType: [
				PaneCursorType.DiagonalNwSeResize,
				PaneCursorType.DiagonalNwSeResize
			],
		};

		renderer.append(this.createLineAnchor(anchorData, 0));
	}
}