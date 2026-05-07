document.addEventListener('DOMContentLoaded', () => {
    const notificationToggle = document.getElementById('notificationDropdownToggle');
    const notificationMenu = document.getElementById('notificationDropdownMenu');
    const notificationBadge = document.getElementById('notificationBadge');
    const notificationList = document.getElementById('notificationList');
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    const deleteAllBtn = document.getElementById('deleteAllBtn');
    
    let unreadCount = 0;
    let stompClient = null;

    // Toggle dropdown
    if (notificationToggle) {
        const btn = notificationToggle.querySelector('.notification-btn');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationMenu.classList.toggle('show');
            if (notificationMenu.classList.contains('show')) {
                fetchNotifications();
            }
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (notificationMenu && notificationMenu.classList.contains('show') && !notificationToggle.contains(e.target)) {
            notificationMenu.classList.remove('show');
        }
    });

    // Fetch initial unread count
    fetchUnreadCount();

    // Initialize WebSocket connection
    initWebSocket();

    // Mark all as read
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            markAllAsRead();
        });
    }

    // Delete all
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteAllNotifications();
        });
    }

    function fetchUnreadCount() {
        fetch('/api/notifications/unread-count')
            .then(res => res.json())
            .then(count => {
                unreadCount = count;
                updateBadge();
            })
            .catch(err => console.error('Error fetching unread count:', err));
    }

    function fetchNotifications() {
        notificationList.innerHTML = '<div class="notification-loading"><i class="fas fa-spinner fa-spin"></i></div>';
        
        fetch('/api/notifications?page=0&size=10')
            .then(res => res.json())
            .then(data => {
                renderNotifications(data.content || []);
            })
            .catch(err => {
                console.error('Error fetching notifications:', err);
                notificationList.innerHTML = '<div class="notification-error">Nie udało się załadować powiadomień.</div>';
            });
    }

    function renderNotifications(notifications) {
        if (!notifications || notifications.length === 0) {
            notificationList.innerHTML = '<div class="notification-empty">Brak nowych powiadomień</div>';
            return;
        }

        notificationList.innerHTML = '';
        notifications.forEach(notif => {
            const item = document.createElement('div');
            item.className = `notification-item ${notif.read ? 'read' : 'unread'}`;
            
            let iconClass = 'fas fa-bell';
            let iconColor = 'var(--primary-color)';
            
            switch (notif.type) {
                case 'FORUM_COMMENT':
                    iconClass = 'fas fa-comments';
                    iconColor = 'var(--success-color)';
                    break;
                case 'SURVEY_NEW':
                    iconClass = 'fas fa-poll';
                    iconColor = 'var(--warning-color)';
                    break;
                case 'CHAT_MESSAGE':
                    iconClass = 'fas fa-envelope';
                    iconColor = 'var(--info-color)';
                    break;
                case 'FRIEND_REQUEST':
                    iconClass = 'fas fa-user-friends';
                    iconColor = 'var(--primary-color)';
                    break;
                case 'ANNOUNCEMENT':
                    iconClass = 'fas fa-bullhorn';
                    iconColor = '#8b5cf6'; // Fioletowy dla ogłoszeń
                    break;
            }

            const date = new Date(notif.createdAt);
            const timeStr = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const dateStr = date.toLocaleDateString();

            item.innerHTML = `
                <div class="notification-icon" style="color: ${iconColor}">
                    <i class="${iconClass}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-text">${notif.message}</div>
                    <div class="notification-time">${dateStr} ${timeStr}</div>
                </div>
                ${!notif.read ? '<div class="notification-dot"></div>' : ''}
            `;

            item.addEventListener('click', () => {
                if (!notif.read) {
                    markAsRead(notif.id);
                }
                if (notif.referenceUrl) {
                    window.location.href = notif.referenceUrl;
                }
            });

            notificationList.appendChild(item);
        });
    }

    function markAsRead(id) {
        fetch(`/api/notifications/${id}/read`, { method: 'PUT' })
            .then(res => {
                if (res.ok) {
                    unreadCount = Math.max(0, unreadCount - 1);
                    updateBadge();
                }
            })
            .catch(err => console.error('Error marking as read:', err));
    }

    function markAllAsRead() {
        fetch('/api/notifications/read-all', { method: 'PUT' })
            .then(res => {
                if (res.ok) {
                    unreadCount = 0;
                    updateBadge();
                    fetchNotifications();
                }
            })
            .catch(err => console.error('Error marking all as read:', err));
    }

    function deleteAllNotifications() {
        fetch('/api/notifications/all', { method: 'DELETE' })
            .then(res => {
                if (res.ok) {
                    unreadCount = 0;
                    updateBadge();
                    notificationList.innerHTML = '<div class="notification-empty">Brak nowych powiadomień</div>';
                }
            })
            .catch(err => console.error('Error deleting all notifications:', err));
    }

    function updateBadge() {
        if (notificationBadge) {
            notificationBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            notificationBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
        }
    }

    function initWebSocket() {
        if (typeof window.StompJs === 'undefined') {
            console.warn('StompJs is not loaded. Real-time notifications disabled.');
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const brokerURL = `${protocol}//${window.location.host}/ws/stomp`;

        stompClient = new window.StompJs.Client({
            brokerURL: brokerURL,
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
        });

        stompClient.onConnect = (frame) => {
            stompClient.subscribe('/user/queue/notifications', (message) => {
                if (message.body) {
                    const notif = JSON.parse(message.body);
                    handleNewNotification(notif);
                }
            });
        };

        stompClient.onStompError = (frame) => {
            console.error('Broker error:', frame.headers['message']);
        };

        stompClient.activate();
    }

    function handleNewNotification(notif) {
        unreadCount++;
        updateBadge();
        
        // If dropdown is open, refresh it
        if (notificationMenu && notificationMenu.classList.contains('show')) {
            fetchNotifications();
        } else {
            // Show toast if utils is available
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast(notif.message, 'info');
            }
        }
    }
});
