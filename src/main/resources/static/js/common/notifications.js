class NotificationSystem {
    constructor() {
        if (typeof Utils === 'undefined') {
            console.error('NotificationSystem: Utils not found. Make sure utils.js is loaded.');
        }
    }

    show(options) {
        if (typeof Utils === 'undefined') return;
        
        const {
            message = '',
            type = 'info', // success, error, info, warning
            duration = 4000,
            isHtml = false
        } = options;

        Utils.showToast(message, type, { duration, isHtml });
    }

    success(message) {
        this.show({ type: 'success', message });
    }

    error(message) {
        this.show({ type: 'error', message });
    }

    info(message) {
        this.show({ type: 'info', message });
    }

    warning(message) {
        this.show({ type: 'warning', message });
    }
}

export const notifications = new NotificationSystem();
window.pansNotifications = notifications;
