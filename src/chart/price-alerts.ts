// ================================================================
// ⚡ PRICE ALERTS PLUGIN - Single File Implementation
// For Lightweight Charts v5.0+
// ===============================================================

import {
    IChartApi,
    ISeriesApi,
    ISeriesPrimitive,
    IPrimitivePaneRenderer,
    IPrimitivePaneView,
    PrimitiveHoveredItem,
    PrimitivePaneViewZOrder,
    SeriesAttachedParameter,
    SeriesType,
    Time,
} from 'lightweight-charts';
import { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';

// ==================== DELEGATE PATTERN ====================
interface ISubscription<T = void> {
    subscribe(callback: (data: T) => void, scope?: object): void;
    unsubscribe(callback: (data: T) => void, scope?: object): void;
    unsubscribeAll(scope?: object): void;
    fire(data: T): void;
    destroy(): void;
}

class Delegate<T = void> implements ISubscription<T> {
    private _listeners: Array<{ callback: (data: T) => void; scope?: object }> = [];

    subscribe(callback: (data: T) => void, scope?: object): void {
        this._listeners.push({ callback, scope });
    }

    unsubscribe(callback: (data: T) => void, scope?: object): void {
        this._listeners = this._listeners.filter(
            listener => !(listener.callback === callback && listener.scope === scope)
        );
    }

    unsubscribeAll(scope?: object): void {
        if (scope) {
            this._listeners = this._listeners.filter(listener => listener.scope !== scope);
        } else {
            this._listeners = [];
        }
    }

    fire(data: T): void {
        const listeners = this._listeners.slice();
        for (const listener of listeners) {
            listener.callback(data);
        }
    }

    destroy(): void {
        this._listeners = [];
    }
}

// ==================== HELPER FUNCTIONS ====================
interface LineDimensions {
    position: number;
    length: number;
}

function positionsLine(position: number, pixelRatio: number, length: number): LineDimensions {
    const scaledPosition = Math.round(position * pixelRatio);
    const scaledLength = Math.round(length * pixelRatio);
    return {
        position: scaledPosition,
        length: Math.max(scaledLength, 0),
    };
}

function adjustRadius<T extends number | number[]>(radius: T, pixelRatio: number): T {
    if (typeof radius === 'number') {
        return (radius * pixelRatio) as T;
    }
    return radius.map(i => i * pixelRatio) as T;
}

// ==================== CONSTANTS ====================
const CONSTANTS = {
    buttonWidth: 21,
    buttonHeight: 21,
    showButtonDistance: 50,
    labelHeight: 17,
    borderRadius: 2,
    iconPadding: 4,
    iconPaddingAlertTop: 2,
    clockIconViewBoxSize: 13,
    iconSize: 13,
    showCentreLabelDistance: 50,
    averageWidthPerCharacter: 5.81,
    removeButtonWidth: 26,
    centreLabelHeight: 20,
    centreLabelInlinePadding: 9,
    crossViewBoxSize: 10,
};

// Chart margin to prevent labels from being cut off
const CHART_MARGIN = 20;

// ==================== PATH2D ICONS ====================
const CLOCK_PLUS_ICON_PATHS: Path2D[] = [
    new Path2D(
        'M5.34004 1.12254C4.7902 0.438104 3.94626 0 3 0C1.34315 0 0 1.34315 0 3C0 3.94626 0.438104 4.7902 1.12254 5.34004C1.04226 5.714 1 6.10206 1 6.5C1 9.36902 3.19675 11.725 6 11.9776V10.9725C3.75002 10.7238 2 8.81628 2 6.5C2 4.01472 4.01472 2 6.5 2C8.81628 2 10.7238 3.75002 10.9725 6H11.9776C11.9574 5.77589 11.9237 5.55565 11.8775 5.34011C12.562 4.79026 13.0001 3.9463 13.0001 3C13.0001 1.34315 11.6569 0 10.0001 0C9.05382 0 8.20988 0.438111 7.66004 1.12256C7.28606 1.04227 6.89797 1 6.5 1C6.10206 1 5.714 1.04226 5.34004 1.12254ZM4.28255 1.46531C3.93534 1.17484 3.48809 1 3 1C1.89543 1 1 1.89543 1 3C1 3.48809 1.17484 3.93534 1.46531 4.28255C2.0188 3.02768 3.02768 2.0188 4.28255 1.46531ZM8.71751 1.46534C9.97237 2.01885 10.9812 3.02774 11.5347 4.28262C11.8252 3.93541 12.0001 3.48812 12.0001 3C12.0001 1.89543 11.1047 1 10.0001 1C9.51199 1 9.06472 1.17485 8.71751 1.46534Z'
    ),
    new Path2D('M7 7V4H8V8H5V7H7Z'),
    new Path2D('M10 8V10H8V11H10V13H11V11H13V10H11V8H10Z'),
];

const CLOCK_ICON_PATHS: Path2D[] = [
    new Path2D(
        'M5.11068 1.65894C3.38969 2.08227 1.98731 3.31569 1.33103 4.93171C0.938579 4.49019 0.700195 3.90868 0.700195 3.27148C0.700195 1.89077 1.81948 0.771484 3.2002 0.771484C3.9664 0.771484 4.65209 1.11617 5.11068 1.65894Z'
    ),
    new Path2D(
        'M12.5 3.37148C12.5 4.12192 12.1694 4.79514 11.6458 5.25338C11.0902 3.59304 9.76409 2.2857 8.09208 1.7559C8.55066 1.21488 9.23523 0.871484 10 0.871484C11.3807 0.871484 12.5 1.99077 12.5 3.37148Z'
    ),
    new Path2D(
        'M6.42896 11.4999C8.91424 11.4999 10.929 9.48522 10.929 6.99994C10.929 4.51466 8.91424 2.49994 6.42896 2.49994C3.94367 2.49994 1.92896 4.51466 1.92896 6.99994C1.92896 9.48522 3.94367 11.4999 6.42896 11.4999ZM6.00024 3.99994V6.99994H4.00024V7.99994H7.00024V3.99994H6.00024Z'
    ),
    new Path2D(
        'M4.08902 0.934101C4.4888 1.08621 4.83946 1.33793 5.11068 1.65894C5.06565 1.67001 5.02084 1.68164 4.97625 1.69382C4.65623 1.78123 4.34783 1.89682 4.0539 2.03776C3.16224 2.4653 2.40369 3.12609 1.8573 3.94108C1.64985 4.2505 1.47298 4.58216 1.33103 4.93171C1.05414 4.6202 0.853937 4.23899 0.760047 3.81771C0.720863 3.6419 0.700195 3.45911 0.700195 3.27148C0.700195 1.89077 1.81948 0.771484 3.2002 0.771484C3.51324 0.771484 3.81285 0.829023 4.08902 0.934101ZM12.3317 4.27515C12.4404 3.99488 12.5 3.69015 12.5 3.37148C12.5 1.99077 11.3807 0.871484 10 0.871484C9.66727 0.871484 9.34974 0.936485 9.05938 1.05448C8.68236 1.20769 8.35115 1.45027 8.09208 1.7559C8.43923 1.8659 8.77146 2.00942 9.08499 2.18265C9.96762 2.67034 10.702 3.39356 11.2032 4.26753C11.3815 4.57835 11.5303 4.90824 11.6458 5.25338C11.947 4.98973 12.1844 4.65488 12.3317 4.27515ZM9.18112 3.43939C8.42029 2.85044 7.46556 2.49994 6.42896 2.49994C3.94367 2.49994 1.92896 4.51466 1.92896 6.99994C1.92896 9.48522 3.94367 11.4999 6.42896 11.4999C8.91424 11.4999 10.929 9.48522 10.929 6.99994C10.929 5.55126 10.2444 4.26246 9.18112 3.43939ZM6.00024 3.99994H7.00024V7.99994H4.00024V6.99994H6.00024V3.99994Z'
    ),
];

const CROSS_PATH = new Path2D(
    'M9.35359 1.35359C9.11789 1.11789 8.88219 0.882187 8.64648 0.646484L5.00004 4.29293L1.35359 0.646484C1.11791 0.882212 0.882212 1.11791 0.646484 1.35359L4.29293 5.00004L0.646484 8.64648C0.882336 8.88204 1.11804 9.11774 1.35359 9.35359L5.00004 5.70714L8.64648 9.35359C8.88217 9.11788 9.11788 8.88217 9.35359 8.64649L5.70714 5.00004L9.35359 1.35359Z'
);

// ==================== INTERFACES ====================
interface CrosshairRendererData {
    y: number;
    text: string;
}

interface ShowHoverData {
    text: string;
    showHover: true;
    hoverRemove: boolean;
}

interface NoHoverData {
    showHover: false;
}

interface AlertRendererDataBase {
    y: number;
    showHover: boolean;
    text?: string;
}

interface CrosshairButtonData {
    hoverColor: string;
    crosshairLabelIcon: Path2D[];
    hovering: boolean;
}

export type AlertRendererData = AlertRendererDataBase & (ShowHoverData | NoHoverData);

export interface IRendererData {
    alertIcon: Path2D[];
    alerts: AlertRendererData[];
    button: CrosshairButtonData | null;
    color: string;
    crosshair: CrosshairRendererData | null;
}

interface MousePosition {
    x: number;
    y: number;
    xPositionRelativeToPriceScale: number;
    overPriceScale: boolean;
    overTimeScale: boolean;
}

interface UserAlertInfo {
    id: string;
    price: number;
}

// ==================== ALERT STATE MANAGEMENT ====================
class UserAlertsState {
    private _alertAdded: Delegate<UserAlertInfo> = new Delegate();
    private _alertRemoved: Delegate<string> = new Delegate();
    private _alertChanged: Delegate<UserAlertInfo> = new Delegate();
    private _alertsChanged: Delegate = new Delegate();
    private _alerts: Map<string, UserAlertInfo>;
    private _alertsArray: UserAlertInfo[] = [];

    constructor() {
        this._alerts = new Map();
        this._alertsChanged.subscribe(() => {
            this._updateAlertsArray();
        }, this);
    }

    destroy() {
        this._alertsChanged.unsubscribeAll(this);
    }

    alertAdded(): Delegate<UserAlertInfo> {
        return this._alertAdded;
    }

    alertRemoved(): Delegate<string> {
        return this._alertRemoved;
    }

    alertChanged(): Delegate<UserAlertInfo> {
        return this._alertChanged;
    }

    alertsChanged(): Delegate {
        return this._alertsChanged;
    }

    addAlert(price: number): string {
        const id = this._getNewId();
        const userAlert: UserAlertInfo = {
            price,
            id,
        };
        this._alerts.set(id, userAlert);
        this._alertAdded.fire(userAlert);
        this._alertsChanged.fire();
        return id;
    }

    removeAlert(id: string) {
        if (!this._alerts.has(id)) return;
        this._alerts.delete(id);
        this._alertRemoved.fire(id);
        this._alertsChanged.fire();
    }

    alerts() {
        return this._alertsArray;
    }

    private _updateAlertsArray() {
        this._alertsArray = Array.from(this._alerts.values()).sort((a, b) => {
            return b.price - a.price;
        });
    }

    private _getNewId(): string {
        let id = Math.round(Math.random() * 1000000).toString(16);
        while (this._alerts.has(id)) {
            id = Math.round(Math.random() * 1000000).toString(16);
        }
        return id;
    }
}

// ==================== MOUSE HANDLERS ====================
class MouseHandlers {
    private _chart: IChartApi | undefined = undefined;
    private _series: ISeriesApi<SeriesType> | undefined = undefined;
    private _unSubscribers: (() => void)[] = [];

    private _clicked: Delegate<MousePosition | null> = new Delegate();
    private _mouseMoved: Delegate<MousePosition | null> = new Delegate();

    attached(chart: IChartApi, series: ISeriesApi<SeriesType>) {
        this._chart = chart;
        this._series = series;
        const container = this._chart.chartElement();
        this._addMouseEventListener(container, 'mouseleave', this._mouseLeave.bind(this));
        this._addMouseEventListener(container, 'mousemove', this._mouseMove.bind(this));
        this._addMouseEventListener(container, 'click', this._mouseClick.bind(this));
    }

    detached() {
        this._series = undefined;
        this._clicked.destroy();
        this._mouseMoved.destroy();
        this._unSubscribers.forEach(unSub => unSub());
        this._unSubscribers = [];
    }

    public clicked(): ISubscription<MousePosition | null> {
        return this._clicked;
    }

    public mouseMoved(): ISubscription<MousePosition | null> {
        return this._mouseMoved;
    }

    private _addMouseEventListener(
        target: HTMLDivElement,
        eventType: 'mouseleave' | 'mousemove' | 'click',
        handler: (event: MouseEvent) => void
    ): void {
        target.addEventListener(eventType, handler);
        const unSubscriber = () => target.removeEventListener(eventType, handler);
        this._unSubscribers.push(unSubscriber);
    }

    private _mouseLeave() {
        this._mouseMoved.fire(null);
    }

    private _mouseMove(event: MouseEvent) {
        this._mouseMoved.fire(this._determineMousePosition(event));
    }

    private _mouseClick(event: MouseEvent) {
        this._clicked.fire(this._determineMousePosition(event));
    }

    private _determineMousePosition(event: MouseEvent): MousePosition | null {
        if (!this._chart || !this._series) return null;
        const element = this._chart.chartElement();
        const chartContainerBox = element.getBoundingClientRect();
        const priceScaleWidth = this._series.priceScale().width();
        const timeScaleHeight = this._chart.timeScale().height();
        const x = event.clientX - chartContainerBox.x;
        const y = event.clientY - chartContainerBox.y;
        const overTimeScale = y > element.clientHeight - timeScaleHeight;
        const xPositionRelativeToPriceScale = element.clientWidth - priceScaleWidth - x;
        const overPriceScale = xPositionRelativeToPriceScale < 0;
        return {
            x,
            y,
            xPositionRelativeToPriceScale,
            overPriceScale,
            overTimeScale,
        };
    }
}

// ==================== BASE RENDERER ====================
abstract class PaneRendererBase implements IPrimitivePaneRenderer {
    protected _data: IRendererData | null = null;
    abstract draw(target: CanvasRenderingTarget2D): void;
    update(data: IRendererData | null) {
        this._data = data;
    }
}

// ==================== MAIN PANE RENDERER ====================
class PaneRenderer extends PaneRendererBase {
    draw(target: CanvasRenderingTarget2D): void {
        target.useBitmapCoordinateSpace(scope => {
            if (!this._data) return;
            
            // FIX: Only alert lines should be blue
            this._drawAlertLines(scope);
            this._drawAlertIcons(scope);

            const hasRemoveHover = this._data.alerts.some(
                alert => alert.showHover && alert.hoverRemove
            );

            if (!hasRemoveHover) {
                // Draw subtle guide line instead of solid crosshair line
                this._drawSubtleCrosshairGuide(scope);
                this._drawCrosshairLabelButton(scope);
            }
            
            // FIX: Draw hover labels at correct position
            this._drawAlertLabel(scope);
        });
    }

    private _drawHorizontalLine(
        scope: BitmapCoordinatesRenderingScope,
        data: {
            width: number;
            lineWidth: number;
            color: string;
            y: number;
        }
    ) {
        const ctx = scope.context;
        try {
            const yPos = positionsLine(data.y, scope.verticalPixelRatio, data.lineWidth);
            const yCentre = yPos.position + yPos.length / 2;

            ctx.save();
            ctx.beginPath();
            ctx.lineWidth = data.lineWidth;
            ctx.strokeStyle = data.color;
            const dash = 4 * scope.horizontalPixelRatio;
            ctx.setLineDash([dash, dash]);
            ctx.moveTo(0, yCentre);
            ctx.lineTo(
                (data.width - CONSTANTS.buttonWidth) * scope.horizontalPixelRatio,
                yCentre
            );
            ctx.stroke();
        } finally {
            ctx.restore();
        }
    }

    private _drawSubtleCrosshairGuide(scope: BitmapCoordinatesRenderingScope) {
        if (!this._data?.crosshair) return;
        const ctx = scope.context;
        try {
            const yPos = positionsLine(this._data.crosshair.y, scope.verticalPixelRatio, 1);
            const yCentre = yPos.position + yPos.length / 2;

            ctx.save();
            ctx.beginPath();
            ctx.lineWidth = 0.5;
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)'; // Very transparent blue
            const dash = 2 * scope.horizontalPixelRatio;
            const gap = 4 * scope.horizontalPixelRatio;
            ctx.setLineDash([dash, gap]); // More subtle pattern
            ctx.moveTo(0, yCentre);
            ctx.lineTo(
                (scope.mediaSize.width - CONSTANTS.buttonWidth) * scope.horizontalPixelRatio,
                yCentre
            );
            ctx.stroke();
        } finally {
            ctx.restore();
        }
    }

    private _drawAlertLines(scope: BitmapCoordinatesRenderingScope) {
        if (!this._data?.alerts) return;
        // FIX: Only alert lines should be blue for visibility
        const lineColor = '#3b82f6'; // Bright blue for alert lines only
        this._data.alerts.forEach(alertData => {
            this._drawHorizontalLine(scope, {
                width: scope.mediaSize.width,
                lineWidth: 1,
                color: lineColor,
                y: alertData.y,
            });
        });
    }

    private _drawAlertIcons(scope: BitmapCoordinatesRenderingScope) {
        if (!this._data?.alerts) return;
        // FIX: Bell icons should keep original color (black/dark)
        const color = this._data.color; // Original color
        const icon = this._data.alertIcon;
        this._data.alerts.forEach(alert => {
            this._drawLabel(scope, {
                width: scope.mediaSize.width,
                labelHeight: CONSTANTS.labelHeight,
                y: alert.y,
                roundedCorners: 2,
                icon,
                iconScaling: CONSTANTS.iconSize / CONSTANTS.clockIconViewBoxSize,
                padding: {
                    left: CONSTANTS.iconPadding,
                    top: CONSTANTS.iconPaddingAlertTop,
                },
                color,
            });
        });
    }

    private _calculateLabelWidth(textLength: number) {
        return (
            CONSTANTS.centreLabelInlinePadding * 2 +
            CONSTANTS.removeButtonWidth +
            textLength * CONSTANTS.averageWidthPerCharacter
        );
    }

    private _drawAlertLabel(scope: BitmapCoordinatesRenderingScope) {
        if (!this._data?.alerts) return;
        const ctx = scope.context;
        const activeLabel = this._data.alerts.find(alert => alert.showHover);
        if (!activeLabel || !activeLabel.showHover) return;
        
        const labelHeight = CONSTANTS.centreLabelHeight;
        const labelWidth = this._calculateLabelWidth(activeLabel.text!.length);
        
        // Position label ABOVE the alert line
        let labelY = activeLabel.y - labelHeight - 5; // Position above the line
        
        // Adjust for top boundary
        if (labelY < CHART_MARGIN) {
            labelY = CHART_MARGIN;
        }
        
        // Adjust for bottom boundary
        const chartBottom = scope.mediaSize.height;
        if (labelY + labelHeight > chartBottom - CHART_MARGIN) {
            labelY = chartBottom - labelHeight - CHART_MARGIN;
        }
        
        const labelXDimensions = positionsLine(
            scope.mediaSize.width / 2,
            scope.horizontalPixelRatio,
            labelWidth
        );
        const yDimensions = positionsLine(
            labelY,
            scope.verticalPixelRatio,
            labelHeight
        );

        ctx.save();
        try {
            const radius = 4 * scope.horizontalPixelRatio;
            
            // Draw main body background of label
            ctx.beginPath();
            ctx.roundRect(
                labelXDimensions.position,
                yDimensions.position,
                labelXDimensions.length,
                yDimensions.length,
                radius
            );
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();

            const removeButtonStartX =
                labelXDimensions.position +
                labelXDimensions.length -
                CONSTANTS.removeButtonWidth * scope.horizontalPixelRatio;

            // Draw button divider
            ctx.beginPath();
            const dividerDimensions = positionsLine(
                removeButtonStartX / scope.horizontalPixelRatio,
                scope.horizontalPixelRatio,
                1
            );
            ctx.fillStyle = '#F1F3FB';
            ctx.fillRect(
                dividerDimensions.position,
                yDimensions.position,
                dividerDimensions.length,
                yDimensions.length
            );

            // Draw stroke for main body
            ctx.beginPath();
            ctx.roundRect(
                labelXDimensions.position,
                yDimensions.position,
                labelXDimensions.length,
                yDimensions.length,
                radius
            );
            ctx.strokeStyle = '#3b82f6'; // Blue border to match alert line
            ctx.lineWidth = 1 * scope.horizontalPixelRatio;
            ctx.stroke();

            // Write text
            ctx.beginPath();
            ctx.fillStyle = '#131722';
            ctx.textBaseline = 'middle';
            ctx.font = `${Math.round(12 * scope.verticalPixelRatio)}px sans-serif`;
            ctx.fillText(
                activeLabel.text!,
                labelXDimensions.position +
                    CONSTANTS.centreLabelInlinePadding * scope.horizontalPixelRatio,
                labelY * scope.verticalPixelRatio + labelHeight * scope.verticalPixelRatio / 2
            );

            // Draw button icon
            ctx.beginPath();
            const iconSize = 9;
            ctx.translate(
                removeButtonStartX +
                    (scope.horizontalPixelRatio * (CONSTANTS.removeButtonWidth - iconSize)) / 2,
                labelY * scope.verticalPixelRatio + (labelHeight * scope.verticalPixelRatio - iconSize * scope.verticalPixelRatio) / 2
            );
            const scaling = (iconSize / CONSTANTS.crossViewBoxSize) * scope.horizontalPixelRatio;
            ctx.scale(scaling, scaling);
            
            // Change X icon color when hovering
            if (activeLabel.hoverRemove) {
                ctx.fillStyle = '#DC2626'; // Red X when hovering
            } else {
                ctx.fillStyle = '#131722'; // Default black
            }
            
            ctx.fill(CROSS_PATH, 'evenodd');
        } finally {
            ctx.restore();
        }
    }

    private _drawCrosshairLabelButton(scope: BitmapCoordinatesRenderingScope) {
        if (!this._data?.button || !this._data?.crosshair) return;
        // FIX: Button should keep original color
        this._drawLabel(scope, {
            width: scope.mediaSize.width,
            labelHeight: CONSTANTS.buttonHeight,
            y: this._data.crosshair.y,
            roundedCorners: [2, 0, 0, 2],
            icon: this._data.button.crosshairLabelIcon,
            iconScaling: CONSTANTS.iconSize / CONSTANTS.clockIconViewBoxSize,
            padding: {
                left: CONSTANTS.iconPadding,
                top: CONSTANTS.iconPadding,
            },
            color: this._data.button.hovering
                ? this._data.button.hoverColor
                : this._data.color, // Original color
        });
    }

    private _drawLabel(
        scope: BitmapCoordinatesRenderingScope,
        data: {
            width: number;
            labelHeight: number;
            y: number;
            roundedCorners: number | number[];
            icon: Path2D[];
            color: string;
            padding: {
                top: number;
                left: number;
            };
            iconScaling: number;
        }
    ) {
        const ctx = scope.context;
        try {
            ctx.save();
            ctx.beginPath();
            const yDimension = positionsLine(
                data.y,
                scope.verticalPixelRatio,
                data.labelHeight
            );
            const x = (data.width - (CONSTANTS.buttonWidth + 1)) * scope.horizontalPixelRatio;
            ctx.roundRect(
                x,
                yDimension.position,
                CONSTANTS.buttonWidth * scope.horizontalPixelRatio,
                yDimension.length,
                adjustRadius(data.roundedCorners, scope.horizontalPixelRatio)
            );
            ctx.fillStyle = data.color;
            ctx.fill();
            ctx.beginPath();
            ctx.translate(
                x + data.padding.left * scope.horizontalPixelRatio,
                yDimension.position + data.padding.top * scope.verticalPixelRatio
            );
            ctx.scale(
                data.iconScaling * scope.horizontalPixelRatio,
                data.iconScaling * scope.verticalPixelRatio
            );
            ctx.fillStyle = '#FFFFFF';
            data.icon.forEach(path => {
                ctx.beginPath();
                ctx.fill(path, 'evenodd');
            });
        } finally {
            ctx.restore();
        }
    }
}

