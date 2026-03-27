(function () {
    'use strict';

    // Element references
    const msgEl = document.getElementById('announcementMessage');
    const formEl = document.getElementById('announcementForm');
    const loadingEl = document.getElementById('annLoading');
    const emptyEl = document.getElementById('annEmpty');
    const listWrap = document.getElementById('announcementList');
    const cardsEl = document.getElementById('annCards');
    const countBadge = document.getElementById('annCountBadge');

    // Starosta-only elements
    const titleInput = document.getElementById('announcementTitle');
    const contentInput = document.getElementById('announcementContent');
    const submitBtn = document.getElementById('submitBtn');
    const titleCounter = document.getElementById('titleCounter');
    const contentCounter = document.getElementById('contentCounter');
    const prioritySelect = document.getElementById('prioritySelect');
    const isPinnedCheckbox = document.getElementById('isPinnedCheckbox');
    const fileInput = document.getElementById('announcementFiles');
    const fileList = document.getElementById('fileList');

    // Table & Filters (Starosta)
    const tableBody = document.getElementById('announcementTableBody');
    const searchInput = document.getElementById('searchInput');
    const resetBtn = document.getElementById('resetFilters');
    const resultsCount = document.getElementById('resultsCount');

    // Modals
    const deleteModal = document.getElementById('deleteModal');
    const modalCancelBtn = document.getElementById('modalCancelBtn');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');
    const readDetailsModal = document.getElementById('readDetailsModal');
    const readDetailsList = document.getElementById('readDetailsList');
    const readDetailsClose = document.getElementById('readDetailsClose');

    if (!formEl || !msgEl) return;

    const mode = formEl.dataset.mode || 'student'; // 'student' | 'starosta'
    let pendingDeleteId = null;

    let state = {
        all: [],
        filtered: [],
        filters: { search: '' }
    };

    // ── Init ────────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        if (mode === 'starosta') {
            formEl.addEventListener('submit', handleSubmit);
            initCharCounters();
            initFileInput();
            initFilters();
        }
        initDeleteModal();
        initReadDetailsModal();
        loadAnnouncements();
    });

    // ── Character counters (starosta form) ──────────────────────────────────
    function initCharCounters() {
        if (titleInput && titleCounter) {
            titleInput.addEventListener('input', () => {
                const len = titleInput.value.length;
                titleCounter.textContent = `${len} / 150`;
                titleCounter.className = 'ann-char-counter' +
                    (len >= 140 ? ' danger' : len >= 120 ? ' warn' : '');
            });
        }
        if (contentInput && contentCounter) {
            contentInput.addEventListener('input', () => {
                const len = contentInput.value.length;
                contentCounter.textContent = `${len} / 2000`;
                contentCounter.className = 'ann-char-counter' +
                    (len >= 1900 ? ' danger' : len >= 1700 ? ' warn' : '');
            });
        }
    }

    function initFileInput() {
        if (!fileInput || !fileList) return;
        fileInput.addEventListener('change', () => {
            const files = Array.from(fileInput.files || []);
            if (files.length > 5) {
                showMessage('Możesz dodać maksymalnie 5 załączników.', 'error');
                fileInput.value = '';
                fileList.innerHTML = '';
                return;
            }
            fileList.innerHTML = '';
            files.forEach(f => {
                const chip = document.createElement('span');
                chip.className = 'ann-file-chip';
                chip.innerHTML = `<i class="fas fa-paperclip"></i> ${Utils.escapeHtml(f.name)} <span class="ann-file-size">(${formatSize(f.size)})</span>`;
                fileList.appendChild(chip);
            });
        });
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // ── Modals ──────────────────────────────────────────────────────────────
    function initDeleteModal() {
        if (!deleteModal) return;
        modalCancelBtn?.addEventListener('click', closeDeleteModal);
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) closeDeleteModal();
        });
        modalConfirmBtn?.addEventListener('click', async () => {
            if (!pendingDeleteId) return;
            const idToDelete = pendingDeleteId;
            closeDeleteModal();
            await executeDelete(idToDelete);
        });
    }

    function openDeleteModal(id) {
        if (!deleteModal) return;
        pendingDeleteId = id;
        deleteModal?.classList.add('active');
    }

    function closeDeleteModal() {
        deleteModal?.classList.remove('active');
        pendingDeleteId = null;
    }

    function initReadDetailsModal() {
        if (!readDetailsModal) return;
        readDetailsClose?.addEventListener('click', () => readDetailsModal.classList.remove('active'));
        readDetailsModal.addEventListener('click', (e) => {
            if (e.target === readDetailsModal) readDetailsModal.classList.remove('active');
        });
    }

    async function openReadDetailsModal(id) {
        if (!readDetailsModal || !readDetailsList) return;
        readDetailsList.innerHTML = '<div class="ann-loading"><i class="fas fa-spinner fa-spin"></i> Ładowanie...</div>';
        readDetailsModal.classList.add('active');
        try {
            const res = await fetch(`/api/announcements/${id}/read-details`);
            if (!res.ok) throw new Error('Nie udało się pobrać szczegółów.');
            const list = await res.json();
            if (!list.length) {
                readDetailsList.innerHTML = '<p class="ann-empty-readers">Nikt jeszcze nie potwierdził odczytu.</p>';
                return;
            }
            readDetailsList.innerHTML = list.map(r => `
                <div class="ann-reader-item">
                    <i class="fas fa-user-check"></i>
                    <span class="ann-reader-name">${Utils.escapeHtml((r.firstName || '') + ' ' + (r.lastName || ''))}</span>
                    <span class="ann-reader-date">${r.confirmedAt ? new Date(r.confirmedAt).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }) : ''}</span>
                </div>
            `).join('');
        } catch (err) {
            readDetailsList.innerHTML = `<p class="ann-error">${Utils.escapeHtml(err.message)}</p>`;
        }
    }

    // ── Submit new announcement ─────────────────────────────────────────────
    async function handleSubmit(event) {
        event.preventDefault();
        clearMessage();

        const title   = (titleInput?.value  || '').trim();
        const content = (contentInput?.value || '').trim();

        if (!title || !content) {
            showMessage('Uzupełnij tytuł i treść ogłoszenia.', 'error');
            return;
        }

        setSubmitLoading(true);

        try {
            const payload = {
                title,
                content,
                priority: prioritySelect?.value || 'INFO',
                isPinned: isPinnedCheckbox?.checked || false
            };

            const formData = new FormData();
            formData.append('data', new Blob([JSON.stringify(payload)], { type: 'application/json' }));

            if (fileInput?.files) {
                Array.from(fileInput.files).forEach(f => formData.append('files', f));
            }

            const response = await fetch('/api/announcements', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || 'Nie udało się wysłać ogłoszenia.');
            }

            formEl.reset();
            if (titleCounter)   titleCounter.textContent   = '0 / 150';
            if (contentCounter) contentCounter.textContent = '0 / 2000';
            if (fileList)       fileList.innerHTML         = '';

            showMessage('Ogłoszenie zostało opublikowane!', 'success');
            await loadAnnouncements();
        } catch (err) {
            showMessage(readError(err), 'error');
        } finally {
            setSubmitLoading(false);
        }
    }

    function setSubmitLoading(loading) {
        if (!submitBtn) return;
        submitBtn.disabled = loading;
        submitBtn.classList.toggle('loading', loading);
    }

    // ── Actions ─────────────────────────────────────────────────────────────
    async function executeDelete(id) {
        try {
            const response = await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || 'Nie udało się usunąć ogłoszenia.');
            }
            showMessage('Ogłoszenie zostało usunięte.', 'success');
            await loadAnnouncements();
        } catch (err) {
            showMessage(readError(err), 'error');
        }
    }

    async function executeConfirmRead(id) {
        try {
            const response = await fetch(`/api/announcements/${id}/confirm-read`, { method: 'POST' });
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || 'Nie udało się potwierdzić przeczytania ogłoszenia.');
            }
            showMessage('Potwierdzono przeczytanie ogłoszenia.', 'success');
            await loadAnnouncements();
        } catch (err) {
            showMessage(readError(err), 'error');
        }
    }

    // ── Load & render ────────────────────────────────────────────────────────
    async function loadAnnouncements() {
        showLoading(true);
        clearMessage();

        try {
            const response = await fetch('/api/announcements/group');
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || 'Nie udało się pobrać ogłoszeń.');
            }
            const data = await response.json();
            if (mode === 'starosta') {
                state.all = data.filter(a => a.canDelete === true);
                applyFilters();
            } else {
                state.all = Array.isArray(data) ? data : [];
                renderAnnouncements(state.all);
            }
        } catch (err) {
            showLoading(false);
            showMessage(readError(err), 'error');
        }
    }

    // ── Filtering (Starosta) ────────────────────────────────────────────────
    function initFilters() {
        searchInput?.addEventListener('input', (e) => {
            state.filters.search = e.target.value.toLowerCase();
            applyFilters();
        });

        resetBtn?.addEventListener('click', () => {
            state.filters = { search: '' };
            if (searchInput) searchInput.value = '';
            applyFilters();
        });
    }

    // (Removed populateAuthorFilter for Starosta as it's not needed)

    function applyFilters() {
        const { search } = state.filters;
        state.filtered = state.all.filter(item => {
            const matchSearch = !search || (
                (item.title || '').toLowerCase().includes(search) ||
                (item.content || '').toLowerCase().includes(search)
            );
            return matchSearch;
        });

        renderAnnouncements(state.filtered);
    }

    function renderAnnouncements(list) {
        showLoading(false);

        if (mode === 'starosta') {
            renderTable(list);
            return;
        }

        if (list.length === 0) {
            if (emptyEl)  emptyEl.style.display  = '';
            if (listWrap) listWrap.style.display  = 'none';
            if (countBadge) countBadge.textContent = '0';
            return;
        }

        if (emptyEl)  emptyEl.style.display  = 'none';
        if (listWrap) listWrap.style.display  = '';
        if (countBadge) countBadge.textContent = list.length;

        const cardsHtml = list.map((item, index) => buildCard(item, index + 1)).join('');
        if (cardsEl) cardsEl.innerHTML = cardsHtml;

        if (cardsEl) {
            cardsEl.querySelectorAll('.ann-delete-btn').forEach(btn => {
                btn.addEventListener('click', () => openDeleteModal(Number(btn.dataset.id)));
            });
            cardsEl.querySelectorAll('.ann-confirm-btn').forEach(btn => {
                btn.addEventListener('click', () => executeConfirmRead(Number(btn.dataset.id)));
            });
            cardsEl.querySelectorAll('.ann-readers-btn').forEach(btn => {
                btn.addEventListener('click', () => openReadDetailsModal(Number(btn.dataset.id)));
            });
        }
    }

    function renderTable(list) {
        if (!tableBody) return;
        if (resultsCount) resultsCount.textContent = list.length;
        if (countBadge) countBadge.textContent = state.all.length;

        if (list.length === 0) {
            if (listWrap) listWrap.style.display = ''; // listWrap is the table card now
            tableBody.innerHTML = `
                <tr class="ann-table-empty">
                    <td colspan="6">
                        <div class="ann-table-empty-inner">
                            <i class="fas fa-search"></i>
                            <h4>Brak wyników</h4>
                            <p>Nie znaleziono ogłoszeń pasujących do filtra.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        if (listWrap) listWrap.style.display = '';
        tableBody.innerHTML = '';

        list.forEach((item, index) => {
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
                    ${priorityBadge(item.priority)}
                </td>
                <td><div class="ann-td-content" title="${Utils.escapeHtml(item.content)}">${Utils.escapeHtml(item.content || '')}</div></td>
                <td class="ann-td-date">${Utils.escapeHtml(created)}</td>
                <td class="ann-td-date">${Number(item.readConfirmationsCount || 0)}</td>
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
                        ${item.canDelete ? `
                            <button class="ann-action-btn ann-btn-del" data-id="${item.id}" title="Usuń">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            `;

            tableBody.appendChild(tr);

            // Pin / unpin
            tr.querySelector('.ann-btn-pin')?.addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                const id = Number(btn.dataset.id);
                try {
                    const res = await fetch(`/api/announcements/${id}/pin`, { method: 'PATCH' });
                    if (!res.ok) throw new Error('Nie udało się zmienić stanu przypięcia.');
                    await loadAnnouncements();
                } catch (err) {
                    showMessage(readError(err), 'error');
                }
            });

            // Expand logic
            tr.querySelector('.ann-btn-view')?.addEventListener('click', (e) => {
                const btn = e.currentTarget;
                const existing = tableBody.querySelector(`.ann-expanded-row[data-for="${item.id}"]`);
                if (existing) {
                    existing.remove();
                    btn.querySelector('i').className = 'fas fa-chevron-down';
                } else {
                    const attachmentsHtml = (item.attachments || []).map(a => `
                        <a href="/api/announcements/attachments/${a.id}" class="ann-attachment-link" download="${Utils.escapeHtml(a.originalFileName)}">
                            <i class="fas fa-paperclip"></i> ${Utils.escapeHtml(a.originalFileName)}
                        </a>
                    `).join('');

                    const expandTr = document.createElement('tr');
                    expandTr.className = 'ann-expanded-row';
                    expandTr.dataset.for = item.id;
                    expandTr.innerHTML = `
                        <td colspan="6">
                            <div class="ann-expanded-inner">
                                <div class="ann-expanded-section">
                                    <span class="ann-expanded-label"><i class="fas fa-align-left"></i> Treść ogłoszenia</span>
                                    <div class="ann-expanded-text">${Utils.escapeHtml(item.content || '')}</div>
                                </div>
                                ${attachmentsHtml ? `
                                <div class="ann-expanded-section">
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

            tr.querySelector('.ann-btn-readers')?.addEventListener('click', () => openReadDetailsModal(item.id));
            tr.querySelector('.ann-btn-del')?.addEventListener('click', () => openDeleteModal(item.id));
        });
    }

    function priorityBadge(priority) {
        const cfg = {
            IMPORTANT: { label: 'Ważne', cls: 'priority-important', icon: 'fa-exclamation-circle' },
            INFO: { label: 'Info', cls: 'priority-info', icon: 'fa-info-circle' },
            ORGANIZATIONAL: { label: 'Organizacyjne', cls: 'priority-org', icon: 'fa-calendar-alt' }
        };
        const p = cfg[priority] || cfg['INFO'];
        return `<span class="ann-priority-badge ${p.cls}"><i class="fas ${p.icon}"></i> ${p.label}</span>`;
    }

    function buildCard(item, index) {
        const created = item.createdAt
            ? new Date(item.createdAt).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })
            : '-';

        const author = [item.authorFirstName, item.authorLastName].filter(Boolean).join(' ') || 'Nieznany';
        const initials = ((item.authorFirstName?.[0] || '') + (item.authorLastName?.[0] || '')).toUpperCase() || '?';
        const group    = item.targetGroupName || '-';

        const pinnedBadge = item.isPinned
            ? `<span class="ann-pinned-badge"><i class="fas fa-thumbtack"></i> Przypięte</span>`
            : '';

        const attachmentCount = (item.attachments || []).length;
        const attachmentsHtml = attachmentCount > 0
            ? `<div class="ann-card-attachments">
                ${item.attachments.map(a => `
                    <a href="/api/announcements/attachments/${a.id}" class="ann-attachment-link" download="${Utils.escapeHtml(a.originalFileName)}">
                        <i class="fas fa-paperclip"></i> ${Utils.escapeHtml(a.originalFileName)}
                    </a>
                `).join('')}
               </div>`
            : '';

        // Managers moved to table panel

        const readAction = item.canConfirmRead
            ? `<button class="ann-confirm-btn" data-id="${item.id}">
                   <i class="fas fa-check"></i> Potwierdzam przeczytanie
               </button>`
            : item.readByCurrentUser
                ? `<span class="ann-read-badge"><i class="fas fa-check-circle"></i> Potwierdzone</span>`
                : '';

        const readStats = item.canViewReadStats
            ? `<div class="ann-meta-item ann-read-count" title="Liczba potwierdzeń przeczytania">
                   <i class="fas fa-user-check"></i>
                   <span>Potwierdzenia: ${Number(item.readConfirmationsCount || 0)}</span>
               </div>`
            : '';

        return `
            <article class="announcement-card ${item.isPinned ? 'pinned' : ''} ${item.priority === 'IMPORTANT' ? 'important' : ''}">
                <div class="announcement-card-header">
                    <div class="announcement-card-header-left">
                        <div class="ann-author-avatar">${Utils.escapeHtml(initials)}</div>
                        <div class="announcement-title-block">
                            <h4 class="announcement-title">
                                ${Utils.escapeHtml(item.title || '')}
                            </h4>
                            <div class="announcement-author-line">
                                <strong>${Utils.escapeHtml(author)}</strong>
                                ${pinnedBadge}
                                ${priorityBadge(item.priority)}
                            </div>
                        </div>
                    </div>
                    <div class="announcement-card-actions">
                        <span class="ann-index-badge">#${index}</span>
                    </div>
                </div>
                <p class="announcement-content">${Utils.escapeHtml(item.content || '')}</p>
                ${attachmentsHtml}
                <div class="announcement-meta">
                    <div class="ann-meta-item">
                        <i class="fas fa-clock"></i>
                        <span>${Utils.escapeHtml(created)}</span>
                    </div>
                    <div class="ann-group-badge">
                        <i class="fas fa-users"></i>
                        ${Utils.escapeHtml(group)}
                    </div>
                    ${readStats}
                    ${readAction}
                </div>
            </article>
        `;
    }

    // ── UI helpers ───────────────────────────────────────────────────────────
    function showLoading(visible) {
        if (loadingEl) {
            loadingEl.style.display = visible ? '' : 'none';
        } else if (visible && tableBody && mode === 'starosta') {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="padding: 4rem 2rem; text-align: center;">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem;">
                            <div class="ann-spinner"></div>
                            <p style="color: var(--text-light); margin: 0;">Ładowanie ogłoszeń...</p>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    function showMessage(text, type) {
        if (!msgEl) return;
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
        msgEl.innerHTML = `
            <div class="ann-alert ${type}">
                <i class="fas ${icon}"></i>
                <span>${Utils.escapeHtml(text)}</span>
            </div>
        `;
        if (type === 'success') {
            setTimeout(() => { if (msgEl) msgEl.innerHTML = ''; }, 4000);
        }
    }

    function clearMessage() {
        if (msgEl) msgEl.innerHTML = '';
    }

    function readError(err) {
        if (!err?.message) return 'Wystąpił nieoczekiwany błąd.';
        const t = err.message.trim();
        if (t.startsWith('{')) {
            try { return JSON.parse(t).message || 'Wystąpił błąd.'; } catch (_) { return t; }
        }
        return t;
    }

})();
