// ================================================================
// 📐 PANE MANAGER - Legend containers for separate panes (RSI etc)
// ================================================================

import { removeElement } from './utils';

export class LegendPaneManager {
    private paneContainers: Map<any, HTMLElement> = new Map();
    private itemContainers: Map<any, HTMLElement> = new Map();
    private mainContainer:  HTMLElement | null    = null;
    private chartContainer: HTMLElement | null    = null;
    private _destroyed:     boolean               = false;

    public setMainContainer(container: HTMLElement, chartContainer?: HTMLElement): void {
        this.mainContainer  = container;
        this.chartContainer = chartContainer || null;
        this.itemContainers.set(null, container);
        console.log('🔍 chartContainer set:', this.chartContainer?.id, chartContainer?.id);
    }

    public getContainer(pane: any = null): HTMLElement | null {
        return this.itemContainers.get(pane) || null;
    }

    public async createPaneContainer(pane: any): Promise<HTMLElement | null> {
        if (this._destroyed) return null;
        if (this.paneContainers.has(pane)) return this.paneContainers.get(pane)!;

        if (!this.chartContainer) {
            console.error('❌ Chart container not available for pane legend');
            return null;
        }

        const legendContainer = document.createElement('div');
        legendContainer.style.cssText = `
            position: absolute;
            left: 12px;
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
        this.chartContainer.appendChild(legendContainer);

        this.paneContainers.set(pane, legendContainer);
        this.itemContainers.set(pane, itemContainer);

        // ✅ Initial position
        this.positionLegend(pane, legendContainer);

        // ✅ Reposition on pane resize
        const resizeHandler = () => {
            if (!this._destroyed) this.positionLegend(pane, legendContainer);
        };
        document.addEventListener('mouseup', resizeHandler);

        console.log('✅ Pane legend container created');
        return legendContainer;
    }

    private positionLegend(pane: any, legendContainer: HTMLElement): void {
        try {
            const paneHeight  = pane.getHeight?.() ?? 120;
            const totalHeight = this.chartContainer?.clientHeight ?? 0;
            if (totalHeight > 0 && paneHeight > 0) {
                legendContainer.style.top = (totalHeight - paneHeight + 8) + 'px';
                return;
            }
        } catch (e) {}

        legendContainer.style.top = '60%';
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

    public destroy(): void {
        this._destroyed = true;
        this.clearAll();
        this.mainContainer  = null;
        this.chartContainer = null;
    }
}