// ==================== PRICE SCALE RENDERER ====================
class PriceScalePaneRenderer extends PaneRendererBase {
    draw(target: CanvasRenderingTarget2D): void {
        // REMOVED: We don't need custom price scale labels
        // Lightweight Charts already shows price labels
        // This prevents duplicate labels overlapping
    }
}

// ==================== PANE VIEW ADAPTER ====================
class UserAlertPricePaneView implements IPrimitivePaneView {
    private _renderer: PaneRenderer | PriceScalePaneRenderer;

    constructor(isPriceScale: boolean) {
        this._renderer = isPriceScale
            ? new PriceScalePaneRenderer()
            : new PaneRenderer();
    }

    zOrder(): PrimitivePaneViewZOrder {
        return 'top';
    }

    renderer(): IPrimitivePaneRenderer {
        return this._renderer;
    }

    update(data: IRendererData | null) {
        this._renderer.update(data);
    }
}

// ==================== MAIN PLUGIN CLASS ====================
export class UserPriceAlerts extends UserAlertsState implements ISeriesPrimitive<Time> {
    private _chart: IChartApi | undefined = undefined;
    private _series: ISeriesApi<SeriesType> | undefined = undefined;
    private _mouseHandlers: MouseHandlers;

    private _paneViews: UserAlertPricePaneView[] = [];
    private _pricePaneViews: UserAlertPricePaneView[] = [];

