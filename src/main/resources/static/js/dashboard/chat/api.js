import { state, DOM } from './state.js';
import { notifications } from '../../common/notifications.js';
import { 
    esc, initials, buildMessageEl, scrollToBottom, setAvatar, 
    buildDateSeparator, replaceTempMessage, appendMessage, relativeTime,
    updateFriendButton
} from './ui.js';
import { sendWsTyping } from './ws.js';

export function refreshConversationList() {
    return fetch('/api/chat/conversations')
        .then(r => r.json())
        .then(list => {
            if (DOM.convSkeleton) DOM.convSkeleton.style.display = 'none';
            DOM.convList.innerHTML = '';
            if (!list.length) {
                const empty = document.createElement('div');
                empty.style.padding = '1.25rem';
                empty.style.textAlign = 'center';
                empty.style.fontSize = '.85rem';
                empty.style.color = 'var(--text-muted)';
                empty.textContent = 'Brak rozmów. Zacznij nową!';
                DOM.convList.appendChild(empty);
                return list;
            }
            list.forEach(conv => DOM.convList.appendChild(buildConvItem(conv)));
            return list;
        })
        .catch((err) => {
            console.error('Refresh list error:', err);
            DOM.convList.innerHTML = '<div style="padding:1rem;color:var(--text-muted);font-size:.85rem;">Błąd ładowania rozmów.</div>';
            return [];
        });
}

function buildConvItem(conv) {
    const el = document.createElement('div');
    el.className = 'chat-conv-item' + (conv.unreadCount > 0 ? ' unread' : '') + (conv.id == state.currentConvId ? ' active' : '');
    el.dataset.convId = conv.id;

    // Build internally using strict elements
    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'chat-conv-avatar-wrap';
    const avatarInitials = document.createElement('span');
    avatarInitials.className = 'chat-avatar-initials';
    avatarInitials.style.width = '38px';
    avatarInitials.style.height = '38px';
    avatarInitials.style.fontSize = '.85rem';
    avatarInitials.textContent = initials(conv.otherUserName);
    avatarWrap.appendChild(avatarInitials);

    const info = document.createElement('div');
    info.className = 'conv-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'conv-name';
    nameEl.textContent = conv.otherUserName;
    const previewEl = document.createElement('div');
    previewEl.className = 'conv-preview';
    previewEl.textContent = conv.lastMessagePreview || 'Brak wiadomości';
    info.appendChild(nameEl);
    info.appendChild(previewEl);

    // Right logic time & badge
    const rightWrap = document.createElement('div');
    rightWrap.className = 'conv-meta';
    rightWrap.style.display = 'flex';
    rightWrap.style.flexDirection = 'column';
    rightWrap.style.alignItems = 'flex-end';
    rightWrap.style.gap = '.2rem';

    if (conv.lastMessageAt) {
        const time = document.createElement('span');
        time.className = 'conv-time';
        time.textContent = relativeTime(conv.lastMessageAt);
        rightWrap.appendChild(time);
    }

    if (conv.unreadCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'conv-unread-badge';
        badge.textContent = conv.unreadCount;
        rightWrap.appendChild(badge);
    }

    el.appendChild(avatarWrap);
    el.appendChild(info);
    el.appendChild(rightWrap);

    el.addEventListener('click', () => openConversation(conv));
    return el;
}

export function openConversation(conv) {
    if (!conv || !conv.id) return;
    state.currentConvId = conv.id;
    state.currentOtherUser = conv;
    state.oldestMsgId = null;
    state.hasMoreMessages = false;

    document.querySelectorAll('.chat-conv-item').forEach(el => {
        el.classList.toggle('active', el.dataset.convId == conv.id);
        if (el.dataset.convId == conv.id) {
            el.classList.remove('unread');
            const b = el.querySelector('.conv-unread-badge');
            if (b) b.remove();
        }
    });

    DOM.headerName.textContent = conv.otherUserName;
    let sub = '';
    if (conv.fieldOfStudy) sub += conv.fieldOfStudy;
    if (conv.yearOfStudy) sub += (sub ? ', ' : '') + conv.yearOfStudy + '. rok';
    DOM.headerSub.textContent = sub;
    setAvatar(DOM.headerAvatarImg, DOM.headerInitials, conv.otherUserId, conv.otherUserName);

    DOM.infoName.textContent = conv.otherUserName;
    DOM.infoMeta.textContent = sub;
    setAvatar(DOM.infoAvatarImg, DOM.infoInitials, conv.otherUserId, conv.otherUserName);
    DOM.btnInfoProfile.href = '/profile/user?userId=' + conv.otherUserId;

    // Reset friendship button to avoid flicker
    const btnAddFriend = document.getElementById('btnAddFriend');
    if (btnAddFriend) btnAddFriend.style.display = 'none';

    // Fetch and update friendship status
    fetch(`/api/friends/status/${conv.otherUserId}`)
        .then(r => r.text())
        .then(status => {
            state.currentFriendshipStatus = status;
            updateFriendButton(status);
        });

    DOM.chatEmpty.style.display = 'none';
    DOM.chatWindow.style.display = 'flex';

    if (window.innerWidth > 1024) {
        DOM.infoPanel.classList.add('visible-desktop');
        DOM.chatLayout.classList.add('has-info-panel');
    }
    if (window.innerWidth <= 680) {
        DOM.sidebar.classList.add('hidden-mobile');
    }

    loadMessages(conv.id, null, true);
    markRead(conv.id);

    fetch('/api/friends/status/' + conv.otherUserId)
        .then(r => r.text())
        .then(status => {
            state.currentFriendshipStatus = status;
            updateFriendButton(status);
        });

    // Dynamic STOMP notify
    import('./ws.js').then(m => {
        if (m.stompClient && m.stompClient.connected) {
            m.stompClient.publish({
                destination: '/app/chat.read',
                body: JSON.stringify({ conversationId: conv.id })
            });
        }
    });
}

