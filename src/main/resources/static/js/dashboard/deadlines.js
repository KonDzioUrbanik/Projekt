const Deadlines = (() => {

    // === STATE ===
    let allDeadlines = [];  // surowe dane z API
    let doneIds = new Set(); // Oznaczane lokalnie, przechowywane w localStorage
    let activeFilter = 'ALL';
    let currentVisibility = 'PRIVATE';

    // === INIT ===
    function getStorageKey() {
        const userInfoEl = document.getElementById('userMenuToggle');
        const userId = userInfoEl ? userInfoEl.getAttribute('data-user-id') : null;
        return userId ? 'dlDoneIds_user_' + userId : 'dlDoneIds_guest';
    }

    function init() {
        // Wczytaj doneIds z localStorage powiązane z danym userem
        try {
            const savedDone = JSON.parse(localStorage.getItem(getStorageKey()));
            if (Array.isArray(savedDone)) {
                doneIds = new Set(savedDone);
            }
        } catch (e) {
            console.error('Błąd parsowania localStorage:', e);
        }

        const addModal = document.getElementById('addDeadlineModal');
        if (addModal && addModal.parentElement !== document.body) {
            document.body.appendChild(addModal);
        }

        const detailModal = document.getElementById('detailModal');
        if (detailModal && detailModal.parentElement !== document.body) {
            document.body.appendChild(detailModal);
        }

        const confirmModal = document.getElementById('confirmDeleteModal');
        if (confirmModal && confirmModal.parentElement !== document.body) {
            document.body.appendChild(confirmModal);
        }

        bindModalControls();
        bindFilterPills();
        bindSortSelect();
        bindFormSubmit();
        bindVisibilityToggle();
        bindDetailModal();
        bindConfirmModal();
        bindViewToggle();
        loadDeadlines();
        setDefaultDate();
        setVisibility('PRIVATE');
    }

    // ============================================================
    //  API
    // ============================================================

    async function loadDeadlines() {
        try {
            const data = await Utils.apiFetch('/api/deadlines');
            // Obrona przed null/undefined z API
            allDeadlines = Array.isArray(data) ? data : [];
            renderList();
            updateStats();
        } catch (err) {
            console.error('[Deadlines] Błąd ładowania:', err);
            allDeadlines = [];
            // Zawsze pokazuj empty state zamiast pustego miejsca
            document.getElementById('deadlinesList').innerHTML = '';
            const emptyEl = document.getElementById('emptyState');
            const emptyMsg = document.getElementById('emptyMsg');
            emptyEl.style.display = 'flex';
            emptyMsg.textContent = 'Nie udało się załadować terminów.';
            if (window.Utils?.showToast) Utils.showToast('Nie udało się załadować terminów.', 'error');
        }
    }

    async function createDeadline(payload) {
        return await Utils.apiFetch('/api/deadlines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    }

    async function deleteDeadlineApi(id) {
        await Utils.apiFetch(`/api/deadlines/${id}`, { method: 'DELETE' });
    }

    // ============================================================
    //  FILTER & SORT
    // ============================================================

    function getFiltered() {
        const isDoneFilter = activeFilter === 'DONE';
        return allDeadlines.filter(d => {
            const done = doneIds.has(d.id);
            if (isDoneFilter) return done;
            if (done) return false;
            if (activeFilter === 'GROUP')   return d.visibility === 'GROUP';
            if (activeFilter === 'PRIVATE') return d.visibility === 'PRIVATE';
            return true; // ALL
        });
    }

    function getSorted(items) {
        const sortVal = document.getElementById('sortSelect').value;
        const urgOrder = { critical: 0, warning: 1, ok: 2, neutral: 3, done: 4 };

        const sorted = [...items];
        if (sortVal === 'date') {
            sorted.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        } else if (sortVal === 'urgent') {
            sorted.sort((a, b) => {
                return (urgOrder[computeUrgency(a.dueDate, doneIds.has(a.id)).cls] || 0)
                     - (urgOrder[computeUrgency(b.dueDate, doneIds.has(b.id)).cls] || 0);
            });
        } else if (sortVal === 'type') {
            const typeOrder = { EXAM: 0, TEST: 1, PROJECT: 2, HOMEWORK: 3, OTHER: 4 };
            sorted.sort((a, b) => (typeOrder[a.taskType] ?? 4) - (typeOrder[b.taskType] ?? 4));
        }
        return sorted;
    }

    // ============================================================
    //  STATS
    // ============================================================

    function updateStats() {
        const active = allDeadlines.filter(d => !doneIds.has(d.id));
        const now = Date.now();

        const critical = active.filter(d => {
            const diff = (new Date(d.dueDate) - now) / 86400000;
            return diff >= 0 && diff <= 2;
        }).length;

        const week = active.filter(d => {
            const diff = (new Date(d.dueDate) - now) / 86400000;
            return diff >= 0 && diff <= 7;
        }).length;

        const group   = active.filter(d => d.visibility === 'GROUP').length;
        const priv    = active.filter(d => d.visibility === 'PRIVATE').length;

        document.getElementById('statCritical').textContent = critical;
        document.getElementById('statWeek').textContent     = week;
        document.getElementById('statGroup').textContent    = group;
        document.getElementById('statPrivate').textContent  = priv;
    }

    // ============================================================
    //  RENDER
    // ============================================================

    function renderList() {
        const list  = document.getElementById('deadlinesList');
        const empty = document.getElementById('emptyState');
        const items = getSorted(getFiltered());

        list.innerHTML = '';

        if (items.length === 0) {
            empty.style.display = 'flex';
            document.getElementById('emptyMsg').textContent =
                activeFilter === 'DONE' ? 'Nie masz ukończonych terminów.' : 'Brak terminów w tej kategorii.';
            return;
        }

        empty.style.display = 'none';

        // Grupowanie po miesiącach -> każda grupa to osobny div z gridem kart
        let lastMonth = '';
        let monthDiv = null;
        let cardsGrid = null;
        let idx = 0;

        items.forEach(d => {
            const due = new Date(d.dueDate);
            const monthKey = due.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });

            if (monthKey !== lastMonth) {
                monthDiv = document.createElement('div');
                monthDiv.className = 'dl-month-group';

                const monthLabel = document.createElement('div');
                monthLabel.className = 'dl-month-label';
                monthLabel.textContent = monthKey;
                monthDiv.appendChild(monthLabel);

                cardsGrid = document.createElement('div');
                cardsGrid.className = 'dl-month-cards';
                monthDiv.appendChild(cardsGrid);

                list.appendChild(monthDiv);
                lastMonth = monthKey;
            }

            const card = buildCard(d, idx++);
            cardsGrid.appendChild(card);
        });
    }

    // ─── Budowanie karty (nowy layout pionowy) ───
    function buildCard(deadline, idx) {
        const done = doneIds.has(deadline.id);
        const { cls, label } = computeUrgency(deadline.dueDate, done);

        const card = document.createElement('div');
        card.className = `dl-card${done ? ' dl-done' : ''}`;
        card.dataset.id = deadline.id;
        card.style.animationDelay = `${idx * 0.04}s`;

        const typeLabels = { EXAM: 'Egzamin', TEST: 'Kolokwium', PROJECT: 'Projekt', HOMEWORK: 'Zadanie', OTHER: 'Inne' };
        const typeLabel  = typeLabels[deadline.taskType] || 'Inne';
        const visLabel   = deadline.visibility === 'GROUP' ? 'Grupowy' : 'Prywatny';

        const lockIcon = deadline.visibility === 'PRIVATE'
            ? `<svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="6" width="10" height="7" rx="1.5"/><path d="M5 6V4a2 2 0 014 0v2"/></svg>`
            : `<svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="5" cy="4.5" r="2"/><circle cx="9" cy="4.5" r="2"/><path d="M1 12c0-2.21 1.79-4 4-4"/><path d="M9 8c2.21 0 4 1.79 4 4"/></svg>`;

        const courseHtml = deadline.courseName
            ? `<div class="dl-card-course">${esc(deadline.courseName)}</div>`
            : '';

        const metaHtml = deadline.visibility === 'GROUP' && deadline.authorName
            ? `<div class="dl-card-meta">${esc(deadline.authorName)}</div>`
            : '';

        card.innerHTML = `
            <div class="dl-stripe ${cls}"></div>
            <div class="dl-card-body">
                <div class="dl-card-top">
                    <div class="dl-card-badges">
                        <span class="dl-tag ${deadline.taskType}">${typeLabel}</span>
                        <span class="dl-vis-badge ${deadline.visibility}">${lockIcon} ${visLabel}</span>
                    </div>
                    <button class="dl-done-btn ${done ? 'checked' : ''}" title="Oznacz jako ukończone" data-id="${deadline.id}">
                        ${done ? '<svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="white" stroke-width="2.2"><polyline points="1.5,5 4,7.5 8.5,2"/></svg>' : ''}
                    </button>
                </div>
                <div class="dl-card-title" title="${esc(deadline.title)}">${esc(deadline.title)}</div>
                ${courseHtml}
                ${metaHtml}
            </div>
            <div class="dl-card-right">
                <div class="dl-card-right-meta">
                    <div class="dl-countdown ${done ? 'done-clr' : cls}">${label}</div>
                    <div class="dl-card-date">${formatDate(deadline.dueDate)}</div>
                </div>
                ${deadline.canEdit ? `<button class="dl-delete-btn" title="Usuń" data-id="${deadline.id}"><svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3,4 11,4"/><path d="M5 4V2.5h4V4"/><path d="M4 4l.8 8h4.4L10 4"/></svg></button>` : ''}
            </div>
        `;

        // Kliknięcie w kartę → modal szczegółów
        card.addEventListener('click', e => {
            if (e.target.closest('.dl-done-btn') || e.target.closest('.dl-delete-btn')) return;
            openDetailModal(deadline);
        });

        // Done toggle
        card.querySelector('.dl-done-btn').addEventListener('click', e => {
            e.stopPropagation();
            toggleDone(deadline.id);
        });

        // Delete
        const delBtn = card.querySelector('.dl-delete-btn');
        if (delBtn) {
            delBtn.addEventListener('click', e => {
                e.stopPropagation();
                handleDelete(deadline.id, deadline.title);
            });
        }

        return card;
    }

    // ============================================================
    //  URGENCY ENGINE
    // ============================================================

    function computeUrgency(dueDateStr, done) {
        if (done) return { cls: 'done', label: 'Ukończono' };

        const now  = Date.now();
        const due  = new Date(dueDateStr).getTime();
        const diffMs   = due - now;
        const diffDays = Math.ceil(diffMs / 86400000);

        if (diffMs < 0) {
            const daysAgo = Math.abs(Math.ceil(diffMs / 86400000));
            return { cls: 'critical', label: daysAgo === 1 ? 'Minął wczoraj' : `Minął ${daysAgo} dni temu` };
        }
        if (diffDays === 0) return { cls: 'critical', label: 'Dzisiaj!' };
        if (diffDays === 1) return { cls: 'critical', label: 'Jutro' };
        if (diffDays <= 3) return { cls: 'critical', label: `Za ${diffDays} dni` };
        if (diffDays <= 7) return { cls: 'warning',  label: `Za ${diffDays} dni` };
        return { cls: 'neutral', label: `Za ${diffDays} dni` };
    }

    function formatDate(isoStr) {
        const d = new Date(isoStr);
        return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' '
             + d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    }

    // ============================================================
    //  DONE TOGGLE (lokalnie, front-only)
    // ============================================================

    function toggleDone(id) {
        if (doneIds.has(id)) doneIds.delete(id);
        else                  doneIds.add(id);
        
        localStorage.setItem(getStorageKey(), JSON.stringify([...doneIds]));
        
        renderList();
        updateStats();
    }

    // ============================================================
    //  FILTER PILLS
    // ============================================================

    function bindFilterPills() {
        document.querySelectorAll('#filterPills .dl-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#filterPills .dl-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeFilter = btn.dataset.filter;
                renderList();
            });
        });
    }

    function bindSortSelect() {
        document.getElementById('sortSelect').addEventListener('change', () => renderList());
    }

    // ============================================================
    //  MODAL
    // ============================================================

    function bindModalControls() {
        document.getElementById('openAddModal').addEventListener('click', openModal);
        document.getElementById('closeAddModal').addEventListener('click', closeModal);
        document.getElementById('cancelAddModal').addEventListener('click', closeModal);

        document.getElementById('addDeadlineModal').addEventListener('click', e => {
            if (e.target === document.getElementById('addDeadlineModal')) closeModal();
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && document.getElementById('addDeadlineModal').classList.contains('open')) closeModal();
        });
    }

    function setDefaultDate() {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        document.getElementById('dl-date').value = d.toISOString().slice(0, 10);
    }

    function openModal() {
        document.getElementById('addDeadlineModal').classList.add('open');
        document.body.style.overflow = 'hidden';
        setTimeout(() => document.getElementById('dl-title').focus(), 200);
    }

    function closeModal() {
        document.getElementById('addDeadlineModal').classList.remove('open');
        document.body.style.overflow = '';
        document.getElementById('addDeadlineForm').reset();
        setDefaultDate();
        setVisibility('PRIVATE');
    }

    // ============================================================
    //  VISIBILITY TOGGLE
    // ============================================================

    function bindVisibilityToggle() {
        document.getElementById('visPrivate').addEventListener('click', () => setVisibility('PRIVATE'));
        document.getElementById('visGroup').addEventListener('click',   () => setVisibility('GROUP'));
    }

    function setVisibility(value) {
        currentVisibility = value;
        document.getElementById('dl-visibility').value = value;

        const pvt = document.getElementById('visPrivate');
        const grp = document.getElementById('visGroup');

        pvt.className = `dl-vis-option dl-vis-private${value === 'PRIVATE' ? ' selected' : ''}`;
        grp.className = `dl-vis-option dl-vis-group${value === 'GROUP' ? ' selected' : ''}`;

        const notice = document.getElementById('rateLimitNotice');
        if (value === 'GROUP') {
            notice.textContent = 'Limit: 10 terminów grupowych / 24h';
            notice.style.display = 'block';
        } else {
            notice.textContent = 'Limit: 50 terminów prywatnych / 24h';
            notice.style.display = 'block';
        }
    }

    // ============================================================
    //  FORM SUBMIT
    // ============================================================

    function bindFormSubmit() {
        document.getElementById('addDeadlineForm').addEventListener('submit', async e => {
            e.preventDefault();
            const btn   = document.getElementById('submitDeadline');
            const title = document.getElementById('dl-title').value.trim();
            const type  = document.getElementById('dl-type').value;
            const course= document.getElementById('dl-course').value.trim();
            const date  = document.getElementById('dl-date').value;
            const time  = document.getElementById('dl-time').value || '23:59';
            const desc  = document.getElementById('dl-desc').value.trim();

            if (!title || !date) {
                if (!title) document.getElementById('dl-title').style.borderColor = '#ef4444';
                if (!date)  document.getElementById('dl-date').style.borderColor  = '#ef4444';
                return;
            }

            // Reset czerwonych obramowań
            document.getElementById('dl-title').style.borderColor = '';
            document.getElementById('dl-date').style.borderColor  = '';

            const payload = {
                title,
                description: desc || null,
                courseName:  course || null,
                dueDate: `${date}T${time}:00`,
                taskType: type,
                visibility: currentVisibility
            };

            btn.disabled = true;
            btn.textContent = 'Dodawanie...';

            try {
                const created = await createDeadline(payload);
                allDeadlines.push(created);
                allDeadlines.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
                closeModal();
                renderList();
                updateStats();
                if (window.Utils?.showToast) Utils.showToast('Termin dodany!', 'success');
            } catch (err) {
                const msg = err?.message || 'Nie udało się dodać terminu.';
                if (window.Utils?.showToast) Utils.showToast(msg, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Dodaj termin';
            }
        });
    }

    // ============================================================
    //  DELETE
    // ============================================================

    async function doDelete(id) {
        try {
            await deleteDeadlineApi(id);
            allDeadlines = allDeadlines.filter(d => d.id !== id);
            doneIds.delete(id);
            closeDetailModal();
            renderList();
            updateStats();
            if (window.Utils?.showToast) Utils.showToast('Termin usunięty.', 'success');
        } catch (err) {
            if (window.Utils?.showToast) Utils.showToast('Nie udało się usunąć terminu.', 'error');
        }
    }

    let pendingDeleteId = null;

    function openConfirmModal(id, title) {
        pendingDeleteId = id;
        document.getElementById('confirmDeadlineName').textContent = title;
        document.getElementById('confirmDeleteModal').classList.add('open');
    }

    function closeConfirmModal() {
        document.getElementById('confirmDeleteModal').classList.remove('open');
        pendingDeleteId = null;
    }

    function handleDelete(id, title) {
        openConfirmModal(id, title);
    }

    // ============================================================
    //  DETAIL MODAL
    // ============================================================

    let detailDeadlineId = null;

    function openDetailModal(deadline) {
        const done = doneIds.has(deadline.id);
        const { cls, label } = computeUrgency(deadline.dueDate, done);

        const typeLabels = { EXAM: 'Egzamin', TEST: 'Kolokwium', PROJECT: 'Projekt', HOMEWORK: 'Zadanie', OTHER: 'Inne' };
        const typeLabel  = typeLabels[deadline.taskType] || 'Inne';
        const visLabel   = deadline.visibility === 'GROUP' ? 'Grupowy' : 'Prywatny';

        const lockIcon = deadline.visibility === 'PRIVATE'
            ? `<svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="6" width="10" height="7" rx="1.5"/><path d="M5 6V4a2 2 0 014 0v2"/></svg>`
            : `<svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="5" cy="4.5" r="2"/><circle cx="9" cy="4.5" r="2"/><path d="M1 12c0-2.21 1.79-4 4-4"/><path d="M9 8c2.21 0 4 1.79 4 4"/></svg>`;

        detailDeadlineId = deadline.id;

        // Wypełnij dane
        document.getElementById('detailStripe').className = `dl-detail-stripe ${cls}`;
        document.getElementById('detailModalTitle').textContent = deadline.title;

        // Badges
        document.getElementById('detailBadges').innerHTML =
            `<span class="dl-tag ${deadline.taskType}">${typeLabel}</span>
             <span class="dl-vis-badge ${deadline.visibility}">${lockIcon} ${visLabel}</span>`;

        // Pola siatki
        document.getElementById('detailDate').textContent = formatDate(deadline.dueDate);
        const cntEl = document.getElementById('detailCountdown');
        cntEl.textContent = label;
        cntEl.className   = `dl-detail-field-value ${done ? 'done-clr' : cls}`;

        const courseBox = document.getElementById('detailCourseBox');
        if (deadline.courseName) {
            document.getElementById('detailCourse').textContent = deadline.courseName;
            courseBox.style.display = '';
        } else {
            courseBox.style.display = 'none';
        }

        const authorBox = document.getElementById('detailAuthorBox');
        if (deadline.authorName) {
            document.getElementById('detailAuthor').textContent = deadline.authorName;
            authorBox.style.display = '';
        } else {
            authorBox.style.display = 'none';
        }

        // Opis
        const descBox = document.getElementById('detailDescBox');
        if (deadline.description) {
            document.getElementById('detailDesc').textContent = deadline.description;
            descBox.style.display = '';
        } else {
            descBox.style.display = 'none';
        }

        // Przycisk "Oznacz ukończone"
        const doneBtn = document.getElementById('detailMarkDone');
        doneBtn.textContent = done ? 'Oznacz jako aktywne' : 'Oznacz ukończone';

        // Przycisk usuń — widoczny tylko dla canEdit
        const delBtn = document.getElementById('detailDeleteBtn');
        delBtn.style.display = deadline.canEdit ? '' : 'none';

        // Pokaż modal
        document.getElementById('detailModal').classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeDetailModal() {
        document.getElementById('detailModal').classList.remove('open');
        document.body.style.overflow = '';
        detailDeadlineId = null;
    }

    function bindDetailModal() {
        document.getElementById('closeDetailModal').addEventListener('click', closeDetailModal);

        // Kliknięcie w tło
        document.getElementById('detailModal').addEventListener('click', e => {
            if (e.target === document.getElementById('detailModal')) closeDetailModal();
        });

        // ESC
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                if (document.getElementById('confirmDeleteModal').classList.contains('open')) {
                    closeConfirmModal();
                } else if (document.getElementById('detailModal').classList.contains('open')) {
                    closeDetailModal();
                }
            }
        });

        // Akcja: Oznacz ukończone
        document.getElementById('detailMarkDone').addEventListener('click', () => {
            if (detailDeadlineId === null) return;
            toggleDone(detailDeadlineId);
            const deadline = allDeadlines.find(d => d.id === detailDeadlineId);
            if (deadline) openDetailModal(deadline);
        });

        // Akcja: Usuń
        document.getElementById('detailDeleteBtn').addEventListener('click', () => {
            if (detailDeadlineId === null) return;
            const deadline = allDeadlines.find(d => d.id === detailDeadlineId);
            if (deadline) handleDelete(deadline.id, deadline.title);
        });
    }

    function bindConfirmModal() {
        document.getElementById('confirmCancelBtn').addEventListener('click', closeConfirmModal);

        document.getElementById('confirmDeleteModal').addEventListener('click', e => {
            if (e.target === document.getElementById('confirmDeleteModal')) closeConfirmModal();
        });

        document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
            if (pendingDeleteId === null) return;
            const id = pendingDeleteId;
            closeConfirmModal();
            await doDelete(id);
        });
    }

    // ============================================================
    //  VIEW TOGGLE (Grid vs List)
    // ============================================================

    function bindViewToggle() {
        const toggleContainer = document.getElementById('viewToggle');
        if (!toggleContainer) return;
        
        const btns = toggleContainer.querySelectorAll('.dl-view-btn');
        const timeline = document.getElementById('deadlinesList');

        function setView(viewMode) {
            if (viewMode === 'list') {
                timeline.classList.add('list-view');
            } else {
                timeline.classList.remove('list-view');
            }
            
            btns.forEach(b => {
                if (b.dataset.view === viewMode) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });

            localStorage.setItem('dlViewMode', viewMode);
        }

        const savedMode = localStorage.getItem('dlViewMode') || 'grid';
        setView(savedMode);

        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                setView(btn.dataset.view);
            });
        });
    }

    // ============================================================
    //  HELPER
    // ============================================================

    function esc(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => Deadlines.init());
