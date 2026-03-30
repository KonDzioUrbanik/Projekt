class ProfileModule {
    static CONFIG = {
        API: {
            MY_NOTES: '/api/notes/my-notes',
            ME: '/api/users/me',
            ALL_ANNOUNCEMENTS: '/api/announcements/all'
        },
        LIMITS: {
            NOTES_DISPLAY: 5,
            PREVIEW_LENGTH: 60
        }
    };

    constructor() {
        this.notesContainer = document.getElementById('notes-container');
        this.postsContainer = document.getElementById('posts-container');
        this.commentsContainer = document.getElementById('comments-container');
        
        // Statystyki wspólne
        this.statsNotes = document.getElementById('stats-notes');
        this.statsPosts = document.getElementById('stats-posts');
        this.statsComments = document.getElementById('stats-comments');
        
        // Nowe statystyki (Staż, Logowanie)
        this.statsSeniority = document.getElementById('stats-seniority') || document.getElementById('stats-seniority-admin');
        this.statsLastLogin = document.getElementById('stats-last-login') || document.getElementById('stats-last-login-admin');
        
        // Statystyki Admina / Starosty
        this.statsAnnouncements = document.getElementById('stats-announcements') || document.getElementById('stats-announcements-starosta');
        
        this.load();
    }

    async load() {
        const promises = [
            this.loadUserStats(),
            this.loadNotes(),
            this.loadPosts(),
            this.loadComments()
        ];
        await Promise.all(promises);
    }

    // Pobieranie danych użytkownika dla stażu i ostatniego logowania
    async loadUserStats() {
        try {
            const response = await fetch(ProfileModule.CONFIG.API.ME);
            if (!response.ok) throw new Error('Nie udało się pobrać danych użytkownika');
            
            const user = await response.json();
            this.renderUserPersonalStats(user);
            
            // Jeśli Admin lub Starosta, załaduj dodatkowo jego ogłoszenia
            if (this.statsAnnouncements && user.role && (user.role.includes('ADMIN') || user.role.includes('STAROSTA'))) {
                this.loadAuthorAnnouncementsCount(user.id);
            }
        } catch (error) {
            console.error('Błąd ładowania statystyk użytkownika:', error);
        }
    }

    renderUserPersonalStats(user) {
        // Staż konta
        if (this.statsSeniority && user.createdAt) {
            const created = new Date(user.createdAt);
            // Wartość główna: Dokładna data (bez godziny)
            this.statsSeniority.textContent = created.toLocaleDateString('pl-PL');
            
            // Tooltip: Szczegółowy staż (miesiące, dni)
            const parentCard = this.statsSeniority.closest('.stat-card');
            if (parentCard) {
                parentCard.setAttribute('title', this.calculateDetailedSeniority(created));
            }
        }

        // Ostatnia sesja
        const sessionDate = user.previousLogin || user.lastLogin;
        
        if (this.statsLastLogin && sessionDate) {
            const lastLoginDate = new Date(sessionDate);
            
            this.statsLastLogin.textContent = this.formatLastLogin(lastLoginDate);

            const parentCard = this.statsLastLogin.closest('.stat-card');
            if (parentCard) {
                parentCard.setAttribute('title', `Pełna data poprzedniej sesji: ${Utils.formatFullDate(sessionDate)}`);
            }
        }
    }

    formatLastLogin(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'Przed chwilą';
        
        const isToday = now.toLocaleDateString() === date.toLocaleDateString();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const isYesterday = yesterday.toLocaleDateString() === date.toLocaleDateString();
        
        const timeStr = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
        
        if (isToday) return `Dzisiaj, ${timeStr}`;
        if (isYesterday) return `Wczoraj, ${timeStr}`;
        
        // Jeśli starsze niż wczoraj, używamy standardowego Utils.formatDate (np. "2 dni temu")
        return Utils.formatDate(date);
    }

    calculateDetailedSeniority(createdDate) {
        const now = new Date();
        let years = now.getFullYear() - createdDate.getFullYear();
        let months = now.getMonth() - createdDate.getMonth();
        let days = now.getDate() - createdDate.getDate();

        if (days < 0) {
            months--;
            const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
            days += lastMonth.getDate();
        }
        if (months < 0) {
            years--;
            months += 12;
        }

        const parts = [];
        if (years > 0) parts.push(`${years} ${years === 1 ? 'rok' : (years < 5 ? 'lata' : 'lat')}`);
        if (months > 0) parts.push(`${months} ${months === 1 ? 'miesiąc' : (months < 5 ? 'miesiące' : 'miesięcy')}`);
        if (days > 0) parts.push(`${days} ${days === 1 ? 'dzień' : 'dni'}`);

        return parts.length > 0 ? `Twój staż: ${parts.join(', ')}` : 'Konto utworzone dzisiaj';
    }

    async loadAuthorAnnouncementsCount(userId) {
        try {
            const response = await fetch(ProfileModule.CONFIG.API.ALL_ANNOUNCEMENTS);
            if (!response.ok) return;
            
            const announcements = await response.json();
            // Filtrujemy ogłoszenia, których autorem jest bieżący użytkownik
            const ownAnnouncements = announcements.filter(a => a.authorId === userId);
            
            if (this.statsAnnouncements) {
                this.statsAnnouncements.textContent = ownAnnouncements.length;
            }
        } catch (error) {
            console.error('Błąd ładowania liczby ogłoszeń:', error);
        }
    }

    // Sekcja: Notatki
    async loadNotes() {
        if (!this.notesContainer) return;
        try {
            const response = await fetch(ProfileModule.CONFIG.API.MY_NOTES);
            
            if (!response.ok) {
                if(response.redirected && response.url.includes('/login')) return;
                throw new Error('Błąd pobierania notatek');
            }

            const notes = await response.json();
            this.renderNotes(notes);

        } catch (error) {
            console.error(error);
            this.showError(this.notesContainer, 'Nie udało się załadować notatek');
        }
    }

    renderNotes(notes) {
        if (!this.notesContainer) return;
        // Aktualizacja licznika
        if (this.statsNotes) {
            this.statsNotes.textContent = notes ? notes.length : 0;
        }

        if (!notes || notes.length === 0) {
            this.showEmptyState(this.notesContainer, 'fa-sticky-note', 'Brak notatek.', '/student/notes', 'Utwórz notatkę');
            return;
        }

        notes.sort((a, b) => {
            const dateA = new Date(a.updatedAt || a.createdAt);
            const dateB = new Date(b.updatedAt || b.createdAt);
            return dateB - dateA;
        });

        const recentNotes = notes.slice(0, ProfileModule.CONFIG.LIMITS.NOTES_DISPLAY); 

        let html = '';
        recentNotes.forEach(note => {
            const date = Utils.formatDate(note.updatedAt || note.createdAt);
            const cleanContent = Utils.stripMarkdown(Utils.stripHtml(note.content));
            const preview = cleanContent.substring(0, ProfileModule.CONFIG.LIMITS.PREVIEW_LENGTH) + 
                           (cleanContent.length > ProfileModule.CONFIG.LIMITS.PREVIEW_LENGTH ? '...' : '');

            html += `
                <a href="/student/notes?id=${note.id}" class="note-mini-card">
                    <h4 class="note-mini-title">${Utils.stripMarkdown(Utils.escapeHtml(note.title))}</h4>
                    <p class="note-mini-content">${Utils.escapeHtml(preview)}</p>
                    <span class="note-mini-date">${date}</span>
                </a>
            `;
        });

        this.notesContainer.innerHTML = html;
    }

    // Sekcja: Posty
    async loadPosts() {
        const posts = []; 
        if (this.statsPosts) {
            this.statsPosts.textContent = posts ? posts.length : 0;
        }
        if (this.postsContainer) {
            this.renderPosts(posts); 
        }
    }

    renderPosts(posts) {
        if (!posts || posts.length === 0) {
            this.showEmptyState(this.postsContainer, 'fa-comments', 'Nie dodałeś jeszcze żadnych postów.', '/student/forum', 'Przejdź do forum');
            return;
        }
    }

    // Sekcja: Komentarze
    async loadComments() {
        const comments = []; 
        if (this.statsComments) {
            this.statsComments.textContent = comments ? comments.length : 0;
        }
        if (this.commentsContainer) {
            this.renderComments(comments);
        }
    }

    renderComments(comments) {
        if (!this.commentsContainer) return;
        if (!comments || comments.length === 0) {
            this.commentsContainer.innerHTML = `
                <div class="empty-state-small">
                    <i class="fas fa-comment-slash" aria-hidden="true"></i>
                    <p>Brak komentarzy</p>
                </div>
            `;
            return;
        }
    }

    // Sekcja: Narzędzia pomocnicze

    showEmptyState(container, iconClass, message, linkUrl, linkText) {
        if (!container) return;
        let btnHtml = '';
        if (linkUrl && linkText) {
            btnHtml = `<a href="${linkUrl}" class="btn-link">${Utils.escapeHtml(linkText)}</a>`;
        }
        container.innerHTML = `
            <div class="empty-state-small">
                <i class="fas ${Utils.escapeHtml(iconClass)}" aria-hidden="true"></i>
                <p>${Utils.escapeHtml(message)}</p>
                ${btnHtml}
            </div>
        `;
    }

    showError(container, message) {
        if (!container) return;
        container.innerHTML = `
            <div class="empty-state-small error">
                <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
                <p>${Utils.escapeHtml(message)}</p>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.profileModule = new ProfileModule();
});