export function loadMessages(convId, beforeId, isFirst) {
    if (isFirst) {
        DOM.msgSkeleton.style.display = 'flex';
        DOM.messages.innerHTML = '';
        DOM.messages.appendChild(DOM.msgSkeleton);
    }
    let url = '/api/chat/conversations/' + convId + '/messages';
    if (beforeId) url += '?before=' + beforeId;

    fetch(url)
        .then(r => r.json())
        .then(msgs => {
            DOM.msgSkeleton.style.display = 'none';
            const sorted = msgs.slice().reverse();
            state.hasMoreMessages = msgs.length >= 50;

            if (isFirst) {
                DOM.messages.innerHTML = '';
                if (state.hasMoreMessages) {
                    DOM.btnLoadMore.parentElement.style.display = 'block';
                    DOM.messages.appendChild(DOM.btnLoadMore.parentElement);
                }
                let lastDate = null;
                sorted.forEach(msg => {
                    const msgDate = msg.sentAt ? new Date(msg.sentAt).toDateString() : null;
                    if (msgDate && msgDate !== lastDate) {
                        lastDate = msgDate;
                        // Build Date Sep strict
                        DOM.messages.appendChild(buildDateSeparator(msg.sentAt));
                    }
                    DOM.messages.appendChild(buildMessageEl(msg));
                });
                scrollToBottom(true);
                if (sorted.length) state.oldestMsgId = sorted[0].id;
            } else {
                const prevHeight = DOM.messages.scrollHeight;
                const prevScrollTop = DOM.messages.scrollTop;
                const anchor = DOM.messages.firstChild;
                sorted.forEach(msg => {
                    DOM.messages.insertBefore(buildMessageEl(msg), anchor);
                });
                DOM.messages.scrollTop = prevScrollTop + (DOM.messages.scrollHeight - prevHeight);
                if (sorted.length) state.oldestMsgId = sorted[0].id;
            }
        })
        .catch(() => { DOM.msgSkeleton.style.display = 'none'; });
}

export function markRead(convId) {
    if(!convId) return;
    fetch('/api/chat/conversations/' + convId + '/read', { method: 'PATCH' }).catch(()=>{});
}

export function deleteMsg(msgId) {
    fetch('/api/chat/messages/' + msgId, { method: 'DELETE' })
        .then(r => r.json())
        .then(msg => {
            const wrap = document.querySelector(`[data-msg-id="${msg.id}"]`);
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
                    import('./ui.js').then(m => {
                        if (msg.deletedAt) {
                            bubble.title = 'Usunięto ' + m.formatTime(msg.deletedAt) + ', ' + m.formatDate(msg.deletedAt);
                        }
                    });
                }
                const opts = wrap.querySelector('.chat-msg-options');
                if (opts) opts.remove();
            }
            refreshConversationList();
        });
}

export function editMsg(msgId, newContent) {
    fetch('/api/chat/messages/' + msgId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent })
    }).then(r => r.json())
      .then(msg => {
            const newWrap = buildMessageEl(msg);
            const wrap = document.querySelector(`[data-msg-id="${msg.id}"]`);
            if (wrap) wrap.replaceWith(newWrap);
            refreshConversationList();
      });
}

export async function startConversationWith(user) {
    try {
        const response = await fetch('/api/chat/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: parseInt(user.id, 10) })
        });
        
        if (!response.ok) throw new Error('Failed to start conversation');
        
        const conv = await response.json();
        
        // Wait for list to refresh first
        await refreshConversationList();
        
        // Then open
        openConversation(conv);
    } catch (error) {
        console.error('Error starting conversation:', error);
        notifications.error('Nie udało się rozpocząć rozmowy.');
    }
}
