// notification/index.ts
// ✅ Single entry point for the entire notification system

import { NotificationModule } from './notification';
import { NotificationUI } from './notification-ui';

// ==================== WIRE INTERNALLY ====================

// 1. Create module (no UI dependency yet)
const notificationModule = new NotificationModule();

// 2. Create UI with module reference
const notificationUI = new NotificationUI(notificationModule);

// 3. Inject UI into module (breaks circular dependency)
notificationModule.setUI(notificationUI);

// ==================== EXPORT ONE THING ====================

// ✅ Module manager only needs this
export { notificationModule as Notification };

// ✅ Export types for use elsewhere in the app
export type {
    NotificationOptions,
    NotificationAction,
    ToastNotification,
    TradeData,
    AlertData,
    INotificationModule,
    INotificationUI
} from './notification-types';