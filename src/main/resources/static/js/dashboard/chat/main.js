import { state, DOM } from './state.js';
import { connectWs, sendWsTyping, stompClient } from './ws.js';
import { refreshConversationList, openConversation, loadMessages, editMsg, deleteMsg, startConversationWith } from './api.js';
import { appendMessage, scrollToBottom, setAvatar, replaceTempMessage, initials, virtualScrollTrim } from './ui.js';

let typingTimeout = null;
let lastTypingSent = 0;
let isSending = false;

document.addEventListener('DOMContentLoaded', () => {
    connectWs();
    refreshConversationList();

    // Context Menu logic
    document.addEventListener('click', () => {
        DOM.contextMenu.style.display = 'none';
    });

    document.getElementById('ctxEdit').addEventListener('click', () => {
        if (!state.contextMsgId) return;
        state.editMsgId = state.contextMsgId;
        const msgWrap = document.querySelector(`[data-msg-id="${state.editMsgId}"]`);
        if (msgWrap) {
            // Very strict extraction without innerHTML
            const bubble = msgWrap.querySelector('.chat-msg-bubble');
            let content = Array.from(bubble.childNodes)
                .map(n => n.nodeType === 3 ? n.textContent : (n.nodeName === 'BR' ? '\n' : ''))
                .join('');
            document.getElementById('editMsgInput').value = content;
            document.getElementById('editMsgOverlay').style.display = 'flex';
        }
    });

    document.getElementById('ctxDelete').addEventListener('click', () => {
        if (!state.contextMsgId) return;
        if (confirm('Usunąć tę wiadomość?')) {
            deleteMsg(state.contextMsgId);
        }
    });

    document.getElementById('btnCloseEditModal').addEventListener('click', () => {
        document.getElementById('editMsgOverlay').style.display = 'none';
        state.editMsgId = null;
    });

    document.getElementById('btnCancelEdit').addEventListener('click', () => {
        document.getElementById('editMsgOverlay').style.display = 'none';
        state.editMsgId = null;
    });

    document.getElementById('btnSaveEdit').addEventListener('click', () => {
        const val = document.getElementById('editMsgInput').value.trim();
        if (!val || !state.editMsgId) return;
        editMsg(state.editMsgId, val);
        document.getElementById('editMsgOverlay').style.display = 'none';
        state.editMsgId = null;
    });

    // Input handlers
    DOM.input.addEventListener('input', () => {
        DOM.input.style.height = 'auto';
        DOM.input.style.height = (DOM.input.scrollHeight) + 'px';
        
        const now = Date.now();
        if (now - lastTypingSent > 1000) {
            sendWsTyping(true);
            lastTypingSent = now;
        }
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => sendWsTyping(false), 2000);
    });

    DOM.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendTextMessage();
        }
    });

    DOM.btnSend.addEventListener('click', () => {
        sendTextMessage();
    });

    // Scroll to check virtual pagination
    DOM.messages.addEventListener('scroll', () => {
        const distToBottom = DOM.messages.scrollHeight - DOM.messages.scrollTop - DOM.messages.clientHeight;
        state.isNearBottom = distToBottom < 50;

        if (DOM.messages.scrollTop === 0 && state.hasMoreMessages && state.oldestMsgId) {
            loadMessages(state.currentConvId, state.oldestMsgId, false);
        }
    });

    // Search and routing
    let searchTimeout = null;
    DOM.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const q = e.target.value.trim();
        if (q.length < 2) {
            DOM.userResults.style.display = 'none';
            DOM.convList.style.display = 'block';
            return;
        }
        searchTimeout = setTimeout(() => {
            fetch('/api/chat/users/search?q=' + encodeURIComponent(q))
                .then(r => r.json())
                .then(users => {
                    DOM.convList.style.display = 'none';
                    DOM.userResults.innerHTML = '';
                    DOM.userResults.style.display = 'block';
                    if (!users.length) {
                        DOM.userResults.innerHTML = '<div style="padding:1rem;color:var(--text-muted);font-size:.85rem;">Brak wyników</div>';
                        return;
                    }
                    users.forEach(u => DOM.userResults.appendChild(buildSearchRes(u)));
                });
        }, 300);
    });

    // UI toggle
    document.getElementById('btnToggleInfo').addEventListener('click', () => {
        if (window.innerWidth > 1024) {
            DOM.infoPanel.classList.toggle('visible-desktop');
            DOM.chatLayout.classList.toggle('has-info-panel');
        } else {
            DOM.infoPanel.classList.toggle('visible');
        }
    });

    document.getElementById('btnCloseInfo').addEventListener('click', () => {
        DOM.infoPanel.classList.remove('visible');
        DOM.infoPanel.classList.remove('visible-desktop');
        DOM.chatLayout.classList.remove('has-info-panel');
    });

    document.getElementById('btnAddFriend').addEventListener('click', () => {
        alert('Funkcja dodawania do znajomych zostanie wkrótce udostępniona!');
    });

    document.getElementById('btnBackToSidebar').addEventListener('click', () => {
        DOM.sidebar.classList.remove('hidden-mobile');
        state.currentConvId = null;
        DOM.chatWindow.style.display = 'none';
        DOM.chatEmpty.style.display = 'flex';
        DOM.infoPanel.classList.remove('visible');
        DOM.infoPanel.classList.remove('visible-desktop');
        DOM.chatLayout.classList.remove('has-info-panel');
    });

    DOM.btnNewChat.addEventListener('click', () => DOM.searchInput.focus());

    if (DOM.btnLoadMore) {
        DOM.btnLoadMore.addEventListener('click', () => {
            if (state.oldestMsgId && state.currentConvId) {
                loadMessages(state.currentConvId, state.oldestMsgId, false);
            }
        });
    }

    // Auto open from URL
    const openConvId = document.getElementById('openConversationId')?.getAttribute('content');
    if (openConvId) {
        fetch('/api/chat/conversations')
            .then(r => r.json())
            .then(list => {
                const c = list.find(x => String(x.id) === openConvId);
                if (c) openConversation(c);
            });
    }
});

