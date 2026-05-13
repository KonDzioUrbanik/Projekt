import { notifications } from '../common/notifications.js';
import { confirmModal } from '../common/modals.js';

class UserProfileModule {
    constructor() {
        const urlParams = new URLSearchParams(window.location.search);
        this.userId = urlParams.get('userId');

        if (!this.userId) {
            console.error('No userId provided in URL');
            return;
        }

        this.DOM = {
            userName: document.getElementById('userName'),
            userRole: document.getElementById('userRole'),
            userEmail: document.getElementById('userEmail'),
            userAvatar: document.getElementById('userAvatar'),
            userInitials: document.getElementById('userInitials'),
            upAvatarWrapper: document.getElementById('upAvatarWrapper'),
            userField: document.getElementById('userField'),
            userYear: document.getElementById('userYear'),
            userBio: document.getElementById('userBio'),
            userStudyMode: document.getElementById('userStudyMode'),
            userJoined: document.getElementById('userJoined'),
            userLastSeen: document.getElementById('userLastSeen'),
            statPosts: document.getElementById('statPosts'),
            statNotes: document.getElementById('statNotes'),
            statComments: document.getElementById('statComments'),
            activityList: document.getElementById('activityList'),
            breadcrumbActive: document.querySelector('.breadcrumb-item.active')
        };

        this.init();
    }

    async init() {
        try {
            await this.loadUserData();
            await this.loadUserActivity();
        } catch (error) {
            console.error('Error initializing user profile:', error);
        }
    }

    async loadUserData() {
        try {
            const response = await fetch(`/api/users/${this.userId}`);
            if (!response.ok) throw new Error('Failed to fetch user data');

            const user = await response.json();
            
            // Aktualizacja breadcrumbs o nazwę użytkownika
            if (window.Breadcrumbs) {
                window.Breadcrumbs.updateTitle(`${user.firstName} ${user.lastName}`);
            }
            this.renderUser(user);
            this.updateBreadcrumbs(user);
        } catch (error) {
            this.DOM.userName.textContent = 'Błąd ładowania';
            console.error(error);
        }
    }

    updateBreadcrumbs(user) {
        const fullName = `${user.firstName} ${user.lastName}`;
        if (this.DOM.breadcrumbActive) {
            this.DOM.breadcrumbActive.textContent = `Profil: ${fullName}`;
        }
        document.title = `Profil - ${fullName} | PANSportal`;
    }

    renderUser(user) {
        const fullName = `${user.firstName} ${user.lastName}`;
        this.DOM.userName.textContent = fullName;
        this.DOM.userRole.textContent = user.role || 'Słuchacz';
        this.DOM.userEmail.textContent = user.email;
        
        if (this.DOM.upAvatarWrapper) {
            this.DOM.upAvatarWrapper.setAttribute('data-user-email', (user.email || '').toLowerCase());
            if (window.UserPresence) window.UserPresence.refreshUI();
        }
        
        // Avatar
        const avatarUrl = `/api/users/${user.id}/avatar`;
        this.DOM.userAvatar.src = avatarUrl;
        this.DOM.userAvatar.onload = () => {
            this.DOM.userAvatar.style.display = 'block';
            this.DOM.userInitials.style.display = 'none';
        };
        this.DOM.userAvatar.onerror = () => {
            this.DOM.userAvatar.style.display = 'none';
            this.DOM.userInitials.style.display = 'flex';
            const initialsText = (user.firstName && user.lastName) 
                ? (user.firstName[0] + user.lastName[0]).toUpperCase()
                : (user.firstName ? user.firstName[0] : '?').toUpperCase();
            this.DOM.userInitials.textContent = initialsText;
        };

        // Pills & Info
        this.DOM.userField.innerHTML = user.fieldOfStudy 
            ? `<i class="fas fa-graduation-cap"></i> ${user.fieldOfStudy}`
            : `<i class="fas fa-graduation-cap"></i> Nie podano`;

        this.DOM.userYear.innerHTML = user.yearOfStudy 
            ? `<i class="fas fa-calendar-alt"></i> ${user.yearOfStudy} rok`
            : `<i class="fas fa-calendar-alt"></i> Nie podano`;

        this.DOM.userBio.textContent = user.bio || 'Ten użytkownik nie dodał jeszcze swojego biogramu.';
        this.DOM.userStudyMode.textContent = user.gender === 'MALE' ? 'Mężczyzna' : (user.gender === 'FEMALE' ? 'Kobieta' : 'Nie podano');
        
        if (user.createdAt) {
            this.DOM.userJoined.textContent = new Date(user.createdAt).toLocaleDateString('pl-PL');
        }

        const lastActive = user.lastLogin || user.createdAt;
        if (lastActive) {
            this.DOM.userLastSeen.textContent = Utils.formatDate(new Date(lastActive));
        }

        this.renderFriendActions(user.id);
    }

