// ================================================================
// 📏 CONTEXT MENU CONTROLLER
// ================================================================

export class ChartContextMenu {
    private menuElement: HTMLElement | null = null;
    private chartContainer: HTMLElement | null = null;
    private isVisible: boolean = false;

    // ✅ Stored bound refs for cleanup
    private boundHandleRightClick: (e: MouseEvent) => void;
    private boundHandleOutsideClick: (e: MouseEvent) => void;
    private boundHandleKeyDown: (e: KeyboardEvent) => void;

    constructor() {
        console.log("📏 Chart Context Menu Initialized");
        this.boundHandleRightClick = this.handleRightClick.bind(this);
        this.boundHandleOutsideClick = this.handleOutsideClick.bind(this);
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
        this.initialize();
    }

    // ==================== INITIALIZATION ====================

    // ✅ No retry needed — chart-core creates this after onChartReady()
    // so #tvChart is guaranteed to exist
    private initialize(): void {
        this.chartContainer = document.getElementById('tvChart');
        if (!this.chartContainer) {
            console.error('❌ Chart container #tvChart not found');
            return;
        }
        this.setupContextMenu();
        console.log("✅ Context menu ready");
    }

    // ==================== CONTEXT MENU SETUP ====================

    private setupContextMenu(): void {
        this.chartContainer!.addEventListener('contextmenu', this.boundHandleRightClick);
        document.addEventListener('click', this.boundHandleOutsideClick);
        document.addEventListener('keydown', this.boundHandleKeyDown);
    }

    private handleRightClick(e: MouseEvent): void {
        e.preventDefault();
        e.stopPropagation();
        this.showMenu(e.clientX, e.clientY);
    }

    private showMenu(x: number, y: number): void {
        this.hideMenu();

        this.menuElement = document.createElement('div');
        this.menuElement.className = 'chart-context-menu';
        this.menuElement.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            z-index: 10000;
        `;

        this.menuElement.innerHTML = this.buildMenuHTML();
        document.body.appendChild(this.menuElement);
        this.isVisible = true;
        this.adjustMenuPosition();
        this.attachMenuHandlers();
    }

    // ==================== MENU HTML ====================

    private buildMenuHTML(): string {
        return `
            <div class="context-menu-content">
                <div class="menu-subheader">⚡ Chart Actions</div>
                <div class="menu-separator"></div>

                <div class="menu-item" data-action="reset">
                    <span class="menu-icon">↻</span>
                    <span class="menu-label">Reset Chart</span>
                </div>

                <div class="menu-item" data-action="download">
                    <span class="menu-icon">📥</span>
                    <span class="menu-label">Download Chart</span>
                </div>

                <div class="menu-separator"></div>

                <div class="menu-item" data-action="settings">
                    <span class="menu-icon"><i class="fas fa-sliders"></i></span>
                    <span class="menu-label">Settings</span>
                </div>

                <div class="menu-separator"></div>

                <div class="menu-item" data-action="fullscreen">
                    <span class="menu-icon"><i class="fas fa-expand"></i></span>
                    <span class="menu-label">Fullscreen <span class="menu-shortcut">F</span></span>
                </div>
            </div>
        `;
    }

    // ==================== MENU HANDLERS ====================

    private attachMenuHandlers(): void {
        if (!this.menuElement) return;

        const items = this.menuElement.querySelectorAll('.menu-item');
        items.forEach(item => {
            item.addEventListener('click', (e: Event) => {
                e.stopPropagation();
                const action = (item as HTMLElement).dataset.action;
                this.handleAction(action || '');
                this.hideMenu();
            });
        });
    }

    private handleAction(action: string): void {
        switch (action) {
            case 'reset':
                document.dispatchEvent(new CustomEvent('chart-reset-request'));
                break;
            case 'download':
                document.dispatchEvent(new CustomEvent('chart-download-request'));
                break;
            case 'settings':
                document.dispatchEvent(new CustomEvent('chart-settings-modal-request'));
                break;
            case 'fullscreen':
                // ✅ Routes through chart-core — no duplicate fullscreen logic
                document.dispatchEvent(new CustomEvent('hotkey-global-action', {
                    detail: { action: 'fullscreen' }
                }));
                break;
        }
    }

    // ==================== MENU POSITIONING ====================

    private adjustMenuPosition(): void {
        if (!this.menuElement) return;

        const rect = this.menuElement.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        let left = parseFloat(this.menuElement.style.left);
        let top = parseFloat(this.menuElement.style.top);

        if (left + rect.width > windowWidth - 10) left = windowWidth - rect.width - 10;
        if (top + rect.height > windowHeight - 10) top = windowHeight - rect.height - 10;
        if (left < 10) left = 10;
        if (top < 10) top = 10;

        this.menuElement.style.left = `${left}px`;
        this.menuElement.style.top = `${top}px`;
    }

    // ==================== MENU VISIBILITY ====================

    private handleOutsideClick(e: MouseEvent): void {
        if (
            this.isVisible &&
            this.menuElement &&
            !this.menuElement.contains(e.target as Node)
        ) {
            this.hideMenu();
        }
    }

    private handleKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Escape' && this.isVisible) {
            this.hideMenu();
        }
    }

    private hideMenu(): void {
        if (this.menuElement && document.body.contains(this.menuElement)) {
            document.body.removeChild(this.menuElement);
        }
        this.menuElement = null;
        this.isVisible = false;
    }

    // ==================== DESTROY ====================

    public destroy(): void {
        this.hideMenu();

        if (this.chartContainer) {
            this.chartContainer.removeEventListener('contextmenu', this.boundHandleRightClick);
        }
        document.removeEventListener('click', this.boundHandleOutsideClick);
        document.removeEventListener('keydown', this.boundHandleKeyDown);

        console.log('♻️ Context menu destroyed');
    }
}