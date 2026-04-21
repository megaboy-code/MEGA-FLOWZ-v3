// notification/notification.ts
// 🔔 NOTIFICATION MODULE - Toast & Alert System (TypeScript)

import {
    NotificationOptions,
    NotificationAction,
    ToastNotification,
    TradeData,
    AlertData,
    INotificationUI
} from './notification-types';

import { NotificationPayload } from '../generated/MegaFlowzDecoder';

const TPSL_DEFAULT_PIPS = 20;

export class NotificationModule {
    private notifications: ToastNotification[] = [];
    private unreadCount: number = 0;
    private audioEnabled: boolean = false;
    private maxNotifications: number = 50;
    private activeToastTimeouts: Map<string, any> = new Map();
    private ui: INotificationUI | null = null;
    private sounds: { [key: string]: () => void } = {};
    private toastContainer: HTMLElement | null = null;

    constructor() {
        console.log("🔔 Notification Module Initialized");
        this.sounds = {
            success: this.createSound(800, 1000),
            error:   this.createSound(400, 600, 0.2),
            warning: this.createSound(600, 800, 0.15),
            info:    this.createSound(500, 700, 0.1)
        };
    }

    // ================================================================
    // UI INJECTION
    // ================================================================

    public setUI(ui: INotificationUI): void {
        this.ui = ui;
        console.log('✅ NotificationUI injected into NotificationModule');
    }

    // ================================================================
    // INITIALIZATION
    // ================================================================

    public initialize(): void {
        console.log("🔄 Initializing Notification Module...");

        if (!this.ui) {
            console.error('❌ UI not set! Call setUI() before initialize()');
            return;
        }

        this.ui.initialize();
        this.setupToastContainer();
        this.setupSoundToggle();
        this.setupMarkAllRead();
        this.loadNotifications();
        this.updateBadge();
        this.requestNotificationPermission();

        console.log("✅ Notification Module Ready");
    }

    // ================================================================
    // TOAST CONTAINER
    // ================================================================

    private setupToastContainer(): void {
        this.toastContainer = document.getElementById('notificationToastContainer');

        if (!this.toastContainer) {
            this.toastContainer = document.createElement('div');
            this.toastContainer.className = 'notification-toast-container';
            this.toastContainer.id = 'notificationToastContainer';
            document.body.appendChild(this.toastContainer);
        }

        console.log('✅ Toast container ready');
    }

    // ================================================================
    // SOUND TOGGLE
    // ================================================================

    private setupSoundToggle(): void {
        const soundToggle = document.getElementById('notificationSoundToggle');
        if (!soundToggle) return;

        const saved = localStorage.getItem('notificationSoundEnabled');
        if (saved === 'true') {
            this.audioEnabled = true;
            soundToggle.classList.add('active');
            soundToggle.querySelector('i')?.classList.replace('fa-volume-xmark', 'fa-volume-high');
        }

        soundToggle.addEventListener('click', () => {
            this.audioEnabled = !this.audioEnabled;
            localStorage.setItem('notificationSoundEnabled', this.audioEnabled.toString());

            const icon = soundToggle.querySelector('i');
            if (this.audioEnabled) {
                soundToggle.classList.add('active');
                icon?.classList.replace('fa-volume-xmark', 'fa-volume-high');
            } else {
                soundToggle.classList.remove('active');
                icon?.classList.replace('fa-volume-high', 'fa-volume-xmark');
            }
        });
    }

    // ================================================================
    // MARK ALL READ
    // ================================================================

    private setupMarkAllRead(): void {
        const btn = document.getElementById('markAllRead');
        if (!btn) return;
        btn.addEventListener('click', () => this.markAllAsRead());
    }

    // ================================================================
    // FLATBUFFER NOTIFICATION HANDLER
    // ================================================================

    public notify(data: NotificationPayload): void {
        const severityMap: Record<number, 'success' | 'error' | 'warning' | 'info'> = {
            0: 'success',
            1: 'warning',
            2: 'error',
            3: 'info'
        };

        const type          = severityMap[data.severity as number] ?? 'info';
        const directionStr  = data.direction ?? '';
        const isBuy         = directionStr === 'BUY';
        const isSell        = directionStr === 'SELL';
        const isTrade       = (isBuy || isSell) && !!data.symbol;

        // ── Build structured data object instead of plain string ──
        const structuredData: Record<string, any> = {
            _rich: true,
            direction: directionStr,
            symbol:    data.symbol    ?? '',
            volume:    data.volume    ?? null,
            price:     data.price     ?? null,
            openPrice: data.open_price && data.open_price > 0 ? data.open_price : null,
            profit:    data.profit    ?? null,
            isTrade,
        };

        this.show(
            JSON.stringify(structuredData),
            type,
            5000,
            { title: data.title || this.getDefaultTitle(type) }
        );
    }