    async renderFriendActions(targetUserId) {
        const actionsContainer = document.getElementById('profileActions');
        if (!actionsContainer) return;

        try {
            const response = await fetch(`/api/friends/status/${targetUserId}`);
            const status = await response.text();

            actionsContainer.innerHTML = '';

            if (status === 'LOCKED') {
                actionsContainer.style.display = 'none';
                return;
            }
            actionsContainer.style.display = 'flex';

            switch (status) {
                case 'NONE':
                    const addBtn = document.createElement('button');
                    addBtn.className = 'btn-primary up-action-btn';
                    addBtn.innerHTML = '<i class="fas fa-user-plus"></i> Dodaj do znajomych';
                    addBtn.onclick = () => this.handleFriendAction('request', targetUserId);
                    actionsContainer.appendChild(addBtn);
                    break;
                case 'SENT':
                    const sentBtn = document.createElement('button');
                    sentBtn.className = 'btn-secondary up-action-btn';
                    sentBtn.disabled = true;
                    sentBtn.innerHTML = '<i class="fas fa-clock"></i> Zaproszenie wysłane';
                    actionsContainer.appendChild(sentBtn);
                    break;
                case 'RECEIVED':
                    const acceptBtn = document.createElement('button');
                    acceptBtn.className = 'btn-primary up-action-btn';
                    acceptBtn.innerHTML = '<i class="fas fa-check"></i> Akceptuj zaproszenie';
                    acceptBtn.onclick = () => this.handleAcceptRequest(targetUserId);
                    actionsContainer.appendChild(acceptBtn);
                    break;
                case 'FRIENDS':
                    const chatBtn = document.createElement('button');
                    chatBtn.className = 'btn-primary up-action-btn';
                    chatBtn.innerHTML = '<i class="fas fa-comment"></i> Rozpocznij czat';
                    chatBtn.onclick = () => window.location.href = `/student/chat?userId=${targetUserId}`;
                    actionsContainer.appendChild(chatBtn);

                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'btn-secondary up-action-btn danger-text';
                    removeBtn.innerHTML = '<i class="fas fa-user-minus"></i> Usuń ze znajomych';
                    removeBtn.onclick = () => this.handleRemoveFriend(targetUserId);
                    actionsContainer.appendChild(removeBtn);
                    break;
            }
        } catch (error) {
            console.error('Error rendering friend actions:', error);
        }
    }

    async handleFriendAction(action, targetUserId) {
        try {
            const response = await fetch(`/api/friends/${action}/${targetUserId}`, { method: 'POST' });
            if (response.ok) {
                notifications.success('Zaproszenie zostało wysłane pomyślnie!');
                this.renderFriendActions(targetUserId);
            } else {
                const msg = await response.text();
                notifications.error(msg || 'Nie udało się wysłać zaproszenia.');
            }
        } catch (error) {
            console.error('Error handled friend action:', error);
            notifications.error('Wystąpił błąd podczas komunikacji z serwerem.');
        }
    }

    async handleAcceptRequest(targetUserId) {
        try {
            const pendingResp = await fetch('/api/friends/pending');
            const pending = await pendingResp.json();
            const request = pending.find(r => r.senderId == targetUserId);
            if (request) {
                const response = await fetch(`/api/friends/accept/${request.requestId}`, { method: 'POST' });
                if (response.ok) {
                    notifications.success('Zaproszenie zaakceptowane!');
                    this.renderFriendActions(targetUserId);
                } else {
                    notifications.error('Błąd podczas akceptowania zaproszenia.');
                }
            }
        } catch (error) {
            console.error('Error accepting friend request:', error);
            notifications.error('Wystąpił błąd techniczny.');
        }
    }

