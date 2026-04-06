import { state } from './state.js';
import { appendMessage, updateSidebarPreviewLocal, handleTypingIndicator } from './ui.js';
import { markRead, refreshConversationList } from './api.js';

export let stompClient = null;

export function connectWs() {
    const socket = new SockJS('/ws/chat');
    stompClient = Stomp.over(socket);
    stompClient.debug = null; // Disable debug logging

    stompClient.connect({}, () => {
        stompClient.subscribe('/user/queue/messages', onWsMessage);
        stompClient.subscribe('/user/queue/typing', onWsTyping);
        stompClient.subscribe('/user/queue/read-receipt', onWsReadReceipt);
        stompClient.subscribe('/user/queue/edit', onWsEdit);
        stompClient.subscribe('/user/queue/delete', onWsDelete);
        stompClient.subscribe('/user/queue/errors', onWsError);
    }, () => {
        setTimeout(connectWs, 3000);
    });
}

function onWsMessage(frame) {
    const msg = JSON.parse(frame.body);

    if (msg.conversationId == state.currentConvId) {
        // Optimistic UI replace check: find most recent "SENDING" message from Me
        const allMyMessages = document.querySelectorAll('.chat-msg-wrap--mine');
        let tempMatch = null;
        
        for (let i = allMyMessages.length - 1; i >= 0; i--) {
            const el = allMyMessages[i];
            const isSending = el.querySelector('.chat-msg-footer span')?.textContent === 'Wysyłanie...';
            if (isSending) {
                // If content matches or it's the very last one, replace it
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
                stompClient.send('/app/chat.read', {}, JSON.stringify({ conversationId: state.currentConvId }));
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
            }
            const opts = wrap.querySelector('.chat-msg-options');
            if (opts) opts.remove();
        }
    });
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
        stompClient.send('/app/chat.typing', {}, JSON.stringify({
            conversationId: state.currentConvId,
            typing: isTyping
        }));
    }
}
