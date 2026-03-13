'use strict';

const FeedbackManager = {
    state: {
        feedback: [],
        filteredFeedback: [],
        currentId: null,
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
                    <div class="feedback-title-text" title="${this.escapeHtml(item.title)}">
                        ${this.escapeHtml(item.title)}
                    </div>
                </td>
                <td>${item.email ? this.escapeHtml(item.email) : '<span class="text-muted">-</span>'}</td>
                <td>${this.renderStatus(item.status)}</td>
                <td>${this.formatDate(item.createdAt)}</td>
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
        document.getElementById('modalDate').textContent = this.formatDate(item.createdAt, true);
        document.getElementById('modalType').textContent = this.translateType(item.type);
        document.getElementById('modalEmail').textContent = item.email || 'Anonim';
        document.getElementById('modalDescription').textContent = item.description;
        
        // Załącznik
        const attachmentRow = document.getElementById('attachmentRow');
        const attachmentDiv = document.getElementById('modalAttachment');
        if (item.originalFileName) {
            attachmentRow.style.display = 'block';
            attachmentDiv.innerHTML = `
                <a href="/api/feedback/${item.id}/attachment" class="attachment-link" target="_blank">
                    <i class="fas fa-paperclip"></i> 
                    Pobierz załącznik ${item.originalFileName ? `(${item.originalFileName})` : ''}
                </a>`;
        } else {
            attachmentRow.style.display = 'none';
            attachmentDiv.innerHTML = '';
        }

        // Komentarz Admina
        document.getElementById('adminComment').value = item.adminComment || '';

        // Dane techniczne
        const techDetails = `
            URL: ${item.url || 'Brak'}<br>
            User Agent: ${item.userAgent || 'Brak'}
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

    // Zapisywanie komentarza admina
    async saveComment() {
        const id = this.state.currentId;
        const comment = document.getElementById('adminComment').value;
        const btn = document.querySelector('.btn-save-comment');
        
        const originalText = '<i class="fas fa-save"></i> Zapisz notatkę';
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Zapisywanie...';
        btn.disabled = true;

        try {
            const response = await fetch(`/api/feedback/${id}/comment`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment: comment })
            });

            if (response.ok) {
                 // Aktualizuj lokalny stan
                const item = this.state.feedback.find(f => f.id === id);
                item.adminComment = comment;
                
                // Show temporary success
                btn.innerHTML = '<i class="fas fa-check"></i> Zapisano!';
                btn.style.backgroundColor = '#10b981'; // Green
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.backgroundColor = '';
                    btn.disabled = false;
                }, 2000);
            } else {
                throw new Error('Server error');
            }
        } catch (error) {
            console.error('Błąd zapisu komentarza:', error);
            alert('Nie udało się zapisać notatki.');
            btn.innerHTML = originalText;
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
            }
        } catch (error) {
            console.error('Błąd aktualizacji:', error);
            alert('Nie udało się zaktualizować statusu.');
        }
    },

    // Usuwanie
    async deleteFeedback(id) {
        if (!confirm('Czy na pewno chcesz usunąć to zgłoszenie? Ta operacja jest nieodwracalna.')) return;

        try {
            const response = await fetch(`/api/feedback/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.state.feedback = this.state.feedback.filter(item => item.id !== id);
                this.applyFilters();
                // Jeśli modal był otwarty dla tego elementu
                if (this.state.currentId === id) this.closeModal();
            }
        } catch (error) {
            console.error('Błąd usuwania:', error);
            alert('Nie udało się usunąć zgłoszenia.');
        }
    },

    // Helpery
    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    formatDate(dateStr, includeTime = false) {
        const date = new Date(dateStr);
        const options = { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric'
        };
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }
        return date.toLocaleDateString('pl-PL', options);
    },

    translateType(type) {
        const map = {
            'BUG': 'Błąd w systemie',
            'SUGGESTION': 'Sugestia/Pomysł',
            'OTHER': 'Inne zgłoszenie'
        };
        return map[type] || type;
    }
};

// Start
document.addEventListener('DOMContentLoaded', () => FeedbackManager.init());
