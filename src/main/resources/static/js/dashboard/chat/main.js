import { notifications } from '../../common/notifications.js';
import { confirmModal } from '../../common/modals.js';
import { state, DOM } from './state.js';
import { connectWs, sendWsTyping, stompClient } from './ws.js';
import { refreshConversationList, openConversation, loadMessages, editMsg, deleteMsg, startConversationWith } from './api.js';
import { appendMessage, scrollToBottom, setAvatar, replaceTempMessage, initials, virtualScrollTrim, updateFriendButton } from './ui.js';

let typingTimeout = null;
let lastTypingSent = 0;
let isSending = false;

document.addEventListener('DOMContentLoaded', async () => {
    // Establish WebSocket connection
    connectWs();

    // Load initial conversation list
    await refreshConversationList();

    // Context Menu logic
    document.addEventListener('click', () => {
        DOM.contextMenu.style.display = 'none';
    });

    document.getElementById('ctxEdit').addEventListener('click', (e) => {
        e.stopPropagation();
        DOM.contextMenu.style.display = 'none';

        if (!state.contextMsgId) return;
        state.editMsgId = state.contextMsgId;
        
        const msgWrap = document.querySelector(`[data-msg-id="${state.editMsgId}"]`);
        if (msgWrap) {
            const bubble = msgWrap.querySelector('.chat-msg-bubble');
            if (bubble) {
                // Determine content strictly from DOM for reliability
                const content = Array.from(bubble.childNodes)
                    .map(n => n.nodeType === 3 ? n.textContent : (n.nodeName === 'BR' ? '\n' : ''))
                    .join('');

                const overlay = document.getElementById('editMsgOverlay');
                const input = document.getElementById('editMsgInput');
                if (overlay && input) {
                    input.value = content;
                    overlay.style.display = 'flex';
                    overlay.style.visibility = 'visible';
                    overlay.style.opacity = '1';
                    overlay.style.zIndex = '20000';
                }
            } else {
                console.warn('Edit aborted: Bubble not found for msgId', state.editMsgId);
            }
        } else {
            console.warn('Edit aborted: Message wrap not found for msgId', state.editMsgId);
        }
    });

    document.getElementById('ctxDelete').addEventListener('click', (e) => {
        e.stopPropagation();
        DOM.contextMenu.style.display = 'none';
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

    // Info Panel actions delegation
    document.getElementById('chatInfoPanel').addEventListener('click', async (e) => {
        const btnAdd = e.target.closest('#btnAddFriend');

        if (btnAdd) {
            if (!state.currentOtherUser) return;
            const otherId = state.currentOtherUser.otherUserId;
            try {
                const isAccepting = (state.currentFriendshipStatus === 'RECEIVED');
                const endpoint = isAccepting 
                    ? `/api/friends/accept-user/${otherId}` 
                    : `/api/friends/request/${otherId}`;

                const response = await fetch(endpoint, { method: 'POST' });
                if (response.ok) {
                    if (isAccepting) {
                        notifications.success('Zaakceptowano zaproszenie!');
                        updateFriendButton('FRIENDS');
                        state.currentFriendshipStatus = 'FRIENDS';
                    } else {
                        notifications.success('Zaproszenie zostało wysłane pomyślnie!');
                        updateFriendButton('SENT');
                        state.currentFriendshipStatus = 'SENT';
                    }
                } else {
                    const msg = await response.text();
                    notifications.error(msg || 'Wystąpił błąd.');
                }
            } catch (err) {
                console.error(err);
                notifications.error('Błąd połączenia z serwerem.');
            }
        }
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

    // Auto open from URL (conversationId or userId)
    const urlParams = new URLSearchParams(window.location.search);
    const userIdParam = urlParams.get('userId');
    const subjectParam = urlParams.get('subject');
    const messageParam = urlParams.get('message');
    const openConvId = document.getElementById('openConversationId')?.getAttribute('content');

    const handleUrlMessage = () => {
        if (subjectParam || messageParam) {
            setTimeout(() => {
                let prefill = "";
                if (subjectParam) prefill += subjectParam + '\n\n';
                if (messageParam) prefill += messageParam;
                if (prefill && !DOM.input.value) {
                    DOM.input.value = prefill;
                    DOM.input.dispatchEvent(new Event('input'));
                }
            }, 600); // Małe opóźnienie na wyrenderowanie DOM czatu
        }
    };

    if (openConvId && openConvId !== 'null' && openConvId !== '') {
        // Find in already loaded list
        const list = await refreshConversationList(); // Returns list from cache/fetch
        const c = list.find(x => String(x.id) === openConvId);
        if (c) {
            openConversation(c);
            handleUrlMessage();
        }
    } else if (userIdParam) {
        startConversationWith({ id: userIdParam }).then(() => {
            handleUrlMessage();
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


