// ================================================================
// 🎨 DRAWING TRADE ARROWS - Trade arrow placement + management
// ================================================================

export class DrawingTradeArrows {
    public showBuyArrows:  boolean = true;
    public showSellArrows: boolean = true;

    public defaultBuyArrowColor:  string = '#238636';
    public defaultSellArrowColor: string = '#da3633';

    private abortController: AbortController = new AbortController();

    constructor(
        private lineTools:            () => any,
        private isInitialized:        () => boolean,
        private loadAndRegisterGroup: (group: string) => Promise<void>
    ) {
        this.setupSettingsListeners();
    }

    // ==================== SETTINGS LISTENERS ====================

    private setupSettingsListeners(): void {
        const { signal } = this.abortController;

        document.addEventListener('chart-arrow-priceline-change', (e: Event) => {
            const { priceLine } = (e as CustomEvent).detail as { priceLine: 'hover' | 'always' };
            const lt = this.lineTools();
            if (!lt || !this.isInitialized()) return;

            try {
                const json  = lt.exportLineTools();
                const tools = JSON.parse(json);
                if (!Array.isArray(tools)) return;

                tools.forEach((tool: any) => {
                    if (tool.toolType !== 'TradeArrow') return;
                    lt.applyLineToolOptions({
                        id:       tool.id,
                        toolType: 'TradeArrow',
                        options:  { arrow: { priceLine } },
                    });
                });
            } catch (error) {
                console.error('❌ Failed to update arrow price line mode:', error);
            }
        }, { signal });

        document.addEventListener('chart-arrow-color-change', (e: Event) => {
            const { type, color } = (e as CustomEvent).detail as { type: 'buy' | 'sell'; color: string };
            const lt = this.lineTools();
            if (!lt || !this.isInitialized()) return;

            if (type === 'buy')  this.defaultBuyArrowColor  = color;
            if (type === 'sell') this.defaultSellArrowColor = color;

            try {
                const json  = lt.exportLineTools();
                const tools = JSON.parse(json);
                if (!Array.isArray(tools)) return;

                tools.forEach((tool: any) => {
                    if (tool.toolType !== 'TradeArrow') return;
                    if (tool.options?.arrow?.type !== type) return;
                    lt.applyLineToolOptions({
                        id:       tool.id,
                        toolType: 'TradeArrow',
                        options:  { arrow: { color } },
                    });
                });
            } catch (error) {
                console.error('❌ Failed to update arrow color:', error);
            }
        }, { signal });
    }

    // ==================== PLACE ====================

    public async placeTradeArrow(params: {
        id:          string;
        type:        'buy' | 'sell';
        timestamp:   number;
        price:       number;
        priceLabel:  string;
        color?:      string;
        priceLine?:  'hover' | 'always';
    }): Promise<void> {
        const lt = this.lineTools();
        if (!lt || !this.isInitialized()) return;

        if (params.type === 'buy'  && !this.showBuyArrows)  return;
        if (params.type === 'sell' && !this.showSellArrows) return;

        try {
            await this.loadAndRegisterGroup('signals');

            const color = params.color ?? (
                params.type === 'buy'
                    ? this.defaultBuyArrowColor
                    : this.defaultSellArrowColor
            );

            lt.createOrUpdateLineTool(
                'TradeArrow',
                [{ timestamp: params.timestamp, price: params.price }],
                {
                    arrow: {
                        type:       params.type,
                        color,
                        size:       10,
                        stemHeight: 20,
                        priceLine:  params.priceLine ?? 'hover',
                        priceLabel: params.priceLabel,
                    },
                },
                params.id
            );

            console.log(`✅ Trade arrow placed: ${params.type} @ ${params.priceLabel}`);

        } catch (error) {
            console.error('❌ Failed to place trade arrow:', error);
        }
    }

    // ==================== REMOVE ====================

    public removeTradeArrows(type?: 'buy' | 'sell'): void {
        const lt = this.lineTools();
        if (!lt || !this.isInitialized()) return;
        try {
            if (typeof lt.removeLineToolsByIdRegex === 'function') {
                const pattern = type
                    ? new RegExp(`^trade-arrow-${type}`)
                    : /^trade-arrow/;
                lt.removeLineToolsByIdRegex(pattern);
            }
        } catch (error) {
            console.error('❌ Failed to remove trade arrows:', error);
        }
    }

    // ==================== DESTROY ====================

    public destroy(): void {
        this.abortController.abort();
    }
}
