//notification/notification.ts
// 🔔 NOTIFICATION UI - User Interface Controls for Notifications
// ================================================================

// ✅ Import INTERFACE only (not the concrete class!)
import { INotificationModule } from './notification-types';

export class NotificationUI {
    // ✅ Use interface instead of concrete class
    private notificationModule: INotificationModule;

    // DOM Elements
    private modal: HTMLElement | null = null;
    private bell: HTMLElement | null = null;
    private badge: HTMLElement | null = null;
    private clearBtn: HTMLElement | null = null;
    private closeBtn: HTMLElement | null = null;
    private notificationList: HTMLElement | null = null;

    // ✅ Constructor accepts interface, not concrete class
    constructor(notificationModule: INotificationModule) {
        console.log("🎮 Notification UI Initialized");
        this.notificationModule = notificationModule;
    }

    // ==================== INITIALIZATION ====================

    public initialize(): void {
        console.log("🖱️ Setting up notification UI controls...");

        this.setupDOMReferences();
        this.setupEventHandlers();
        this.setupHotkeyListener();

        console.log("✅ Notification UI ready");
    }

    public destroy(): void {
        // Remove event listeners
        if (this.bell) {
            this.bell.onclick = null;
        }

        if (this.clearBtn) {
            this.clearBtn.replaceWith(this.clearBtn.cloneNode(true));
        }

        if (this.closeBtn) {
            this.closeBtn.replaceWith(this.closeBtn.cloneNode(true));
        }

        // Null all references
        this.modal = null;
        this.bell = null;
        this.badge = null;
        this.clearBtn = null;
        this.closeBtn = null;
        this.notificationList = null;

        console.log('✅ NotificationUI destroyed');
    }

    // ==================== DOM REFERENCES ====================

    private setupDOMReferences(): void {
        this.modal = document.getElementById('notificationModal');
        this.bell = document.getElementById('notificationBell');
        this.badge = document.getElementById('alertCount');
        this.clearBtn = document.getElementById('clearNotifications');
        this.closeBtn = document.querySelector('.close-notifications');
        this.notificationList = document.getElementById('notificationList');

        console.log("🔍 Notification DOM references:", {
            modal: !!this.modal,
            bell: !!this.bell,
            badge: !!this.badge,
            clearBtn: !!this.clearBtn,
            closeBtn: !!this.closeBtn,
            notificationList: !!this.notificationList
        });
    }

    // ==================== HOTKEY INTEGRATION ====================

    private setupHotkeyListener(): void {
        document.addEventListener('hotkey-modal-toggle', (e: Event) => {
            const customEvent = e as CustomEvent<{ modal: string }>;
            if (customEvent.detail?.modal === 'notification') {
                console.log('⌨️ Hotkey N: Toggle notification modal');
                this.toggleModal();
            }
        });

        console.log("✅ Hotkey integration ready (N key toggles notification modal)");
    }

    // ==================== EVENT HANDLERS ====================

    private setupEventHandlers(): void {
        console.log("🔗 Setting up notification event handlers...");

        // Notification bell click
        if (this.bell) {
            this.bell.onclick = (e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("🔔 Bell clicked");
                this.showModalFromClick();
            };
            console.log("✅ Notification bell handler attached");
        } else {
            console.warn("⚠️ Notification bell element not found - ID: 'notificationBell'");
        }

        // Clear all notifications button
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', (e: Event) => {
                e.preventDefault();
                this.clearAllNotifications();
            });
        }

        // Close modal button
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', (e: Event) => {
                e.preventDefault();
                this.hideModal();
            });
        }

        // Close modal when clicking outside
        document.addEventListener('click', (e: Event) => {
            this.handleOutsideClick(e as MouseEvent);
        });

        // Close modal on escape key
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Escape' && this.isModalVisible()) {
                this.hideModal();
            }
        });

        console.log("✅ Notification event handlers setup complete");
    }

    // ==================== MODAL CONTROLS ====================

    public toggleModal(): void {
        console.log("🔔 Notification UI toggleModal() called");

        if (!this.modal) {
            console.warn("⚠️ Modal element not found");
            return;
        }

        if (this.isModalVisible()) {
            this.hideModal();
        } else {
            this.showModalFromClick();
        }
    }

    private showModalFromClick(): void {
        if (!this.modal) return;

        this.closeAllModals();
        this.modal.style.display = 'block';

        // ✅ Use interface method (no type casting needed!)
        this.notificationModule.updateNotificationList();

        console.log("📱 Notification modal opened");
    }

    public showModal(): void {
        this.showModalFromClick();
    }

    public hideModal(): void {
        if (!this.modal) return;

        this.modal.style.display = 'none';
        console.log("📱 Notification modal closed");
    }

    private isModalVisible(): boolean {
        return this.modal ? this.modal.style.display === 'block' : false;
    }

    // ==================== NOTIFICATION CONTROLS ====================

    private clearAllNotifications(): void {
        // ✅ Use interface method directly (no type casting!)
        this.notificationModule.clearAll();
    }

    // ==================== OUTSIDE CLICK HANDLER ====================

    private handleOutsideClick(e: MouseEvent): void {
        // Check if full-screen modals are active first
        const journalOverlay = document.getElementById('fullJournalOverlay');
        if (journalOverlay && journalOverlay.classList.contains('active')) return;

        // Handle notification modal
        if (this.modal && this.isModalVisible()) {
            const target = e.target as Element;
            const clickedInsideModal = this.modal.contains(target);

            if (!clickedInsideModal) {
                this.hideModal();
            }
        }
    }

    // ==================== MODAL MANAGEMENT ====================

    public closeAllModals(): void {
        [
            'notificationModal',
            'strategiesModal',
            'fullJournalOverlay',
            'fullHeatmapOverlay',
            'journal-trade-modal'
        ].forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.style.display = 'none';
                modal.classList.remove('active');
            }
        });

        console.log("📱 Closed all modals from NotificationUI");
    }

    // ==================== BADGE UPDATES ====================

    public updateBadgeCount(count: number): void {
        if (this.badge) {
            this.badge.textContent = count > 99 ? '99+' : count.toString();
            this.badge.style.display = count > 0 ? 'block' : 'none';
        }

        if (this.bell) {
            if (count > 0) {
                this.bell.classList.add('has-notifications');
            } else {
                this.bell.classList.remove('has-notifications');
            }
        }
    }

    // ==================== PUBLIC API ====================

    public getModalElement(): HTMLElement | null {
        return this.modal;
    }

    public getBellElement(): HTMLElement | null {
        return this.bell;
    }

    public isBellAvailable(): boolean {
        return !!this.bell;
    }
}