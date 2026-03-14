```markdown
# 📊 Chart Engine Module

## Overview
The Chart Engine is a modular, self-contained charting system built on `lightweight-charts`. It provides a clean separation of concerns through specialized sub-modules, making it maintainable and extensible.

## File Structure

```

chart engine/
│
├── index.ts                    # Public API - exports MainChart orchestrator
├── main-chart.ts               # Orchestrator that composes all modules
├── chart-instance.ts           # Chart creation, lifecycle, basic operations
├── chart-state.ts              # Loading states and blur overlay
├── chart-ui.ts                 # Top-level UI controls (symbol, timeframe, chart type)
├── context-menu.ts             # Right-click context menu with settings
├── context-menu-styles.ts       # CSS styles for context menu
├── template-manager.ts          # Color template CRUD operations
├── theme-manager.ts             # Theme management (dark/light/blue)
├── pane-manager.ts              # Multi-pane management for indicators
├── series-manager.ts            # Price series creation and management
├── volume-manager.ts            # Volume series management
└── types/                       # (optional) Shared TypeScript interfaces

```

## Module Responsibilities

### 🎯 MainChart (main-chart.ts)
The orchestrator that composes all modules and presents a unified API to the outside world.

**Responsibilities:**
- Creates and initializes all sub-modules
- Routes data between modules
- Manages cross-module communication via events
- Provides public API for chart-core
- Handles symbol/timeframe changes
- Coordinates data flow (initial/update)
- Creates context menu after chart is ready

### 🏗️ ChartInstance (chart-instance.ts)
Handles the core chart instance lifecycle.

**Responsibilities:**
- Creates the lightweight-charts instance
- Manages chart container and resize
- Provides basic chart operations (grid, crosshair, time scale)
- Screenshot functionality
- Clean up on destroy

**Key Methods:**
- `create(container)`: Creates chart instance
- `toggleGrid()`, `toggleCrosshair()`, `toggleTimeScale()`
- `resetView()`, `downloadChart()`
- `destroy()`

### ⚡ ChartState (chart-state.ts)
Manages chart loading states and visual feedback.

**Responsibilities:**
- State machine (IDLE → LOADING → READY)
- Blur overlay with spinner animation
- State change notifications via events
- Cursor management during loading

**Key Methods:**
- `setState()`, `getState()`
- `isLoading()`, `isReady()`
- `onStateChange()` callback registration
- `destroy()`

### 🎮 ChartUI (chart-ui.ts)
Handles top-level UI controls for chart interaction.

**Responsibilities:**
- Symbol selector dropdown
- Timeframe selector
- Chart type selector (candlestick/line/area/baseline)
- Action buttons (reset, download, fullscreen)
- Keyboard shortcuts (F for fullscreen, R for reset, D for download)

**Key Methods:**
- `initialize()`: Sets up DOM elements and listeners
- `updateSymbol()`, `updateTimeframe()`, `updateChartType()`
- `destroy()`

### 📋 ContextMenu (context-menu.ts)
Handles right-click context menu functionality.

**Responsibilities:**
- Right-click menu on chart container
- Theme selection (dark/light/blue)
- Display settings (grid, crosshair, timescale)
- Color template management
- Chart actions (reset, download, fullscreen)
- Settings modal access

**Key Methods:**
- `destroy()`: Clean up menu and event listeners

### 🎨 ThemeManager (theme-manager.ts)
Manages color themes and presets.

**Responsibilities:**
- Fixed preset themes (dark, light, blue)
- Theme application via DOM events
- Theme state persistence
- Custom colors detection

**Key Methods:**
- `applyTheme()`
- `getCurrentThemeColors()`
- `isThemeActive()`

### 📁 TemplateManager (template-manager.ts)
Handles color template CRUD operations.

**Responsibilities:**
- Create, read, update, delete color templates
- localStorage persistence
- Template validation
- Template application via events

**Key Methods:**
- `createTemplate()`, `updateTemplate()`, `deleteTemplate()`
- `applyTemplate()`
- `getTemplates()`

### 📐 PaneManager (pane-manager.ts)
Manages multiple chart panes for indicators.

**Responsibilities:**
- Creating new panes
- Removing panes
- Adding series to specific panes
- Pane visibility and height management
- Moving panes between positions

**Key Methods:**
- `addPane()`, `removePane()`
- `addSeriesToPane()`
- `setPaneHeight()`, `setPaneVisibility()`
- `movePane()`

### 📈 SeriesManager (series-manager.ts)
Handles the main price series.

**Responsibilities:**
- Creating series based on chart type (candlestick/line/area/baseline)
- Setting and updating price data
- Color management for different chart types
- Chart type switching

**Key Methods:**
- `createSeries()`
- `setData()`, `updateData()`
- `updateColors()`
- `clearData()`, `destroy()`

### 📊 VolumeManager (volume-manager.ts)
Manages volume series as an overlay.

**Responsibilities:**
- Creating volume histogram series
- Setting and updating volume data
- Volume color management (bull/bear)
- Scale margin adjustment when volume is visible
- Volume state persistence

**Key Methods:**
- `create()`, `remove()`
- `setData()`, `updateCandle()`
- `updateColors()`
- `isVisible()`, `getCurrentVolume()`

## Data Flow

```

