import { notifications } from '../common/notifications.js';
import { confirmModal } from '../common/modals.js';

class FriendsModule {
    constructor() {
        this.DOM = {
            tabs: document.querySelectorAll('.tab-btn'),
            tabContents: document.querySelectorAll('.tab-content'),
            friendsGrid: document.getElementById('friendsGrid'),
            requestsList: document.getElementById('requestsList'),
            sentList: document.getElementById('sentList'),
            friendsCount: document.getElementById('friendsCount'),
            pendingCount: document.getElementById('pendingCount'),
            sentCount: document.getElementById('sentCount')
        };

        this.init();
    }

    init() {
        this.DOM.tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchTab(tab);
            });
        });

        this.loadFriends();
        this.loadPendingRequests();
        this.loadSentRequests();
        
        // Use event delegation for buttons
        this.DOM.friendsGrid.addEventListener('click', (e) => this.delegateAction(e));
        this.DOM.requestsList.addEventListener('click', (e) => this.delegateAction(e));
        this.DOM.sentList.addEventListener('click', (e) => this.delegateAction(e));
    }

    switchTab(tabName) {
        this.DOM.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
        this.DOM.tabContents.forEach(c => c.classList.toggle('active', c.id === `${tabName}Tab`));
    }

    async loadFriends() {
        try {
            const response = await fetch('/api/friends/list');
            if (!response.ok) throw new Error();
            const friends = await response.json();
            this.DOM.friendsCount.textContent = friends.length;
            this.renderFriends(friends);
        } catch (error) {
            notifications.error('Nie udało się załadować listy znajomych.');
        }
    }

    async loadPendingRequests() {
        try {
            const response = await fetch('/api/friends/pending');
            if (!response.ok) throw new Error();
            const requests = await response.json();
            this.DOM.pendingCount.textContent = requests.length;
            this.renderRequests(requests);
        } catch (error) {
            notifications.error('Nie udało się załadować zaproszeń.');
        }
    }

    async loadSentRequests() {
        try {
            const response = await fetch('/api/friends/sent');
            if (!response.ok) throw new Error();
            const requests = await response.json();
            this.DOM.sentCount.textContent = requests.length;
            this.renderSentRequests(requests);
        } catch (error) {
            notifications.error('Nie udało się załadować wysłanych zaproszeń.');
        }
    }

    renderFriends(friends) {
        this.DOM.friendsGrid.innerHTML = '';
        if (friends.length === 0) {
            this.DOM.friendsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-ghost"></i>
                    <p>Nie masz jeszcze żadnych znajomych.</p>
                </div>`;
            return;
        }

        friends.forEach(f => {
            const card = document.createElement('div');
            card.className = 'friend-card';
            card.innerHTML = `
                <div class="friend-card-inner">
                    <div class="friend-avatar">
                        <img src="/api/users/${f.userId}/avatar" alt="${f.fullName}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(f.fullName)}&background=random'">
                    </div>
                    <div class="friend-info">
                        <h3>${f.fullName}</h3>
                        <div class="field">
                            <i class="fas fa-graduation-cap"></i>
                            <span>${f.fieldOfStudy ? f.fieldOfStudy + ', ' + f.yearOfStudy + '. rok' : 'Student'}</span>
                        </div>
                    </div>
                    <div class="friend-actions">
                        <button class="icon-btn chat-btn" data-action="chat" data-id="${f.userId}" title="Czat">
                            <i class="fas fa-comment"></i>
                        </button>
                        <button class="icon-btn profile-btn" data-action="profile" data-id="${f.userId}" title="Profil">
                            <i class="fas fa-user"></i>
                        </button>
                        <button class="icon-btn remove-btn" data-action="remove" data-id="${f.userId}" title="Usuń ze znajomych">
                            <i class="fas fa-user-minus"></i>
                        </button>
                    </div>
                </div>
            `;
            this.DOM.friendsGrid.appendChild(card);
        });
    }

    renderRequests(requests) {
        this.DOM.requestsList.innerHTML = '';
        if (requests.length === 0) {
            this.DOM.requestsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>Brak nowych zaproszeń do znajomych.</p>
                </div>`;
            return;
        }

        requests.forEach(r => {
            const row = document.createElement('div');
            row.className = 'request-row';
            row.innerHTML = `
                <div class="request-user">
                    <div class="request-avatar">
                        <img src="/api/users/${r.senderId}/avatar" alt="${r.senderName}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(r.senderName)}&background=random'">
                    </div>
                    <div class="request-info">
                        <strong>${r.senderName}</strong>
                        <span>Chce dołączyć do Twoich znajomych</span>
                    </div>
                </div>
                <div class="request-actions">
                    <button class="profile-btn-small" data-action="profile" data-id="${r.senderId}" title="Zobacz profil">
                        <i class="fas fa-user"></i> Profil
                    </button>
                    <button class="accept-btn" data-action="accept" data-id="${r.requestId}">
                        <i class="fas fa-check"></i> Akceptuj
                    </button>
                    <button class="reject-btn" data-action="reject" data-id="${r.requestId}" title="Odrzuć">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            this.DOM.requestsList.appendChild(row);
        });
    }

    renderSentRequests(requests) {
        this.DOM.sentList.innerHTML = '';
        if (requests.length === 0) {
            this.DOM.sentList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-paper-plane"></i>
                    <p>Nie masz żadnych oczekujących zaproszeń.</p>
                </div>`;
            return;
        }

        requests.forEach(r => {
            const row = document.createElement('div');
            row.className = 'request-row';
            row.innerHTML = `
                <div class="request-user">
                    <div class="request-avatar">
                        <img src="/api/users/${r.senderId}/avatar" alt="${r.senderName}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(r.senderName)}&background=random'">
                    </div>
                    <div class="request-info">
                        <strong>${r.senderName}</strong>
                        <span>Oczekuje na akceptację</span>
                    </div>
                </div>
                <div class="request-actions">
                    <button class="profile-btn-small" data-action="profile" data-id="${r.senderId}" title="Zobacz profil">
                        <i class="fas fa-user"></i> Profil
                    </button>
                    <button class="reject-btn" data-action="cancel" data-id="${r.requestId}" title="Anuluj zaproszenie">
                        <i class="fas fa-trash-alt"></i> Anuluj
                    </button>
                </div>
            `;
            this.DOM.sentList.appendChild(row);
        });
    }

    delegateAction(e) {
        const btn = e.target.closest('button');
        if (!btn) return;

        const action = btn.dataset.action;
        const id = btn.dataset.id;

        if (action === 'chat') window.location.href = `/student/chat?userId=${id}`;
        if (action === 'profile') window.location.href = `/profile/user?userId=${id}`;
        if (action === 'remove') this.removeFriend(id);
        if (action === 'cancel') this.cancelRequest(id);
        if (action === 'accept' || action === 'reject') this.handleRequest(id, action);
    }

    async cancelRequest(requestId) {
        const confirmed = await confirmModal({
            title: 'Anuluj zaproszenie',
            message: 'Czy na pewno chcesz wycofać to zaproszenie do znajomych?',
            confirmText: 'Tak, anuluj',
            type: 'warning'
        });

        if (!confirmed) return;

        try {
            const response = await fetch(`/api/friends/cancel/${requestId}`, { method: 'POST' });
            if (response.ok) {
                notifications.success('Zaproszenie zostało wycofane.');
                this.loadSentRequests();
            } else {
                notifications.error('Nie udało się wycofać zaproszenia.');
            }
        } catch (err) {
            console.error(err);
            notifications.error('Błąd połączenia z serwerem.');
        }
    }

    async removeFriend(friendId) {
        const confirmed = await confirmModal({
            title: 'Usuń ze znajomych',
            message: 'Czy na pewno chcesz usunąć tę osobę ze swoich znajomych?',
            confirmText: 'Usuń',
            type: 'danger'
        });

        if (!confirmed) return;

        try {
            const response = await fetch(`/api/friends/remove/${friendId}`, { method: 'DELETE' });
            if (response.ok) {
                notifications.success('Użytkownik został usunięty ze znajomych.');
                this.loadFriends();
            } else {
                notifications.error('Nie udało się usunąć znajomego.');
            }
        } catch (err) {
            console.error(err);
            notifications.error('Błąd połączenia z serwerem.');
        }
    }

    async handleRequest(requestId, action) {
        try {
            const response = await fetch(`/api/friends/${action}/${requestId}`, { method: 'POST' });
            if (response.ok) {
                const msg = action === 'accept' ? 'Zaproszenie zaakceptowane!' : 'Zaproszenie odrzucone.';
                notifications.success(msg);
                this.loadFriends();
                this.loadPendingRequests();
                this.loadSentRequests();
            } else {
                notifications.error('Błąd podczas przetwarzania prośby.');
            }
        } catch (error) {
            notifications.error('Wystąpił błąd techniczny.');
        }
    }

    getInitials(name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new FriendsModule();
});
