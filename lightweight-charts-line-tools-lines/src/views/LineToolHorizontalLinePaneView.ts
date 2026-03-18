// /src/views/LineToolHorizontalLinePaneView.ts

import {
	IChartApiBase,
	ISeriesApi,
	SeriesType,
	Coordinate,
	LineStyle,
} from 'lightweight-charts';

import {
	BaseLineTool,
	LineToolPaneView,
	CompositeRenderer,
	SegmentRenderer,
	TextRenderer,
	AnchorPoint,
	OffScreenState,
	getToolCullingState,
	LineJoin,
	LineCap,
	LineOptions,
	LineToolOptionsInternal,
	BoxHorizontalAlignment,
	deepCopy,
	PaneCursorType,
	SinglePointOrientation
} from 'lightweight-charts-line-tools-core';

import { LineToolHorizontalLine } from '../model/LineToolHorizontalLine';

export class LineToolHorizontalLinePaneView<HorzScaleItem> extends LineToolPaneView<HorzScaleItem> {
	
	// ✅ Only line renderer kept as class property
	// TextRenderer created fresh every frame to prevent cached width bug
	protected _lineRenderer: SegmentRenderer<HorzScaleItem> = new SegmentRenderer();

	public constructor(
		source: LineToolHorizontalLine<HorzScaleItem>,
		chart: IChartApiBase<HorzScaleItem>,
		series: ISeriesApi<SeriesType, HorzScaleItem>,
	) {
		super(source as BaseLineTool<HorzScaleItem>, chart, series);
	}

	protected override _updateImpl(height: number, width: number): void {
		this._invalidated = false;
		this._renderer.clear();

		const options = this._tool.options() as LineToolOptionsInternal<'HorizontalLine'>;
 
		if (!options.visible) return;

		const points = this._tool.points(); 
		if (points.length === 0) return;
 
		// ── CULLING ──
		const singlePointOrientation: SinglePointOrientation = {
			horizontal: true,
			vertical:   false,
		};

		const cullingState = getToolCullingState(
			points,
			this._tool as BaseLineTool<HorzScaleItem>,
			options.line.extend,
			singlePointOrientation
		);

		if (cullingState !== OffScreenState.Visible) return;

		const hasScreenPoints = this._updatePoints(); 
		if (!hasScreenPoints) return;

		const [anchorPoint] = this._points;
        
		const anchorX          = anchorPoint.x; 
		const lineY            = anchorPoint.y;
		const paneDrawingWidth = this._tool.getChartDrawingWidth();

		const { left: extendLeft, right: extendRight } = options.line.extend;
        
		const startX: Coordinate = extendLeft  ? 0 as Coordinate : anchorX;
		const endX:   Coordinate = extendRight ? paneDrawingWidth as Coordinate : anchorX;
        
		const segmentStart = new AnchorPoint(startX, lineY, 0);
		const segmentEnd   = new AnchorPoint(endX,   lineY, 0);

		// ── LINE RENDERER ──
		const lineOptions = deepCopy(options.line) as any;
		lineOptions.join  = lineOptions.join || LineJoin.Miter;
		lineOptions.cap   = lineOptions.cap  || LineCap.Butt;

		this._lineRenderer.setData({ 
			points: [segmentStart, segmentEnd], 
			line:   lineOptions as LineOptions,
			toolDefaultHoverCursor: options.defaultHoverCursor,
			toolDefaultDragCursor:  options.defaultDragCursor,
		});
		(this._renderer as CompositeRenderer<HorzScaleItem>).append(this._lineRenderer);

		// ── TEXT RENDERER ──
		if (options.text.value) {
			const horizontalAlignment = (
				options.text.box?.alignment?.horizontal || ''
			).toLowerCase();
			
			const minXBound  = extendLeft  ? 0              : anchorX;
			const maxXBound  = extendRight ? paneDrawingWidth : anchorX;
			const segmentWidth = maxXBound - minXBound;

			let textPivotX: Coordinate;

			switch (horizontalAlignment) {
				case BoxHorizontalAlignment.Left.toLowerCase():
					textPivotX = minXBound as Coordinate;
					break;
				case BoxHorizontalAlignment.Right.toLowerCase():
					textPivotX = maxXBound as Coordinate;
					break;
				case BoxHorizontalAlignment.Center.toLowerCase():
				default:
					textPivotX = (minXBound + segmentWidth / 2) as Coordinate;
					break;
			}

			const textPivot = new AnchorPoint(textPivotX, anchorPoint.y, 0);

			// ✅ Fresh TextRenderer every frame — prevents cached width bug
			const freshTextRenderer = new TextRenderer<HorzScaleItem>();

			const textRendererData = {
				points: [textPivot, textPivot],
				text:   deepCopy(options.text),  // ✅ deep copy
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
		if (this._points.length < 1) return;

		const options = this._tool.options() as LineToolOptionsInternal<'HorizontalLine'>;
		
		if (options.locked) return;

		const [anchorPoint] = this._points;
 
		const anchorData = {
			points:           [anchorPoint],
			pointsCursorType: [PaneCursorType.VerticalResize],
		};
 
		renderer.append(this.createLineAnchor(anchorData, 0));
	}
}