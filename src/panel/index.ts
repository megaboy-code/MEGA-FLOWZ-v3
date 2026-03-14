// ================================================================
// 📦 PANEL INDEX - Single entry point for panel system
// ================================================================

import { PanelsModule } from './panels-module';
import { PanelUI } from './panel-ui';

// ==================== WIRE INTERNALLY ====================

// 1. Create module first (no UI dependency yet)
const panelsModule = new PanelsModule();

// 2. Create UI with module reference (uses interface)
const panelUI = new PanelUI(panelsModule);

// 3. Inject UI into module (breaks circular dependency)
panelsModule.setUI(panelUI);

// 4. Initialize in correct order
panelUI.initialize();
panelsModule.initialize();

// ==================== EXPORT ONE THING ====================

// ✅ Module manager only needs this
export { panelsModule as Panels };

// ✅ Export types if needed elsewhere
export type {
    PanelState,
    IPanelsModule,
    IPanelUI
} from './panel-types';