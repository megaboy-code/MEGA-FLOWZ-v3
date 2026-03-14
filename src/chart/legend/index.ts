// ================================================================
// 📊 CHART LEGEND - Orchestrator
// ================================================================

import { MainLegend } from './main-legend';
import { ItemsLegend } from './items-legend';
import { LegendPaneManager } from './pane-manager';
import { removeElement, formatVolume } from './utils';
import { LegendItem, LegendItemValue, LegendUpdateData, ConnectionStatus } from '../chart-types';

export class ChartLegend {
    private chartContainer:    HTMLElement;
    private legendContainer:   HTMLElement | null = null;
    private mainItemContainer: HTMLElement | null = null;

    private mainLegend:  MainLegend;
    private itemsLegend: ItemsLegend;
    private paneManager: LegendPaneManager;

    private collapsed: boolean = false;

    // ✅ AbortController — one abort() removes all listeners
    private abortController: AbortController | null = null;

    constructor(chartContainer: HTMLElement) {
        this.chartContainer = chartContainer;
        this.mainLegend     = new MainLegend();
        this.itemsLegend    = new ItemsLegend();
        this.paneManager    = new LegendPaneManager();
    }

    // ==================== INITIALIZATION ====================

    public initialize(): void {
        this.destroy();
        this.createContainer();
        this.setupEventListeners();
    }

    private createContainer(): void {
        this.legendContainer = document.createElement('div');
        this.legendContainer.id = 'chart-legend';
        this.legendContainer.style.cssText = `
            position: absolute;
            left: 12px;
            top: 12px;
            z-index: 100;
            pointer-events: none;
            user-select: none;
            display: flex;
            flex-direction: column;
            gap: 4px;
        `;

        const mainLegendEl = this.mainLegend.create();

        this.mainLegend.onToggleCollapse = () => {
            this.collapsed = !this.collapsed;
            this.mainLegend.setCollapsed(this.collapsed);
            if (this.mainItemContainer) {
                this.mainItemContainer.style.display = this.collapsed ? 'none' : 'flex';
            }
        };

        this.mainItemContainer = document.createElement('div');
        this.mainItemContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 2px;
            pointer-events: auto;
        `;

        this.paneManager.setMainContainer(this.mainItemContainer);

        this.legendContainer.appendChild(mainLegendEl);
        this.legendContainer.appendChild(this.mainItemContainer);
        this.chartContainer.appendChild(this.legendContainer);
    }

    // ==================== EVENT LISTENERS ====================

    private setupEventListeners(): void {
        this.abortController = new AbortController();
        const { signal } = this.abortController;

        document.addEventListener('legend-item-settings', (e: Event) => {
            const { id, item } = (e as CustomEvent).detail;
            document.dispatchEvent(new CustomEvent('open-item-settings', {
                detail: { id, item }
            }));
        }, { signal });

        document.addEventListener('legend-item-toggle', (e: Event) => {
            const { id } = (e as CustomEvent).detail;
            document.dispatchEvent(new CustomEvent('legend-toggle-item', {
                detail: { id }
            }));
        }, { signal });

        document.addEventListener('legend-item-remove', (e: Event) => {
            const { id } = (e as CustomEvent).detail;
            this.removeItem(id);
            document.dispatchEvent(new CustomEvent('legend-remove-item', {
                detail: { id }
            }));
        }, { signal });
    }

    // ==================== PUBLIC API ====================

    public update(data: LegendUpdateData): void {
        if (data.symbol    !== undefined) this.mainLegend.updateSymbol(data.symbol);
        if (data.timeframe !== undefined) this.mainLegend.updateTimeframe(data.timeframe);
        if (data.price     !== undefined) this.mainLegend.updatePrice(data.price, data.precision);
        if (data.precision !== undefined && data.price === undefined) {
            this.mainLegend.updatePrice(null, data.precision);
        }
        if (data.volumeVisible !== undefined) {
            const volumeItem = this.itemsLegend.getItem('volume');
            if (data.volumeVisible && !volumeItem) {
                this.addItem({
                    id:     'volume',
                    name:   'VOL',
                    color:  '#10b981',
                    values: [{ value: '--', color: '#10b981' }]
                });
            } else if (!data.volumeVisible && volumeItem) {
                this.removeItem('volume');
            }
        }
    }

    public updateConnectionStatus(status: ConnectionStatus): void {
        this.mainLegend.updateStatus(status);
    }

    public updateVolume(volume: number, isBullish: boolean): void {
        const color     = isBullish ? '#10b981' : '#ef4444';
        const formatted = formatVolume(volume);
        if (this.itemsLegend.hasItem('volume')) {
            this.itemsLegend.updateValue('volume', [{ value: formatted, color }]);
        }
    }

    public addItem(item: LegendItem): void {
        const container = this.paneManager.getContainer(item.pane || null);
        if (!container) {
            console.warn(`⚠️ No container for pane`, item.pane);
            return;
        }
        this.itemsLegend.addItem(item, container);
    }

    public removeItem(id: string): void {
        this.itemsLegend.removeItem(id);
    }

    public updateItemValue(id: string, value: string): void {
        this.itemsLegend.updateSingleValue(id, value);
    }

    public updateItemValues(id: string, values: LegendItemValue[]): void {
        this.itemsLegend.updateValue(id, values);
    }

    // ✅ Update legend name when period changes
    public updateItemName(id: string, name: string): void {
        this.itemsLegend.updateName(id, name);
    }

    // ✅ Update settings stored in legend item
    public updateItemSettings(id: string, settings: Record<string, any>): void {
        this.itemsLegend.updateSettings(id, settings);
    }

    public setItemVisible(id: string, visible: boolean): void {
        this.itemsLegend.setVisible(id, visible);
    }

    public hasItem(id: string): boolean {
        return this.itemsLegend.hasItem(id);
    }

    public async createPaneLegend(pane: any): Promise<void> {
        await this.paneManager.createPaneContainer(pane);
    }

    public removePaneLegend(pane: any): void {
        this.itemsLegend.getAll()
            .filter(item => item.pane === pane)
            .forEach(item => this.itemsLegend.removeItem(item.id));
        this.paneManager.removePaneContainer(pane);
    }

    public clearItems(): void {
        this.itemsLegend.getAll()
            .filter(item => item.icon !== 'fa-robot')
            .forEach(item => this.itemsLegend.removeItem(item.id));
        this.paneManager.clearAll();
    }

    // ==================== DESTROY ====================

    public destroy(): void {
        // ✅ One line removes ALL event listeners
        this.abortController?.abort();
        this.abortController = null;

        this.itemsLegend.destroy();
        this.paneManager.destroy();
        this.mainLegend.destroy();
        removeElement(this.legendContainer);
        this.legendContainer   = null;
        this.mainItemContainer = null;
        this.collapsed         = false;
    }
}