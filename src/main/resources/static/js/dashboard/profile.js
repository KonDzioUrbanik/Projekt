class ProfileModule {
    constructor() {
        this.notesContainer = document.getElementById('notes-container');
        this.postsContainer = document.getElementById('posts-container');
        this.commentsContainer = document.getElementById('comments-container');
        
        this.load();
    }

    async load() {
        await Promise.all([
            this.loadNotes(),
            this.loadPosts(),
            this.loadComments()
        ]);
    }

    // NOTATKI
    async loadNotes() {
        try {
            const response = await fetch('/api/notes/my-notes');
            
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
        if (!notes || notes.length === 0) {
            this.showEmptyState(this.notesContainer, 'fa-sticky-note', 'Brak notatek.', '/dashboard/notes', 'Utwórz notatkę');
            return;
        }

        // SORTOWANIE: Najnowsze na górze
        notes.sort((a, b) => {
            const dateA = new Date(a.updatedAt || a.createdAt);
            const dateB = new Date(b.updatedAt || b.createdAt);
            return dateB - dateA;
        });

        // 2. LIMIT: Bierzemy 5 pierwszych
        const recentNotes = notes.slice(0, 5); 

        let html = '';
        recentNotes.forEach(note => {
            // Używamy nowej metody formatDate (czas relatywny)
            const date = this.formatDate(note.updatedAt || note.createdAt);
            
            const preview = this.stripHtml(note.content).substring(0, 60) + (note.content.length > 60 ? '...' : '');

            html += `
                <a href="/dashboard/notes?id=${note.id}" class="note-mini-card">
                    <h4 class="note-mini-title">${this.escapeHtml(note.title)}</h4>
                    <p class="note-mini-content">${this.escapeHtml(preview)}</p>
                    <span class="note-mini-date">${date}</span>
                </a>
            `;
        });

        this.notesContainer.innerHTML = html;
    }

    // POSTY
    async loadPosts() {
        // Placeholder
        this.renderPosts([]); 
    }

    renderPosts(posts) {
        if (!posts || posts.length === 0) {
            this.showEmptyState(this.postsContainer, 'fa-comments', 'Nie dodałeś jeszcze żadnych postów.', '/dashboard/forum', 'Przejdź do forum');
            return;
        }
        // logika renderowania postów ...
    }

    // KOMENTARZE
    async loadComments() {
        // Placeholder
        this.renderComments([]);
    }

    renderComments(comments) {
        if (!comments || comments.length === 0) {
            this.postsContainer.innerHTML = `
                <div class="empty-state-small">
                    <i class="fas fa-comment-slash" style="opacity: 0.5; font-size: 2rem; margin-bottom: 10px;"></i>
                    <p style="color: #64748b;">Brak postów</p>
                </div>
            `;
            return;
        }

        // logika renderowania komentarzy ...
    }

    // NARZĘDZIA

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'przed chwilą';
        
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `${diffInMinutes} min temu`;

        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) {
            if (diffInHours === 1) return 'godzinę temu';
            if (diffInHours > 1 && diffInHours < 5) return `${diffInHours} godz. temu`;
            return `${diffInHours} godz. temu`;
        }

        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays === 1) return 'wczoraj';

        return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
    }

    showEmptyState(container, iconClass, message, linkUrl, linkText) {
        let btnHtml = '';
        if (linkUrl && linkText) {
            btnHtml = `<a href="${linkUrl}" class="btn-link" style="margin-top:5px; display:inline-block;">${linkText}</a>`;
        }
        
        container.innerHTML = `
            <div class="empty-state-small" style="text-align:center; padding:30px; color:#64748b;">
                <i class="fas ${iconClass}" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5;"></i>
                <p style="margin:0;">${message}</p>
                ${btnHtml}
            </div>
        `;
    }

    showError(container, message) {
        container.innerHTML = `
            <div class="empty-state-small" style="text-align:center; padding:30px; color:#ef4444;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 10px;"></i>
                <p>${message}</p>
            </div>`;
    }

    escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    stripHtml(html) {
       let tmp = document.createElement("DIV");
       tmp.innerHTML = html;
       return tmp.textContent || tmp.innerText || "";
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.profileModule = new ProfileModule();
});