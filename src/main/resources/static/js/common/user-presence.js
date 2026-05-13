/**
 * Zarządzanie statusem aktywności użytkowników w czasie rzeczywistym (Online/Offline)
 */
const UserPresence = (function() {
    let stompClient = null;
    let onlineUsers = new Set();
    const presenceListeners = [];
    let domObserver = null;

    async function fetchInitialState() {
        try {
            const response = await fetch('/api/users/presence/online');
            if (response.ok) {
                const initialOnline = await response.json();
                onlineUsers = new Set(initialOnline.map(e => e.toLowerCase().trim()));
                updateAllPresenceIndicators();
            }
        } catch (error) {
            console.error("[Presence] Błąd pobierania stanu początkowego:", error);
        }
    }

    async function init() {
        startDomObserver(); 
        await fetchInitialState();
        connectWebSocket();

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                fetchInitialState();
                if (stompClient && !stompClient.connected) {
                    stompClient.activate();
                }
            }
        });
    }

    function startDomObserver() {
        if (domObserver) return;

        let debounceTimer = null;
        const triggerRefresh = () => {
            if (debounceTimer) cancelAnimationFrame(debounceTimer);
            debounceTimer = requestAnimationFrame(() => {
                updateAllPresenceIndicators();
            });
        };

        domObserver = new MutationObserver((mutations) => {
            let shouldRefresh = false;
            
            for (let mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (let node of mutation.addedNodes) {
                        if (node.nodeType === 1 && (node.hasAttribute('data-user-email') || node.querySelector('[data-user-email]'))) {
                            shouldRefresh = true;
                            break;
                        }
                    }
                } else if (mutation.type === 'attributes' && mutation.attributeName === 'data-user-email') {
                    shouldRefresh = true;
                }
                if (shouldRefresh) break;
            }

            if (shouldRefresh) triggerRefresh();
        });

        domObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-user-email']
        });
    }

    function connectWebSocket() {
        stompClient = new StompJs.Client({
            brokerURL: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws-system/websocket`,
            reconnectDelay: 5000,
            heartbeatIncoming: 20000,
            heartbeatOutgoing: 20000,
        });

        stompClient.debug = function(str) {
            // Debugging STOMP wyłączony w produkcji
        };

        stompClient.onConnect = async (frame) => {
            await fetchInitialState();
            stompClient.subscribe('/topic/users/status', (message) => {
                try {
                    const statusUpdate = JSON.parse(message.body);
                    handleStatusUpdate(statusUpdate);
                } catch (e) {
                    console.error("[Presence] Błąd parsowania statusu:", e);
                }
            });
        };

        stompClient.onWebSocketClose = (evt) => {
            if (evt.code !== 1000) {
                console.warn("[Presence] Gniazdo zamknięte (Kod:", evt.code, ")");
            }
        };

        stompClient.onStompError = (frame) => {
            console.error("[Presence] Błąd protokołu STOMP:", frame.headers['message']);
        };

        stompClient.activate();
    }

    function handleStatusUpdate(update) {
        if (!update || !update.email) return;
        const email = update.email.toLowerCase().trim();
        const online = update.online;
        
        if (online) onlineUsers.add(email);
        else onlineUsers.delete(email);

        updateUserIndicators(email, online);
        presenceListeners.forEach(callback => {
            try { callback(email, online); } catch(e) {}
        });
    }

    function updateUserIndicators(email, isOnline) {
        if (!email) return;
        const normalizedEmail = email.toLowerCase().trim();
        const elements = document.querySelectorAll(`[data-user-email="${normalizedEmail}"]`);
        
        elements.forEach(el => {
            let targetWrapper = el.classList.contains('avatar-wrapper') ? el : el.querySelector('.avatar-wrapper');
            if (!targetWrapper) targetWrapper = el;

            let dot = targetWrapper.querySelector(':scope > .presence-dot');
            if (!dot) {
                dot = document.createElement('span');
                dot.className = 'presence-dot';
                targetWrapper.appendChild(dot);
            }
            
            if (isOnline) {
                dot.classList.add('online');
                dot.title = 'Użytkownik jest online';
            } else {
                dot.classList.remove('online');
                dot.title = 'Użytkownik jest offline';
            }

            const allDots = targetWrapper.querySelectorAll(':scope > .presence-dot');
            if (allDots.length > 1) {
                for(let i = 1; i < allDots.length; i++) {
                    allDots[i].remove();
                }
            }
        });
    }

    function updateAllPresenceIndicators() {
        const elements = document.querySelectorAll('[data-user-email]');
        elements.forEach(el => {
            const email = el.getAttribute('data-user-email');
            if (email) {
                updateUserIndicators(email, onlineUsers.has(email.toLowerCase().trim()));
            }
        });
    }

    return {
        init: init,
        isOnline: (email) => onlineUsers.has((email || '').toLowerCase().trim()),
        onStatusChange: (callback) => presenceListeners.push(callback),
        refreshUI: updateAllPresenceIndicators,
        getOnlineSet: () => Array.from(onlineUsers) 
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        UserPresence.init();
    }
});
