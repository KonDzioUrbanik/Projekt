'use strict';

const FeedbackManager = {
    state: {
        feedback: [],
        filteredFeedback: [],
        currentId: null,
        pendingDeleteId: null,
        filters: {
            search: '',
            status: '',
            type: ''
        }
    },

    elements: {
        tableBody: document.querySelector('.feedback-table tbody'),
        searchInput: document.getElementById('searchInput'),
        statusFilter: document.getElementById('statusFilter'),
        typeFilter: document.getElementById('typeFilter'),
        modal: document.getElementById('feedbackDetailModal'),
        resultsCount: document.getElementById('resultsCount')
    },

    // Inicjalizacja
    init() {
        this.fetchFeedback();
        this.attachEventListeners();
        this.initDeleteModal();
    },

    initDeleteModal() {
        const btnCancel = document.getElementById('btnCancelDelete');
        const btnConfirm = document.getElementById('btnConfirmDelete');
        const overlay = document.getElementById('deleteConfirmOverlay');

        if (btnCancel && overlay) {
            btnCancel.addEventListener('click', () => {
                overlay.classList.remove('active');
                this.state.pendingDeleteId = null;
            });
        }

        if (btnConfirm && overlay) {
            btnConfirm.addEventListener('click', () => {
                overlay.classList.remove('active');
                if (this.state.pendingDeleteId) {
                    this.executeDelete(this.state.pendingDeleteId);
                }
            });
        }
    },

    // Pobieranie danych
    async fetchFeedback() {
        try {
            const response = await fetch('/api/feedback');
            if (!response.ok) throw new Error('Błąd pobierania danych');
            this.state.feedback = await response.json();
            this.applyFilters();
        } catch (error) {
            console.error('Błąd:', error);
            this.elements.tableBody.innerHTML = `<tr><td colspan="7" class="text-center error-msg">Nie udało się pobrać zgłoszeń.</td></tr>`;
            Utils.showToast('Nie udało się pobrać zgłoszeń.', 'error');
        }
    },

    // Listenery
    attachEventListeners() {
        this.elements.searchInput.addEventListener('input', (e) => {
            this.state.filters.search = e.target.value.toLowerCase();
            this.applyFilters();
        });

        this.elements.statusFilter.addEventListener('change', (e) => {
            this.state.filters.status = e.target.value;
            this.applyFilters();
        });

        this.elements.typeFilter.addEventListener('change', (e) => {
            this.state.filters.type = e.target.value;
            this.applyFilters();
        });
    },

    // Filtrowanie
    applyFilters() {
        const { search, status, type } = this.state.filters;
        
        this.state.filteredFeedback = this.state.feedback.filter(item => {
            const matchesSearch = (
                item.title.toLowerCase().includes(search) || 
                item.description.toLowerCase().includes(search) ||
                (item.email && item.email.toLowerCase().includes(search))
            );
            const matchesStatus = status === '' || item.status === status;
            const matchesType = type === '' || item.type === type;
            
            return matchesSearch && matchesStatus && matchesType;
        });
        
        this.render();
    },

    // Renderowanie tabeli
    render() {
        this.elements.resultsCount.textContent = this.state.filteredFeedback.length;
        this.elements.tableBody.innerHTML = '';

        if (this.state.filteredFeedback.length === 0) {
            this.elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state-cell">
                        <div class="empty-state">
                            <i class="fas fa-inbox"></i>
                            <h3>Brak zgłoszeń</h3>
                            <p>Nie znaleziono zgłoszeń spełniających kryteria.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        this.state.filteredFeedback.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>#${item.id}</td>
                <td>${this.renderType(item.type)}</td>
                <td>
                    <div class="feedback-title-text" title="${Utils.escapeHtml(item.title)}">
                        ${Utils.escapeHtml(item.title)}
                    </div>
                </td>
                <td>${item.email ? Utils.escapeHtml(item.email) : '<span class="text-muted">-</span>'}</td>
                <td>${this.renderStatus(item.status)}</td>
                <td title="${Utils.formatFullDate(item.createdAt)}">${Utils.formatDate(item.createdAt)}</td>
                <td>
                    <button class="action-btn btn-view" onclick="FeedbackManager.openModal(${item.id})" title="Szczegóły">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn btn-delete" onclick="FeedbackManager.deleteFeedback(${item.id})" title="Usuń">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;
            this.elements.tableBody.appendChild(row);
        });
    },

    // Renderowanie typu z ikoną
    renderType(type) {
        let icon, label, styleClass;
        switch(type) {
            case 'BUG': 
                icon = 'fa-bug'; 
                label = 'Błąd'; 
                styleClass = 'type-bug';
                break;
            case 'SUGGESTION': 
                icon = 'fa-lightbulb'; 
                label = 'Sugestia'; 
                styleClass = 'type-suggestion';
                break;
            default: 
                icon = 'fa-comment'; 
                label = 'Inne'; 
                styleClass = 'type-other';
        }
        return `
            <div style="display: flex; align-items: center;">
                <div class="type-icon ${styleClass}">
                    <i class="fas ${icon}"></i>
                </div>
                <span>${label}</span>
            </div>
        `;
    },

    // Renderowanie statusu
    renderStatus(status) {
        let label, className, icon;
        switch(status) {
            case 'OPEN':
                label = 'Nowe'; className = 'status-open'; icon = 'fa-exclamation-circle';
                break;
            case 'IN_PROGRESS':
                label = 'W trakcie'; className = 'status-in_progress'; icon = 'fa-spinner';
                break;
            case 'RESOLVED':
                label = 'Rozwiązane'; className = 'status-resolved'; icon = 'fa-check-circle';
                break;
            case 'REJECTED':
                label = 'Odrzucone'; className = 'status-rejected'; icon = 'fa-times-circle';
                break;
        }
        return `<span class="badge-status ${className}"><i class="fas ${icon}"></i> ${label}</span>`;
    },

    // Otwieranie modalu
    openModal(id) {
        const item = this.state.feedback.find(f => f.id === id);
        if (!item) return;

        this.state.currentId = id;
        
        // Wypełnianie danych
        document.getElementById('modalTitle').textContent = item.title;
        document.getElementById('modalStatus').innerHTML = this.renderStatus(item.status);
        const modalDateEl = document.getElementById('modalDate');
        modalDateEl.textContent = Utils.formatDate(item.createdAt);
        modalDateEl.title = Utils.formatFullDate(item.createdAt);
        document.getElementById('modalType').textContent = this.translateType(item.type);
        document.getElementById('modalEmail').textContent = item.email || 'Anonim';
        document.getElementById('modalDescription').textContent = item.description;

        // Sekcja odpowiedzi mailowej
        const emailRow = document.getElementById('emailResponseRow');
        const emailLabel = document.getElementById('emailResponseRecipientLabel');
        const emailText = document.getElementById('emailResponseText');
        
        if (item.email && item.email.includes('@')) {
            emailRow.style.display = 'block';
            emailLabel.innerHTML = `Odpowiedź mailowa do: <strong style="color: var(--color-primary);">${Utils.escapeHtml(item.email)}</strong>`;
            emailText.value = '';
        } else {
            emailRow.style.display = 'none';
        }
        
        // Załącznik
        const attachmentRow = document.getElementById('attachmentRow');
        const attachmentDiv = document.getElementById('modalAttachment');
        if (item.originalFileName) {
            attachmentRow.style.display = 'block';
            const safeFileName = Utils.escapeHtml(item.originalFileName);
            const isImage = item.contentType && item.contentType.startsWith('image/');
            const icon = isImage ? 'fa-file-image' : 'fa-file-pdf';
            
            attachmentDiv.innerHTML = `
                <a href="/api/feedback/${item.id}/attachment" target="_blank" class="attachment-link">
                    <i class="fas ${icon}"></i> 
                    <span>${safeFileName}</span>
                    <i class="fas fa-external-link-alt" style="font-size: 0.8rem; margin-left: 0.5rem; opacity: 0.7;"></i>
                </a>
            `;
        } else {
            attachmentRow.style.display = 'none';
            attachmentDiv.innerHTML = '';
        }

        // Załaduj notatki
        this.loadNotes(id);

        // Dane techniczne
        const techDetails = `
            URL: ${Utils.escapeHtml(item.url || 'Brak')}<br>
            User Agent: ${Utils.escapeHtml(item.userAgent || 'Brak')}
        `;
        document.getElementById('modalTechDetails').innerHTML = techDetails;

        // Aktywacja modalu
        this.elements.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    // Zamykanie modalu
    closeModal() {
        this.elements.modal.classList.remove('active');
        document.body.style.overflow = '';
        this.state.currentId = null;
    },

    // Ładowanie notatek admina
    async loadNotes(feedbackId) {
        const feed = document.getElementById('adminNotesList');
        const emptyState = document.getElementById('notesEmptyState');
        // Clear previous notes but keep empty state
        Array.from(feed.children).forEach(el => {
            if (!el.classList.contains('notes-feed-empty')) el.remove();
        });

        try {
            const response = await fetch(`/api/feedback/${feedbackId}/notes`);
            if (!response.ok) return;
            const notes = await response.json();

            if (notes.length === 0) {
                emptyState.style.display = 'flex';
                return;
            }

            emptyState.style.display = 'none';
            // Server returns DESC (newest first) — appendChild maintains that visual order
            notes.forEach(note => {
                feed.appendChild(this.renderNote(note));
            });
        } catch (e) {
            console.error('Błąd ładowania notatek:', e);
        }
    },

    // Renderuje jeden element notatki
    renderNote(note) {
        const el = document.createElement('div');
        el.className = 'note-item';
        const initials = (note.authorEmail || 'A').split('@')[0].substring(0, 2).toUpperCase();
        const dateStr = note.createdAt
            ? new Date(note.createdAt).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '';
        el.innerHTML = `
            <div class="note-avatar">${Utils.escapeHtml(initials)}</div>
            <div class="note-body">
                <div class="note-meta">
                    <span class="note-author">${Utils.escapeHtml(note.authorEmail || 'Admin')}</span>
                    <span class="note-time"><i class="fas fa-clock" style="font-size:0.7rem;"></i> ${dateStr}</span>
                </div>
                <div class="note-content">${Utils.escapeHtml(note.content || '')}</div>
            </div>
        `;
        return el;
    },

    // Dodawanie nowej notatki
    async addNote() {
        const id = this.state.currentId;
        const input = document.getElementById('adminNoteInput');
        const content = input ? input.value.trim() : '';

        if (!content) {
            Utils.showToast('Notatka nie może być pusta.', 'warning');
            return;
        }

        const btn = document.getElementById('addNoteBtn');
        const originalHtml = btn ? btn.innerHTML : '';
        if (btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Dodawanie...'; btn.disabled = true; }

        try {
            const response = await fetch(`/api/feedback/${id}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });

            if (!response.ok) throw new Error('Server error');
            const note = await response.json();

            // Prepend new note to feed
            const feed = document.getElementById('adminNotesList');
            const emptyState = document.getElementById('notesEmptyState');
            if (emptyState) emptyState.style.display = 'none';
            if (feed) feed.insertBefore(this.renderNote(note), feed.firstChild);

            input.value = '';
            Utils.showToast('Notatka została dodana.', 'success');
        } catch (error) {
            console.error('Błąd dodawania notatki:', error);
            Utils.showToast('Nie udało się dodać notatki.', 'error');
        } finally {
            if (btn) { btn.innerHTML = originalHtml; btn.disabled = false; }
        }
    },

    // Wysyłka e-maila do użytkownika
    async sendEmailResponse() {
        const id = this.state.currentId;
        const text = document.getElementById('emailResponseText').value;
        
        if (!text.trim()) {
            Utils.showToast('Treść odpowiedzi nie może być pusta.', 'warning');
            return;
        }

        const btn = document.querySelector('.btn-send-email');
        const originalHtml = btn.innerHTML;
        
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Wysyłanie...';
        btn.disabled = true;

        try {
            const response = await fetch(`/api/feedback/${id}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            const data = await response.json();

            if (response.ok) {
                Utils.showToast('Odpowiedź została wysłana pomyślnie!', 'success');
                document.getElementById('emailResponseText').value = '';
            } else {
                // Specyficzny błąd gdy SMTP nie działa
                if (response.status === 503) {
                    Utils.showToast('Błąd serwera pocztowego (SMTP). Reakcja została zapisana w logach, ale mail nie dotarł.', 'error');
                } else {
                    throw new Error(data.message || 'Błąd wysyłki');
                }
            }
        } catch (error) {
            console.error('Błąd wysyłki e-maila:', error);
            Utils.showToast('Nie udało się wysłać odpowiedzi. ' + error.message, 'error');
        } finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    },

    // Aktualizacja statusu
    async updateStatus(status) {
        if (!this.state.currentId) return;

        try {
            const response = await fetch(`/api/feedback/${this.state.currentId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: status })
            });

            if (response.ok) {
                // Aktualizuj lokalny stan
                const item = this.state.feedback.find(f => f.id === this.state.currentId);
                item.status = status;
                
                // Odśwież widok
                this.render();
                document.getElementById('modalStatus').innerHTML = this.renderStatus(status);
                Utils.showToast('Zaktualizowano status.', 'success');
            }
        } catch (error) {
            console.error('Błąd aktualizacji:', error);
            Utils.showToast('Nie udało się zaktualizować statusu.', 'error');
        }
    },

    // Usuwanie
    deleteFeedback(id) {
        const overlay = document.getElementById('deleteConfirmOverlay');
        if (!overlay) {
            if (confirm('Czy na pewno chcesz usunąć to zgłoszenie? Ta operacja jest nieodwracalna.')) {
                this.executeDelete(id);
            }
            return;
        }

        this.state.pendingDeleteId = id;
        overlay.classList.add('active');
    },

    executeDelete(id) {
        const itemToDelete = this.state.feedback.find(s => s.id === id);
        if (!itemToDelete) return;

        // Optimistically remove from UI
        this.state.feedback = this.state.feedback.filter(item => item.id !== id);
        this.applyFilters();
        if (this.state.currentId === id) this.closeModal();

        let isUndone = false;
        
        const toast = Utils.showToast('Zgłoszenie usunięte', 'success', {
            actionHtml: '<button class="btn-undo-toast" id="undo-btn">COFNIJ</button>',
            duration: 5000
        });

        if (toast) {
            const undoBtn = toast.querySelector('#undo-btn');
            if (undoBtn) {
                undoBtn.addEventListener('click', () => {
                    isUndone = true;
                    toast.classList.add('fade-out');
                    setTimeout(() => toast.remove(), 300);

                    // Przywracamy dane
                    this.state.feedback.push(itemToDelete);
                    this.state.feedback.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    this.applyFilters();
                    Utils.showToast('Cofnięto usunięcie. Zgłoszenie przywrócone.', 'info');
                });
            }
        }

        // Oczekujemy 5 sekund, potem request właściwy
        setTimeout(async () => {
            if (!isUndone) {
                if (toast && toast.parentElement) {
                    toast.classList.add('fade-out');
                    setTimeout(() => toast.remove(), 300);
                }

                try {
                    const response = await fetch(`/api/feedback/${id}`, { method: 'DELETE' });
                    if (!response.ok) throw new Error('Nie udało się trwale usunąć zgłoszenia.');
                } catch (error) {
                    console.error('Błąd usuwania:', error);
                    // Jeśli błąd, przywracamy po cichu do danych
                    if (!this.state.feedback.some(f => f.id === itemToDelete.id)) {
                        this.state.feedback.push(itemToDelete);
                        this.state.feedback.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                        this.applyFilters();
                    }
                    Utils.showToast(error.message || 'Błąd usuwania z serwera.', 'error');
                }
            }
        }, 5000);
    },

    translateType(type) {
        const map = {
            'BUG': 'Błąd w systemie',
            'SUGGESTION': 'Sugestia/Pomysł',
            'OTHER': 'Inne zgłoszenie'
        };
        return map[type] || type;
    },
};

// Start
document.addEventListener('DOMContentLoaded', () => FeedbackManager.init());
