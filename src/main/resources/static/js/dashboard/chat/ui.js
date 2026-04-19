import { state, DOM } from './state.js';
import { editMsg, deleteMsg } from './api.js';

export function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function initials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase();
    return parts[0][0].toUpperCase();
}

export function relativeTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'teraz';
    if (diff < 3600) return Math.floor(diff / 60) + ' min temu';
    if (diff < 86400) return Math.floor(diff / 3600) + ' godz. temu';
    if (diff < 172800) return 'wczoraj';
    if (diff < 259200) return 'przedwczoraj';
    return Math.floor(diff / 86400) + ' dni temu';
}

export function formatTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function setAvatar(imgEl, initialsEl, userId, name) {
    const ini = initials(name);
    if (initialsEl) {
        initialsEl.textContent = ini;
        initialsEl.style.display = 'flex';
    }
    if (imgEl) {
        imgEl.style.display = 'none';
        imgEl.src = '/api/users/' + userId + '/avatar';
        imgEl.onload = function () {
            imgEl.style.display = 'block';
            if (initialsEl) initialsEl.style.display = 'none';
        };
        imgEl.onerror = function () {
            imgEl.style.display = 'none';
            if (initialsEl) initialsEl.style.display = 'flex';
        };
    }
}

let typingClearTimeout = null;

export function handleTypingIndicator(typing) {
    if (typing) {
        DOM.typingIndicator.style.display = 'inline-flex';
        clearTimeout(typingClearTimeout);
        typingClearTimeout = setTimeout(() => {
            DOM.typingIndicator.style.display = 'none';
        }, 3000);
    } else {
        DOM.typingIndicator.style.display = 'none';
    }
}

export function scrollToBottom(force) {
    if (force || state.isNearBottom) {
        DOM.messages.scrollTop = DOM.messages.scrollHeight;
    }
}

/* Virtual scroll implementation - Trim excess DOM to prevent RAM crash */
export function virtualScrollTrim() {
    // Limits the DOM to maximum 200 elements inside messages container
    const LIMIT = 200;
    if (DOM.messages.children.length > LIMIT) {
        // Remove from the top
        let diff = DOM.messages.children.length - (LIMIT - 50); // Keep 150
        while (diff > 0 && DOM.messages.firstChild) {
            // Keep the load-more button if it is the first child
            if (DOM.messages.firstChild.id === 'chatLoadMore') {
               if(DOM.messages.children[1]) {
                   DOM.messages.removeChild(DOM.messages.children[1]);
               } else {
                   break;
               }
            } else {
               DOM.messages.removeChild(DOM.messages.firstChild);
            }
            diff--;
        }
    }
}

/* Strict DOM creation! No innerHTML */
export function buildMessageEl(msg) {
    const isMine = msg.mine;
    const isDeleted = msg.deletedAt !== null && msg.deletedAt !== undefined;
    const isSending = msg.status === 'SENDING';

    const wrap = document.createElement('div');
    wrap.className = 'chat-msg-wrap' + (isMine ? ' chat-msg-wrap--mine' : '');
    wrap.dataset.msgId = msg.id;

    const msgEl = document.createElement('div');
    msgEl.className = 'chat-msg' + (isMine ? ' chat-msg--mine' : ' chat-msg--theirs') + (isDeleted ? ' chat-msg--deleted' : '');
    if (isSending) msgEl.style.opacity = '0.6';

    const bubble = document.createElement('div');
    bubble.className = 'chat-msg-bubble';

    if (isDeleted) {
        const icon = document.createElement('i');
        icon.className = 'fas fa-ban';
        icon.style.fontSize = '.75rem';
        icon.style.marginRight = '.35rem';
        bubble.appendChild(icon);
        bubble.appendChild(document.createTextNode('Wiadomość usunięta'));
        if (msg.deletedAt) {
            bubble.title = 'Usunięto ' + formatTime(msg.deletedAt) + ', ' + formatDate(msg.deletedAt);
        }
    } else {
        const textContent = msg.content || '';
        const blocks = textContent.split('\n');
        blocks.forEach((block, idx) => {
            bubble.appendChild(document.createTextNode(block));
            if (idx < blocks.length - 1) {
                bubble.appendChild(document.createElement('br'));
            }
        });
    }

    const footer = document.createElement('div');
    footer.className = 'chat-msg-footer';

    if (isSending) {
        const span = document.createElement('span');
        span.textContent = 'Wysyłanie...';
        footer.appendChild(span);
    } else {
        const tsSpan = document.createElement('span');
        if (msg.sentAt) tsSpan.title = new Date(msg.sentAt).toLocaleString('pl-PL');
        tsSpan.textContent = formatTime(msg.sentAt);
        footer.appendChild(tsSpan);

        if (!isDeleted && msg.editedAt) {
            const editTag = document.createElement('span');
            editTag.className = 'chat-msg-edited';
            editTag.title = 'Edytowano ' + formatTime(msg.editedAt);
            editTag.textContent = 'edytowano';
            footer.appendChild(editTag);
        }

        if (isMine) {
            const statusClass = msg.status === 'READ' ? ' chat-msg-status--read' : '';
            const statusSpan = document.createElement('span');
            statusSpan.className = 'chat-msg-status' + statusClass;
            statusSpan.textContent = msg.status === 'READ' ? '✓✓' : '✓';
            
            // Tooltips
            let tooltipText = 'Wysłano';
            if (msg.status === 'READ') tooltipText = 'Odczytano';
            else if (msg.status === 'DELIVERED') tooltipText = 'Dostarczono';
            statusSpan.setAttribute('data-tooltip', tooltipText);
            
            footer.appendChild(statusSpan);
        }
    }

    const bubbleWrap = document.createElement('div');
    bubbleWrap.className = 'chat-msg-bubble-wrap';
    bubbleWrap.style.position = 'relative';
    bubbleWrap.style.display = 'flex';
    bubbleWrap.style.alignItems = 'center';

    bubbleWrap.appendChild(bubble);

    if (isMine && !isDeleted && !isSending) {
        const optBtn = document.createElement('button');
        optBtn.className = 'chat-msg-options-btn';
        const icon = document.createElement('i');
        icon.className = 'fas fa-ellipsis-h';
        optBtn.appendChild(icon);

        optBtn.addEventListener('click', function(e) {
            showContextMenu(e, msg.id, msg.sentAt, msg.content);
            e.stopPropagation();
        });

        const opts = document.createElement('div');
        opts.className = 'chat-msg-options';
        opts.appendChild(optBtn);
        bubbleWrap.appendChild(opts);
    }

    msgEl.appendChild(bubbleWrap);
    msgEl.appendChild(footer);

    wrap.appendChild(msgEl);
    return wrap;
}