    async handleRemoveFriend(targetUserId) {
        const confirmed = await confirmModal({
            title: 'Usuń ze znajomych',
            message: `Czy na pewno chcesz usunąć tę osobę ze swoich znajomych?`,
            confirmText: 'Usuń',
            type: 'danger'
        });

        if (!confirmed) return;

        try {
            const response = await fetch(`/api/friends/remove/${targetUserId}`, { method: 'DELETE' });
            if (response.ok) {
                notifications.success('Użytkownik został usunięty ze znajomych.');
                this.renderFriendActions(targetUserId);
            } else {
                notifications.error('Nie udało się usunąć znajomego.');
            }
        } catch (error) {
            console.error('Error removing friend:', error);
            notifications.error('Wystąpił błąd techniczny.');
        }
    }

    async loadUserActivity() {
        try {
            // Forum stats (threads and comments)
            const forumStatsResponse = await fetch(`/api/forum/users/${this.userId}/stats`);
            if (forumStatsResponse.ok) {
                const stats = await forumStatsResponse.json();
                if (this.DOM.statPosts) this.DOM.statPosts.textContent = stats.threadsCount;
                if (this.DOM.statComments) this.DOM.statComments.textContent = stats.commentsCount;
            }

            // Notes count
            const notesResponse = await fetch(`/api/notes/by-user/${this.userId}`);
            if (notesResponse.ok) {
                const notes = await notesResponse.json();
                if (this.DOM.statNotes) this.DOM.statNotes.textContent = notes.length;
            }

            // Unified Activity
            const activityResponse = await fetch(`/api/users/${this.userId}/activity`);
            if (activityResponse.ok) {
                const activities = await activityResponse.json();
                this.renderActivity(activities);
            }
        } catch (error) {
            console.error('Error loading activity:', error);
        }
    }

    renderActivity(activities) {
        if (!activities || activities.length === 0) {
            this.DOM.activityList.innerHTML = '<p class="up-empty-text">Brak aktywności w ostatnim czasie.</p>';
            return;
        }

        this.DOM.activityList.innerHTML = '';
        activities.forEach(activity => {
            const date = Utils.formatDate(activity.createdAt);
            const activityItem = document.createElement('div');
            activityItem.className = 'up-activity-item';
            
            const icon = activity.type === 'FORUM_THREAD' ? 'fa-comments' : 'fa-sticky-note';
            const actionText = activity.type === 'FORUM_THREAD' ? 'Dodano wątek:' : 'Udostępniono notatkę:';
            const link = activity.type === 'FORUM_THREAD' ? `/student/forum?threadId=${activity.id}` : `/student/notes?id=${activity.id}`;

            activityItem.innerHTML = `
                <div style="display: flex; gap: 1rem; align-items: flex-start; padding: 1.25rem; border-bottom: 1px solid var(--border); transition: all 0.2s ease; cursor: pointer; border-radius: 12px; margin-bottom: 0.5rem; background: var(--bg-card);">
                    <div style="background: var(--primary-light); width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--primary); flex-shrink: 0;">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div style="flex: 1;">
                        <p style="margin: 0 0 0.25rem; color: var(--text-main); font-weight: 700; font-size: 0.95rem;">${actionText} ${Utils.escapeHtml(activity.title)}</p>
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <span style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem;">
                                <i class="far fa-clock"></i> ${date}
                            </span>
                            <span style="font-size: 0.8rem; color: var(--primary); font-weight: 600;">Kliknij, aby zobaczyć</span>
                        </div>
                    </div>
                    <div style="color: var(--text-muted); opacity: 0.5;">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            `;

            activityItem.querySelector('div').onclick = () => {
                window.location.href = link;
            };
            this.DOM.activityList.appendChild(activityItem);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new UserProfileModule();
});
