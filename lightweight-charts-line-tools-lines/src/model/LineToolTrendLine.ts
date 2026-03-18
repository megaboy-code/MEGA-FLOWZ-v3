// /src/model/LineToolTrendLine.ts

import {
	IChartApiBase,
	ISeriesApi,
	IHorzScaleBehavior,
	SeriesType,
	LineStyle,
	Coordinate,
} from 'lightweight-charts';

import {
	BaseLineTool,
	LineToolPoint,
	LineToolOptionsInternal,
	LineToolType,
	LineToolPartialOptionsMap,
	LineToolTrendLineOptions,
	TextOptions,
	EndOptions,
	ExtendOptions,
	TextAlignment,
	BoxVerticalAlignment,
	BoxHorizontalAlignment,
	LineToolsCorePlugin,
	LineEnd,
	deepCopy,
	merge,
	DeepPartial,
	PaneCursorType,
	HitTestResult,
	LineToolHitTestData,
	CompositeRenderer,
	Point,
	InteractionPhase,
	PriceAxisLabelStackingManager,
	ConstraintResult
} from 'lightweight-charts-line-tools-core';

import { LineToolTrendLinePaneView } from '../views/LineToolTrendLinePaneView';

export const TrendLineOptionDefaults: LineToolOptionsInternal<'TrendLine'> = {
	visible: true,
	editable: true,
	defaultHoverCursor: PaneCursorType.Pointer,
	defaultDragCursor: PaneCursorType.Grabbing,
	defaultAnchorHoverCursor: PaneCursorType.Pointer,
	defaultAnchorDragCursor: PaneCursorType.Grabbing,
	notEditableCursor: PaneCursorType.NotAllowed,
	showPriceAxisLabels: true,
	showTimeAxisLabels: true,
	priceAxisLabelAlwaysVisible: false,
	timeAxisLabelAlwaysVisible: false,
	
	line: {
		width: 1,
		color: '#2962ff',
		style: LineStyle.Solid,
		extend: { left: false, right: false },
		end: { left: LineEnd.Normal, right: LineEnd.Normal },
	},
	text: {
		value: '',
		padding: 0,
		wordWrapWidth: 0,
		forceTextAlign: false,
		forceCalculateMaxLineWidth: false,
		alignment: TextAlignment.Center,
		font: { family: 'sans-serif', color: '#2962ff', size: 12, bold: false, italic: false },
		box: { 
			scale: 1, 
			angle: 0, 
			alignment: { 
				vertical:   BoxVerticalAlignment.Top, 
				horizontal: BoxHorizontalAlignment.Center 
			},
			// ✅ Explicitly no box — overrides core internal defaults
			background: { color: 'rgba(0,0,0,0)', inflation: { x: 0, y: 0 } },
			border:     { color: 'rgba(0,0,0,0)', width: 0, style: LineStyle.Solid, radius: 0, highlight: false },
			shadow:     undefined,
		},
	} as TextOptions,
};

export class LineToolTrendLine<HorzScaleItem> extends BaseLineTool<HorzScaleItem> {

	public override readonly toolType: LineToolType = 'TrendLine';
	public override readonly pointsCount: number = 2;

	public maxAnchorIndex(): number {
		return 1;
	}

	public supportsClickClickCreation(): boolean {
		return true;
	}

	public supportsClickDragCreation(): boolean {
		return true;
	}

	public supportsShiftClickClickConstraint(): boolean {
		return true;
	}

	public supportsShiftClickDragConstraint(): boolean {
		return true;
	}

	public constructor(
		coreApi: LineToolsCorePlugin<HorzScaleItem>,
		chart: IChartApiBase<HorzScaleItem>,
		series: ISeriesApi<SeriesType, HorzScaleItem>,
		horzScaleBehavior: IHorzScaleBehavior<HorzScaleItem>,
		options: DeepPartial<LineToolOptionsInternal<'TrendLine'>> = {},
		points: LineToolPoint[] = [],
		priceAxisLabelStackingManager: PriceAxisLabelStackingManager<HorzScaleItem>
	) {
		const finalOptions = deepCopy(TrendLineOptionDefaults) as LineToolOptionsInternal<'TrendLine'>;
		merge(finalOptions, options as DeepPartial<LineToolOptionsInternal<'TrendLine'>>);

		super(
			coreApi,
			chart,
			series,
			horzScaleBehavior,
			finalOptions,
			points,
			'TrendLine',
			2,
			priceAxisLabelStackingManager
		);

		this._setPaneViews([new LineToolTrendLinePaneView(this, this._chart, this._series)]);
	}

	public override getShiftConstrainedPoint(
		pointIndex: number, 
		rawScreenPoint: Point, 
		phase: InteractionPhase,
		originalLogicalPoint: LineToolPoint,
		allOriginalLogicalPoints: LineToolPoint[]
	): ConstraintResult {
		
		let constraintSourceLogicalPoint: LineToolPoint | null = null;

		if (phase === InteractionPhase.Creation) {
			constraintSourceLogicalPoint = originalLogicalPoint;
		} else {
			const otherPointIndex = pointIndex === 0 ? 1 : 0;
			constraintSourceLogicalPoint = allOriginalLogicalPoints[otherPointIndex];
		}
		
		if (!constraintSourceLogicalPoint) {
			return { point: rawScreenPoint, snapAxis: 'none' };
		}

		const constraintSourceScreenPoint = this.pointToScreenPoint(constraintSourceLogicalPoint);
		
		if (!constraintSourceScreenPoint) {
			return { point: rawScreenPoint, snapAxis: 'none' };
		}

		return {
			point: new Point(rawScreenPoint.x, constraintSourceScreenPoint.y),
			snapAxis: 'price',
		};
	}

	public normalize(): void {
		if (this._points.length < 2) return;

		let [p0, p1] = this._points;

		if (p0.timestamp > p1.timestamp) {
			this._points = [p1, p0];
			return;
		}

		if (p0.timestamp === p1.timestamp) {
			if (p0.price > p1.price) {
				this._points = [p1, p0];
				return;
			}
		}
	}

	public override setPoint(index: number, point: LineToolPoint): void {
		super.setPoint(index, point);
	}

	public override _internalHitTest(x: Coordinate, y: Coordinate): HitTestResult<LineToolHitTestData> | null {

		if (!this._paneViews || this._paneViews.length === 0 || !this._paneViews[0]) {
			return null;
		}

		const paneView = this._paneViews[0] as LineToolTrendLinePaneView<HorzScaleItem>;
		const compositeRenderer = paneView.renderer() as CompositeRenderer<HorzScaleItem>;

		if (!compositeRenderer || !compositeRenderer.hitTest) {
			return null;
		}

		return compositeRenderer.hitTest(x, y);
	}
}