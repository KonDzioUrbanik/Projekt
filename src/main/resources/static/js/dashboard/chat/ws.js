import { state } from './state.js';
import { appendMessage, updateSidebarPreviewLocal, handleTypingIndicator } from './ui.js';
import { markRead } from './api.js';

// StompJs.Client instance (from @stomp/stompjs v7 UMD bundle loaded globally)
export let stompClient = null;

function showWsBanner(visible) {
    let banner = document.getElementById('ws-offline-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'ws-offline-banner';
        Object.assign(banner.style, {
            display: 'none', position: 'fixed', top: '0', left: '0', right: '0',
            zIndex: '9999', textAlign: 'center', padding: '0.5rem 1rem',
            background: '#f59e0b', color: '#1a1a1a', fontSize: '0.85rem',
            fontWeight: '600', letterSpacing: '0.02em'
        });
        banner.innerHTML = '<i class="fas fa-wifi" style="margin-right:0.4rem;"></i>Brak połączenia na żywo – trwa ponowne łączenie...';
        document.body.appendChild(banner);
    }
    banner.style.display = visible ? 'block' : 'none';
}

export function connectWs() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const brokerURL = `${proto}//${window.location.host}/ws/stomp`;

    stompClient = new StompJs.Client({
        brokerURL,
        reconnectDelay: 3000,
        debug: () => {}, // suppress debug logs

        onConnect: () => {
            showWsBanner(false);
            stompClient.subscribe('/user/queue/messages', onWsMessage);
            stompClient.subscribe('/user/queue/typing', onWsTyping);
            stompClient.subscribe('/user/queue/read-receipt', onWsReadReceipt);
            stompClient.subscribe('/user/queue/edit', onWsEdit);
            stompClient.subscribe('/user/queue/delete', onWsDelete);
            stompClient.subscribe('/user/queue/errors', onWsError);
        },

        onDisconnect: () => {
            showWsBanner(true);
        },

        onStompError: (frame) => {
            console.error('STOMP error', frame);
            showWsBanner(true);
        }
    });

    stompClient.activate();
}

function onWsMessage(frame) {
    const msg = JSON.parse(frame.body);

    if (msg.conversationId == state.currentConvId) {
        // Optimistic UI replace: find most recent "SENDING" message from Me
        const allMyMessages = document.querySelectorAll('.chat-msg-wrap--mine');
        let tempMatch = null;

        for (let i = allMyMessages.length - 1; i >= 0; i--) {
            const el = allMyMessages[i];
            const isSending = el.querySelector('.chat-msg-footer span')?.textContent === 'Wysyłanie...';
            if (isSending) {
                tempMatch = el;
                break;
            }
        }

        if (tempMatch) {
            import('./ui.js').then(m => m.replaceTempMessage(tempMatch.dataset.msgId, msg));
        } else {
            appendMessage(msg, true);
        }

        if (msg.mine === false) {
            markRead(state.currentConvId);
            if (stompClient && stompClient.connected) {
                stompClient.publish({
                    destination: '/app/chat.read',
                    body: JSON.stringify({ conversationId: state.currentConvId })
                });
            }
        }
    }
    updateSidebarPreviewLocal(msg.conversationId, msg.content, msg.sentAt, msg.senderName, msg.mine);
}

function onWsTyping(frame) {
    const data = JSON.parse(frame.body);
    if (data.conversationId == state.currentConvId) {
        handleTypingIndicator(data.typing);
    }
}

function onWsReadReceipt(frame) {
    const data = JSON.parse(frame.body);
    if (data.conversationId == state.currentConvId) {
        document.querySelectorAll('.chat-msg--mine .chat-msg-status').forEach(el => {
            el.textContent = '✓✓';
            el.classList.add('chat-msg-status--read');
            el.setAttribute('data-tooltip', 'Odczytano');
        });
    }
}

function onWsEdit(frame) {
    const msg = JSON.parse(frame.body);
    import('./ui.js').then(m => {
        const wrap = document.querySelector(`[data-msg-id="${msg.id}"]`);
        if (wrap) {
            const newWrap = m.buildMessageEl(msg);
            wrap.replaceWith(newWrap);
        }
    });
    import('./api.js').then(m => m.refreshConversationList());
}

function onWsDelete(frame) {
    const data = JSON.parse(frame.body);
    import('./ui.js').then(m => {
        const wrap = document.querySelector(`[data-msg-id="${data.msgId}"]`);
        if (wrap) {
            const msgEl = wrap.querySelector('.chat-msg');
            if (msgEl) msgEl.classList.add('chat-msg--deleted');
            const bubble = wrap.querySelector('.chat-msg-bubble');
            if (bubble) {
                bubble.innerHTML = '';
                const icon = document.createElement('i');
                icon.className = 'fas fa-ban';
                icon.style.marginRight = '0.35rem';
                bubble.appendChild(icon);
                bubble.appendChild(document.createTextNode('Wiadomość usunięta'));
                if (data.deletedAt) {
                    bubble.title = 'Usunięto ' + new Date(data.deletedAt).toLocaleString('pl-PL');
                }
            }
            const opts = wrap.querySelector('.chat-msg-options');
            if (opts) opts.remove();
        }
    });
    import('./api.js').then(m => m.refreshConversationList());
}

function onWsError(frame) {
    // Find most recent "Sending..." message and mark it as failed
    const allMyMessages = document.querySelectorAll('.chat-msg-wrap--mine');
    let tempMatchId = null;

    for (let i = allMyMessages.length - 1; i >= 0; i--) {
        const el = allMyMessages[i];
        const footerSpan = el.querySelector('.chat-msg-footer span');
        if (footerSpan && footerSpan.textContent === 'Wysyłanie...') {
            tempMatchId = el.dataset.msgId;
            break;
        }
    }

    if (tempMatchId) {
        import('./ui.js').then(m => m.markMessageAsFailed(tempMatchId));
    }
}

export function sendWsTyping(isTyping) {
    if (stompClient && stompClient.connected && state.currentConvId) {
        stompClient.publish({
            destination: '/app/chat.typing',
            body: JSON.stringify({
                conversationId: state.currentConvId,
                typing: isTyping
            })
        });
    }
}
