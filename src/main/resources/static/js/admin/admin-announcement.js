'use strict';

const AdminAnnouncement = {

    state: {
        all: [],
        groups: [],
        filtered: [],
        pendingDeleteId: null,
        filters: { search: '', group: '', author: '' }
    },

    elements: {
        form: document.getElementById('adminAnnouncementForm'),
        titleInput: document.getElementById('announcementTitle'),
        contentInput: document.getElementById('announcementContent'),
        submitBtn: document.getElementById('submitBtn'),
        titleCounter: document.getElementById('titleCounter'),
        contentCounter: document.getElementById('contentCounter'),
        targetAudienceSelect: document.getElementById('targetAudienceSelect'),
        prioritySelect: document.getElementById('prioritySelect'),
        isPinnedCheckbox: document.getElementById('isPinnedCheckbox'),
        fileInput: document.getElementById('announcementFiles'),
        fileList: document.getElementById('fileList'),
        tableBody: document.getElementById('announcementTableBody'),
        searchInput: document.getElementById('searchInput'),
        groupFilter: document.getElementById('groupFilter'),
        authorFilter: document.getElementById('authorFilter'),
        resetBtn: document.getElementById('resetFilters'),
        resultsCount: document.getElementById('resultsCount'),
        msgEl: document.getElementById('announcementMessage'),
        deleteModal: document.getElementById('deleteModal'),
        cancelBtn: document.getElementById('modalCancelBtn'),
        confirmBtn: document.getElementById('modalConfirmBtn'),
        deleteText: document.getElementById('deleteModalText'),
        readDetailsModal: document.getElementById('readDetailsModal'),
        readDetailsList: document.getElementById('readDetailsList'),
        readDetailsClose: document.getElementById('readDetailsClose'),
        successModal: document.getElementById('successModal'),
        successModalClose: document.getElementById('successModalClose')
    },

    // ── Init ─────────────────────────────────────────────────────────────────
    init() {
        this.attachListeners();
        this.initCharCounters();
        this.initFileInput();
        this.bootstrapData();
    },

    async bootstrapData() {
        await Promise.all([this.fetchGroups(), this.fetchAnnouncements()]);
    },

    attachListeners() {
        const { form, searchInput, groupFilter, resetBtn, cancelBtn, confirmBtn,
                deleteModal, readDetailsClose, readDetailsModal } = this.elements;

        form?.addEventListener('submit', (e) => this.handleSubmit(e));

        searchInput?.addEventListener('input', (e) => {
            this.state.filters.search = e.target.value.toLowerCase();
            this.applyFilters();
        });

        groupFilter?.addEventListener('change', (e) => {
            this.state.filters.group = e.target.value;
            this.applyFilters();
        });
        
        this.elements.authorFilter?.addEventListener('change', (e) => {
            this.state.filters.author = e.target.value;
            this.applyFilters();
        });

        resetBtn?.addEventListener('click', () => this.resetFilters());
        cancelBtn?.addEventListener('click', () => this.closeDeleteModal());
        confirmBtn?.addEventListener('click', () => this.confirmDelete());

        deleteModal?.addEventListener('click', (e) => {
            if (e.target === deleteModal) this.closeDeleteModal();
        });

        readDetailsClose?.addEventListener('click', () => this.closeReadDetailsModal());
        readDetailsModal?.addEventListener('click', (e) => {
            if (e.target === readDetailsModal) this.closeReadDetailsModal();
        });

        this.elements.successModalClose?.addEventListener('click', () => this.closeSuccessModal());
        this.elements.successModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.successModal) this.closeSuccessModal();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeDeleteModal();
                this.closeReadDetailsModal();
                this.closeSuccessModal();
            }
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

    initFileInput() {
        const { fileInput, fileList } = this.elements;
        if (!fileInput || !fileList) return;

        fileInput.addEventListener('change', () => {
            const files = Array.from(fileInput.files || []);
            if (files.length > 5) {
                this.showError('Możesz dodać maksymalnie 5 załączników.');
                fileInput.value = '';
                fileList.innerHTML = '';
                return;
            }

            fileList.innerHTML = '';
            files.forEach(f => {
                const chip = document.createElement('span');
                chip.className = 'ann-file-chip';
                chip.innerHTML = `<i class="fas fa-paperclip"></i> ${Utils.escapeHtml(f.name)} <span class="ann-file-size">(${this.formatSize(f.size)})</span>`;
                fileList.appendChild(chip);
            });
        });
    },

    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },

    // ── Create announcement ─────────────────────────────────────────────────
    async handleSubmit(event) {
        event.preventDefault();
        this.clearMessage();

        const title   = (this.elements.titleInput?.value || '').trim();
        const content = (this.elements.contentInput?.value || '').trim();

        if (!title || !content) {
            this.showError('Uzupełnij tytuł i treść ogłoszenia.');
            return;
        }

        const targetAudience = this.elements.targetAudienceSelect?.value || 'global';
        const isGlobal       = targetAudience === 'global';
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
                targetGroupIds: selectedGroupIds,
                priority: this.elements.prioritySelect?.value || 'INFO',
                isPinned: this.elements.isPinnedCheckbox?.checked || false
            };

            const formData = new FormData();
            formData.append('data', new Blob([JSON.stringify(payload)], { type: 'application/json' }));

            const files = this.elements.fileInput?.files;
            if (files) {
                Array.from(files).forEach(f => formData.append('files', f));
            }

            const response = await fetch('/api/announcements', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(this.readErrorText(errText) || 'Nie udało się opublikować ogłoszenia.');
            }

            this.resetForm();
            this.showSuccessModal();
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
        if (this.elements.titleCounter)   this.elements.titleCounter.textContent = '0 / 150';
        if (this.elements.contentCounter) this.elements.contentCounter.textContent = '0 / 2000';
        if (this.elements.targetAudienceSelect) this.elements.targetAudienceSelect.value = 'global';
        if (this.elements.prioritySelect) this.elements.prioritySelect.value = 'INFO';
        if (this.elements.isPinnedCheckbox) this.elements.isPinnedCheckbox.checked = false;
        if (this.elements.fileList) this.elements.fileList.innerHTML = '';
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
            this.populateAuthorFilter();
            this.applyFilters();
        } catch (err) {
            this.showError('Błąd podczas ładowania ogłoszeń: ' + err.message);
            if (this.elements.tableBody) {
                this.elements.tableBody.innerHTML = this.emptyRow(
                    'fa-exclamation-triangle', 'Błąd ładowania', 'Nie udało się pobrać ogłoszeń z serwera.'
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

    populateAuthorFilter() {
        const { authorFilter } = this.elements;
        if (!authorFilter) return;

        authorFilter.innerHTML = '<option value="">Wszyscy autorzy</option>';
        const authors = [...new Set(this.state.all.map(a => 
            [a.authorFirstName, a.authorLastName].filter(Boolean).join(' ')
        ).filter(Boolean))].sort();
        
        authors.forEach(auth => {
            const opt = document.createElement('option');
            opt.value = auth;
            opt.textContent = auth;
            authorFilter.appendChild(opt);
        });
    },

    // ── Filtering ────────────────────────────────────────────────────────────
    applyFilters() {
        const { search, group, author } = this.state.filters;

        this.state.filtered = this.state.all.filter(item => {
            const searchLower = search.toLowerCase();
            const matchSearch = !search || (
                (item.title  || '').toLowerCase().includes(searchLower) ||
                (item.content || '').toLowerCase().includes(searchLower) ||
                ((item.authorFirstName || '') + ' ' + (item.authorLastName || '')).toLowerCase().includes(searchLower)
            );
            const matchGroup = !group || item.targetGroupName === group;
            const itemAuthor = [item.authorFirstName, item.authorLastName].filter(Boolean).join(' ');
            const matchAuthor = !author || itemAuthor === author;
            
            return matchSearch && matchGroup && matchAuthor;
        });

        this.render();
    },

    resetFilters() {
        this.state.filters = { search: '', group: '', author: '' };
        if (this.elements.searchInput) this.elements.searchInput.value = '';
        if (this.elements.groupFilter) this.elements.groupFilter.value = '';
        if (this.elements.authorFilter) this.elements.authorFilter.value = '';
        this.applyFilters();
    },

    // ── Priority helpers ──────────────────────────────────────────────────────
    priorityBadge(priority) {
        const cfg = {
            IMPORTANT: { label: 'Ważne', cls: 'priority-important' },
            INFO: { label: 'Info', cls: 'priority-info' },
            ORGANIZATIONAL: { label: 'Organizacyjne', cls: 'priority-org' }
        };
        const p = cfg[priority] || cfg['INFO'];
        return `<span class="ann-priority-badge ${p.cls}">${p.label}</span>`;
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
            const tr = document.createElement('tr');
            tr.dataset.id = item.id;

            const created = item.createdAt
                ? new Date(item.createdAt).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })
                : '-';
            const author = [item.authorFirstName, item.authorLastName].filter(Boolean).join(' ') || '-';
            const pinnedIcon = item.isPinned
                ? `<i class="fas fa-thumbtack ann-pin-active" title="Przypięte"></i> `
                : '';

            const attachmentCount = (item.attachments || []).length;
            const attachIcon = attachmentCount > 0
                ? `<span class="ann-attach-count" title="${attachmentCount} załącznik(i)"><i class="fas fa-paperclip"></i> ${attachmentCount}</span>`
                : '';

            tr.innerHTML = `
                <td style="color: var(--text-light); font-size: 0.82rem;">${index + 1}</td>
                <td>
                    <div class="ann-td-title" title="${Utils.escapeHtml(item.title)}">
                        ${pinnedIcon}${Utils.escapeHtml(item.title || '')}
                        ${attachIcon}
                    </div>
                    ${this.priorityBadge(item.priority)}
                </td>
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
                        <button class="ann-action-btn ann-btn-pin ${item.isPinned ? 'pinned' : ''}" data-id="${item.id}" title="${item.isPinned ? 'Odepnij' : 'Przypnij'}">
                            <i class="fas fa-thumbtack"></i>
                        </button>
                        <button class="ann-action-btn ann-btn-readers" data-id="${item.id}" title="Kto przeczytał">
                            <i class="fas fa-eye"></i>
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
                const existingExpanded = tableBody.querySelector(`.ann-expanded-row[data-for="${item.id}"]`);
                if (existingExpanded) {
                    existingExpanded.remove();
                    btn.querySelector('i').className = 'fas fa-chevron-down';
                } else {
                    tableBody.querySelectorAll('.ann-expanded-row').forEach(r => r.remove());
                    tableBody.querySelectorAll('.ann-btn-view i').forEach(i => i.className = 'fas fa-chevron-down');

                    const attachmentsHtml = (item.attachments || []).map(a =>
                        `<a href="/api/announcements/attachments/${a.id}" class="ann-attachment-link" download="${Utils.escapeHtml(a.originalFileName)}">
                            <i class="fas fa-paperclip"></i> ${Utils.escapeHtml(a.originalFileName)}
                        </a>`
                    ).join('');

                    const expandTr = document.createElement('tr');
                    expandTr.className = 'ann-expanded-row';
                    expandTr.dataset.for = item.id;
                    expandTr.innerHTML = `
                        <td colspan="8">
                            <div class="ann-expanded-inner">
                                <div class="ann-expanded-section">
                                    <span class="ann-expanded-label"><i class="fas fa-align-left"></i> Treść ogłoszenia</span>
                                    <div class="ann-expanded-text">${Utils.escapeHtml(item.content || '')}</div>
                                </div>
                                ${attachmentsHtml ? `
                                <div class="ann-expanded-section ann-expanded-attachments">
                                    <span class="ann-expanded-label"><i class="fas fa-paperclip"></i> Załączniki</span>
                                    <div class="ann-attachments-row">${attachmentsHtml}</div>
                                </div>` : ''}
                            </div>
                        </td>
                    `;
                    tr.after(expandTr);
                    btn.querySelector('i').className = 'fas fa-chevron-up';
                }
            });

            // Pin / unpin
            tr.querySelector('.ann-btn-pin')?.addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                const id = Number(btn.dataset.id);
                try {
                    const res = await fetch(`/api/announcements/${id}/pin`, { method: 'PATCH' });
                    if (!res.ok) throw new Error('Nie udało się zmienić stanu przypięcia.');
                    await this.fetchAnnouncements();
                } catch (err) {
                    this.showError(err.message);
                }
            });

            // Read details
            tr.querySelector('.ann-btn-readers')?.addEventListener('click', async (e) => {
                const id = Number(e.currentTarget.dataset.id);
                await this.openReadDetailsModal(id);
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

    // ── Read Details Modal ────────────────────────────────────────────────────
    async openReadDetailsModal(id) {
        const { readDetailsModal, readDetailsList } = this.elements;
        if (!readDetailsModal || !readDetailsList) return;

        readDetailsList.innerHTML = '<div class="ann-loading"><i class="fas fa-spinner fa-spin"></i> Ładowanie...</div>';
        readDetailsModal.classList.add('active');

        try {
            const res = await fetch(`/api/announcements/${id}/read-details`);
            if (!res.ok) throw new Error('Brak dostępu lub błąd serwera.');
            const list = await res.json();

            if (!list.length) {
                readDetailsList.innerHTML = '<p class="ann-empty-readers">Nikt jeszcze nie potwierdził odczytu.</p>';
                return;
            }

            readDetailsList.innerHTML = list.map(r => {
                const when = r.confirmedAt
                    ? new Date(r.confirmedAt).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })
                    : '';
                return `<div class="ann-reader-item">
                    <i class="fas fa-user-check"></i>
                    <span class="ann-reader-name">${Utils.escapeHtml((r.firstName || '') + ' ' + (r.lastName || ''))}</span>
                    <span class="ann-reader-date">${when}</span>
                </div>`;
            }).join('');
        } catch (err) {
            readDetailsList.innerHTML = `<p class="ann-error">${Utils.escapeHtml(err.message)}</p>`;
        }
    },

    closeReadDetailsModal() {
        this.elements.readDetailsModal?.classList.remove('active');
    },

    // ── Success Modal ────────────────────────────────────────────────────────
    showSuccessModal() {
        this.elements.successModal?.classList.add('active');
    },

    closeSuccessModal() {
        this.elements.successModal?.classList.remove('active');
    },

    // ── Delete Modal ─────────────────────────────────────────────────────────
    openDeleteModal(id, title, isGlobal) {
        this.state.pendingDeleteId = id;
        if (this.elements.deleteText) {
            this.elements.deleteText.innerHTML = isGlobal
                ? `Czy na pewno chcesz usunac globalne ogloszenie <strong>&ldquo;${Utils.escapeHtml(title || '')}&rdquo;</strong>? Operacja usunie cala paczke wyslanek do wszystkich kierunkow.`
                : `Czy na pewno chcesz usunąć ogłoszenie <strong>&ldquo;${Utils.escapeHtml(title || '')}&rdquo;</strong>? Tej operacji nie można cofnąć.`;
        }
        this.elements.deleteModal?.classList.add('active');
    },

    closeDeleteModal() {
        this.elements.deleteModal?.classList.remove('active');
        this.state.pendingDeleteId = null;
    },

    async confirmDelete() {
        const id = this.state.pendingDeleteId;
        this.closeDeleteModal();
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
    showSuccess(text) { this.showAlert(text, 'success', 'fa-check-circle'); },
    showError(text)   { this.showAlert(text, 'error',   'fa-exclamation-circle'); },

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
            const data = JSON.parse(raw);
            let msg = data.message || data.detail || raw;
            if (data.reason) msg += ` (${data.reason})`;
            return msg;
        } catch (_) {
            return raw;
        }
    },

    readError(err) {
        if (err?.message && err.message.startsWith('{')) return this.readErrorText(err.message);
        if (err instanceof Error) return err.message;
        return 'Wystąpił nieoczekiwany błąd.';
    },
};

document.addEventListener('DOMContentLoaded', () => AdminAnnouncement.init());
