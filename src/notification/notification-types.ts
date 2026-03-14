// notification/notification-types.ts
// ✅ Shared types - no imports from either file

// ==================== CORE INTERFACES ====================

export interface NotificationOptions {
    title?: string;
    type?: 'success' | 'error' | 'warning' | 'info';
    duration?: number;
    persistent?: boolean;
    html?: boolean;
    sound?: boolean;
    browserNotification?: boolean;
    action?: NotificationAction;
    data?: any;
}

export interface NotificationAction {
    label?: string;
    callback?: (data?: any) => void;
}

export interface ToastNotification {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    title: string;
    timestamp: number;
    read: boolean;
    persistent: boolean;
    action: NotificationAction | null;
    data: any;
}

export interface TradeData {
    direction: 'LONG' | 'SELL';
    symbol: string;
    volume: number;
    entry_price: number;
    pnl?: number;
    [key: string]: any;
}

export interface AlertData {
    symbol: string;
    condition: string;
    price: number;
    [key: string]: any;
}

// ==================== MODULE CONTRACTS ====================

/**
 * What NotificationUI needs from NotificationModule
 * NotificationUI imports THIS interface only (not the class)
 * This breaks the circular dependency
 */
export interface INotificationModule {
    updateNotificationList(): void;
    markAsRead(id: string): void;
    markAllAsRead(): void;
    clearAll(): void;
    clearRead(): void;
    getUnread(): ToastNotification[];
    getRecent(count: number): ToastNotification[];
    getStats(): {
        total: number;
        unread: number;
        read: number;
        types: { [key: string]: number };
    };
}

/**
 * What NotificationModule needs from NotificationUI
 * NotificationModule imports THIS interface only (not the class)
 * This breaks the circular dependency
 */
export interface INotificationUI {
    initialize(): void;
    destroy(): void;
    updateBadgeCount(count: number): void;
    showModal(): void;
    hideModal(): void;
    toggleModal(): void;
    closeAllModals(): void;
}