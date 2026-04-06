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
        this.statsNotes = document.getElementById('statNotes');
        this.statsPosts = document.getElementById('statPosts');
        // Statystyki wspólne (próba wielu formatów ID dla bezpieczeństwa)
        this.statsNotes = document.getElementById('stats-notes') || document.getElementById('statNotes');
        this.statsPosts = document.getElementById('stats-posts') || document.getElementById('statPosts');
        this.statsComments = document.getElementById('stats-comments') || document.getElementById('statComments');
        
        // Nowe statystyki (Staż, Logowanie)
        this.statsSeniority = document.getElementById('stats-seniority') || document.getElementById('stats-seniority-admin');
        this.statsLastLogin = document.getElementById('stats-last-login') || document.getElementById('stats-last-login-admin');
        
        // Statystyki Admina / Starosty
        this.statsAnnouncements = document.getElementById('stats-announcements') || document.getElementById('stats-announcements-starosta');
        
        this.load();
    }

    async load() {
        try {
            await this.loadUserStats(); 
            
            if (!this.userId) {
                console.warn('User ID still undefined after loadUserStats, retrying in 500ms...');
                await new Promise(r => setTimeout(r, 500));
                await this.loadUserStats();
            }

            const promises = [
                this.loadNotes(),
                this.loadPosts(),
                this.loadComments()
            ];
            await Promise.all(promises);
        } catch (err) {
            console.error('Błąd inicjalizacji profilu:', err);
        }
    }

    // Pobieranie danych użytkownika dla stażu i ostatniego logowania
    async loadUserStats() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const userId = urlParams.get('userId');
            
            const apiUrl = userId ? `/api/users/${userId}` : ProfileModule.CONFIG.API.ME;
            const response = await fetch(apiUrl);
            
            if (!response.ok) throw new Error('Nie udało się pobrać danych użytkownika');
            
            const user = await response.json();
            this.userId = user.id; // Przechowaj ID dla innych metod
            this.renderUserPersonalStats(user);
            
            // Pobierz statystyki forum (licznik wątków i komentarzy)
            try {
                const forumStatsResponse = await fetch(`/api/forum/users/${user.id}/stats`);
                if (forumStatsResponse.ok) {
                    const stats = await forumStatsResponse.json();
                    if (this.statsPosts) this.statsPosts.textContent = stats.threadsCount;
                    if (this.statsComments) this.statsComments.textContent = stats.commentsCount;
                }
            } catch (err) {
                console.warn('Nie udało się pobrać statystyk forum:', err);
            }

            // Jeśli przeglądamy profil kogoś innego (mamy userId w URL), możemy ukryć elementy edycji
            if (userId) {
                document.querySelectorAll('.only-me').forEach(el => el.style.display = 'none');
            }

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
            const response = await fetch(`/api/announcements/count/author/${userId}`);
            if (!response.ok || response.redirected || response.url.includes('/login')) return;
            
            const count = await response.json();
            
            if (this.statsAnnouncements) {
                this.statsAnnouncements.textContent = count;
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
        try {
            const response = await fetch(`/api/forum/users/${this.userId}/threads`);
            if (!response.ok || response.redirected || response.url.includes('/login')) return;
            const posts = await response.json();
            
            if (this.statsPosts) {
                this.statsPosts.textContent = posts ? posts.length : 0;
            }
            if (this.postsContainer) {
                this.renderPosts(posts); 
            }
        } catch (error) {
            console.error('Błąd ładowania postów:', error);
        }
    }

    renderPosts(posts) {
        if (!posts || posts.length === 0) {
            this.showEmptyState(this.postsContainer, 'fa-comments', 'Nie dodałeś jeszcze żadnych postów.', '/student/forum', 'Przejdź do forum');
            return;
        }

        let html = '';
        posts.slice(0, 5).forEach(post => {
            const date = Utils.formatDate(post.createdAt);
            const contentPreview = post.content.substring(0, 100) + (post.content.length > 100 ? '...' : '');
            
            html += `
                <a href="/student/forum?threadId=${post.id}" class="post-mini-card">
                    <h4 class="post-mini-title">${Utils.escapeHtml(post.title)}</h4>
                    <p class="post-mini-content">${Utils.escapeHtml(contentPreview)}</p>
                    <span class="post-mini-date">${date}</span>
                </a>
            `;
        });
        this.postsContainer.innerHTML = html;
    }

    // Sekcja: Komentarze
    async loadComments() {
        try {
            const response = await fetch(`/api/forum/users/${this.userId}/comments`);
            if (!response.ok || response.redirected || response.url.includes('/login')) return;
            const comments = await response.json();
            
            if (this.statsComments) {
                this.statsComments.textContent = comments ? comments.length : 0;
            }
            if (this.commentsContainer) {
                this.renderComments(comments);
            }
        } catch (error) {
            console.error('Błąd ładowania komentarzy:', error);
        }
    }

    renderComments(comments) {
        if (!this.commentsContainer) return;
        if (!comments || comments.length === 0) {
            this.showEmptyState(this.commentsContainer, 'fa-reply', 'Nie napisałeś jeszcze żadnego komentarza.', '/student/forum', 'Przejdź do forum');
            return;
        }

        let html = '';
        comments.slice(0, 5).forEach(comment => {
            const date = Utils.formatDate(comment.createdAt);
            const preview = comment.content.substring(0, 80) + (comment.content.length > 80 ? '...' : '');
            const threadId = comment.threadId;

            html += `
                <a href="/student/forum?threadId=${threadId}" class="comment-mini-card">
                    <p class="comment-mini-content">"${Utils.escapeHtml(preview)}"</p>
                    <span class="comment-mini-date">${date}</span>
                </a>
            `;
        });
        this.commentsContainer.innerHTML = html;
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