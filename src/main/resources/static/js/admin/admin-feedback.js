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

        // Komentarz Admina
        document.getElementById('adminComment').value = item.adminComment || '';

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
            Utils.showToast('Nie udało się zapisać notatki.', 'error');
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
        // Soft delete logic with toast undo
        const itemToDelete = this.state.feedback.find(s => s.id === id);
        if (!itemToDelete) return;

        // Optimistically remove from UI
        this.state.feedback = this.state.feedback.filter(item => item.id !== id);
        this.applyFilters();
        if (this.state.currentId === id) this.closeModal();

        // Pokazujemy toast z opcją cofnij
        const toastContainer = document.getElementById('toastContainer');
        const toastId = 'toast-' + Date.now();

        const toast = document.createElement('div');
        toast.className = 'toast success';
        toast.id = toastId;
        toast.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>Zgłoszenie usunięte</span>
            <button class="toast-undo-btn" id="undo-${toastId}">COFNIJ</button>
        `;
        toastContainer.appendChild(toast);

        let isUndone = false;

        const undoBtn = document.getElementById(`undo-${toastId}`);
        if(undoBtn) {
            undoBtn.addEventListener('click', () => {
                isUndone = true;
                toast.style.animation = 'fadeOut 0.3s forwards';
                setTimeout(() => toast.remove(), 300);

                // Przywracamy dane
                this.state.feedback.push(itemToDelete);
                // Sortujemy po dacie malejąco żeby utrzymać porządek (najnowsze u góry)
                this.state.feedback.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                
                this.applyFilters();
                Utils.showToast('Cofnięto usunięcie. Zgłoszenie przywrócone.', 'info');
            });
        }

        // Oczekujemy 5 sekundy, potem request właściwy
        setTimeout(async () => {
            if (!isUndone) {
                const liveToast = document.getElementById(toastId);
                if (liveToast) {
                    liveToast.style.animation = 'fadeOut 0.3s forwards';
                    setTimeout(() => liveToast.remove(), 300);
                }

                try {
                    const response = await fetch(`/api/feedback/${id}`, { method: 'DELETE' });
                    if (!response.ok) throw new Error('Network error');
                    console.log('Zgłoszenie trwale usunięte z serwera.');
                } catch (error) {
                    console.error('Błąd usuwania:', error);
                    // Jeśli błąd, przywracamy po cichu do danych
                    this.state.feedback.push(itemToDelete);
                    this.state.feedback.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    this.applyFilters();
                    Utils.showToast('Błąd usuwania z serwera.', 'error');
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