function buildSearchRes(u) {
    const el = document.createElement('div');
    el.className = 'chat-conv-item';
    el.style.borderBottom = '1px solid var(--border-color)';
    el.innerHTML = `
        <div class="chat-conv-avatar-wrap">
            <span class="chat-avatar-initials" style="width:38px;height:38px;font-size:0.85rem">${initials(u.fullName)}</span>
        </div>
        <div class="conv-info">
            <div class="conv-name">${u.fullName}</div>
            <div class="conv-preview">${u.fieldOfStudy ? u.fieldOfStudy : 'Student'}</div>
        </div>
    `;
    el.addEventListener('click', () => {
        DOM.searchInput.value = '';
        DOM.userResults.style.display = 'none';
        DOM.convList.style.display = 'block';
        startConversationWith(u);
    });
    return el;
}

function sendTextMessage() {
    if (isSending) return;
    const text = DOM.input.value.trim();
    if (!text || !state.currentConvId) return;
    if (text.length > 4000) return alert('Wiadomość jest za długa (max 4000 znaków).');

    // Optimistic UI!
    const tempId = 'temp-' + Date.now();
    const tempMsg = {
        id: tempId,
        content: text,
        conversationId: state.currentConvId,
        senderName: 'Ty',
        sentAt: new Date().toISOString(),
        mine: true,
        status: 'SENDING' // Special Optimistic UI status
    };
    
    appendMessage(tempMsg, true);
    DOM.input.value = '';
    DOM.input.style.height = 'auto';

    isSending = true;
    DOM.btnSend.disabled = true;
    DOM.btnSend.style.opacity = '0.5';

    if (stompClient && stompClient.connected) {
        stompClient.publish({
            destination: '/app/chat.send',
            body: JSON.stringify({
                conversationId: state.currentConvId,
                content: text
            })
        });
    } else {
        alert('Brak połączenia z czatem na żywo!');
    }

    setTimeout(() => {
        isSending = false;
        DOM.btnSend.disabled = false;
        DOM.btnSend.style.opacity = '1';
    }, 400);

    sendWsTyping(false);
}