export function buildDateSeparator(iso) {
    const el = document.createElement('div');
    el.className = 'chat-date-separator';
    el.textContent = formatDate(iso);
    return el;
}

export function showContextMenu(e, msgId, sentAt, content) {
    state.contextMsgId = msgId;
    const editAllowed = (new Date() - new Date(sentAt)) < 5 * 60 * 1000;
    document.getElementById('ctxEdit').style.display = editAllowed ? '' : 'none';
    DOM.contextMenu.style.display = 'block';
    const x = Math.min(e.clientX, window.innerWidth - 160);
    const y = Math.min(e.clientY, window.innerHeight - 80);
    DOM.contextMenu.style.left = x + 'px';
    DOM.contextMenu.style.top = y + 'px';
}

export function markMessageAsFailed(tempId) {
    const wrap = document.querySelector(`[data-msg-id="${tempId}"]`);
    if (wrap) {
        const msgEl = wrap.querySelector('.chat-msg');
        if (msgEl) {
            msgEl.style.opacity = '1';
            msgEl.classList.add('chat-msg--failed');
            const footer = msgEl.querySelector('.chat-msg-footer');
            if (footer) {
                footer.innerHTML = '<span style="color:var(--danger-color);font-size:0.7rem;"><i class="fas fa-exclamation-circle"></i> Błąd wysyłania</span>';
            }
        }
    }
}

export function replaceTempMessage(tempId, savedMsg) {
    const wrap = document.querySelector(`[data-msg-id="${tempId}"]`);
    if (wrap) {
        const newWrap = buildMessageEl(savedMsg);
        // Ensure we keep the animate class if needed
        wrap.replaceWith(newWrap);
    } else {
        appendMessage(savedMsg, true);
    }
}

export function appendMessage(msg, animate) {
    const el = buildMessageEl(msg);
    if (animate) el.style.animation = 'fadeSlideIn 0.18s ease';
    DOM.messages.appendChild(el);
    virtualScrollTrim();
    scrollToBottom(false);
}

export function updateSidebarPreviewLocal(convId, content, sentAt, senderName, isMine) {
    const item = document.querySelector(`.chat-conv-item[data-conv-id="${convId}"]`);
    if (item) {
        let rawText = content || '';
        let previewText = isMine ? 'Ty: ' + rawText : rawText;
        if (previewText.length > 50) previewText = previewText.substring(0, 50) + '…';

        const pEl = item.querySelector('.conv-preview');
        if (pEl) pEl.textContent = previewText; // STRICT xss

        const tEl = item.querySelector('.conv-time');
        if (tEl) tEl.textContent = 'teraz';

        if (item !== DOM.convList.firstChild) {
            DOM.convList.insertBefore(item, DOM.convList.firstChild);
        }

        if (convId != state.currentConvId && !isMine) {
            item.classList.add('unread');
            const badgeEl = item.querySelector('.conv-unread-badge');
            if (badgeEl) {
                badgeEl.textContent = parseInt(badgeEl.textContent || '0') + 1;
            } else {
                const meta = item.querySelector('.conv-meta');
                if (meta) {
                    const b = document.createElement('span');
                    b.className = 'conv-unread-badge';
                    b.textContent = '1';
                    meta.appendChild(b);
                }
            }
        }
    } else {
        // Needs refresh
        import('./api.js').then(m => m.refreshConversationList());
    }
}

export function updateFriendButton(status) {
    const btn = document.getElementById('btnAddFriend');
    if (!btn) return;

    btn.disabled = false;
    btn.style.display = 'flex';

    switch (status) {
        case 'FRIENDS':
            btn.innerHTML = '<i class="fas fa-check"></i> Znajomy';
            btn.disabled = true;
            break;
        case 'SENT':
            btn.innerHTML = '<i class="fas fa-clock"></i> Zaproszenie wysłane';
            btn.disabled = true;
            break;
        case 'RECEIVED':
            btn.innerHTML = '<i class="fas fa-user-check"></i> Akceptuj zaproszenie';
            break;
        case 'LOCKED':
            btn.style.display = 'none';
            break;
        default:
            btn.innerHTML = '<i class="fas fa-user-plus"></i> Dodaj do znajomych';
    }
}
