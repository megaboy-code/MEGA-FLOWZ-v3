# MegaFlowZ Drawing Tools — Complete Developer Guide

> A comprehensive reference for understanding, maintaining, and creating new drawing tools
> built on `lightweight-charts-line-tools-core`.

-----

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
1. [File Structure](#2-file-structure)
1. [Core Engine — What It Does](#3-core-engine--what-it-does)
1. [Core Public API Reference](#4-core-public-api-reference)
1. [The MVC Pattern](#5-the-mvc-pattern)
1. [The Model — Deep Dive](#6-the-model--deep-dive)
1. [The Pane View — Deep Dive](#7-the-pane-view--deep-dive)
1. [Renderers](#8-renderers)
1. [Culling Engine](#9-culling-engine)
1. [Anchor System](#10-anchor-system)
1. [Hit Testing](#11-hit-testing)
1. [How ChartDrawingModule Orchestrates Everything](#12-how-chartdrawingmodule-orchestrates-everything)
1. [Persistence Flow](#13-persistence-flow)
1. [Theme Integration](#14-theme-integration)
1. [Step-by-Step: Creating a New Tool](#15-step-by-step-creating-a-new-tool)
1. [Common Pitfalls](#16-common-pitfalls)
1. [Quick Reference](#17-quick-reference)

-----

## 1. Architecture Overview

The drawing tools system is built in layers. Each layer has a single responsibility and
communicates through well-defined interfaces.

```
┌──────────────────────────────────────────────────────────────┐
│                       USER INTERFACE                         │
│  DrawingToolbar → ToolQuickToolbar → ToolPropertiesModal     │
└──────────────────────────────┬───────────────────────────────┘
                               │ callbacks
┌──────────────────────────────▼───────────────────────────────┐
│                   ChartDrawingModule                         │
│  Orchestrator: persistence, TF/symbol switching, theme       │
└──────────────────────────────┬───────────────────────────────┘
                               │ createLineToolsPlugin()
┌──────────────────────────────▼───────────────────────────────┐
│           lightweight-charts-line-tools-core                 │
│  Core Engine: math, hit-testing, selection, drag, events     │
└──────────────────────────────┬───────────────────────────────┘
                               │ registerLineTool()
┌──────────────────────────────▼───────────────────────────────┐
│                     Tool Plugins                             │
│  LineToolTrendLine, LineToolRectangle, LineToolFibRetracement │
│  Each plugin = Model (data) + PaneView (rendering)           │
└──────────────────────────────┬───────────────────────────────┘
                               │ renders to
┌──────────────────────────────▼───────────────────────────────┐
│              Lightweight Charts v5 Canvas                    │
└──────────────────────────────────────────────────────────────┘
```

**Data flows down, events flow up.**

- User clicks a tool button → `DrawingToolbar` → `ChartDrawingModule.startDrawing()` → `core.addLineTool()`
- User double-clicks a tool → core fires `subscribeLineToolsDoubleClick` → `DrawingToolbar` → shows `ToolQuickToolbar`
- User moves a tool → core fires `subscribeLineToolsAfterEdit` → `ChartDrawingModule.saveDrawings()`

-----

## 2. File Structure

```
src/chart/
├── chart-core.ts                        ← Top-level orchestrator (ChartModule)
├── chart-utils.ts                       ← Price formatting, precision helpers
│
├── chart-engine/
│   ├── main-chart.ts                    ← MainChart: data, state, series lifecycle
│   ├── chart-state.ts                   ← ChartStateManager: LOADING/READY blur overlay
│   ├── series-manager.ts                ← SeriesManager: candlestick/line/area/baseline
│   └── chart-instance.ts               ← ChartInstance: LWC chart creation
│
└── drawing/
    ├── chart-drawing-module.ts          ← ChartDrawingModule: orchestrator
    │
    ├── ui/
    │   ├── drawing-toolbar.ts           ← Tool buttons, keyboard shortcuts
    │   ├── tool-quick-toolbar.ts        ← Floating quick edit toolbar
    │   ├── tool-properties-modal.ts     ← Full properties editor modal
    │   ├── tool-properties-modal.css    ← Modal styles (split for size)
    │   └── tool-schemas.ts              ← Property schemas + template storage
    │
    └── tools/
        ├── lines.ts                     ← Registration: TrendLine, Ray, Arrow, etc.
        ├── shapes.ts                    ← Registration: Rectangle, Circle, Triangle
        ├── text.ts                      ← Registration: Text tool
        ├── advanced.ts                  ← Registration: FibRetracement, ParallelChannel, etc.
        ├── freehand.ts                  ← Registration: Brush, Highlighter
        └── position.ts                 ← Registration: LongShortPosition

External packages (separate repos):

lightweight-charts-line-tools-lines/
├── src/
│   ├── index.ts                         ← registerLinesPlugin() entry point
│   ├── model/
│   │   ├── LineToolTrendLine.ts         ← TrendLine Model (data + logic)
│   │   ├── LineToolHorizontalLine.ts    ← HorizontalLine Model
│   │   └── ...
│   └── views/
│       ├── LineToolTrendLinePaneView.ts  ← TrendLine View (rendering)
│       ├── LineToolHorizontalLinePaneView.ts
│       └── ...

lightweight-charts-line-tools-rectangle/
├── src/
│   ├── model/LineToolRectangle.ts       ← Rectangle Model
│   └── views/LineToolRectanglePaneView.ts ← Rectangle View
```

-----

## 3. Core Engine — What It Does

`lightweight-charts-line-tools-core` is the brain. It handles everything that is hard.

### Coordinate Interpolation (“Blank Space” Logic)

The chart has data bars on the left and empty space on the right (future). The core uses linear
interpolation to convert between screen pixels and logical time+price coordinates everywhere on
the chart — including the blank future space. Tools can be placed anywhere.

### Interaction Manager

A centralized event bus that handles:

- **Hover detection** — which tool is the mouse over?
- **Selection** — click to select, click away to deselect
- **Drag thresholds** — prevents accidental moves when clicking
- **Shift key constraints** — geometric locking (horizontal lines, etc.)
- **Virtual anchor drag** — handles that exist visually but not in the data

### Culling Engine (AABB + Sub-Segments)

Before rendering each tool every frame, the core checks if it is even visible in the viewport.
Two strategies:

- **AABB (Axis-Aligned Bounding Box)** — fast check for simple shapes
- **Sub-segment intersection** — for infinite lines (Rays, Extended Lines) and shapes with extensions

If a tool is off-screen it is skipped entirely — critical for performance when many tools exist.

### Price Axis Label Stacking Manager

When multiple tools have price labels at similar price levels they overlap and become unreadable.
The `PriceAxisLabelStackingManager` detects collisions and shifts labels vertically in real-time
so every label is always readable.

### Composite Renderer Architecture

Each tool composes multiple renderers into one:

- `SegmentRenderer` — lines and rays
- `RectangleRenderer` — filled rectangles
- `TextRenderer` — text labels
- `LineAnchorRenderer` — interactive handles

These are stacked in a `CompositeRenderer` and rendered in order (bottom to top).

-----

## 4. Core Public API Reference

All of these are available on the object returned by `createLineToolsPlugin(chart, series)`.

### Tool Registration & Creation

```typescript
// Register a tool class before it can be used
lineTools.registerLineTool('TrendLine', LineToolTrendLine);

// Start interactive drawing (user clicks on chart to place points)
lineTools.addLineTool('TrendLine');

// Start drawing with options (pass defaults or saved template)
lineTools.addLineTool('TrendLine', [], { line: { color: '#ff0000' } });

// Create or update a tool programmatically by ID
lineTools.createOrUpdateLineTool('TrendLine', points, options, id);

// Partial update on existing tool
lineTools.applyLineToolOptions({ id, toolType, options });
```

### Retrieval

```typescript
// Get all currently selected tools as JSON string
lineTools.getSelectedLineTools();

// Get a specific tool by ID as JSON string
lineTools.getLineToolByID(id);

// Get tools matching a regex pattern
lineTools.getLineToolsByIdRegex(/^trend/);
```

### Removal

```typescript
lineTools.removeLineToolsById(['id1', 'id2']);
lineTools.removeLineToolsByIdRegex(/^temp/);
lineTools.removeSelectedLineTools();
lineTools.removeAllLineTools();
```

### Persistence

```typescript
// Export all tools to JSON string (snapshot of current state)
const json = lineTools.exportLineTools();

// Import tools from JSON string
// Non-destructive: updates existing IDs, creates new ones
lineTools.importLineTools(json);
```

### Event Subscriptions

```typescript
// Fires when a tool is modified, moved, or creation finishes
lineTools.subscribeLineToolsAfterEdit((payload) => {
  if (payload?.stage === 'lineToolFinished') {
    // Tool creation is done — deactivate drawing mode
  }
  // payload.selectedLineTool contains the tool data
});

// Fires when user double-clicks an existing tool
// payload.selectedLineTool contains full tool options for building a properties UI
lineTools.subscribeLineToolsDoubleClick((payload) => {
  const tool = payload?.selectedLineTool || payload;
  // Open properties panel for tool.id
});
```

### Manual Crosshair Control

```typescript
lineTools.setCrossHairXY(x, y, visible);
lineTools.clearCrossHair();
```

-----

## 5. The MVC Pattern

Every drawing tool follows the MVC (Model-View-Controller) pattern:

```
┌─────────────────────────────────────────────────────┐
│  MODEL  (LineToolTrendLine.ts)                       │
│  - Stores: points[], options{}                       │
│  - Logic: normalize(), getShiftConstrainedPoint()    │
│  - Hit test: _internalHitTest()                      │
│  - Virtual anchors: getPoint(), setPoint()           │
└───────────────────────┬─────────────────────────────┘
                        │ _setPaneViews([...])
┌───────────────────────▼─────────────────────────────┐
│  VIEW  (LineToolTrendLinePaneView.ts)                │
│  - Converts logical points → screen pixels           │
│  - Decides what to render (culling)                  │
│  - Configures and composes renderers                 │
│  - Adds anchors                                      │
└───────────────────────┬─────────────────────────────┘
                        │ append()
┌───────────────────────▼─────────────────────────────┐
│  RENDERERS  (from core)                             │
│  - SegmentRenderer, RectangleRenderer, TextRenderer  │
│  - Actually draw pixels on the canvas               │
│  - Handle hit testing at the pixel level            │
└─────────────────────────────────────────────────────┘
```

The **Model** never knows about pixels. The **View** never stores business logic. The **Renderers**
never know what tool they belong to.

-----

## 6. The Model — Deep Dive

The model file (e.g., `LineToolTrendLine.ts`) is responsible for data and interaction logic.

### Required Properties

```typescript
// Unique string ID — must match the registration key exactly
public override readonly toolType: LineToolType = 'TrendLine';

// Number of data points this tool needs
// Use -1 for unbounded tools (Brush, Path)
public override readonly pointsCount: number = 2;
```

### Option Defaults

Every tool defines a static defaults object. This is the complete starting state for a new tool:

```typescript
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
    font: { color: '#ffffff', size: 12, bold: false, italic: false, family: 'sans-serif' },
    box: {
      alignment: {
        vertical: BoxVerticalAlignment.Top,
        horizontal: BoxHorizontalAlignment.Center
      },
      background: { color: 'rgba(0,0,0,0)', inflation: { x: 0, y: 0 } },
      border: { color: 'rgba(0,0,0,0)', width: 0, style: LineStyle.Solid, radius: 0, highlight: false },
      shadow: undefined,
    },
  },
};
```

### Constructor Pattern

```typescript
public constructor(
  coreApi: LineToolsCorePlugin<HorzScaleItem>,
  chart: IChartApiBase<HorzScaleItem>,
  series: ISeriesApi<SeriesType, HorzScaleItem>,
  horzScaleBehavior: IHorzScaleBehavior<HorzScaleItem>,
  options: DeepPartial<LineToolOptionsInternal<'TrendLine'>> = {},
  points: LineToolPoint[] = [],
  priceAxisLabelStackingManager: PriceAxisLabelStackingManager<HorzScaleItem>
) {
  // 1. Deep copy defaults — never mutate the static constant
  const finalOptions = deepCopy(TrendLineOptionDefaults) as LineToolOptionsInternal<'TrendLine'>;

  // 2. Merge user options on top of defaults
  merge(finalOptions, options as DeepPartial<LineToolOptionsInternal<'TrendLine'>>);

  // 3. Call super with final options
  super(coreApi, chart, series, horzScaleBehavior, finalOptions, points, 'TrendLine', 2, priceAxisLabelStackingManager);

  // 4. Link the View to this Model
  this._setPaneViews([new LineToolTrendLinePaneView(this, this._chart, this._series)]);
}
```

**Why `deepCopy`?** JavaScript objects are references. Without a deep copy, changing one tool’s
color would change the defaults for all future tools because they share the same nested objects
in memory.

### Interaction Capability Flags

These tell the `InteractionManager` what the tool supports:

```typescript
public supportsClickClickCreation(): boolean  { return true; }  // Click → Move → Click
public supportsClickDragCreation(): boolean   { return true; }  // Press → Drag → Release
public supportsShiftClickClickConstraint(): boolean { return true; } // Shift locks geometry
public supportsShiftClickDragConstraint(): boolean  { return true; }
```

### normalize()

Called automatically after creation or editing. Standardizes the point order so rendering math
is always predictable:

```typescript
// TrendLine: ensures P0 is always left of P1 in time
public normalize(): void {
  if (this._points.length < 2) return;
  const [p0, p1] = this._points;
  if (p0.timestamp > p1.timestamp) {
    this._points = [p1, p0];
  }
}

// Rectangle: ensures P0 is always Top-Left, P1 is always Bottom-Right
public normalize(): void {
  const [p0, p1] = this._points;
  this._points[0] = { timestamp: Math.min(p0.timestamp, p1.timestamp), price: Math.max(p0.price, p1.price) };
  this._points[1] = { timestamp: Math.max(p0.timestamp, p1.timestamp), price: Math.min(p0.price, p1.price) };
}
```

### getShiftConstrainedPoint()

Called when the user holds Shift and drags a handle. Returns the corrected position that enforces
the geometric constraint:

```typescript
public override getShiftConstrainedPoint(
  pointIndex: number,
  rawScreenPoint: Point,
  phase: InteractionPhase,
  originalLogicalPoint: LineToolPoint,
  allOriginalLogicalPoints: LineToolPoint[]
): ConstraintResult {
  // TrendLine: lock Y to the other point's Y (force horizontal line)
  const otherIndex = pointIndex === 0 ? 1 : 0;
  const otherScreen = this.pointToScreenPoint(allOriginalLogicalPoints[otherIndex]);
  if (!otherScreen) return { point: rawScreenPoint, snapAxis: 'none' };
  return {
    point: new Point(rawScreenPoint.x, otherScreen.y),
    snapAxis: 'price',
  };
}
```

### Virtual Anchors (getPoint / setPoint)

Tools like Rectangle have more visual handles than data points. Override `getPoint` and `setPoint`
to map virtual handles to real data:

```typescript
// Rectangle stores 2 points but shows 8 handles (indices 0–7)
public maxAnchorIndex(): number { return 7; }

public override getPoint(index: number): LineToolPoint | null {
  if (index < 2) return super.getPoint(index); // Real data points
  return this._getAnchorPointForIndex(index);  // Calculate virtual position
}

public override setPoint(index: number, point: LineToolPoint): void {
  if (index < 2) { super.setPoint(index, point); return; }
  // Map virtual handle drag back to the two real data points
  switch (index) {
    case 4: this._points[0].timestamp = point.timestamp; break; // Middle-Left → left edge
    case 5: this._points[1].timestamp = point.timestamp; break; // Middle-Right → right edge
    case 6: this._points[0].price = point.price; break;         // Top-Center → top edge
    case 7: this._points[1].price = point.price; break;         // Bottom-Center → bottom edge
  }
}
```

-----

## 7. The Pane View — Deep Dive

The pane view file (e.g., `LineToolTrendLinePaneView.ts`) is the bridge between data and pixels.

### _updateImpl()

This is the main rendering method. Called whenever the chart needs to repaint and the tool is
marked as invalidated:

```typescript
protected override _updateImpl(height: number, width: number): void {
  this._invalidated = false;
  this._renderer.clear(); // Always clear first — fresh frame

  const options = this._tool.options() as LineToolOptionsInternal<'TrendLine'>;

  // 1. Check visibility flag
  if (!options.visible) return;

  // 2. Check we have enough points to draw
  if (this._tool.points().length < this._tool.pointsCount) return;

  // 3. Culling — is the tool even on screen?
  const cullingState = getToolCullingState(points, this._tool, options.line.extend);
  if (cullingState !== OffScreenState.Visible) return;

  // 4. Convert logical points (Time/Price) to screen pixels
  const hasScreenPoints = this._updatePoints();
  if (!hasScreenPoints) return;

  // 5. Configure renderers and append to composite
  this._segmentRenderer.setData({ points: segmentPoints, line: lineOptions, ... });
  (this._renderer as CompositeRenderer<HorzScaleItem>).append(this._segmentRenderer);

  // 6. Add text renderer if tool has text
  if (options.text.value) {
    const freshTextRenderer = new TextRenderer<HorzScaleItem>(); // Fresh every frame!
    freshTextRenderer.setData({ points, text: textOptions, ... });
    (this._renderer as CompositeRenderer<HorzScaleItem>).append(freshTextRenderer);
  }

  // 7. Add anchors if tool is selected
  if (this.areAnchorsVisible()) {
    this._addAnchors(this._renderer as CompositeRenderer<HorzScaleItem>);
  }
}
```

**Critical:** Always create a **fresh `TextRenderer` every frame** — never cache it as a class
property. The text renderer caches its measured text width internally, and if reused across frames
with different zoom levels or text content the width calculation goes stale causing layout bugs.

### Text Angle Calculation (TrendLine)

For TrendLine the text label rotates along the line angle:

```typescript
const dx = point1.x - point0.x;
const dy = point1.y - point0.y;
const angleRadians = Math.atan2(dy, dx);
const finalAngle = (-angleRadians * (180 / Math.PI)) + (options.text.box?.angle || 0);
```

### _addAnchors()

Adds the interactive resize handles. The base class provides `createLineAnchor()` which uses
object pooling internally to avoid garbage collection pressure:

```typescript
protected override _addAnchors(renderer: CompositeRenderer<HorzScaleItem>): void {
  const options = this._tool.options() as LineToolOptionsInternal<'TrendLine'>;
  if (options.locked) return; // No anchors when tool is locked

  const [point0, point1] = this._points;

  renderer.append(this.createLineAnchor({
    points: [point0, point1],
    pointsCursorType: [
      PaneCursorType.DiagonalNwSeResize,
      PaneCursorType.DiagonalNwSeResize,
    ],
  }, 0));
}
```

For complex tools like Rectangle with 8 anchors, calculate each position and pass them all to
a single `createLineAnchor` call for efficiency.

-----

## 8. Renderers

Renderers are the primitives that actually draw on the canvas. They come from the core package.

### SegmentRenderer

Draws a line segment between two points. Supports extensions (Ray, Extended Line), line styles
(solid, dashed, dotted), line endings (normal, arrow), and join/cap styles.

```typescript
this._segmentRenderer.setData({
  points: [point0, point1],
  line: {
    color: '#2962ff',
    width: 1,
    style: LineStyle.Solid,
    extend: { left: false, right: true }, // Ray extending right
    end: { left: LineEnd.Normal, right: LineEnd.Arrow },
    join: LineJoin.Miter,
    cap: LineCap.Butt,
  },
  toolDefaultHoverCursor: PaneCursorType.Pointer,
  toolDefaultDragCursor: PaneCursorType.Grabbing,
});
```

### RectangleRenderer

Draws a filled rectangle with a border between two diagonal points.

```typescript
this._rectangleRenderer.setData({
  ...deepCopy(options.rectangle),
  points: [point0, point1],
  hitTestBackground: false, // true = clicking the fill area selects the tool
  toolDefaultHoverCursor: PaneCursorType.Pointer,
  toolDefaultDragCursor: PaneCursorType.Grabbing,
});
```

### TextRenderer

Draws a text label with optional box, border, shadow, and background. Always instantiate fresh
each frame — never cache as a class property.

```typescript
const freshTextRenderer = new TextRenderer<HorzScaleItem>();
freshTextRenderer.setData({
  points: [attachmentPoint, attachmentPoint],
  text: {
    value: 'Support',
    font: { color: '#ffffff', size: 12, bold: false, italic: false, family: 'sans-serif' },
    box: {
      angle: finalAngle,
      alignment: {
        vertical: BoxVerticalAlignment.Top,
        horizontal: BoxHorizontalAlignment.Center
      },
      background: { color: 'rgba(0,0,0,0)', inflation: { x: 0, y: 0 } },
      border: { color: 'rgba(0,0,0,0)', width: 0, style: LineStyle.Solid, radius: 0, highlight: false },
      shadow: undefined,
    },
  },
  hitTestBackground: true,
  toolDefaultHoverCursor: PaneCursorType.Pointer,
  toolDefaultDragCursor: PaneCursorType.Grabbing,
});
```

### CompositeRenderer

A container that holds multiple renderers. Everything gets appended here and rendered in order —
first appended is drawn first (bottom layer).

```typescript
const r = this._renderer as CompositeRenderer<HorzScaleItem>;
r.clear();

// Draw order: background first, then foreground, then anchors on top
r.append(this._rectangleRenderer);  // Background shape
r.append(freshTextRenderer);        // Text on top of shape
this._addAnchors(r);               // Handles on top of everything
```

-----

## 9. Culling Engine

The culling engine prevents rendering tools that are not visible in the current viewport.
Always cull before configuring renderers — it is cheap compared to pixel drawing.

### Simple Culling (Lines, Rays)

```typescript
const cullingState = getToolCullingState(
  points,               // Array of LineToolPoint
  this._tool,           // For viewport bounds access
  options.line.extend   // { left: bool, right: bool }
);

if (cullingState !== OffScreenState.Visible) return;
```

### Advanced Culling (Rectangles with Extensions)

For shapes that can extend infinitely, define sub-segments for the culling engine to check:

```typescript
const cullingInfo: LineToolCullingInfo = {
  subSegments: [
    [0, 1], // Top edge (P_TL → P_TR)
    [2, 3], // Bottom edge (P_BL → P_BR)
  ]
};

const cullingState = getToolCullingState(
  [P_TL, P_TR, P_BL, P_BR], // All 4 corners as flat array
  this._tool,
  options.rectangle.extend,
  undefined,                  // singlePointOrientation — for CrossLine/VerticalLine only
  cullingInfo
);

switch (cullingState) {
  case OffScreenState.OffScreenTop:
  case OffScreenState.OffScreenBottom:
    return; // Vertical miss — always cull regardless of extensions
  case OffScreenState.OffScreenLeft:
    if (!options.rectangle.extend.right) return; // Cull unless extends right
    break;
  case OffScreenState.OffScreenRight:
    if (!options.rectangle.extend.left) return;  // Cull unless extends left
    break;
  case OffScreenState.FullyOffScreen:
    return;
}
```

### OffScreenState Values

|Value            |Meaning                                     |
|-----------------|--------------------------------------------|
|`Visible`        |Tool intersects viewport — render it        |
|`OffScreenLeft`  |Tool is entirely to the left of viewport    |
|`OffScreenRight` |Tool is entirely to the right of viewport   |
|`OffScreenTop`   |Tool is entirely above viewport             |
|`OffScreenBottom`|Tool is entirely below viewport             |
|`FullyOffScreen` |Tool is completely outside in all directions|

-----

## 10. Anchor System

Anchors are the interactive handles that appear when a tool is selected.

### AnchorPoint

```typescript
new AnchorPoint(
  x,          // Screen X coordinate (pixels)
  y,          // Screen Y coordinate (pixels)
  index,      // Anchor index — maps back to getPoint() and setPoint()
  isVirtual,  // true = virtual midpoint handle (not a real data point)
  cursor      // PaneCursorType shown when hovering this specific handle
)
```

### Cursor Types for Anchors

|Cursor                             |When to Use                           |
|-----------------------------------|--------------------------------------|
|`PaneCursorType.DiagonalNwSeResize`|Corner handles on standard orientation|
|`PaneCursorType.DiagonalNeSwResize`|Corner handles on flipped orientation |
|`PaneCursorType.HorizontalResize`  |Left/Right edge handles               |
|`PaneCursorType.VerticalResize`    |Top/Bottom edge handles               |
|`PaneCursorType.Grabbing`          |Body of tool when dragging            |
|`PaneCursorType.Pointer`           |Hover over tool body                  |

### Rectangle 8-Handle Layout

```
       (6) Top-Center
          |
(0) TL *──*──* TR (3)
       |     |
(4) ML *     * MR (5)
       |     |
(2) BL *──*──* BR (1)
          |
       (7) Bottom-Center
```

Indices 0 and 1 are real data points stored in `_points[]`.
Indices 2–7 are virtual handles calculated on the fly from those two points.

### Anchor Object Pooling

The base class `createLineAnchor()` uses object pooling internally — it recycles existing renderer
instances rather than creating new ones every frame. This prevents garbage collection pauses during
rapid user interaction. Always use `createLineAnchor()` rather than creating renderers manually.

-----

## 11. Hit Testing

Hit testing determines if a mouse click or hover lands on a tool. The Model delegates to the View:

```typescript
public override _internalHitTest(
  x: Coordinate,
  y: Coordinate
): HitTestResult<LineToolHitTestData> | null {
  if (!this._paneViews?.length) return null;

  const paneView = this._paneViews[0] as LineToolTrendLinePaneView<HorzScaleItem>;
  const compositeRenderer = paneView.renderer() as CompositeRenderer<HorzScaleItem>;

  if (!compositeRenderer?.hitTest) return null;

  return compositeRenderer.hitTest(x, y);
}
```

The `CompositeRenderer.hitTest()` checks each appended renderer in reverse order (top to bottom)
and returns the first hit. This means anchors (added last) are tested before the body — so
clicking an anchor handle does not accidentally trigger the move gesture for the whole tool.

### hitTestBackground

On `RectangleRenderer` and `TextRenderer`:

- `hitTestBackground: false` — only the border/outline is clickable, fill is transparent to clicks
- `hitTestBackground: true` — the fill area is also clickable and selects the tool

Use `false` for shapes where you want the user to be able to click through the fill to tools
behind it. Use `true` when the fill should capture clicks and drag the entire tool.

-----

## 12. How ChartDrawingModule Orchestrates Everything

`ChartDrawingModule` is the glue between the UI, the core engine, and persistence.

### Initialization Flow

```
ChartDrawingModule.initialize()
  ├── createLineToolsPlugin(chart, series)     ← attach core to LWC instance
  ├── setupToolOptions()                        ← apply price formatter, global options
  ├── wireChartEvents()                         ← route chart clicks → core.onClick()
  ├── subscribeToToolEvents()                   ← auto-save on AfterEdit and creation
  ├── setupThemeListener()                      ← MutationObserver on data-theme attribute
  ├── initializeToolbar()                       ← create DrawingToolbar + QuickToolbar
  └── loadDrawings()                            ← restore saved tools from localStorage
```

### Tool Registration (Lazy Loading)

Tools are NOT all loaded at startup. They are loaded on demand when first needed:

```typescript
private async loadAndRegisterGroup(groupName: string): Promise<void> {
  if (registeredGroups.has(groupName)) return; // Already registered — instant return

  switch (groupName) {
    case 'lines': {
      const { registerLinesPlugin } = await import('./tools/lines');
      registerLinesPlugin(this.lineTools);
      break;
    }
    case 'shapes': {
      const { SHAPE_TOOLS } = await import('./tools/shapes');
      Object.entries(SHAPE_TOOLS).forEach(([name, tool]) => {
        this.lineTools.registerLineTool(name, tool);
      });
      break;
    }
    // ... other groups
  }
  registeredGroups.add(groupName);
}
```

The first time a user draws a Rectangle, the shapes bundle is loaded. Every subsequent Rectangle
drawing uses the already-registered class instantly with no async overhead.

### TOOL_GROUP_MAP

Maps tool type strings to their lazy-load group. Used both for `startDrawing()` and during
`loadDrawings()` to know which groups to pre-load before importing:

```typescript
const TOOL_GROUP_MAP: Record<string, string> = {
  TrendLine:         'lines',
  Ray:               'lines',
  Rectangle:         'shapes',
  Circle:            'shapes',
  FibRetracement:    'advanced',
  ParallelChannel:   'advanced',
  Brush:             'freehand',
  Highlighter:       'freehand',
  LongShortPosition: 'position',
  // ...
};
```

-----

## 13. Persistence Flow

Tools are saved to and loaded from browser localStorage. The core has NO built-in persistence —
it only provides serialization helpers (`exportLineTools` / `importLineTools`).

### Storage Keys

Each symbol + timeframe combination has its own localStorage key:

```
chart_drawings_BTCUSD_M5     → '[{...}, {...}]'
chart_drawings_BTCUSD_H1     → '[{...}]'
chart_drawings_EURUSD_H4     → '[]'
drawing_tool_templates        → '{"TrendLine":{"options":{...}}}'
drawing_tool_named_templates  → '{"TrendLine":{"My Style":{...}}}'
```

### Save Flow

```
User moves a tool
  → core fires subscribeLineToolsAfterEdit
    → ChartDrawingModule.saveDrawings()
      → core.exportLineTools()
          Returns JSON snapshot of ALL current tools in memory
        → localStorage.setItem('chart_drawings_BTCUSD_M5', json)
```

`saveDrawings()` is also called on: tool creation, tool deletion, properties change, symbol change,
TF change, and `window.beforeunload`.

### Load Flow (TF Switch Example)

```
User clicks H4 button
  → handleTimeframeChange('H4')
    → drawingModule.onTimeframeChange('H4')
      → saveDrawings()            ← save current M5 tools FIRST
      → currentTimeframe = 'H4'

New H4 data arrives from WebSocket
  → seriesManager.setData(data)
    → onSeriesDataReady()
      → drawingModule.onDataReady()
        → requestAnimationFrame × 2   ← wait for render cycle to complete
          → loadDrawings()
            → core.removeAllLineTools()             ← clear M5 tools
            → loadAndRegisterGroup(needed groups)   ← ensure tool classes loaded
            → core.importLineTools(H4_json)         ← restore H4 tools
```

### Export / Import JSON Structure

```json
[
  {
    "id": "hBuXGlIHUToi",
    "toolType": "TrendLine",
    "points": [
      { "timestamp": 1773759600, "price": 74915.34 },
      { "timestamp": 1773763200, "price": 74800.00 }
    ],
    "options": {
      "line": { "color": "#2962ff", "width": 1, "style": 0 },
      "text": { "value": "Support", "font": { "color": "#ffffff" } }
    }
  }
]
```

The core reconstructs each tool from this JSON — matching `toolType` to the registered class,
then passing `points` and `options` to the constructor. The ID is preserved so future imports
can update the same tool rather than creating a duplicate.

### Why importLineTools is Non-Destructive

The core docs say: “updates existing IDs and creates new ones.” This means:

- Tool with ID `abc` in JSON + tool with ID `abc` on chart → **update** existing tool
- Tool with ID `xyz` in JSON + no tool with ID `xyz` on chart → **create** new tool
- Tool with ID `def` on chart + ID `def` not in JSON → **left untouched**

This is why `removeAllLineTools()` must always be called before `importLineTools()` when switching
TF or symbol — otherwise old tools from the previous TF remain on the chart alongside the new ones.

-----

## 14. Theme Integration

### Dynamic Text Color on Theme Change

When the user switches between light and dark themes, all tool text colors update automatically.
The `ChartDrawingModule` watches for changes to the `data-theme` attribute on the `<html>` element:

```typescript
private setupThemeListener(): void {
  this.themeObserver = new MutationObserver(() => {
    const color = this.getThemeTextColor(); // '#000000' light / '#ffffff' dark
    this.updateAllToolsTextColor(color);
  });
  this.themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });
}

private updateAllToolsTextColor(color: string): void {
  const tools = JSON.parse(this.lineTools.exportLineTools());
  tools.forEach((tool: any) => {
    if (tool.options?.text !== undefined) { // Only tools that have text options
      this.lineTools.applyLineToolOptions({
        id: tool.id,
        toolType: tool.toolType,
        options: { text: { font: { color } } }
      });
    }
  });
  this.saveDrawings(); // Persist the updated colors
}
```

### New Tool Default Text Color

When a user activates a tool, the default text color is set from the current theme at creation time.
If the user has a saved template, the template text color is overridden with the current theme color:

```typescript
private activateDrawingTool(button, toolId): void {
  const template = loadToolTemplate(toolId);
  const textColor = this.getThemeTextColor();

  if (template) {
    // Use template but override text color with current theme
    if (template.text?.font) template.text.font.color = textColor;
    this.startDrawing(toolId, template);
  } else {
    // No template — use theme color as only default
    this.startDrawing(toolId, { text: { font: { color: textColor } } });
  }
}
```

This ensures text is always readable regardless of when the tool was drawn or what theme was
active at the time.

-----

## 15. Step-by-Step: Creating a New Tool

This example creates a **Diamond** tool — a rhombus defined by a center point and a radius point.

### Step 1: Plan the Tool

Before writing any code, decide:

|Property      |Decision                            |
|--------------|------------------------------------|
|Points        |2 (center + radius)                 |
|Anchors       |2 (one per data point)              |
|Renderer      |4 × `SegmentRenderer` (one per side)|
|Text          |Optional label at center            |
|Extensions    |None                                |
|Creation modes|Click-Click and Click-Drag          |

### Step 2: Create the Model

```typescript
// src/chart/drawing/tools/custom/LineToolDiamond.ts

import {
  BaseLineTool, LineToolType, LineToolPoint, LineToolOptionsInternal,
  PaneCursorType, deepCopy, merge, DeepPartial, LineToolsCorePlugin,
  IHorzScaleBehavior, PriceAxisLabelStackingManager, HitTestResult,
  LineToolHitTestData, CompositeRenderer, Coordinate, TextAlignment,
  BoxVerticalAlignment, BoxHorizontalAlignment
} from 'lightweight-charts-line-tools-core';
import { IChartApiBase, ISeriesApi, SeriesType, LineStyle } from 'lightweight-charts';
import { LineToolDiamondPaneView } from './LineToolDiamondPaneView';

export const DiamondOptionDefaults = {
  visible: true,
  editable: true,
  defaultHoverCursor: PaneCursorType.Pointer,
  defaultDragCursor: PaneCursorType.Grabbing,
  defaultAnchorHoverCursor: PaneCursorType.Pointer,
  defaultAnchorDragCursor: PaneCursorType.Grabbing,
  notEditableCursor: PaneCursorType.NotAllowed,
  showPriceAxisLabels: true,
  showTimeAxisLabels: false,
  priceAxisLabelAlwaysVisible: false,
  timeAxisLabelAlwaysVisible: false,
  diamond: {
    border: { color: '#f97316', width: 2, style: LineStyle.Solid },
    background: { color: 'rgba(249,115,22,0.2)' },
    extend: { left: false, right: false },
  },
  text: {
    value: '',
    alignment: TextAlignment.Center,
    font: { color: '#ffffff', size: 12, bold: false, italic: false, family: 'sans-serif' },
    box: {
      angle: 0,
      scale: 1,
      alignment: { vertical: BoxVerticalAlignment.Middle, horizontal: BoxHorizontalAlignment.Center },
      background: { color: 'rgba(0,0,0,0)', inflation: { x: 0, y: 0 } },
      border: { color: 'rgba(0,0,0,0)', width: 0, style: LineStyle.Solid, radius: 0, highlight: false },
      shadow: undefined,
    },
    padding: 0,
    wordWrapWidth: 0,
    forceTextAlign: false,
    forceCalculateMaxLineWidth: false,
  },
};

export class LineToolDiamond<HorzScaleItem> extends BaseLineTool<HorzScaleItem> {
  public override readonly toolType: LineToolType = 'Diamond';
  public override readonly pointsCount: number = 2;

  public maxAnchorIndex(): number { return 1; }

  public supportsClickClickCreation(): boolean { return true; }
  public supportsClickDragCreation(): boolean  { return true; }
  public supportsShiftClickClickConstraint(): boolean { return false; }
  public supportsShiftClickDragConstraint(): boolean  { return false; }

  public constructor(
    coreApi: LineToolsCorePlugin<HorzScaleItem>,
    chart: IChartApiBase<HorzScaleItem>,
    series: ISeriesApi<SeriesType, HorzScaleItem>,
    horzScaleBehavior: IHorzScaleBehavior<HorzScaleItem>,
    options: DeepPartial<any> = {},
    points: LineToolPoint[] = [],
    priceAxisLabelStackingManager: PriceAxisLabelStackingManager<HorzScaleItem>
  ) {
    const finalOptions = deepCopy(DiamondOptionDefaults);
    merge(finalOptions, options);
    super(coreApi, chart, series, horzScaleBehavior, finalOptions, points, 'Diamond', 2, priceAxisLabelStackingManager);
    this._setPaneViews([new LineToolDiamondPaneView(this, this._chart, this._series)]);
  }

  public normalize(): void {
    // No normalization needed for Diamond
  }

  public override _internalHitTest(x: Coordinate, y: Coordinate): HitTestResult<LineToolHitTestData> | null {
    if (!this._paneViews?.length) return null;
    const paneView = this._paneViews[0] as LineToolDiamondPaneView<HorzScaleItem>;
    const renderer = paneView.renderer() as CompositeRenderer<HorzScaleItem>;
    if (renderer?.hitTest) return renderer.hitTest(x, y);
    return null;
  }
}
```

### Step 3: Create the Pane View

```typescript
// src/chart/drawing/tools/custom/LineToolDiamondPaneView.ts

import {
  BaseLineTool, LineToolPaneView, CompositeRenderer, SegmentRenderer,
  TextRenderer, AnchorPoint, PaneCursorType, getToolCullingState,
  OffScreenState, deepCopy, LineJoin, LineCap, LineOptions,
  IPrimitivePaneRenderer
} from 'lightweight-charts-line-tools-core';
import { IChartApiBase, ISeriesApi, SeriesType } from 'lightweight-charts';
import { LineToolDiamond } from './LineToolDiamond';

export class LineToolDiamondPaneView<HorzScaleItem> extends LineToolPaneView<HorzScaleItem> {
  // Segment renderers for 4 sides — safe to cache (no text width issue)
  private _seg1: SegmentRenderer<HorzScaleItem> = new SegmentRenderer();
  private _seg2: SegmentRenderer<HorzScaleItem> = new SegmentRenderer();
  private _seg3: SegmentRenderer<HorzScaleItem> = new SegmentRenderer();
  private _seg4: SegmentRenderer<HorzScaleItem> = new SegmentRenderer();

  public constructor(source: LineToolDiamond<HorzScaleItem>, chart: IChartApiBase<any>, series: ISeriesApi<SeriesType, any>) {
    super(source as BaseLineTool<any>, chart, series);
  }

  public override renderer(): IPrimitivePaneRenderer | null {
    if (this._invalidated) this._updateImpl(0, 0);
    return this._renderer;
  }

  protected override _updateImpl(height: number, width: number): void {
    this._invalidated = false;
    this._renderer.clear(); // Always clear first

    const options = this._tool.options() as any;
    if (!options.visible) return;
    if (this._tool.points().length < 2) return;

    // Culling check
    const points = this._tool.points();
    const cullingState = getToolCullingState(points, this._tool as BaseLineTool<HorzScaleItem>, options.diamond.extend);
    if (cullingState !== OffScreenState.Visible) return;

    const hasPoints = this._updatePoints();
    if (!hasPoints || this._points.length < 2) return;

    const [center, radiusPt] = this._points;

    // Calculate diamond size from the distance between center and radius point
    const dx = Math.abs(radiusPt.x - center.x);
    const dy = Math.abs(radiusPt.y - center.y);
    const size = Math.max(dx, dy);

    // Calculate 4 diamond vertices
    const top    = new AnchorPoint(center.x,        center.y - size, 0);
    const right  = new AnchorPoint(center.x + size, center.y,        0);
    const bottom = new AnchorPoint(center.x,        center.y + size, 0);
    const left   = new AnchorPoint(center.x - size, center.y,        0);

    const lineOpts: any = {
      ...deepCopy(options.diamond.border),
      extend: { left: false, right: false },
      join: LineJoin.Miter,
      cap: LineCap.Butt,
    };

    const cursor = {
      toolDefaultHoverCursor: options.defaultHoverCursor,
      toolDefaultDragCursor: options.defaultDragCursor,
    };

    // Configure and append 4 sides
    this._seg1.setData({ points: [top, right],    line: lineOpts, ...cursor });
    this._seg2.setData({ points: [right, bottom], line: lineOpts, ...cursor });
    this._seg3.setData({ points: [bottom, left],  line: lineOpts, ...cursor });
    this._seg4.setData({ points: [left, top],     line: lineOpts, ...cursor });

    const r = this._renderer as CompositeRenderer<HorzScaleItem>;
    r.append(this._seg1);
    r.append(this._seg2);
    r.append(this._seg3);
    r.append(this._seg4);

    // Optional text at center
    if (options.text?.value) {
      const freshText = new TextRenderer<HorzScaleItem>(); // Fresh every frame
      freshText.setData({
        points: [center, center],
        text: deepCopy(options.text),
        hitTestBackground: true,
        ...cursor,
      });
      r.append(freshText);
    }

    if (this.areAnchorsVisible()) {
      this._addAnchors(r);
    }
  }

  protected override _addAnchors(renderer: CompositeRenderer<HorzScaleItem>): void {
    const options = this._tool.options() as any;
    if (options.locked) return;
    if (this._points.length < 2) return;

    renderer.append(this.createLineAnchor({
      points: [this._points[0], this._points[1]],
      pointsCursorType: [
        PaneCursorType.Pointer,              // Center — grabbing cursor
        PaneCursorType.DiagonalNwSeResize,   // Radius point — resize cursor
      ],
    }, 0));
  }
}
```

### Step 4: Register the Tool

```typescript
// src/chart/drawing/tools/custom.ts

import { LineToolDiamond } from './custom/LineToolDiamond';

export const CUSTOM_TOOLS = {
  Diamond: LineToolDiamond,
};
```

Add to `TOOL_GROUP_MAP` and `loadAndRegisterGroup` in `chart-drawing-module.ts`:

```typescript
// In TOOL_GROUP_MAP
Diamond: 'custom',

// In loadAndRegisterGroup switch
case 'custom': {
  const { CUSTOM_TOOLS } = await import('./tools/custom');
  Object.entries(CUSTOM_TOOLS).forEach(([name, tool]) => {
    try { this.lineTools.registerLineTool(name, tool); }
    catch (error) { console.warn(`Failed to register tool ${name}:`, error); }
  });
  break;
}
```

### Step 5: Add to Properties Schema

```typescript
// In tool-schemas.ts

const diamondSchema: ToolSchema = {
  toolType: 'Diamond',
  displayName: 'Diamond',
  properties: [
    {
      key:          'diamond.border.color',
      label:        'Border Color',
      type:         'color',
      tab:          'style',
      section:      'Border',
      defaultValue: '#f97316'
    },
    {
      key:          'diamond.border.width',
      label:        'Width',
      type:         'line-width',
      tab:          'style',
      section:      'Border',
      defaultValue: 2
    },
    {
      key:          'diamond.background.color',
      label:        'Fill',
      type:         'color',
      tab:          'style',
      section:      'Fill',
      defaultValue: 'rgba(249,115,22,0.2)'
    },
    visibilityProp,
    ...commonTextProps('text'),
  ]
};

// Add to registry
export const toolSchemas: Record<string, ToolSchema> = {
  // ... existing tools ...
  Diamond: diamondSchema,
};
```

### Step 6: Add Toolbar Button

```html
<!-- In drawing-sidebar.html -->
<button data-tool="Diamond" title="Diamond">
  <svg><!-- diamond icon SVG --></svg>
</button>
```

The tool is now fully integrated. It draws interactively, persists across sessions, supports
the properties panel, template system, and theme text color updates.

-----

## 16. Common Pitfalls

### Never cache TextRenderer as a class property

The TextRenderer measures text width internally on first render. If reused across frames with
different zoom levels or text content, the cached width becomes stale causing layout bugs
where text appears in the wrong position.

```typescript
// Wrong — stale width bug on zoom
private _textRenderer = new TextRenderer();

// Correct — fresh measurement every frame
const freshTextRenderer = new TextRenderer<HorzScaleItem>();
```

### Always deepCopy defaults in the constructor

Without a deep copy, all tool instances share the same nested option objects in memory. Changing
one tool’s color changes the defaults for all future tools.

```typescript
// Wrong — all tools share the same object
const finalOptions = TrendLineOptionDefaults;

// Correct — unique copy per instance
const finalOptions = deepCopy(TrendLineOptionDefaults);
```

### Always clear the renderer at the start of _updateImpl

If you return early (visibility check, culling), the renderer must be cleared first or it shows
stale content from the previous render frame.

```typescript
protected override _updateImpl(height, width): void {
  this._invalidated = false;
  this._renderer.clear(); // ALWAYS first — before any early returns

  if (!options.visible) return;
  // ...
}
```

### toolType must match the registration key exactly

If the class has `toolType = 'TrendLine'` but you registered it as
`registerLineTool('Trendline', ...)`, import from localStorage will fail silently — the core
cannot find the class for that tool type.

### Always removeAllLineTools before importLineTools when switching context

`importLineTools` is non-destructive. Without clearing first, old tools from the previous TF or
symbol remain on the chart and blend with the newly imported tools.

```typescript
// Always this sequence
this.lineTools.removeAllLineTools();
this.lineTools.importLineTools(savedJson);
```

### Virtual anchors need BOTH getPoint AND setPoint

If you override `maxAnchorIndex()` to expose virtual handles you MUST override both `getPoint`
and `setPoint`. If only one is overridden, dragging virtual handles will either not work or
corrupt the data points.

### Disconnect the theme observer in destroy()

If you set up a `MutationObserver` in `initialize()`, disconnect it in `destroy()` to prevent
memory leaks and callbacks firing on a destroyed module.

```typescript
public destroy(): void {
  if (this.themeObserver) {
    this.themeObserver.disconnect();
    this.themeObserver = null;
  }
  // ...
}
```

-----

## 17. Quick Reference

### Tool Files Checklist

|File                          |Purpose                                             |
|------------------------------|----------------------------------------------------|
|`model/LineToolXxx.ts`        |Model — data, logic, hit test, constraints          |
|`views/LineToolXxxPaneView.ts`|View — screen conversion, rendering, anchors        |
|`tools/your-group.ts`         |Registration — maps string key to class             |
|`chart-drawing-module.ts`     |TOOL_GROUP_MAP entry + loadAndRegisterGroup case    |
|`tool-schemas.ts`             |Properties panel schema + toolSchemas registry entry|
|HTML toolbar                  |`<button data-tool="YourToolType">`                 |

### Core Imports Quick Reference

```typescript
import {
  // Base classes
  BaseLineTool, LineToolPaneView, LineToolsCorePlugin,

  // Options
  LineToolOptionsInternal, LineToolPartialOptionsMap, DeepPartial,
  deepCopy, merge,

  // Geometry
  Point, AnchorPoint, LineToolPoint, Coordinate,

  // Renderers
  CompositeRenderer, SegmentRenderer, RectangleRenderer, TextRenderer,

  // Renderer data types
  TextRendererData, RectangleRendererData,

  // Culling
  getToolCullingState, OffScreenState, LineToolCullingInfo,

  // Line options
  LineOptions, LineJoin, LineCap, LineEnd,

  // Text options
  TextOptions, TextAlignment, BoxVerticalAlignment, BoxHorizontalAlignment,

  // Cursors
  PaneCursorType,

  // Hit test
  HitTestResult, LineToolHitTestData,

  // Interaction
  InteractionPhase, ConstraintResult,

  // Stacking
  PriceAxisLabelStackingManager,

  // Types
  LineToolType, IPrimitivePaneRenderer, ILineToolsPlugin,
} from 'lightweight-charts-line-tools-core';
```

### pointsCount Reference

|Value|Meaning     |Example Tools                        |
|-----|------------|-------------------------------------|
|`1`  |Single point|VerticalLine, CrossLine              |
|`2`  |Two points  |TrendLine, Rectangle, Circle, Diamond|
|`3`  |Three points|Triangle, FibRetracement             |
|`-1` |Unbounded   |Brush, Highlighter, Path             |

### Anchor Index Conventions by Tool

|Tool          |Anchor Count|Index Layout                                  |
|--------------|------------|----------------------------------------------|
|TrendLine     |2           |0 = P0, 1 = P1                                |
|HorizontalLine|1           |0 = center point                              |
|Rectangle     |8           |0=TL, 1=BR, 2=BL, 3=TR, 4=ML, 5=MR, 6=TC, 7=BC|
|Circle        |2           |0 = center, 1 = radius point                  |
|Triangle      |3           |0, 1, 2 = three corners                       |

### OffScreenState Decision Table

|State            |Extensions Off|Extend Left On|Extend Right On|
|-----------------|--------------|--------------|---------------|
|`OffScreenLeft`  |Cull          |Cull          |**Draw**       |
|`OffScreenRight` |Cull          |**Draw**      |Cull           |
|`OffScreenTop`   |Cull          |Cull          |Cull           |
|`OffScreenBottom`|Cull          |Cull          |Cull           |
|`FullyOffScreen` |Cull          |Cull          |Cull           |
|`Visible`        |**Draw**      |**Draw**      |**Draw**       |

-----

*This document covers the complete drawing tools system as implemented in MegaFlowZ.
For core engine internals, refer to the TypeDoc documentation generated in the
`lightweight-charts-line-tools-core/docs` directory by running `npm run build` in that package.*