    private _lastMouseUpdate: MousePosition | null = null;
    private _currentCursor: string | null = null;
    private _hoveringID: string = '';
    private _symbolName: string = '';

    constructor() {
        super();
        this._mouseHandlers = new MouseHandlers();
    }

    attached(param: SeriesAttachedParameter<Time>) {
        const { chart, series, requestUpdate } = param;
        this._chart = chart;
        this._series = series;
        this._paneViews = [new UserAlertPricePaneView(false)];
        this._pricePaneViews = [new UserAlertPricePaneView(true)];
        this._mouseHandlers.attached(chart, series);
        
        this._mouseHandlers.mouseMoved().subscribe(mouseUpdate => {
            this._lastMouseUpdate = mouseUpdate;
            requestUpdate();
        }, this);
        
        this._mouseHandlers.clicked().subscribe(mousePosition => {
            if (mousePosition && this._series) {
                if (this._isHovering(mousePosition)) {
                    const price = this._series.coordinateToPrice(mousePosition.y);
                    if (price) {
                        this.addAlert(price);
                        requestUpdate();
                    }
                }
                if (this._hoveringID) {
                    this.removeAlert(this._hoveringID);
                    requestUpdate();
                }
            }
        }, this);
    }

    detached() {
        this._mouseHandlers.mouseMoved().unsubscribeAll(this);
        this._mouseHandlers.clicked().unsubscribeAll(this);
        this._mouseHandlers.detached();
        this._series = undefined;
        this._chart = undefined;
    }

