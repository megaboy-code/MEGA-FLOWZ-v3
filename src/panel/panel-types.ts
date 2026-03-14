// ================================================================
// 📋 PANEL TYPES - Shared interfaces (no circular imports)
// ================================================================
// panel/panel-types.ts

export interface PanelMap {
    [key: string]: string;
}

export interface PanelState {
    isExpanded: boolean;
    isLocked: boolean;
    activeTool: string;
}

// ✅ What PanelUI needs from PanelsModule
export interface IPanelsModule {
    show(tool: string): void;
    hide(): void;
    toggle(tool?: string | null): void;
    getState(): PanelState;
}

// ✅ What PanelsModule needs from PanelUI
export interface IPanelUI {
    initialize(): void;
    switchPanel(panelName: string): void;
    getCurrentPanel(): string;
}