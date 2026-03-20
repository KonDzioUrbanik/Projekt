'use strict';

const AdminAnnouncement = {

    state: {
        all: [],
        groups: [],
        filtered: [],
        pendingDeleteId: null,
        filters: { search: '', group: '' }
    },

    elements: {
        form:         document.getElementById('adminAnnouncementForm'),
        titleInput:   document.getElementById('announcementTitle'),
        contentInput: document.getElementById('announcementContent'),
        submitBtn:    document.getElementById('submitBtn'),
        titleCounter: document.getElementById('titleCounter'),
        contentCounter: document.getElementById('contentCounter'),
        targetAudienceSelect: document.getElementById('targetAudienceSelect'),
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
        this.initCharCounters();
        this.bootstrapData();
    },

    async bootstrapData() {
        await Promise.all([this.fetchGroups(), this.fetchAnnouncements()]);
    },

    attachListeners() {
        const {
            form,
            searchInput,
            groupFilter,
            resetBtn,
            cancelBtn,
            confirmBtn,
            deleteModal
        } = this.elements;

        form?.addEventListener('submit', (e) => this.handleSubmit(e));

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

    initCharCounters() {
        const { titleInput, contentInput, titleCounter, contentCounter } = this.elements;

        titleInput?.addEventListener('input', () => {
            const len = titleInput.value.length;
            if (!titleCounter) return;
            titleCounter.textContent = `${len} / 150`;
            titleCounter.className = 'ann-char-counter' +
                (len >= 140 ? ' danger' : len >= 120 ? ' warn' : '');
        });

        contentInput?.addEventListener('input', () => {
            const len = contentInput.value.length;
            if (!contentCounter) return;
            contentCounter.textContent = `${len} / 2000`;
            contentCounter.className = 'ann-char-counter' +
                (len >= 1900 ? ' danger' : len >= 1700 ? ' warn' : '');
        });
    },

    // ── Create announcement ─────────────────────────────────────────────────
    async handleSubmit(event) {
        event.preventDefault();
        this.clearMessage();

        const title = (this.elements.titleInput?.value || '').trim();
        const content = (this.elements.contentInput?.value || '').trim();

        if (!title || !content) {
            this.showError('Uzupełnij tytuł i treść ogłoszenia.');
            return;
        }

        const targetAudience = this.elements.targetAudienceSelect?.value || 'global';
        const isGlobal = targetAudience === 'global';
        const selectedGroupIds = isGlobal ? [] : [Number(targetAudience)].filter(Number.isFinite);
        if (!isGlobal && selectedGroupIds.length === 0) {
            this.showError('Wybierz prawidłowy kierunek lub opcję globalną.');
            return;
        }

        this.setSubmitLoading(true);

        try {
            const payload = {
                title,
                content,
                global: isGlobal,
                targetGroupIds: selectedGroupIds
            };

            const response = await fetch('/api/announcements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(this.readErrorText(errText) || 'Nie udało się opublikować ogłoszenia.');
            }

            this.resetForm();
            this.showSuccess('Ogłoszenie zostało opublikowane.');
            await this.fetchAnnouncements();
        } catch (err) {
            this.showError('Błąd: ' + this.readError(err));
        } finally {
            this.setSubmitLoading(false);
        }
    },

    setSubmitLoading(loading) {
        const { submitBtn } = this.elements;
        if (!submitBtn) return;
        submitBtn.disabled = loading;
        submitBtn.classList.toggle('loading', loading);
    },

    resetForm() {
        this.elements.form?.reset();
        if (this.elements.titleCounter) this.elements.titleCounter.textContent = '0 / 150';
        if (this.elements.contentCounter) this.elements.contentCounter.textContent = '0 / 2000';
        if (this.elements.targetAudienceSelect) {
            this.elements.targetAudienceSelect.value = 'global';
        }
    },

    async fetchGroups() {
        const { targetAudienceSelect } = this.elements;
        if (!targetAudienceSelect) return;

        try {
            const response = await fetch('/api/groups');
            if (!response.ok) throw new Error('Nie udało się pobrać kierunków.');
            const groups = await response.json();
            this.state.groups = Array.isArray(groups) ? groups : [];

            targetAudienceSelect.innerHTML = '<option value="global">Wszyscy (globalnie)</option>';
            this.state.groups.forEach(group => {
                const option = document.createElement('option');
                option.value = String(group.id);
                option.textContent = group.name;
                targetAudienceSelect.appendChild(option);
            });
        } catch (err) {
            this.showError('Błąd podczas ładowania kierunków: ' + err.message);
        }
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

        groupFilter.innerHTML = '<option value="">Wszystkie grupy</option>';

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
                <td><div class="ann-td-title" title="${Utils.escapeHtml(item.title)}">${Utils.escapeHtml(item.title || '')}</div></td>
                <td><div class="ann-td-content" title="${Utils.escapeHtml(item.content)}">${Utils.escapeHtml(item.content || '')}</div></td>
                <td class="ann-td-author">${Utils.escapeHtml(author)}</td>
                <td class="ann-td-group">
                    <span class="ann-group-badge">
                        <i class="fas fa-users"></i>
                        ${Utils.escapeHtml(item.targetGroupName || '-')}
                    </span>
                </td>
                <td class="ann-td-date">${Number(item.readConfirmationsCount || 0)}</td>
                <td class="ann-td-date">${Utils.escapeHtml(created)}</td>
                <td class="ann-td-actions">
                    <div class="ann-action-group">
                        <button class="ann-action-btn ann-btn-view" data-id="${item.id}" title="Rozwiń treść">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                        ${item.canDelete
                            ? `<button class="ann-action-btn ann-btn-del" data-id="${item.id}" data-title="${Utils.escapeHtml(item.title)}" data-global="${item.targetGroupId === null}" title="Usuń">
                                   <i class="fas fa-trash-alt"></i>
                               </button>`
                            : ''}
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
                        <td colspan="8">
                            <div class="ann-expanded-content">${Utils.escapeHtml(item.content || '')}</div>
                        </td>
                    `;
                    tr.after(expandTr);
                    btn.querySelector('i').className = 'fas fa-chevron-up';
                }
            });

            // Delete
            tr.querySelector('.ann-btn-del')?.addEventListener('click', (e) => {
                const btn = e.currentTarget;
                this.openDeleteModal(Number(btn.dataset.id), btn.dataset.title, btn.dataset.global === 'true');
            });
        });
    },

    emptyRow(icon, title, subtitle) {
        return `
            <tr class="ann-table-empty">
                <td colspan="8">
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
    openDeleteModal(id, title, isGlobal) {
        this.state.pendingDeleteId = id;
        if (this.elements.deleteText) {
            this.elements.deleteText.innerHTML =
                isGlobal
                    ? `Czy na pewno chcesz usunac globalne ogloszenie <strong>&ldquo;${Utils.escapeHtml(title || '')}&rdquo;</strong>? Operacja usunie cala paczke wyslanek do wszystkich kierunkow.`
                    : `Czy na pewno chcesz usunąć ogłoszenie <strong>&ldquo;${Utils.escapeHtml(title || '')}&rdquo;</strong>? Tej operacji nie można cofnąć.`;
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
                throw new Error(this.readErrorText(errText) || 'Nie udało się usunąć ogłoszenia.');
            }
            await this.fetchAnnouncements();
            this.showSuccess('Ogłoszenie zostało usunięte.');
        } catch (err) {
            this.showError('Błąd: ' + this.readError(err));
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
                <span>${Utils.escapeHtml(text)}</span>
            </div>
        `;
        if (type === 'success') {
            setTimeout(() => { this.elements.msgEl.innerHTML = ''; }, 4000);
        }
    },

    clearMessage() {
        if (this.elements.msgEl) this.elements.msgEl.innerHTML = '';
    },

    readErrorText(text) {
        const raw = (text || '').trim();
        if (!raw) return '';
        if (!raw.startsWith('{')) return raw;
        try {
            return JSON.parse(raw).message || raw;
        } catch (_) {
            return raw;
        }
    },

    readError(err) {
        if (!err?.message) return 'Wystąpił nieoczekiwany błąd.';
        return this.readErrorText(err.message) || err.message;
    },

};

document.addEventListener('DOMContentLoaded', () => AdminAnnouncement.init());

