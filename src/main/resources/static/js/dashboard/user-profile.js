/**
 * Dedicated User Profile Module
 * Logic for viewing other users' public data.
 */
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
    }

    async loadUserActivity() {
        try {
            // Stats (Announcements count)
            const announcementsResponse = await fetch(`/api/announcements/count/author/${this.userId}`);
            if (announcementsResponse.ok) {
                const count = await announcementsResponse.json();
                this.DOM.statPosts.textContent = count;
            }

            // Load shared/accessible notes from this user
            const notesResponse = await fetch(`/api/notes/by-user/${this.userId}`);
            if (notesResponse.ok) {
                const notes = await notesResponse.json();
                this.DOM.statNotes.textContent = notes.length;
                this.renderActivity(notes);
            }
        } catch (error) {
            console.error('Error loading activity:', error);
        }
    }

    renderActivity(notes) {
        if (!notes || notes.length === 0) return;

        this.DOM.activityList.innerHTML = '';
        notes.slice(0, 5).forEach(note => {
            const date = Utils.formatDate(new Date(note.updatedAt || note.createdAt));
            const activityItem = document.createElement('div');
            activityItem.className = 'up-activity-item';
            activityItem.innerHTML = `
                <div style="display: flex; gap: 1rem; align-items: flex-start; padding: 1.25rem; border-bottom: 1px solid var(--border); transition: all 0.2s ease; cursor: pointer; border-radius: 12px; margin-bottom: 0.5rem; background: var(--bg-card);">
                    <div style="background: var(--primary-light); width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--primary); flex-shrink: 0;">
                        <i class="fas fa-sticky-note"></i>
                    </div>
                    <div style="flex: 1;">
                        <p style="margin: 0 0 0.25rem; color: var(--text-main); font-weight: 700; font-size: 0.95rem;">Udostępniono notatkę: ${Utils.escapeHtml(note.title)}</p>
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
                window.location.href = `/student/notes?id=${note.id}`;
            };
            this.DOM.activityList.appendChild(activityItem);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new UserProfileModule();
});
