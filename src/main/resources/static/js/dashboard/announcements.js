(function () {
    'use strict';

    // ── Element references ───────────────────────────────────────────────────
    const msgEl        = document.getElementById('announcementMessage');
    const formEl       = document.getElementById('announcementForm');
    const loadingEl    = document.getElementById('annLoading');
    const emptyEl      = document.getElementById('annEmpty');
    const listWrap     = document.getElementById('announcementList');
    const cardsEl      = document.getElementById('annCards');
    const countBadge   = document.getElementById('annCountBadge');

    // Starosta-only elements
    const titleInput   = document.getElementById('announcementTitle');
    const contentInput = document.getElementById('announcementContent');
    const submitBtn    = document.getElementById('submitBtn');
    const titleCounter = document.getElementById('titleCounter');
    const contentCounter = document.getElementById('contentCounter');

    // Delete modal
    const deleteModal      = document.getElementById('deleteModal');
    const modalCancelBtn   = document.getElementById('modalCancelBtn');
    const modalConfirmBtn  = document.getElementById('modalConfirmBtn');

    if (!formEl || !msgEl) return;

    const mode = formEl.dataset.mode || 'student'; // 'student' | 'starosta'
    let pendingDeleteId = null;

    // ── Init ────────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        if (mode === 'starosta') {
            formEl.addEventListener('submit', handleSubmit);
            initCharCounters();
        }
        initDeleteModal();
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

    // ── Delete modal ────────────────────────────────────────────────────────
    function initDeleteModal() {
        if (!deleteModal) return;
        modalCancelBtn?.addEventListener('click', closeDeleteModal);
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) closeDeleteModal();
        });
        modalConfirmBtn?.addEventListener('click', async () => {
            if (!pendingDeleteId) return;
            closeDeleteModal();
            await executeDelete(pendingDeleteId);
            pendingDeleteId = null;
        });
    }

    function openDeleteModal(id) {
        pendingDeleteId = id;
        deleteModal?.classList.add('active');
    }

    function closeDeleteModal() {
        deleteModal?.classList.remove('active');
        pendingDeleteId = null;
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
            const response = await fetch('/api/announcements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || 'Nie udało się wysłać ogłoszenia.');
            }

            formEl.reset();
            if (titleCounter)   titleCounter.textContent   = '0 / 150';
            if (contentCounter) contentCounter.textContent = '0 / 2000';

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

    // ── Delete an announcement ──────────────────────────────────────────────
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
            const announcements = await response.json();
            renderAnnouncements(Array.isArray(announcements) ? announcements : []);
        } catch (err) {
            showLoading(false);
            showMessage(readError(err), 'error');
        }
    }

    function renderAnnouncements(list) {
        showLoading(false);

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

        // Attach delete button listeners (starosta only)
        if (mode === 'starosta' && cardsEl) {
            cardsEl.querySelectorAll('.ann-delete-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    openDeleteModal(Number(btn.dataset.id));
                });
            });
        }
    }

    function buildCard(item, index) {
        const created = item.createdAt
            ? new Date(item.createdAt).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })
            : '-';

        const author = [item.authorFirstName, item.authorLastName].filter(Boolean).join(' ') || 'Nieznany';
        const initials = ((item.authorFirstName?.[0] || '') + (item.authorLastName?.[0] || '')).toUpperCase() || '?';
        const group    = item.targetGroupName || '-';

        const deleteBtn = mode === 'starosta'
            ? `<button class="ann-delete-btn" data-id="${item.id}" title="Usuń ogłoszenie">
                   <i class="fas fa-trash-alt"></i>
               </button>`
            : '';

        return `
            <article class="announcement-card">
                <div class="announcement-card-header">
                    <div class="announcement-card-header-left">
                        <div class="ann-author-avatar">${escapeHtml(initials)}</div>
                        <div class="announcement-title-block">
                            <h4 class="announcement-title">${escapeHtml(item.title || '')}</h4>
                            <div class="announcement-author-line">
                                <strong>${escapeHtml(author)}</strong>
                            </div>
                        </div>
                    </div>
                    <div class="announcement-card-actions">
                        <span class="ann-index-badge">#${index}</span>
                        ${deleteBtn}
                    </div>
                </div>
                <p class="announcement-content">${escapeHtml(item.content || '')}</p>
                <div class="announcement-meta">
                    <div class="ann-meta-item">
                        <i class="fas fa-clock"></i>
                        <span>${escapeHtml(created)}</span>
                    </div>
                    <div class="ann-group-badge">
                        <i class="fas fa-users"></i>
                        ${escapeHtml(group)}
                    </div>
                </div>
            </article>
        `;
    }

    // ── UI helpers ───────────────────────────────────────────────────────────
    function showLoading(visible) {
        if (loadingEl) loadingEl.style.display = visible ? '' : 'none';
    }

    function showMessage(text, type /* 'success' | 'error' */) {
        if (!msgEl) return;
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
        msgEl.innerHTML = `
            <div class="ann-alert ${type}">
                <i class="fas ${icon}"></i>
                <span>${escapeHtml(text)}</span>
            </div>
        `;
        // Auto-dismiss success after 4 s
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

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
})();