    paneViews(): readonly IPrimitivePaneView[] {
        return this._paneViews;
    }

    priceAxisPaneViews(): readonly IPrimitivePaneView[] {
        return this._pricePaneViews;
    }

    updateAllViews(): void {
        const alerts = this.alerts();
        const rendererData = this._calculateRendererData(alerts, this._lastMouseUpdate);
        this._currentCursor = null;
        if (
            rendererData?.button?.hovering ||
            rendererData?.alerts.some(alert => alert.showHover && alert.hoverRemove)
        ) {
            this._currentCursor = 'pointer';
        }
        this._paneViews.forEach(pv => pv.update(rendererData));
        this._pricePaneViews.forEach(pv => pv.update(rendererData));
    }

    hitTest(): PrimitiveHoveredItem | null {
        if (!this._currentCursor) return null;
        return {
            cursorStyle: this._currentCursor,
            externalId: 'user-alerts-primitive',
            zOrder: 'top',
        };
    }

    setSymbolName(name: string) {
        this._symbolName = name;
    }

    private _isHovering(mousePosition: MousePosition | null): boolean {
        return Boolean(
            mousePosition &&
                mousePosition.xPositionRelativeToPriceScale >= 1 &&
                mousePosition.xPositionRelativeToPriceScale < CONSTANTS.buttonWidth
        );
    }

