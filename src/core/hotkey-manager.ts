// ================================================================
// ⚡ HOTKEY MANAGER - Global Keyboard Shortcut Management
// ================================================================

export class HotkeyManager {
    private enabled: boolean = true;
    private cooldown: { [key: string]: number } = {};
    private journalCooldown: number = 0;
    private readonly COOLDOWN_MS = 100;
    private readonly JOURNAL_COOLDOWN_MS = 500;

    constructor() {
        console.log("⌨️ Hotkey Manager Initialized");
    }

    public initialize(): void {
        this.setupHotkeyListeners();
        console.log("✅ Global hotkeys ready");
    }

    public enable(): void {
        this.enabled = true;
    }

    public disable(): void {
        this.enabled = false;
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    private setupHotkeyListeners(): void {
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (!this.enabled) return;
            if (this.isInputElement(e.target as HTMLElement)) return;
            if (e.repeat) return;

            const combo = this.getKeyCombo(e);
            if (this.isOnCooldown(combo)) return;
            this.cooldown[combo] = Date.now();

            if (this.handleHotkey(combo)) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }

    private handleHotkey(combo: string): boolean {
        const keyMap: { [key: string]: () => void } = {

            // ==================== PANEL SWITCHING ====================
            '1': () => this.dispatchPanelSwitch('trading'),
            '2': () => this.dispatchPanelSwitch('watchlist'),
            '3': () => this.dispatchPanelSwitch('calendar'),
            '4': () => this.dispatchPanelSwitch('alerts'),

            // ==================== MODALS ====================
            'j': () => {
                if (this.isJournalOnCooldown()) return;
                this.setJournalCooldown();
                document.dispatchEvent(new CustomEvent('open-tab', {
                    detail: { tab: 'journal' }
                }));
            },
            's':   () => this.dispatchModalToggle('strategies'),
            'n':   () => this.dispatchModalToggle('notification'),
            'p':   () => this.dispatchGlobalAction('open-positions-modal'),
            ',':   () => this.dispatchGlobalAction('open-settings-modal'),

            // ==================== GLOBAL ACTIONS ====================
            'escape': () => this.dispatchGlobalAction('close-all-modals'),
            'f':      () => this.dispatchGlobalAction('fullscreen'),
            'r':      () => this.dispatchGlobalAction('chart-reset'),
            'd':      () => this.dispatchGlobalAction('chart-download'),

            // ==================== DRAWING TOOLS ====================
            'l': () => this.dispatchGlobalAction('lock-tools'),

            // ==================== TRADING ====================
            'ctrl+b':       () => this.dispatchTradeAction('buy'),
            'ctrl+shift+s': () => this.dispatchTradeAction('sell'),
            'alt+s':        () => this.dispatchTradeAction('sell'),
        };

        const handler = keyMap[combo];
        if (handler) {
            console.log(`⌨️ Hotkey: ${combo}`);
            handler();
            return true;
        }

        return false;
    }

    // ==================== JOURNAL COOLDOWN ====================

    private isJournalOnCooldown(): boolean {
        return (Date.now() - this.journalCooldown) < this.JOURNAL_COOLDOWN_MS;
    }

    private setJournalCooldown(): void {
        this.journalCooldown = Date.now();
        setTimeout(() => { this.journalCooldown = 0; }, this.JOURNAL_COOLDOWN_MS + 100);
    }

    // ==================== EVENT DISPATCHERS ====================

    private dispatchPanelSwitch(panelName: string): void {
        document.dispatchEvent(new CustomEvent('hotkey-panel-switch', {
            detail: { panel: panelName }
        }));
    }

    private dispatchModalToggle(modalName: string): void {
        document.dispatchEvent(new CustomEvent('hotkey-modal-toggle', {
            detail: { modal: modalName }
        }));
    }

    private dispatchGlobalAction(action: string): void {
        document.dispatchEvent(new CustomEvent('hotkey-global-action', {
            detail: { action }
        }));
    }

    private dispatchTradeAction(direction: 'buy' | 'sell'): void {
        document.dispatchEvent(new CustomEvent('hotkey-trade-action', {
            detail: { direction }
        }));
    }

    // ==================== UTILITY ====================

    private getKeyCombo(e: KeyboardEvent): string {
        const parts: string[] = [];
        if (e.ctrlKey || e.metaKey) parts.push('ctrl');
        if (e.altKey) parts.push('alt');
        if (e.shiftKey) parts.push('shift');
        if (e.key === 'Escape') return 'escape';
        if (e.key === ' ') return 'space';
        if (!this.isModifierKey(e.key)) parts.push(e.key.toLowerCase());
        return parts.join('+');
    }

    private isModifierKey(key: string): boolean {
        return ['control', 'ctrl', 'alt', 'shift', 'meta', 'os'].includes(key.toLowerCase());
    }

    private isInputElement(element: HTMLElement): boolean {
        if (!element) return false;
        const tag = element.tagName.toLowerCase();
        return ['input', 'textarea', 'select'].includes(tag) || element.isContentEditable;
    }

    private isOnCooldown(combo: string): boolean {
        const lastTime = this.cooldown[combo];
        if (!lastTime) return false;
        return (Date.now() - lastTime) < this.COOLDOWN_MS;
    }
}