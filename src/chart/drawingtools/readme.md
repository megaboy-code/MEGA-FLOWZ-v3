## **DRAWING TOOLS MODULE - Developer Documentation**

---

## **📚 Table of Contents**

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Getting Started](#getting-started)
4. [File Structure](#file-structure)
5. [Core Concepts](#core-concepts)
6. [Adding Tool Property Schemas](#adding-tool-property-schemas)
7. [Creating Custom Tools](#creating-custom-tools)
8. [Lock/Unlock System](#lockunlock-system)
9. [Persistence Across Timeframes](#persistence-across-timeframes)
10. [API Reference](#api-reference)
11. [Keyboard Shortcuts](#keyboard-shortcuts)
12. [Troubleshooting](#troubleshooting)

---

## **Overview**

This module provides a comprehensive drawing tools system for Lightweight Charts v5+. It wraps the `lightweight-charts-line-tools-core` library and provides:

- ✅ Performance-optimized drawing with "gates" (only processes events when actively drawing/selecting)
- ✅ Advanced movable properties modal for editing tools
- ✅ Lock/unlock functionality to prevent accidental edits
- ✅ Tool property schemas for dynamic UI generation
- ✅ Persistence across timeframe/series changes
- ✅ Keyboard shortcuts for productivity
- ✅ Support for 20+ drawing tools

---

## **Architecture**

### **Component Hierarchy**

```
ChartDrawingModule (chart-drawing.ts)
  ├── Manages line tools core instance
  ├── Handles performance gates (drawing/selection modes)
  ├── Provides lock/unlock/delete functionality
  └── Owns DrawingToolbar
      │
      └── DrawingToolbar (drawing-toolbar.ts)
          ├── Manages toolbar buttons
          ├── Handles keyboard shortcuts
          └── Owns ToolPropertiesModal
              │
              └── ToolPropertiesModal (tool-properties-modal.ts)
                  ├── Renders dynamic property UI
                  ├── Uses ToolSchemas for configuration
                  └── Communicates changes back to ChartDrawingModule
```

### **Data Flow**

```
User Action (Click/Keyboard)
    ↓
DrawingToolbar (captures event)
    ↓
ChartDrawingModule (executes action via Core API)
    ↓
lightweight-charts-line-tools-core (updates tool)
    ↓
Tool Updated (visual feedback on chart)
```

---

## **Getting Started**

### **Installation**

```bash
npm install lightweight-charts
npm install github:difurious/lightweight-charts-line-tools-core
npm install github:difurious/lightweight-charts-line-tools-rectangle
# Install other tool plugins as needed
```

### **Basic Setup**

```typescript
import { createChart, CandlestickSeries } from 'lightweight-charts';
import { ChartDrawingModule } from './chart-drawing';

// 1. Create chart and series
const chart = createChart(document.getElementById('chart'));
const series = chart.addSeries(CandlestickSeries);

// 2. Initialize drawing module
const drawingModule = new ChartDrawingModule(
  chart,
  series,
  {
    precision: 2,
    showLabels: true,
    priceFormatter: (price) => price.toFixed(2)
  },
  {
    setDrawingState: (active) => console.log('Drawing:', active),
    setSelectionState: (active) => console.log('Selection:', active)
  }
);

// 3. Initialize
drawingModule.initialize();

// 4. Start drawing
drawingModule.startDrawing('TrendLine');
```

---

## **File Structure**

```
src/
├── chart-drawing.ts              // Main module - manages line tools core
├── index.ts                       // Public API exports
│
└── ui/
    ├── drawing-toolbar.ts         // Toolbar buttons & keyboard shortcuts
    ├── tool-properties-modal.ts   // Advanced movable properties editor
    └── tool-schemas.ts            // Property definitions for each tool
```

### **File Responsibilities**

| File | Purpose | Key Classes/Exports |
|------|---------|---------------------|
| `chart-drawing.ts` | Core orchestration, API wrapper | `ChartDrawingModule` |
| `drawing-toolbar.ts` | UI interaction, button management | `DrawingToolbar` |
| `tool-properties-modal.ts` | Dynamic property editor | `ToolPropertiesModal` |
| `tool-schemas.ts` | Tool metadata & property definitions | `toolSchemas`, `getSchemaForTool()` |

---

## **Core Concepts**

### **1. Performance Gates**

The module uses "gates" to minimize unnecessary event processing:

```typescript
// Gates are CLOSED by default (no events processed)
isDrawingActive = false;
isSelectionMode = false;

// Gate OPENS when user activates a tool
drawingModule.startDrawing('Rectangle');
// → isDrawingActive = true
// → Crosshair events now processed

// Gate CLOSES when drawing finishes
// → isDrawingActive = false
// → Crosshair events ignored
```

**Why?** Processing every crosshair move event (60fps) is expensive. Gates ensure events only process when necessary.

### **2. Tool Options Structure**

Every tool has an `options` object:

```typescript
{
  visible: true,
  editable: true,
  locked: false,              // Custom property for lock system
  showPriceAxisLabels: true,
  line: {
    color: '#3b82f6',
    width: 2,
    style: LineStyle.Solid
  },
  extend: {
    left: false,
    right: false
  },
  // Tool-specific properties
  levels: [...],              // FibRetracement only
  background: {...},          // Rectangle only
  text: {...}                 // Text/Callout only
}
```

### **3. Tool Lifecycle**

```
1. Register Tool Class
   └── lineTools.registerLineTool('TrendLine', LineToolTrendLine)

2. Start Drawing (Interactive)
   └── lineTools.addLineTool('TrendLine')
   └── User clicks chart to place points

3. Or Create Programmatically
   └── lineTools.createOrUpdateLineTool(type, points, options, id)

4. Edit Properties
   └── Get tool: getLineToolByID(id)
   └── Update: createOrUpdateLineTool(type, points, newOptions, id)

5. Lock Tool (Optional)
   └── Update options: { locked: true, editable: false }

6. Delete Tool
   └── Check if locked
   └── removeLineToolsById([id])

7. Export State
   └── exportLineTools() → JSON string

8. Import State
   └── importLineTools(json)
```

---

## **Adding Tool Property Schemas**

### **Step 1: Define the Schema**

Open `ui/tool-schemas.ts` and add your tool schema:

```typescript
const myCustomToolSchema: ToolSchema = {
  toolType: 'MyCustomTool',
  displayName: 'My Custom Tool',
  icon: 'fa-icon-name',
  properties: [
    {
      key: 'customColor',
      label: 'Custom Color',
      type: 'color',
      defaultValue: '#ff0000',
      section: 'Appearance'
    },
    {
      key: 'thickness',
      label: 'Thickness',
      type: 'range',
      min: 1,
      max: 20,
      step: 1,
      defaultValue: 5,
      section: 'Appearance'
    },
    {
      key: 'showLabel',
      label: 'Show Label',
      type: 'checkbox',
      defaultValue: true,
      section: 'Visibility'
    },
    // Add common properties
    ...commonLineProperties,
    ...commonVisibilityProperties
  ]
};
```

### **Step 2: Register in Schema Registry**

```typescript
export const toolSchemas: Record<string, ToolSchema> = {
  'TrendLine': trendLineSchema,
  'Rectangle': rectangleSchema,
  'MyCustomTool': myCustomToolSchema,  // Add here
  // ... other tools
};
```

### **Step 3: Property Types Reference**

| Type | Description | Example Use Case |
|------|-------------|------------------|
| `color` | Color picker | Line color, fill color |
| `range` | Slider with numeric value | Width, opacity, font size |
| `number` | Number input | Precise values |
| `select` | Dropdown menu | Line style (solid/dashed/dotted) |
| `checkbox` | Toggle on/off | Visibility flags, enable/disable features |
| `text` | Single-line text | Labels, IDs |
| `textarea` | Multi-line text | Callout text, notes |
| `levelArray` | Special Fib levels editor | Fibonacci levels with colors/opacities |

### **Step 4: Nested Properties**

Use dot notation for nested options:

```typescript
{
  key: 'line.color',        // Sets options.line.color
  key: 'text.font.size',    // Sets options.text.font.size
  key: 'border.radius',     // Sets options.border.radius
}
```

The `setPropertyValue()` helper automatically creates nested objects:

```typescript
setPropertyValue(options, 'line.color', '#ff0000');
// Result: options.line.color = '#ff0000'
```

### **Step 5: Property Sections**

Group related properties using `section`:

```typescript
properties: [
  { key: 'line.color', section: 'Line Style' },
  { key: 'line.width', section: 'Line Style' },
  { key: 'fill.color', section: 'Fill' },
  { key: 'fill.opacity', section: 'Fill' },
]
```

Modal will render:
```
┌─ Line Style ──────────┐
│ Line Color: [picker]  │
│ Line Width: [slider]  │
└───────────────────────┘

┌─ Fill ────────────────┐
│ Fill Color: [picker]  │
│ Fill Opacity: [slider]│
└───────────────────────┘
```

---

## **Creating Custom Tools**

### **Scenario: You've built a custom tool plugin**

Let's say you created `LineToolCustomIndicator` that shows buy/sell signals.

### **Step 1: Install & Register Tool**

```typescript
import { LineToolCustomIndicator } from './your-custom-tool';

// In chart-drawing.ts → registerAllTools()
const toolsToRegister = [
  // ... existing tools
  { name: 'CustomIndicator', tool: LineToolCustomIndicator }
];
```

### **Step 2: Define Tool Options Structure**

Your tool's default options (in your tool plugin):

```typescript
const CustomIndicatorDefaults = {
  visible: true,
  editable: true,
  buySignal: {
    color: '#00ff00',
    shape: 'arrow',
    size: 10
  },
  sellSignal: {
    color: '#ff0000',
    shape: 'arrow',
    size: 10
  },
  showLabels: true,
  labelText: {
    buy: 'BUY',
    sell: 'SELL'
  }
};
```

### **Step 3: Create Property Schema**

In `ui/tool-schemas.ts`:

```typescript
const customIndicatorSchema: ToolSchema = {
  toolType: 'CustomIndicator',
  displayName: 'Custom Indicator',
  icon: 'chart-bar',
  properties: [
    // Buy Signal Section
    {
      key: 'buySignal.color',
      label: 'Buy Signal Color',
      type: 'color',
      defaultValue: '#00ff00',
      section: 'Buy Signal'
    },
    {
      key: 'buySignal.size',
      label: 'Buy Signal Size',
      type: 'range',
      min: 5,
      max: 30,
      step: 1,
      defaultValue: 10,
      section: 'Buy Signal'
    },
    {
      key: 'buySignal.shape',
      label: 'Buy Signal Shape',
      type: 'select',
      options: [
        { value: 'arrow', label: 'Arrow' },
        { value: 'circle', label: 'Circle' },
        { value: 'triangle', label: 'Triangle' }
      ],
      defaultValue: 'arrow',
      section: 'Buy Signal'
    },
    
    // Sell Signal Section
    {
      key: 'sellSignal.color',
      label: 'Sell Signal Color',
      type: 'color',
      defaultValue: '#ff0000',
      section: 'Sell Signal'
    },
    {
      key: 'sellSignal.size',
      label: 'Sell Signal Size',
      type: 'range',
      min: 5,
      max: 30,
      step: 1,
      defaultValue: 10,
      section: 'Sell Signal'
    },
    
    // Labels Section
    {
      key: 'showLabels',
      label: 'Show Labels',
      type: 'checkbox',
      defaultValue: true,
      section: 'Labels'
    },
    {
      key: 'labelText.buy',
      label: 'Buy Label Text',
      type: 'text',
      defaultValue: 'BUY',
      section: 'Labels'
    },
    {
      key: 'labelText.sell',
      label: 'Sell Label Text',
      type: 'text',
      defaultValue: 'SELL',
      section: 'Labels'
    },
    
    // Common properties
    ...commonVisibilityProperties
  ]
};

// Register it
export const toolSchemas: Record<string, ToolSchema> = {
  // ... existing tools
  'CustomIndicator': customIndicatorSchema
};
```

### **Step 4: Test**

```typescript
// Draw the tool
drawingModule.startDrawing('CustomIndicator');

// User draws on chart...

// Double-click tool → Properties modal opens
// Modal shows:
// - Buy Signal section (color, size, shape)
// - Sell Signal section (color, size)
// - Labels section (enable, text values)
// - Lock/Delete buttons
```

### **Step 5: Handle Complex Properties**

For very complex properties (like arrays of objects), create a custom renderer:

```typescript
// In tool-properties-modal.ts → renderPropertyField()

case 'customArrayType':
  return this.renderCustomArray(prop, tool);

// Add method
private renderCustomArray(prop: PropertyField, tool: any): string {
  const items = getPropertyValue(tool.options, prop.key) || [];
  
  let html = `<div class="custom-array-editor">`;
  items.forEach((item, index) => {
    html += `
      <div class="array-item">
        <input type="text" data-array="${prop.key}" data-index="${index}" value="${item.value}" />
        <button data-remove-item="${index}">Remove</button>
      </div>
    `;
  });
  html += `<button data-add-item="${prop.key}">Add Item</button>`;
  html += `</div>`;
  
  return html;
}
```

---

## **Lock/Unlock System**

### **How It Works**

Locking a tool sets two properties:

```typescript
{
  locked: true,      // Custom property (our addition)
  editable: false    // Core API property
}
```

### **Lock Behavior**

| Action | Unlocked | Locked |
|--------|----------|--------|
| Move tool | ✅ Yes | ❌ No |
| Edit anchors | ✅ Yes | ❌ No |
| Delete tool | ✅ Yes | ❌ No |
| Select tool | ✅ Yes | ✅ Yes |
| View properties | ✅ Yes | ✅ Yes |
| Unlock | N/A | ✅ Yes |

### **Locking via API**

```typescript
// Lock a tool
drawingModule.lockTool(toolId, true);

// Unlock a tool
drawingModule.lockTool(toolId, false);

// Check if locked
const toolData = JSON.parse(drawingModule.getLineToolByID(toolId))[0];
const isLocked = toolData.options?.locked || false;
```

### **Locking via UI**

1. Double-click tool → Properties modal opens
2. Click "Lock" button → Tool becomes locked
3. Lock button changes to "Unlock"
4. Delete button becomes disabled (grayed out)
5. Click "Unlock" → Tool becomes editable again

### **Locking via Keyboard**

1. Select tool (click it)
2. Press `L` key → Toggles lock/unlock

### **Preventing Deletion of Locked Tools**

The system automatically checks lock status before deletion:

```typescript
// In chart-drawing.ts → deleteTool()
const tool = JSON.parse(this.getLineToolByID(toolId))[0];
if (tool.options?.locked) {
  console.warn('Cannot delete locked tool');
  return;
}

// In drawing-toolbar.ts → Delete key handler
if (this.selectedTool.options?.locked) {
  alert('This tool is locked. Unlock it first to delete.');
  return;
}
```

---

## **Persistence Across Timeframes**

### **The Problem**

When you change chart timeframes (1m → 5m → 1h), the series changes. Previously, this would destroy all drawings.

### **The Solution**

The `updateSeries()` method now exports/imports drawings:

```typescript
public updateSeries(newSeries: ISeriesApi<SeriesType>): void {
  // 1. Export current drawings
  const savedDrawings = this.exportDrawings();
  
  // 2. Destroy old line tools
  this.lineTools.destroy();
  
  // 3. Create new line tools with new series
  this.lineTools = createLineToolsPlugin(this.chart, newSeries);
  
  // 4. Re-register tools
  this.registerAllTools();
  
  // 5. Restore drawings
  if (savedDrawings && savedDrawings !== '[]') {
    this.importDrawings(savedDrawings);
  }
}
```

### **Usage**

```typescript
// When user changes timeframe
const newSeries = chart.addSeries(CandlestickSeries, { 
  /* new timeframe data */ 
});

// Update drawing module
drawingModule.updateSeries(newSeries);

// ✅ All drawings preserved!
```

### **What Gets Persisted**

- ✅ Tool type (TrendLine, Rectangle, etc.)
- ✅ Tool points (coordinates)
- ✅ Tool options (colors, widths, locked state, etc.)
- ✅ Tool IDs (same tools before/after)

### **Storage Format**

Export format is JSON:

```json
[
  {
    "id": "tool_12345",
    "toolType": "TrendLine",
    "points": [
      { "timestamp": 1234567890, "price": 100.50 },
      { "timestamp": 1234567900, "price": 101.25 }
    ],
    "options": {
      "visible": true,
      "locked": true,
      "line": {
        "color": "#3b82f6",
        "width": 2
      }
    }
  }
]
```

You can save this to:
- LocalStorage
- Database
- File system
- Cloud storage

```typescript
// Save to localStorage
const drawings = drawingModule.exportDrawings();
localStorage.setItem('chartDrawings', drawings);

// Load from localStorage
const saved = localStorage.getItem('chartDrawings');
if (saved) {
  drawingModule.importDrawings(saved);
}
```

---

## **API Reference**

### **ChartDrawingModule**

#### **Constructor**

```typescript
new ChartDrawingModule(
  chart: IChartApi,
  series: ISeriesApi<SeriesType>,
  config: DrawingToolsConfig,
  callbacks?: {
    setDrawingState?: (active: boolean) => void;
    setSelectionState?: (active: boolean) => void;
  }
)
```

#### **Initialization**

```typescript
initialize(): boolean
```

Initializes the drawing module. Call once after construction.

**Returns:** `true` if successful, `false` otherwise.

#### **Drawing Management**

```typescript
startDrawing(toolType: string): void
```

Activates a drawing tool for interactive creation.

**Parameters:**
- `toolType`: Tool identifier (e.g., 'TrendLine', 'Rectangle')

**Example:**
```typescript
drawingModule.startDrawing('FibRetracement');
```

---

```typescript
clearAllDrawings(): void
```

Removes all drawings from the chart.

**Warning:** This cannot be undone. Consider exporting first.

---

```typescript
removeSelectedDrawings(): void
```

Removes currently selected drawing(s).

---

#### **Tool Property Management**

```typescript
updateToolProperties(toolId: string, updates: any): void
```

Updates a tool's options.

**Parameters:**
- `toolId`: Unique tool identifier
- `updates`: Object with property updates (supports nested properties)

**Example:**
```typescript
drawingModule.updateToolProperties('tool_123', {
  line: {
    color: '#ff0000',
    width: 3
  },
  visible: true
});
```

---

```typescript
lockTool(toolId: string, locked: boolean): void
```

Locks or unlocks a tool.

**Parameters:**
- `toolId`: Tool identifier
- `locked`: `true` to lock, `false` to unlock

**Example:**
```typescript
drawingModule.lockTool('tool_123', true);  // Lock
drawingModule.lockTool('tool_123', false); // Unlock
```

---

```typescript
deleteTool(toolId: string): void
```

Deletes a tool if it's not locked.

**Parameters:**
- `toolId`: Tool identifier

**Example:**
```typescript
drawingModule.deleteTool('tool_123');
```

---

#### **Persistence**

```typescript
exportDrawings(): string
```

Exports all drawings as a JSON string.

**Returns:** JSON string containing all tool data.

**Example:**
```typescript
const json = drawingModule.exportDrawings();
localStorage.setItem('drawings', json);
```

---

```typescript
importDrawings(json: string): void
```

Imports drawings from a JSON string.

**Parameters:**
- `json`: Previously exported JSON string

**Example:**
```typescript
const json = localStorage.getItem('drawings');
if (json) {
  drawingModule.importDrawings(json);
}
```

---

#### **Series Management**

```typescript
updateSeries(newSeries: ISeriesApi<SeriesType>): void
```

Updates the series reference and preserves all drawings.

**Parameters:**
- `newSeries`: New series instance

**Example:**
```typescript
const newSeries = chart.addSeries(CandlestickSeries);
drawingModule.updateSeries(newSeries);
```

---

#### **State & Utility**

```typescript
isReady(): boolean
```

Checks if module is initialized.

**Returns:** `true` if ready, `false` otherwise.

---

```typescript
getAvailableToolTypes(): string[]
```

Gets list of all registered tool types.

**Returns:** Array of tool type strings.

---

```typescript
getToolCount(): number
```

Gets the number of active drawings.

**Returns:** Number of tools on chart.

---

```typescript
destroy(): void
```

Destroys the module and cleans up resources. Call when disposing chart.

---

### **Core API Methods (Advanced)**

These methods directly interact with the line-tools-core:

```typescript
getLineTools(): any
```

Returns the raw line tools core instance.

---

```typescript
subscribeLineToolsAfterEdit(callback: (payload: any) => void): void
```

Subscribes to tool edit events.

**Example:**
```typescript
drawingModule.subscribeLineToolsAfterEdit((payload) => {
  console.log('Tool edited:', payload);
  if (payload.stage === 'lineToolFinished') {
    // Auto-save to backend
    saveToBackend(drawingModule.exportDrawings());
  }
});
```

---

```typescript
subscribeLineToolsDoubleClick(callback: (payload: any) => void): void
```

Subscribes to tool double-click events.

**Example:**
```typescript
drawingModule.subscribeLineToolsDoubleClick((payload) => {
  console.log('Tool double-clicked:', payload);
  // Custom logic here
});
```

---

```typescript
getLineToolByID(id: string): string
```

Gets a specific tool's data as JSON.

**Returns:** JSON string containing tool data.

**Example:**
```typescript
const json = drawingModule.getLineToolByID('tool_123');
const tool = JSON.parse(json)[0];
console.log(tool.options);
```

---

## **Keyboard Shortcuts**

| Key | Action | Requirement |
|-----|--------|-------------|
| `ESC` | Deactivate all tools & close modal | Always |
| `Delete` or `Backspace` | Delete selected tool | Tool selected & unlocked |
| `P` | Show properties modal | Tool selected |
| `L` | Toggle lock/unlock | Tool selected |

**Notes:**
- Shortcuts don't work when typing in input fields
- Delete key shows alert if tool is locked
- P and L keys are case-insensitive

---

## **Troubleshooting**

### **Drawings disappear when changing timeframes**

**Solution:** Ensure you're calling `updateSeries()` instead of destroying and recreating the module:

```typescript
// ❌ Wrong
drawingModule.destroy();
const newModule = new ChartDrawingModule(...);

// ✅ Right
const newSeries = chart.addSeries(...);
drawingModule.updateSeries(newSeries);
```

---

### **Properties modal doesn't show for my custom tool**

**Checklist:**
1. Did you add the schema to `tool-schemas.ts`?
2. Did you register it in `toolSchemas` object?
3. Is the `toolType` string exactly matching?

```typescript
// Tool registration
lineTools.registerLineTool('MyTool', MyToolClass);

// Schema must match exactly
const myToolSchema: ToolSchema = {
  toolType: 'MyTool',  // ← Must match registration name
  // ...
};
```

---

### **Can't delete locked tool**

**Expected behavior.** Locked tools cannot be deleted. Unlock first:

```typescript
// Via API
drawingModule.lockTool(toolId, false);

// Via UI
// 1. Double-click tool
// 2. Click "Unlock" button in modal
// 3. Now you can delete
```

---

### **Modal doesn't show latest changes**

The modal fetches fresh data on open. If you're seeing stale data:

```typescript
// In drawing-toolbar.ts → showToolProperties()
const freshData = this.drawingModule.getLineToolByID(tool.id);
const tool = JSON.parse(freshData)[0];
this.propertiesModal.show(tool);
```

Check that `getLineToolByID()` is working correctly.

---

### **Performance issues with many tools**

The module includes performance optimizations:

1. **Gates:** Events only process when drawing/selecting
2. **Batching:** Tool formatting is batched (100ms delay)
3. **Throttling:** Crosshair events throttled to 60fps

If still slow with 100+ tools:

```typescript
// Reduce crosshair throttle
private readonly CROSSHAIR_THROTTLE_MS = 32; // 30fps instead of 60fps

// Increase batch delay
this.formatBatchTimeout = window.setTimeout(() => {
  // ...
}, 200); // 200ms instead of 100ms
```

---

### **Tool doesn't respect property changes**

Some tools have specific option structures. Check the tool's source code:

```typescript
// Example: Rectangle might expect
{
  border: { color, width },
  background: { color }
}

// Not
{
  line: { color, width },
  fill: { color }
}
```

Update your schema to match the tool's expected structure.

---

## **Advanced Examples**

### **Auto-save to Backend**

```typescript
drawingModule.subscribeLineToolsAfterEdit((payload) => {
  if (payload.stage === 'lineToolFinished') {
    const drawings = drawingModule.exportDrawings();
    
    fetch('/api/save-drawings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chartId: 'BTC-USD',
        drawings: drawings 
      })
    });
  }
});
```

---

### **Load Drawings on Chart Init**

```typescript
async function initChart() {
  const chart = createChart(...);
  const series = chart.addSeries(...);
  const drawingModule = new ChartDrawingModule(...);
  
  drawingModule.initialize();
  
  // Load saved drawings
  const response = await fetch('/api/get-drawings?chartId=BTC-USD');
  const data = await response.json();
  
  if (data.drawings) {
    drawingModule.importDrawings(data.drawings);
  }
}
```

---

### **Bulk Lock All Tools**

```typescript
function lockAllTools() {
  const drawings = drawingModule.exportDrawings();
  const tools = JSON.parse(drawings);
  
  tools.forEach(tool => {
    drawingModule.lockTool(tool.id, true);
  });
}
```

---

### **Custom Property Validator**

```typescript
// In tool-properties-modal.ts → applyChanges()

// Before applying updates
if (updates.line?.width && updates.line.width > 10) {
  alert('Line width cannot exceed 10');
  return;
}

if (updates.text?.value && updates.text.value.length > 100) {
  alert('Text too long (max 100 chars)');
  return;
}

// Apply updates...
```

---

### **Tool Change Notifications**

```typescript
drawingModule.subscribeLineToolsAfterEdit((payload) => {
  const tool = payload.selectedLineTool || payload;
  
  // Show toast notification
  showToast(`${tool.toolType} updated`);
  
  // Log to analytics
  analytics.track('tool_edited', {
    type: tool.toolType,
    locked: tool.options?.locked
  });
});
```

---

## **Best Practices**

### **✅ DO:**

1. **Always call `updateSeries()` when changing timeframes**
   ```typescript
   drawingModule.updateSeries(newSeries);
   ```

2. **Export drawings before major operations**
   ```typescript
   const backup = drawingModule.exportDrawings();
   // Perform risky operation
   // If failed: drawingModule.importDrawings(backup);
   ```

3. **Use schemas for all custom tools**
   - Makes tools user-friendly
   - Enables property editing
   - Self-documenting

4. **Lock important drawings**
   - Lock support/resistance levels
   - Lock analysis annotations
   - Prevents accidental deletion

5. **Clean up on unmount**
   ```typescript
   componentWillUnmount() {
     drawingModule.destroy();
   }
   ```

### **❌ DON'T:**

1. **Don't manipulate core instance directly**
   ```typescript
   // ❌ Bad
   drawingModule.getLineTools().someInternalMethod();
   
   // ✅ Good
   drawingModule.startDrawing('TrendLine');
   ```

2. **Don't forget to initialize**
   ```typescript
   const dm = new ChartDrawingModule(...);
   dm.initialize(); // ← Must call this!
   ```

3. **Don't bypass lock checks**
   ```typescript
   // ❌ Bad
   drawingModule.getLineTools().removeLineToolsById([id]);
   
   // ✅ Good
   drawingModule.deleteTool(id); // Checks lock status
   ```

4. **Don't create schemas with duplicate keys**
   ```typescript
   // ❌ Bad
   properties: [
     { key: 'color', ... },
     { key: 'color', ... }  // Duplicate!
   ]
   ```

---

## **Contributing**

To add support for more tools:

1. Install the tool plugin
2. Register in `chart-drawing.ts → registerAllTools()`
3. Add schema in `tool-schemas.ts`
4. Test lock/unlock/delete functionality
5. Update this documentation

---

## **License**

See project LICENSE file.

---

## **Support**

For issues:
1. Check [Troubleshooting](#troubleshooting)
2. Review [lightweight-charts-line-tools-core](https://github.com/difurious/lightweight-charts-line-tools-core) docs
3. Open GitHub issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser/environment info