    private _isHoveringRemoveButton(
        mousePosition: MousePosition | null,
        timescaleWidth: number,
        alertY: number,
        textLength: number
    ): boolean {
        if (!mousePosition || !timescaleWidth) return false;
        
        // Calculate label position (same as drawing logic)
        const labelHeight = CONSTANTS.centreLabelHeight;
        let labelY = alertY - labelHeight - 5; // Same offset as in drawing
        
        // Adjust for top boundary
        if (labelY < CHART_MARGIN) {
            labelY = CHART_MARGIN;
        }
        
        // Check if mouse is within label height
        const distanceY = Math.abs(mousePosition.y - labelY);
        if (distanceY > labelHeight / 2) return false;
        
        const labelWidth = this._calculateLabelWidth(textLength);
        
        // Calculate X position of the label center
        const labelCenterX = (timescaleWidth + labelWidth) / 2;
        
        // Calculate X position of the X button (right side of label)
        const buttonCenterX = labelCenterX + (labelWidth / 2) - (CONSTANTS.removeButtonWidth / 2);
        
        // Check if mouse is within X button area
        const distanceX = Math.abs(mousePosition.x - buttonCenterX);
        const isWithinButtonX = distanceX <= CONSTANTS.removeButtonWidth / 2;
        
        return isWithinButtonX;
    }
    