    // ================================================================
    // NOTIFICATION CREATION
    // ================================================================

    public show(
        message: string,
        type: 'success' | 'error' | 'warning' | 'info' = 'info',
        duration: number = 5000,
        options: NotificationOptions = {}
    ): string {

        const now = Date.now();
        const isDuplicate = this.notifications.some(n =>
            n.message === message &&
            n.type    === type &&
            (now - n.timestamp) < 2000
        );

        if (isDuplicate) return '';

        const notification: ToastNotification = {
            id:         Date.now() + Math.random().toString(36).substr(2, 9),
            type,
            message,
            title:      options.title || this.getDefaultTitle(type),
            timestamp:  Date.now(),
            read:       false,
            persistent: options.persistent || false,
            action:     options.action     || null,
            data:       options.data       || {}
        };

        this.notifications.unshift(notification);

        if (this.notifications.length > this.maxNotifications) {
            this.notifications = this.notifications.slice(0, this.maxNotifications);
        }

        this.updateUnreadCount();
        this.ui?.updateBadgeCount(this.unreadCount);
        this.updateNotificationList();
        this.showToast(notification, duration);

        if (this.audioEnabled && options.sound !== false) {
            this.playSound(type);
        }

        if (options.browserNotification !== false && document.hidden) {
            this.showBrowserNotification(notification);
        }

        this.saveNotifications();

        return notification.id;
    }

    // ================================================================
    // PARSE RICH DATA
    // ================================================================

    private parseMessage(message: string): Record<string, any> | null {
        try {
            const parsed = JSON.parse(message);
            if (parsed._rich) return parsed;
        } catch {}
        return null;
    }

    // ================================================================
    // BUILD TOAST HTML
    // ================================================================

    private buildToastBodyHTML(notification: ToastNotification): string {
        const rich = this.parseMessage(notification.message);

        // ── Rich trade data ──
        if (rich && rich.isTrade) {
            const isBuy     = rich.direction === 'BUY';
            const dirClass  = isBuy ? 'buy' : 'sell';
            const dirIcon   = isBuy ? 'fa-arrow-up' : 'fa-arrow-down';
            const hasProfit = rich.profit !== null && rich.profit !== undefined;
            const isProfit  = hasProfit && rich.profit >= 0;
            const pnlClass  = isProfit ? 'profit' : 'loss';
            const pnlSign   = isProfit ? '+' : '-';
            const pnlAbs    = hasProfit ? Math.abs(rich.profit).toFixed(2) : '0.00';

            const isClose   = notification.title === 'Position Closed' || notification.title === 'Trade Closed';
            const isOpen    = notification.title === 'Trade Executed';

            let detailHTML = '';

            if (isOpen) {
                detailHTML = `
                    <div class="toast-detail-row">
                        <div class="toast-detail-item">
                            <span class="toast-detail-label">Entry</span>
                            <span class="toast-detail-value">${rich.price?.toFixed(rich.symbol?.includes('JPY') ? 3 : 5) ?? '—'}</span>
                        </div>
                        ${rich.openPrice ? `
                        <div class="toast-detail-divider"></div>
                        <div class="toast-detail-item">
                            <span class="toast-detail-label">Open</span>
                            <span class="toast-detail-value">${rich.openPrice.toFixed(rich.symbol?.includes('JPY') ? 3 : 5)}</span>
                        </div>` : ''}
                    </div>
                `;
            }

            if (isClose && rich.openPrice) {
                detailHTML = `
                    <div class="toast-detail-row">
                        <div class="toast-detail-item">
                            <span class="toast-detail-label">Entry</span>
                            <span class="toast-detail-value">${rich.openPrice.toFixed(rich.symbol?.includes('JPY') ? 3 : 5)}</span>
                        </div>
                        <div class="toast-detail-divider"></div>
                        <div class="toast-detail-item">
                            <span class="toast-detail-label">Close</span>
                            <span class="toast-detail-value">${rich.price?.toFixed(rich.symbol?.includes('JPY') ? 3 : 5) ?? '—'}</span>
                        </div>
                    </div>
                `;
            }

            const pnlHTML = hasProfit ? `
                <div class="toast-pnl-row">
                    <span class="toast-pnl-label">P / L</span>
                    <span class="toast-pnl-value ${pnlClass}">${pnlSign}$${pnlAbs}</span>
                </div>
            ` : '';

            const actionsHTML = isOpen ? `
                <div class="toast-actions">
                    <button class="toast-btn primary" onclick="void(0)">
                        <i class="fas fa-table-list"></i> View Position
                    </button>
                    <button class="toast-btn ghost toast-dismiss-btn">Dismiss</button>
                </div>
            ` : isClose ? `
                <div class="toast-actions">
                    <button class="toast-btn primary" onclick="void(0)">
                        <i class="fas fa-book"></i> Add to Journal
                    </button>
                    <button class="toast-btn ghost toast-dismiss-btn">Dismiss</button>
                </div>
            ` : '';

            return `
                <div class="toast-trade-row">
                    <span class="dir-badge ${dirClass}">
                        <i class="fas ${dirIcon}"></i> ${rich.direction}
                    </span>
                    <span class="toast-symbol">${rich.symbol}</span>
                    <span class="toast-volume">${rich.volume?.toFixed(2) ?? '—'} Lots</span>
                </div>
                ${detailHTML}
                ${pnlHTML}
                ${actionsHTML}
            `;
        }

        // ── Plain message fallback ──
        return `<div class="toast-message">${notification.message}</div>`;
    }

