// ================================================================
// 📐 PANE MANAGER - Legend containers for separate panes (RSI etc)
// ================================================================

import { removeElement } from './utils';

const MAX_RETRIES = 30;

export class LegendPaneManager {
    private paneContainers: Map<any, HTMLElement> = new Map();
    private itemContainers: Map<any, HTMLElement> = new Map();
    private mainContainer:  HTMLElement | null    = null;
    private _destroyed:     boolean               = false;

    public setMainContainer(container: HTMLElement): void {
        this.mainContainer = container;
        this.itemContainers.set(null, container);
    }

    public getContainer(pane: any = null): HTMLElement | null {
        return this.itemContainers.get(pane) || null;
    }

    public async createPaneContainer(pane: any): Promise<HTMLElement | null> {
        if (this._destroyed) return null;

        if (this.paneContainers.has(pane)) {
            return this.paneContainers.get(pane)!;
        }

        const paneElement = await this.waitForPaneElement(pane);

        if (!paneElement) {
            console.error('❌ Pane element never became available');
            return null;
        }

        if (this._destroyed) return null;

        paneElement.style.position = 'relative';

        const legendContainer = document.createElement('div');
        legendContainer.style.cssText = `
            position: absolute;
            left: 12px;
            top: 12px;
            z-index: 10;
            pointer-events: none;
            user-select: none;
            font-family: 'Inter', sans-serif;
        `;

        const itemContainer = document.createElement('div');
        itemContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 2px;
            pointer-events: auto;
        `;

        legendContainer.appendChild(itemContainer);
        paneElement.appendChild(legendContainer);

        this.paneContainers.set(pane, legendContainer);
        this.itemContainers.set(pane, itemContainer);

        console.log('✅ Pane legend container created');

        return legendContainer;
    }

    public removePaneContainer(pane: any): void {
        removeElement(this.paneContainers.get(pane) || null);
        this.paneContainers.delete(pane);
        this.itemContainers.delete(pane);
    }

    public clearAll(): void {
        this.paneContainers.forEach((container, pane) => {
            if (pane !== null) removeElement(container);
        });
        this.paneContainers.clear();

        const mainContainer = this.itemContainers.get(null);
        this.itemContainers.clear();
        if (mainContainer) this.itemContainers.set(null, mainContainer);
    }

    private async waitForPaneElement(
        pane:    any,
        retries: number = 0
    ): Promise<HTMLElement | null> {
        if (this._destroyed) return null;

        try {
            // ✅ Get pane DOM element via paneIndex + chartWidget paneWidgets
            const paneIndex  = pane.paneIndex?.();
            if (paneIndex !== undefined) {
                const chartWidget = pane._private__chartWidget;
                const paneWidget  = chartWidget?._private__paneWidgets?.[paneIndex];
                const el          = paneWidget?.getElement?.() ?? paneWidget?._private__element;
                if (el) return el;
            }
        } catch (e) {}

        if (retries >= MAX_RETRIES) {
            console.error(`❌ waitForPaneElement failed after ${MAX_RETRIES} retries`);
            return null;
        }

        await new Promise(r => setTimeout(r, 16));
        return this.waitForPaneElement(pane, retries + 1);
    }

    public destroy(): void {
        this._destroyed = true;
        this.clearAll();
        this.mainContainer = null;
    }
}