    private _calculateLabelWidth(textLength: number) {
        return (
            CONSTANTS.centreLabelInlinePadding * 2 +
            CONSTANTS.removeButtonWidth +
            textLength * CONSTANTS.averageWidthPerCharacter
        );
    }

    private _calculateRendererData(
        alertsInfo: UserAlertInfo[],
        mousePosition: MousePosition | null
    ): IRendererData | null {
        if (!this._series) return null;
        const priceFormatter = this._series.priceFormatter();

        const showCrosshair = mousePosition && !mousePosition.overTimeScale;
        const showButton = showCrosshair;
        const crosshairPrice = mousePosition && this._series.coordinateToPrice(mousePosition.y);
        const crosshairPriceText = priceFormatter.format(crosshairPrice ?? -100);

        let closestDistance = Infinity;
        let closestIndex: number = -1;

        const alerts: (AlertRendererData & { price: number; id: string })[] =
            alertsInfo.map((alertInfo, index) => {
                const y = this._series!.priceToCoordinate(alertInfo.price) ?? -100;
                if (mousePosition?.y && y >= 0) {
                    const distance = Math.abs(mousePosition.y - y);
                    if (distance < closestDistance) {
                        closestIndex = index;
                        closestDistance = distance;
                    }
                }
                return {
                    y,
                    showHover: false,
                    price: alertInfo.price,
                    id: alertInfo.id,
                };
            });
            
        this._hoveringID = '';
        if (closestIndex >= 0 && closestDistance < CONSTANTS.showCentreLabelDistance) {
            const timescaleWidth = this._chart?.timeScale().width() ?? 0;
            const a = alerts[closestIndex];
            const text = `${this._symbolName} crossing ${this._series.priceFormatter().format(a.price)}`;
            const hoverRemove = this._isHoveringRemoveButton(
                mousePosition,
                timescaleWidth,
                a.y,
                text.length
            );
            alerts[closestIndex] = {
                ...alerts[closestIndex],
                showHover: true,
                text,
                hoverRemove,
            };
            if (hoverRemove) this._hoveringID = a.id;
        }
        
        return {
            alertIcon: CLOCK_ICON_PATHS,
            alerts,
            button: showButton
                ? {
                      hovering: this._isHovering(mousePosition),
                      hoverColor: '#50535E', // Original hover color
                      crosshairLabelIcon: CLOCK_PLUS_ICON_PATHS,
                  }
                : null,
            color: '#131722', // Changed back to original black/dark color
            crosshair: showCrosshair
                ? {
                      y: mousePosition!.y,
                      text: crosshairPriceText,
                  }
                : null,
        };
    }
}