    // ================================================================
    // BUILD NOTIFICATION LIST ITEM HTML
    // ================================================================

    private buildNotifItemHTML(notification: ToastNotification): string {
        const rich      = this.parseMessage(notification.message);
        const timeAgo   = this.formatTimeAgo(notification.timestamp);
        const readClass = notification.read ? 'read' : 'unread';
        const icon      = this.getIcon(notification.type);
        const iconClass = this.getIconClass(notification);

        let bodyHTML = '';

        if (rich && rich.isTrade) {
            const isBuy    = rich.direction === 'BUY';
            const dirClass = isBuy ? 'buy' : 'sell';
            const dirIcon  = isBuy ? 'fa-arrow-up' : 'fa-arrow-down';

            const hasProfit = rich.profit !== null && rich.profit !== undefined;
            const isProfit  = hasProfit && rich.profit >= 0;
            const pnlClass  = isProfit ? 'profit' : 'loss';
            const pnlSign   = isProfit ? '+' : '-';
            const pnlAbs    = hasProfit ? Math.abs(rich.profit).toFixed(2) : '0.00';
            const decimals  = rich.symbol?.includes('JPY') ? 3 : 5;

            const isClose = notification.title === 'Position Closed' || notification.title === 'Trade Closed';

            const detailLine = isClose && rich.openPrice
                ? `Entry <span>${rich.openPrice.toFixed(decimals)}</span> → Close <span>${rich.price?.toFixed(decimals) ?? '—'}</span>`
                : `@ <span>${rich.price?.toFixed(decimals) ?? '—'}</span>`;

            const pnlHTML = hasProfit ? `
                <div class="notif-pnl-row">
                    <span class="notif-pnl-value ${pnlClass}">${pnlSign}$${pnlAbs}</span>
                </div>
            ` : '';

            bodyHTML = `
                <div class="notif-trade-row">
                    <span class="dir-badge ${dirClass}">
                        <i class="fas ${dirIcon}"></i> ${rich.direction}
                    </span>
                    <span class="notif-symbol">${rich.symbol}</span>
                    <span class="notif-volume">${rich.volume?.toFixed(2) ?? '—'} Lots</span>
                </div>
                <div class="notif-detail-line">${detailLine}</div>
                ${pnlHTML}
            `;
        } else {
            bodyHTML = `<div class="notif-detail-line">${notification.message}</div>`;
        }

        return `
            <div class="notification-item ${notification.type} ${readClass}" data-id="${notification.id}">
                <div class="notif-icon ${iconClass}">
                    <i class="fas fa-${icon}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-item-top">
                        <div class="notification-title">${this.escapeHtml(notification.title)}</div>
                        <div class="notification-time">${timeAgo}</div>
                    </div>
                    ${bodyHTML}
                </div>
                <div class="notification-actions">
                    <button class="notification-mark-read" data-id="${notification.id}" title="Mark read">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="notification-dismiss" data-id="${notification.id}" title="Dismiss">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // ================================================================
    // SHOW TOAST
    // ================================================================

    private showToast(notification: ToastNotification, duration: number): void {
        if (!this.toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `notification-toast ${notification.type}`;
        toast.id        = `toast-${notification.id}`;

        const icon     = this.getIcon(notification.type);
        const subtitle = this.getSubtitle(notification);
        const bodyHTML = this.buildToastBodyHTML(notification);

        toast.innerHTML = `
            <div class="toast-header">
                <div class="toast-icon"><i class="fas fa-${icon}"></i></div>
                <div class="toast-header-text">
                    <div class="toast-title">${notification.title}</div>
                    ${subtitle ? `<div class="toast-subtitle">${subtitle}</div>` : ''}
                </div>
                <button class="toast-close-btn" data-notification-id="${notification.id}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="toast-body">
                ${bodyHTML}
            </div>
            <div class="toast-progress">
                <div class="toast-progress-fill"></div>
            </div>
        `;

        this.toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);

        if (!notification.persistent) {
            const timeoutId = setTimeout(() => {
                this.removeToast(notification.id);
            }, duration) as any;
            this.activeToastTimeouts.set(notification.id, timeoutId);
        }

        toast.querySelector('.toast-close-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeToast(notification.id);
        });

        toast.querySelector('.toast-dismiss-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeToast(notification.id);
        });

        toast.addEventListener('click', (e) => {
            if (
                !(e.target as Element).closest('.toast-close-btn') &&
                !(e.target as Element).closest('.toast-dismiss-btn') &&
                !(e.target as Element).closest('.toast-btn')
            ) {
                this.ui?.showModal();
                this.markAsRead(notification.id);
            }
        });
    }

    private getSubtitle(notification: ToastNotification): string {
        const rich = this.parseMessage(notification.message);
        if (!rich) return '';

        if (notification.title === 'Trade Executed')  return 'Market order filled';
        if (notification.title === 'Position Closed') {
            const hasProfit = rich.profit !== null && rich.profit !== undefined;
            if (!hasProfit) return 'Position closed';
            return rich.profit >= 0 ? 'Take profit hit' : 'Stop loss hit';
        }
        return '';
    }

    private removeToast(id: string): void {
        const toast = document.getElementById(`toast-${id}`);
        if (toast) {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }

        const timeoutId = this.activeToastTimeouts.get(id);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.activeToastTimeouts.delete(id);
        }
    }

    private removeNotification(id: string): void {
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.updateUnreadCount();
        this.ui?.updateBadgeCount(this.unreadCount);
        this.updateNotificationList();
        this.removeToast(id);
        this.saveNotifications();
    }

    // ================================================================
    // NOTIFICATION TYPES
    // ================================================================

    public success(message: string, options: NotificationOptions = {}): string {
        return this.show(message, 'success', 4000, { title: 'Success', ...options });
    }

    public error(message: string, options: NotificationOptions = {}): string {
        return this.show(message, 'error', 6000, { title: 'Error', persistent: false, ...options });
    }

    public warning(message: string, options: NotificationOptions = {}): string {
        return this.show(message, 'warning', 5000, { title: 'Warning', ...options });
    }

    public info(message: string, options: NotificationOptions = {}): string {
        return this.show(message, 'info', 4000, { title: 'Information', ...options });
    }

    public tradeExecuted(tradeData: TradeData): string {
        const isBuy = tradeData.direction === 'LONG';
        const structuredData = JSON.stringify({
            _rich:     true,
            direction: isBuy ? 'BUY' : 'SELL',
            symbol:    tradeData.symbol,
            volume:    tradeData.volume,
            price:     tradeData.entry_price,
            openPrice: null,
            profit:    tradeData.pnl ?? null,
            isTrade:   true,
        });

        return this.show(structuredData, 'success', 5000, { title: 'Trade Executed' });
    }

    public priceAlert(alertData: AlertData): string {
        return this.show(
            `${alertData.symbol} ${alertData.condition} ${alertData.price}`,
            'warning',
            6000,
            {
                title:               'Price Alert Triggered',
                persistent:          true,
                sound:               true,
                browserNotification: true,
                action: {
                    label:    'View Chart',
                    callback: () => this.openChart(alertData.symbol)
                }
            }
        );
    }

    public systemAlert(
        title: string,
        message: string,
        type: 'success' | 'error' | 'warning' | 'info' = 'info'
    ): string {
        return this.show(message, type, 5000, {
            title,
            persistent: type === 'error',
            sound:      type === 'error'
        });
    }

    // ================================================================
    // NOTIFICATION MANAGEMENT
    // ================================================================

    public markAsRead(id: string): void {
        const notification = this.notifications.find(n => n.id === id);
        if (notification && !notification.read) {
            notification.read = true;
            this.updateUnreadCount();
            this.ui?.updateBadgeCount(this.unreadCount);
            this.saveNotifications();
            this.updateNotificationList();
        }
    }

    public markAllAsRead(): void {
        this.notifications.forEach(n => n.read = true);
        this.unreadCount = 0;
        this.ui?.updateBadgeCount(0);
        this.saveNotifications();
        this.updateNotificationList();
    }

    public clearAll(): void {
        if (this.notifications.length === 0) return;

        this.activeToastTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.activeToastTimeouts.clear();

        this.notifications = [];
        this.unreadCount   = 0;
        this.ui?.updateBadgeCount(0);
        this.updateNotificationList();
        this.saveNotifications();

        document.querySelectorAll('.notification-toast').forEach(toast => toast.remove());
    }

    public clearRead(): void {
        this.notifications.forEach(notification => {
            if (notification.read) {
                const timeoutId = this.activeToastTimeouts.get(notification.id);
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    this.activeToastTimeouts.delete(notification.id);
                }
                this.removeToast(notification.id);
            }
        });

        this.notifications = this.notifications.filter(n => !n.read);
        this.updateUnreadCount();
        this.ui?.updateBadgeCount(this.unreadCount);
        this.updateNotificationList();
        this.saveNotifications();
    }

    public getUnread():              ToastNotification[] { return this.notifications.filter(n => !n.read); }
    public getRecent(count = 10):   ToastNotification[] { return this.notifications.slice(0, count); }

    // ================================================================
    // UI UPDATES
    // ================================================================

    public updateNotificationList(): void {
        const notificationList = document.getElementById('notificationList');
        if (!notificationList) return;

        const badge = document.getElementById('notificationBadge');
        if (badge) {
            badge.textContent    = String(this.unreadCount);
            badge.style.display  = this.unreadCount > 0 ? 'inline-flex' : 'none';
        }

        const countEl = document.querySelector('.notification-count');
        if (countEl) {
            countEl.textContent = `${this.notifications.length} total · ${this.unreadCount} unread`;
        }

        if (this.notifications.length === 0) {
            notificationList.innerHTML = `
                <div class="notification-item empty">
                    <div class="notif-icon info">
                        <i class="fas fa-bell-slash"></i>
                    </div>
                    <div class="notification-content">
                        <div class="notification-title">No notifications</div>
                        <div class="notif-detail-line">You're all caught up!</div>
                    </div>
                </div>
            `;
            return;
        }

        notificationList.innerHTML = this.notifications
            .map(n => this.buildNotifItemHTML(n))
            .join('');

        notificationList.querySelectorAll('.notification-mark-read').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                if (id) this.markAsRead(id);
            });
        });

        notificationList.querySelectorAll('.notification-dismiss').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                if (id) this.removeNotification(id);
            });
        });

        notificationList.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!(e.target as Element).closest('.notification-actions')) {
                    const id = item.getAttribute('data-id');
                    if (id) this.markAsRead(id);
                }
            });
        });
    }

    public updateBadge(): void {
        this.ui?.updateBadgeCount(this.unreadCount);
    }

    // ================================================================
    // UTILITIES
    // ================================================================

    private getDefaultTitle(type: string): string {
        const titles: { [key: string]: string } = {
            success: 'Success',
            error:   'Error',
            warning: 'Warning',
            info:    'Information'
        };
        return titles[type] || 'Notification';
    }

    private getIcon(type: string): string {
        const icons: { [key: string]: string } = {
            success: 'check',
            error:   'exclamation-circle',
            warning: 'exclamation-triangle',
            info:    'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    private getIconClass(notification: ToastNotification): string {
        const rich = this.parseMessage(notification.message);
        if (rich?.isTrade) {
            return rich.direction === 'BUY' ? 'buy' : 'sell';
        }
        return notification.type;
    }

    private escapeHtml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    private formatTimeAgo(timestamp: number): string {
        const diff = Date.now() - timestamp;
        if (diff < 60000)    return 'Just now';
        if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    private createSound(freqStart: number, freqEnd: number, duration: number = 0.1): () => void {
        return () => {
            try {
                const audioContext  = new (window.AudioContext || (window as any).webkitAudioContext)();
                const oscillator    = audioContext.createOscillator();
                const gainNode      = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.setValueAtTime(freqStart, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(freqEnd, audioContext.currentTime + duration);

                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + duration);
            } catch (error) {
                console.log('Sound not supported:', error);
            }
        };
    }

    private playSound(type: string): void {
        if (this.sounds[type]) this.sounds[type]();
    }

    private toggleSound(enabled: boolean): void {
        this.audioEnabled = enabled;
        localStorage.setItem('notificationSoundEnabled', enabled.toString());
    }

    // ================================================================
    // BROWSER NOTIFICATIONS
    // ================================================================

    private requestNotificationPermission(): void {
        if (!("Notification" in window)) return;
        if (Notification.permission === "default") {
            Notification.requestPermission().then(permission => {
                console.log("Notification permission:", permission);
            });
        }
    }

    private showBrowserNotification(notification: ToastNotification): void {
        if (!("Notification" in window)) return;
        if (Notification.permission !== "granted") return;

        const rich        = this.parseMessage(notification.message);
        const bodyText    = rich?.isTrade
            ? `${rich.direction} ${rich.symbol} ${rich.volume?.toFixed(2)}L @ ${rich.price}`
            : notification.message.replace(/<[^>]*>/g, '');

        const browserNotif = new Notification(notification.title, {
            body:              bodyText,
            icon:              '/favicon.ico',
            tag:               'megaflowz-notification',
            requireInteraction: notification.persistent || false,
            silent:            !this.audioEnabled
        });

        browserNotif.onclick = () => {
            window.focus();
            this.ui?.showModal();
            this.markAsRead(notification.id);
        };

        if (!notification.persistent) {
            setTimeout(() => browserNotif.close(), 6000);
        }
    }

    // ================================================================
    // ACTION HANDLERS
    // ================================================================

    private triggerAction(notification: ToastNotification): void {
        if (notification.action?.callback) {
            notification.action.callback(notification.data);
        }
    }

    private openTradeDetails(tradeData: TradeData): void {
        console.log('Opening trade details:', tradeData);
        if ((window as any).MegaFlowzDashboard?.showTradeDetails) {
            (window as any).MegaFlowzDashboard.showTradeDetails(tradeData);
        }
    }

    private openChart(symbol: string): void {
        console.log('Opening chart for:', symbol);
        if ((window as any).MegaFlowzDashboard?.chart) {
            (window as any).MegaFlowzDashboard.chart.switchSymbol(symbol);
        }
    }

    // ================================================================
    // PERSISTENCE
    // ================================================================

    private saveNotifications(): void {
        try {
            localStorage.setItem('megaflowz_notifications', JSON.stringify(this.notifications));
        } catch (error) {
            console.error('Failed to save notifications:', error);
        }
    }

    private loadNotifications(): void {
        try {
            const saved = localStorage.getItem('megaflowz_notifications');
            if (saved) {
                this.notifications = JSON.parse(saved);
                this.updateUnreadCount();
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    }

    private updateUnreadCount(): void {
        this.unreadCount = this.notifications.filter(n => !n.read).length;
    }

    // ================================================================
    // PUBLIC API
    // ================================================================

    public enableSound():                    void { this.toggleSound(true); }
    public disableSound():                   void { this.toggleSound(false); }
    public setMaxNotifications(max: number): void { this.maxNotifications = max; }

    public getStats() {
        return {
            total:  this.notifications.length,
            unread: this.unreadCount,
            read:   this.notifications.length - this.unreadCount,
            types: {
                success: this.notifications.filter(n => n.type === 'success').length,
                error:   this.notifications.filter(n => n.type === 'error').length,
                warning: this.notifications.filter(n => n.type === 'warning').length,
                info:    this.notifications.filter(n => n.type === 'info').length
            }
        };
    }

    // ================================================================
    // UI DELEGATION
    // ================================================================

    public toggleModal():     void { this.ui?.toggleModal(); }
    public showModal():       void { this.ui?.showModal(); this.updateNotificationList(); }
    public hideModal():       void { this.ui?.hideModal(); }
    public closeAllModals():  void { this.ui?.closeAllModals(); }

    // ================================================================
    // CLEANUP
    // ================================================================

    public destroy(): void {
        console.log('🧹 Cleaning up Notification Module...');

        this.activeToastTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.activeToastTimeouts.clear();

        this.ui?.destroy();

        document.querySelectorAll('.notification-toast').forEach(toast => toast.remove());

        if (this.toastContainer) {
            this.toastContainer.remove();
            this.toastContainer = null;
        }

        this.notifications = [];
        this.unreadCount   = 0;
        this.ui            = null;

        console.log('✅ Notification Module cleanup complete');
    }
}
