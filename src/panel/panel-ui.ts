// ================================================================
// ⚡ PANEL UI - Panel Switching & Hotkey Integration ONLY
// ================================================================

import { IPanelsModule } from './panel-types';

export class PanelUI {
    private currentPanel: string = 'trading';

    constructor(private panelsModule: IPanelsModule) {
        console.log("🔄 Panel UI Initialized (Switching Only)");
    }

    // ==================== INITIALIZATION ====================

    public initialize(): void {
        this.setupHotkeyListeners();
        console.log("✅ Panel switching ready");
    }

    // ==================== HOTKEY INTEGRATION ====================

    private setupHotkeyListeners(): void {
        document.addEventListener('hotkey-panel-switch', (e: Event) => {
            const customEvent = e as CustomEvent<{ panel: string }>;
            if (customEvent.detail?.panel) {
                console.log(`⌨️ Hotkey: switch to ${customEvent.detail.panel}`);
                this.handlePanelSwitch(customEvent.detail.panel);
            }
        });
    }

    // ==================== PANEL SWITCHING ====================

    private handlePanelSwitch(panelName: string): void {
        if (panelName === this.currentPanel) {
            this.panelsModule.toggle();
        } else {
            this.panelsModule.show(panelName);
            this.currentPanel = panelName;
            this.dispatchPanelSwitched(panelName);
        }
    }

    private dispatchPanelSwitched(panelName: string): void {
        document.dispatchEvent(new CustomEvent('panel-switched', {
            detail: { panel: panelName }
        }));
        console.log(`🔄 Panel switched to: ${panelName}`);
    }

    // ==================== PUBLIC API ====================

    public switchPanel(panelName: string): void {
        this.handlePanelSwitch(panelName);
    }

    public getCurrentPanel(): string {
        return this.currentPanel;
    }
}