WebSocket Data
↓
ChartModule (chart-core)
↓
MainChart.handleInitialData() / handleUpdate()
↓
DataManager (shared) ← → SeriesManager
↓                     ↓
VolumeManager         Chart Instance
↓                     ↓
Events               PaneManager
↓                     ↓
Legend               UI Updates
Context Menu

```

## Event Communication

Modules communicate via DOM events:

| Event | Payload | Description |
|-------|---------|-------------|
| `symbol-changed` | `{ symbol }` | Symbol changed |
| `timeframe-changed` | `{ timeframe }` | Timeframe changed |
| `chart-state-change` | `{ state }` | Chart loading state changed |
| `volume-update` | `{ volume, isBullish, timeframe }` | Volume data updated |
| `volume-color-change` | `{ type, color }` | Volume colors updated |
| `chart-ready` | `{ chart, symbol, timeframe }` | Chart fully loaded |
| `chart-theme-change` | `{ theme, colors }` | Theme changed |
| `chart-colors-change` | `{ colors }` | Custom colors applied |
| `chart-toggle-grid` | none | Toggle grid visibility |
| `chart-toggle-crosshair` | none | Toggle crosshair |
| `chart-toggle-timescale` | none | Toggle time scale |
| `chart-reset-request` | none | Reset chart view |
| `chart-download-request` | none | Download chart as image |

## Usage Example

```typescript
import { MainChart } from './chart engine';
import { ChartDataManager } from '../chart-data-manager';

const dataManager = new ChartDataManager();
const chartColors = {
  background: '#0f172a',
  grid: '#2d3748',
  bull: '#10b981',
  bear: '#ef4444',
  line: '#3b82f6',
  volumeBull: '#10b981',
  volumeBear: '#ef4444'
};

const mainChart = new MainChart(
  chartColors,
  'EURUSD',
  'H1',
  dataManager
);

// Load chart into container
await mainChart.loadChart(document.getElementById('tvChart'));

// Handle incoming data
mainChart.handleInitialData(websocketMessage);

// Change chart type
mainChart.setChartType('line');

// Clean up
mainChart.destroy();
```

Extending the Chart Engine

To add new functionality:

1. Create a new module with single responsibility
2. Add to MainChart constructor and composition
3. Expose via public API if needed externally
4. Use events for cross-module communication
5. Keep modules independent - no circular dependencies

Best Practices

· ✅ Single responsibility per module
· ✅ Dependencies passed via constructor
· ✅ Event-based cross-module communication
· ✅ Proper cleanup in destroy()
· ✅ Console logs for debugging
· ✅ TypeScript interfaces for all public APIs
· ❌ No circular dependencies
· ❌ No direct imports from parent modules
· ❌ No DOM manipulation outside UI modules

Performance Considerations

· Throttled crosshair updates (16ms)
· Batch data updates where possible
· Lazy initialization of UI components
· Proper cleanup to prevent memory leaks
· ResizeObserver for container resizing

```
```