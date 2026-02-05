class ProfileModule {
    static CONFIG = {
        API: {
            MY_NOTES: '/api/notes/my-notes'
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
        
        // Statystyki
        this.statsNotes = document.getElementById('stats-notes');
        this.statsPosts = document.getElementById('stats-posts');
        this.statsComments = document.getElementById('stats-comments');
        
        this.load();
    }

    async load() {
        await Promise.all([
            this.loadNotes(),
            this.loadPosts(),
            this.loadComments()
        ]);
    }

    // Sekcja: Notatki
    async loadNotes() {
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
        // Aktualizacja licznika
        if (this.statsNotes) {
            this.statsNotes.textContent = notes ? notes.length : 0;
        }

        if (!notes || notes.length === 0) {
            this.showEmptyState(this.notesContainer, 'fa-sticky-note', 'Brak notatek.', '/dashboard/notes', 'Utwórz notatkę');
            return;
        }

        // Sortowanie: Najnowsze na górze
        notes.sort((a, b) => {
            const dateA = new Date(a.updatedAt || a.createdAt);
            const dateB = new Date(b.updatedAt || b.createdAt);
            return dateB - dateA;
        });

        // Limit wyświetlania: 5 najnowszych
        const recentNotes = notes.slice(0, ProfileModule.CONFIG.LIMITS.NOTES_DISPLAY); 

        let html = '';
        recentNotes.forEach(note => {
            // Używamy Utils.formatDate (czas relatywny)
            const date = Utils.formatDate(note.updatedAt || note.createdAt);
            
            const preview = Utils.stripHtml(note.content).substring(0, ProfileModule.CONFIG.LIMITS.PREVIEW_LENGTH) + 
                           (note.content.length > ProfileModule.CONFIG.LIMITS.PREVIEW_LENGTH ? '...' : '');

            html += `
                <a href="/dashboard/notes?id=${note.id}" class="note-mini-card">
                    <h4 class="note-mini-title">${Utils.escapeHtml(note.title)}</h4>
                    <p class="note-mini-content">${Utils.escapeHtml(preview)}</p>
                    <span class="note-mini-date">${date}</span>
                </a>
            `;
        });

        this.notesContainer.innerHTML = html;
    }

    // Sekcja: Posty
    async loadPosts() {
        const posts = []; // Tymczasowe dane (placeholder)
        
        // Aktualizacja licznika
        if (this.statsPosts) {
            this.statsPosts.textContent = posts ? posts.length : 0;
        }

        this.renderPosts(posts); 
    }

    renderPosts(posts) {
        if (!posts || posts.length === 0) {
            this.showEmptyState(this.postsContainer, 'fa-comments', 'Nie dodałeś jeszcze żadnych postów.', '/dashboard/forum', 'Przejdź do forum');
            return;
        }
        // logika renderowania postów ...
    }

    // Sekcja: Komentarze
    async loadComments() {
        const comments = []; // Tymczasowe dane (placeholder)

        // Aktualizacja licznika
        if (this.statsComments) {
            this.statsComments.textContent = comments ? comments.length : 0;
        }

        this.renderComments(comments);
    }

    renderComments(comments) {
        if (!comments || comments.length === 0) {
            this.commentsContainer.innerHTML = `
                <div class="empty-state-small">
                    <i class="fas fa-comment-slash"></i>
                    <p>Brak komentarzy</p>
                </div>
            `;
            return;
        }

        // TODO: Implementacja wyświetlania komentarzy
    }

    // Sekcja: Narzędzia pomocnicze

    showEmptyState(container, iconClass, message, linkUrl, linkText) {
        let btnHtml = '';
        if (linkUrl && linkText) {
            btnHtml = `<a href="${linkUrl}" class="btn-link">${linkText}</a>`;
        }
        
        container.innerHTML = `
            <div class="empty-state-small">
                <i class="fas ${iconClass}"></i>
                <p>${message}</p>
                ${btnHtml}
            </div>
        `;
    }

    showError(container, message) {
        container.innerHTML = `
            <div class="empty-state-small error">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${message}</p>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.profileModule = new ProfileModule();
});