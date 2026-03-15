'use strict';

const AdminAnnouncement = {

    state: {
        all: [],
        filtered: [],
        pendingDeleteId: null,
        filters: { search: '', group: '' }
    },

    elements: {
        tableBody:    document.getElementById('announcementTableBody'),
        searchInput:  document.getElementById('searchInput'),
        groupFilter:  document.getElementById('groupFilter'),
        resetBtn:     document.getElementById('resetFilters'),
        resultsCount: document.getElementById('resultsCount'),
        msgEl:        document.getElementById('announcementMessage'),
        deleteModal:  document.getElementById('deleteModal'),
        cancelBtn:    document.getElementById('modalCancelBtn'),
        confirmBtn:   document.getElementById('modalConfirmBtn'),
        deleteText:   document.getElementById('deleteModalText')
    },

    // ── Init ─────────────────────────────────────────────────────────────────
    init() {
        this.attachListeners();
        this.fetchAnnouncements();
    },

    attachListeners() {
        const { searchInput, groupFilter, resetBtn, cancelBtn, confirmBtn, deleteModal } = this.elements;

        searchInput?.addEventListener('input', (e) => {
            this.state.filters.search = e.target.value.toLowerCase();
            this.applyFilters();
        });

        groupFilter?.addEventListener('change', (e) => {
            this.state.filters.group = e.target.value;
            this.applyFilters();
        });

        resetBtn?.addEventListener('click', () => this.resetFilters());

        cancelBtn?.addEventListener('click', () => this.closeModal());
        confirmBtn?.addEventListener('click', () => this.confirmDelete());
        deleteModal?.addEventListener('click', (e) => {
            if (e.target === deleteModal) this.closeModal();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    },

    // ── Fetch ────────────────────────────────────────────────────────────────
    async fetchAnnouncements() {
        try {
            const response = await fetch('/api/announcements/all');
            if (!response.ok) throw new Error('Nie udało się pobrać ogłoszeń.');
            this.state.all = await response.json();
            this.populateGroupFilter();
            this.applyFilters();
        } catch (err) {
            this.showError('Błąd podczas ładowania ogłoszeń: ' + err.message);
            if (this.elements.tableBody) {
                this.elements.tableBody.innerHTML = this.emptyRow(
                    'fa-exclamation-triangle',
                    'Błąd ładowania',
                    'Nie udało się pobrać ogłoszeń z serwera.'
                );
            }
        }
    },

    // ── Group filter population ──────────────────────────────────────────────
    populateGroupFilter() {
        const { groupFilter } = this.elements;
        if (!groupFilter) return;

        const groups = [...new Set(this.state.all.map(a => a.targetGroupName).filter(Boolean))].sort();
        groups.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.textContent = g;
            groupFilter.appendChild(opt);
        });
    },

    // ── Filtering ────────────────────────────────────────────────────────────
    applyFilters() {
        const { search, group } = this.state.filters;

        this.state.filtered = this.state.all.filter(item => {
            const searchLower = search.toLowerCase();
            const matchSearch = !search || (
                (item.title  || '').toLowerCase().includes(searchLower) ||
                (item.content || '').toLowerCase().includes(searchLower) ||
                ((item.authorFirstName || '') + ' ' + (item.authorLastName || '')).toLowerCase().includes(searchLower)
            );
            const matchGroup = !group || item.targetGroupName === group;
            return matchSearch && matchGroup;
        });

        this.render();
    },

    resetFilters() {
        this.state.filters = { search: '', group: '' };
        if (this.elements.searchInput) this.elements.searchInput.value = '';
        if (this.elements.groupFilter) this.elements.groupFilter.value = '';
        this.applyFilters();
    },

    // ── Render ───────────────────────────────────────────────────────────────
    render() {
        const { tableBody, resultsCount } = this.elements;
        if (!tableBody) return;

        if (resultsCount) resultsCount.textContent = this.state.filtered.length;

        if (this.state.filtered.length === 0) {
            tableBody.innerHTML = this.state.all.length === 0
                ? this.emptyRow('fa-inbox', 'Brak ogłoszeń', 'W systemie nie ma jeszcze żadnych ogłoszeń.')
                : this.emptyRow('fa-search', 'Brak wyników', 'Żadne ogłoszenie nie pasuje do podanych filtrów.');
            return;
        }

        tableBody.innerHTML = '';
        this.state.filtered.forEach((item, index) => {
            // Main row
            const tr = document.createElement('tr');
            tr.dataset.id = item.id;

            const created = item.createdAt
                ? new Date(item.createdAt).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })
                : '-';
            const author = [item.authorFirstName, item.authorLastName].filter(Boolean).join(' ') || '-';

            tr.innerHTML = `
                <td style="color: var(--text-light); font-size: 0.82rem;">${index + 1}</td>
                <td><div class="ann-td-title" title="${this.esc(item.title)}">${this.esc(item.title || '')}</div></td>
                <td><div class="ann-td-content" title="${this.esc(item.content)}">${this.esc(item.content || '')}</div></td>
                <td class="ann-td-author">${this.esc(author)}</td>
                <td class="ann-td-group">
                    <span class="ann-group-badge">
                        <i class="fas fa-users"></i>
                        ${this.esc(item.targetGroupName || '-')}
                    </span>
                </td>
                <td class="ann-td-date">${this.esc(created)}</td>
                <td class="ann-td-actions">
                    <div class="ann-action-group">
                        <button class="ann-action-btn ann-btn-view" data-id="${item.id}" title="Rozwiń treść">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                        <button class="ann-action-btn ann-btn-del" data-id="${item.id}" data-title="${this.esc(item.title)}" title="Usuń">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);

            // Expand / collapse
            tr.querySelector('.ann-btn-view')?.addEventListener('click', (e) => {
                const btn = e.currentTarget;
                const existingExpanded = tableBody.querySelector('.ann-expanded-row[data-for="' + item.id + '"]');
                if (existingExpanded) {
                    existingExpanded.remove();
                    btn.querySelector('i').className = 'fas fa-chevron-down';
                } else {
                    // Close any other open expanded rows
                    tableBody.querySelectorAll('.ann-expanded-row').forEach(r => r.remove());
                    tableBody.querySelectorAll('.ann-btn-view i').forEach(i => i.className = 'fas fa-chevron-down');

                    const expandTr = document.createElement('tr');
                    expandTr.className = 'ann-expanded-row';
                    expandTr.dataset.for = item.id;
                    expandTr.innerHTML = `
                        <td colspan="7">
                            <div class="ann-expanded-content">${this.esc(item.content || '')}</div>
                        </td>
                    `;
                    tr.after(expandTr);
                    btn.querySelector('i').className = 'fas fa-chevron-up';
                }
            });

            // Delete
            tr.querySelector('.ann-btn-del')?.addEventListener('click', (e) => {
                const btn = e.currentTarget;
                this.openDeleteModal(Number(btn.dataset.id), btn.dataset.title);
            });
        });
    },

    emptyRow(icon, title, subtitle) {
        return `
            <tr class="ann-table-empty">
                <td colspan="7">
                    <div class="ann-table-empty-inner">
                        <i class="fas ${icon}"></i>
                        <h4>${title}</h4>
                        <p>${subtitle}</p>
                    </div>
                </td>
            </tr>
        `;
    },

    // ── Delete Modal ─────────────────────────────────────────────────────────
    openDeleteModal(id, title) {
        this.state.pendingDeleteId = id;
        if (this.elements.deleteText) {
            this.elements.deleteText.innerHTML =
                `Czy na pewno chcesz usunąć ogłoszenie <strong>&ldquo;${this.esc(title || '')}&rdquo;</strong>? Tej operacji nie można cofnąć.`;
        }
        this.elements.deleteModal?.classList.add('active');
    },

    closeModal() {
        this.elements.deleteModal?.classList.remove('active');
        this.state.pendingDeleteId = null;
    },

    async confirmDelete() {
        const id = this.state.pendingDeleteId;
        this.closeModal();
        if (!id) return;

        try {
            const response = await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || 'Nie udało się usunąć ogłoszenia.');
            }
            this.state.all = this.state.all.filter(a => a.id !== id);
            this.applyFilters();
            this.showSuccess('Ogłoszenie zostało usunięte.');
        } catch (err) {
            this.showError('Błąd: ' + err.message);
        }
    },

    // ── Messages ─────────────────────────────────────────────────────────────
    showSuccess(text) {
        this.showAlert(text, 'success', 'fa-check-circle');
    },

    showError(text) {
        this.showAlert(text, 'error', 'fa-exclamation-circle');
    },

    showAlert(text, type, icon) {
        if (!this.elements.msgEl) return;
        this.elements.msgEl.innerHTML = `
            <div class="ann-alert ${type}">
                <i class="fas ${icon}"></i>
                <span>${this.esc(text)}</span>
            </div>
        `;
        if (type === 'success') {
            setTimeout(() => { this.elements.msgEl.innerHTML = ''; }, 4000);
        }
    },

    // ── Utils ────────────────────────────────────────────────────────────────
    esc(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
};

document.addEventListener('DOMContentLoaded', () => AdminAnnouncement.init());

