'use strict';

class ScheduleManagement {
    static CONFIG = {
        API: {
            SCHEDULE: '/api/schedule',
            SCHEDULE_ALL: '/api/schedule/all',
            GROUPS: '/api/groups'
        },
        CLASS_TYPES: {
            'WYKLAD': 'Wykład', 'CWICZENIA': 'Ćwiczenia laboratoryjne', 'LABORATORIUM': 'Laboratorium',
            'PROJEKT': 'Projekt zespołowy', 'SEMINARIUM': 'Seminarium', 'KONSULTACJE': 'Konsultacje',
            'CWICZENIA_PROJEKTOWE': 'Ćwiczenia projektowe'
        },
        CREDIT_TYPES: {
            'ZALICZENIE': 'Zaliczenie', 'ZALICZENIE_NA_OCENE': 'Zaliczenie na ocenę',
            'EGZAMIN': 'Egzamin', 'INNE': 'Inne'
        }
    };

    constructor() {
        this.scheduleData = [];
        this.filteredData = [];
        this.currentPage = 1;
        this.pageSize = 50;
        this.totalPages = 1;
        this.isEditing = false;
        this.currentEditId = null;
        this.allGroups = [];
        const appElem = document.getElementById('scheduleApp');
        this.isStarosta = appElem?.getAttribute('data-is-starosta') === 'true';
        const sgId = appElem?.getAttribute('data-starosta-group-id');
        this.starostaGroupId = sgId && sgId !== 'null' ? parseInt(sgId) : null;
        this.pendingForceSave = false;
        this.lastSavedFormData = null;
        this.deletionTimers = new Map();

        // Teachers list state (tags)
        this.currentTeachers = [];

        this.initializeEventListeners();
        this.loadGroups();
        this.loadSchedule();
    }

    initializeEventListeners() {
        document.getElementById('addScheduleBtn').addEventListener('click', () => this.openModal());
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());

        document.getElementById('scheduleForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSchedule(false);
        });

        // Occurrence add button
        document.getElementById('addOccurrenceBtn').addEventListener('click', () => this.addOccurrenceRow());

        // Teacher tag input
        const teacherInput = document.getElementById('teacherInput');
        const teachersWrapper = document.getElementById('teachersWrapper');
        
        if (teachersWrapper && teacherInput) {
            teachersWrapper.addEventListener('click', () => teacherInput.focus());
            
            teacherInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    this.addTeacher();
                }
                if (e.key === 'Backspace' && teacherInput.value === '' && this.currentTeachers.length > 0) {
                    this.removeTeacher(this.currentTeachers.length - 1);
                }
            });
            
            teacherInput.addEventListener('blur', () => {
                if (teacherInput.value.trim()) this.addTeacher();
            });
            
            // Handle paste or fast typing with input event
            teacherInput.addEventListener('input', (e) => {
                if (teacherInput.value.includes(',')) {
                    this.addTeacher();
                }
            });
        }

        // Filtry
        document.getElementById('typeFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('groupFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('teacherFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('showArchivedToggle').addEventListener('change', () => this.applyFilters());

        const debouncedSearch = Utils.debounce(() => this.applyFilters(), 300);
        document.getElementById('searchInput').addEventListener('input', debouncedSearch);
        document.getElementById('resetFilters').addEventListener('click', () => this.resetFilters());

        // Masowe akcje
        document.getElementById('clearGroupScheduleBtn')?.addEventListener('click', () => this.clearGroupSchedule());
        document.getElementById('archiveActiveBtn')?.addEventListener('click', () => this.archiveActiveEntries());

        // Paginacja
        document.getElementById('prevPageTop').addEventListener('click', () => this.changePage(this.currentPage - 1));
        document.getElementById('nextPageTop').addEventListener('click', () => this.changePage(this.currentPage + 1));
        document.getElementById('pageSizeTop').addEventListener('change', (e) => this.handlePageSizeChange(e));

        // Eksport
        document.getElementById('openExportModalBtn')?.addEventListener('click', () => this.openExportModal());
        document.getElementById('closeExportModalBtn')?.addEventListener('click', () => this.closeExportModal());
        document.getElementById('cancelExportBtn')?.addEventListener('click', () => this.closeExportModal());
        document.getElementById('performExportBtn')?.addEventListener('click', () => this.exportCsv());

        document.getElementById('selectAllCols')?.addEventListener('click', () => {
            document.querySelectorAll('.export-columns input[type="checkbox"]').forEach(ch => ch.checked = true);
        });
        document.getElementById('deselectAllCols')?.addEventListener('click', () => {
            document.querySelectorAll('.export-columns input[type="checkbox"]').forEach(ch => ch.checked = false);
        });

        // Kolizje
        document.getElementById('btnCancelCollision')?.addEventListener('click', () => this.closeCollisionModal());
        document.getElementById('btnConfirmCollision')?.addEventListener('click', () => this.saveSchedule(true));

        // Delegacja tabeli
        const tableBody = document.getElementById('scheduleTableBody');
        if (tableBody) {
            tableBody.addEventListener('click', (e) => {
                const editBtn = e.target.closest('.btn-edit');
                if (editBtn) {
                    const data = Utils.safeJsonParse(editBtn.getAttribute('data-schedule'), null);
                    if (data) this.openModal(data);
                    return;
                }
                const deleteBtn = e.target.closest('.btn-delete');
                if (deleteBtn) {
                    const id = deleteBtn.getAttribute('data-id');
                    const title = deleteBtn.closest('tr').querySelector('strong')?.innerText || 'te zajęcia';
                    this.openDeleteConfirmModal(id, `Czy na pewno chcesz usunąć zajęcia <strong>${title}</strong>?`);
                    return;
                }
                const archiveBtn = e.target.closest('.btn-archive');
                if (archiveBtn) { this.archiveSchedule(archiveBtn.getAttribute('data-id')); return; }
                const restoreBtn = e.target.closest('.btn-restore');
                if (restoreBtn) { this.restoreSchedule(restoreBtn.getAttribute('data-id')); return; }
            });
        }

        // Modal usuwania
        document.getElementById('btnCancelDelete')?.addEventListener('click', () => {
            document.getElementById('deleteConfirmOverlay').classList.remove('active');
        });
        document.getElementById('btnConfirmDelete')?.addEventListener('click', () => {
            document.getElementById('deleteConfirmOverlay').classList.remove('active');
            if (this.pendingDeleteType === 'single') this.deleteSchedule(this.pendingDeleteId);
            else if (this.pendingDeleteType === 'bulk') this.executeBulkDelete(this.pendingDeleteId);
        });

        // Modal podglądu
        document.getElementById('previewBtn')?.addEventListener('click', () => this.showPreview());
        document.getElementById('closePreviewBtn')?.addEventListener('click', () => this.closePreview());
        document.getElementById('closePreviewFooterBtn')?.addEventListener('click', () => this.closePreview());
    }

    // Teachers Tag Input

    addTeacher() {
        const input = document.getElementById('teacherInput');
        if (!input) return;

        // Split by commas in case multiple were pasted or entered
        const rawValue = input.value;
        const parts = rawValue.split(',').map(p => p.trim()).filter(p => p.length > 0);
        
        if (parts.length === 0) {
            input.value = '';
            return;
        }

        let updated = false;
        parts.forEach(name => {
            if (!this.currentTeachers.includes(name)) {
                this.currentTeachers.push(name);
                updated = true;
            }
        });

        if (updated) {
            this.renderTeacherTags();
        }
        
        input.value = '';
    }

    removeTeacher(index) {
        this.currentTeachers.splice(index, 1);
        this.renderTeacherTags();
    }

    renderTeacherTags() {
        const container = document.getElementById('teachersTags');
        if (!container) return;
        container.innerHTML = this.currentTeachers.map((t, i) => `
            <span class="teacher-tag">
                ${Utils.escapeHtml(t)}
                <button type="button" class="teacher-tag-remove" data-idx="${i}" title="Usuń">×</button>
            </span>
        `).join('');
        container.querySelectorAll('.teacher-tag-remove').forEach(btn => {
            btn.addEventListener('click', () => this.removeTeacher(parseInt(btn.dataset.idx)));
        });
    }

    // Occurrences Dynamic Rows

    addOccurrenceRow(data = null) {
        const list = document.getElementById('occurrencesList');
        if (!list) return;

        const row = document.createElement('div');
        row.className = 'occurrence-row';
        row.innerHTML = `
            <div class="occurrence-index">#1</div>
            <div class="occurrence-fields">
                <input type="hidden" class="occ-id" value="${data?.id || ''}">
                <div class="occ-field">
                    <label>Od</label>
                    <input type="datetime-local" class="occ-start" value="${data?.startDateTime ? this.toDateTimeLocal(data.startDateTime) : ''}" required>
                </div>
                <div class="occ-field">
                    <label>Do</label>
                    <input type="datetime-local" class="occ-end" value="${data?.endDateTime ? this.toDateTimeLocal(data.endDateTime) : ''}" required>
                </div>
                <div class="occ-field">
                    <label>Sala</label>
                    <input type="text" class="occ-room" placeholder="np. 201" value="${Utils.escapeHtml(data?.room || '')}">
                </div>
                <div class="occ-field">
                    <label>Budynek</label>
                    <input type="text" class="occ-building" placeholder="np. W20 A" value="${Utils.escapeHtml(data?.buildingCode || '')}">
                </div>
                <div class="occ-field occ-location">
                    <label>Lokalizacja</label>
                    <input type="text" class="occ-loc" placeholder="np. Wyspiańskiego 20, budynek A" value="${Utils.escapeHtml(data?.location || '')}">
                </div>
                <button type="button" class="btn-remove-occurrence" title="Usuń termin"><i class="fas fa-minus"></i></button>
            </div>
        `;
        row.querySelector('.btn-remove-occurrence').addEventListener('click', () => {
            row.remove();
            this.reindexOccurrences();
        });
        list.appendChild(row);
        this.reindexOccurrences();
    }

    reindexOccurrences() {
        const rows = document.querySelectorAll('#occurrencesList .occurrence-row');
        rows.forEach((row, idx) => {
            const indexEl = row.querySelector('.occurrence-index');
            if (indexEl) indexEl.textContent = `#${idx + 1}`;
        });
    }

    collectOccurrences() {
        const rows = document.querySelectorAll('#occurrencesList .occurrence-row');
        const result = [];
        for (const row of rows) {
            const id = row.querySelector('.occ-id').value;
            const start = row.querySelector('.occ-start').value;
            const end = row.querySelector('.occ-end').value;
            if (!start || !end) continue;
            
            // Ensure ISO format YYYY-MM-DDTHH:mm:ss
            let startISO = start;
            let endISO = end;
            if (start.length === 16) startISO += ':00';
            if (end.length === 16) endISO += ':00';

            result.push({
                id:            id ? parseInt(id) : null,
                startDateTime: startISO,
                endDateTime:   endISO,
                room:          row.querySelector('.occ-room').value.trim() || null,
                buildingCode:  row.querySelector('.occ-building').value.trim() || null,
                location:      row.querySelector('.occ-loc').value.trim() || null
            });
        }
        return result;
    }

    toDateTimeLocal(isoString) {
        if (!isoString) return '';
        return isoString.substring(0, 16);
    }

    // Data Loading

    async loadSchedule() {
        const loading = document.getElementById('loading');
        if (loading) loading.classList.add('active');
        try {
            const api = this.isStarosta 
                ? '/api/schedule/starosta' 
                : ScheduleManagement.CONFIG.API.SCHEDULE_ALL;
            const response = await fetch(api);
            if (!response.ok) throw new Error(`Status: ${response.status}`);
            this.scheduleData = await response.json();
            this.populateTeacherFilter();
            this.applyFilters();
        } catch (error) {
            console.error('Błąd:', error);
            this.renderErrorState();
        } finally {
            if (loading) loading.classList.remove('active');
        }
    }

    async loadGroups() {
        try {
            const res = await fetch(ScheduleManagement.CONFIG.API.GROUPS);
            if (!res.ok) throw new Error(`Status: ${res.status}`);
            this.allGroups = await res.json();
            this.populateGroupsSelect();
            this.populateGroupFilter();
        } catch (error) { console.error('Błąd grup:', error); }
    }

    populateGroupsSelect() {
        const select = document.getElementById('studentGroups');
        if (!select) return;
        select.innerHTML = '';
        
        [...this.allGroups].sort((a, b) => a.name.localeCompare(b.name, 'pl')).forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.name;
            
            if (this.isStarosta && g.id === this.starostaGroupId) {
                opt.selected = true;
            }
            
            select.appendChild(opt);
        });

        if (this.isStarosta) {
            select.disabled = true;
            // Native selects don't always show the selected text properly when disabled and size=1
            // We can add a "dummy" first option if needed, but better to just ensure it's selected.
            // Dispatch change event to trigger any listeners (like "Wybrano: X" libraries)
            select.dispatchEvent(new Event('change'));
        }
    }

    populateGroupFilter() {
        const filter = document.getElementById('groupFilter');
        if (!filter) return;
        
        filter.innerHTML = '';
        if (!this.isStarosta) {
            filter.innerHTML = '<option value="">Wszystkie kierunki</option>';
        }

        [...this.allGroups].sort((a, b) => a.name.localeCompare(b.name, 'pl')).forEach(g => {
            if (this.isStarosta && g.id !== this.starostaGroupId) return;
            
            const opt = document.createElement('option');
            opt.value = g.id; 
            opt.textContent = g.name;
            if (this.isStarosta && g.id === this.starostaGroupId) {
                opt.selected = true;
            }
            filter.appendChild(opt);
        });

        if (this.isStarosta) {
            filter.disabled = true;
            filter.dispatchEvent(new Event('change'));
        }
    }

    populateTeacherFilter() {
        const filter = document.getElementById('teacherFilter');
        if (!filter) return;
        filter.innerHTML = '<option value="">Wszyscy wykładowcy</option>';
        const teachers = [...new Set(
            this.scheduleData.flatMap(i => i.teachers || []).filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, 'pl'));
        teachers.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t; opt.textContent = t; filter.appendChild(opt);
        });
    }

    applyFilters() {
        const type    = document.getElementById('typeFilter').value;
        const group   = document.getElementById('groupFilter').value;
        const teacher = document.getElementById('teacherFilter').value;
        const q       = document.getElementById('searchInput').value.toLowerCase().trim();
        const arch    = document.getElementById('showArchivedToggle').checked;

        this.filteredData = this.scheduleData.filter(item => {
            if (type && item.classType !== type) return false;
            if (teacher && !(item.teachers || []).some(t => t === teacher)) return false;
            if (group && (!item.studentGroups || !item.studentGroups.some(g => g.id.toString() === group))) return false;
            if (q) {
                const text = `${item.title} ${(item.teachers || []).join(' ')} ${item.studentGroups?.map(g => g.name).join(' ')}`.toLowerCase();
                if (!text.includes(q)) return false;
            }
            if (!arch && item.archived) return false;
            return true;
        });

        const countSpan = document.getElementById('resultsCount');
        if (countSpan) countSpan.textContent = this.filteredData.length;
        this.currentPage = 1;
        this.updatePaginationUI();
        this.toggleBulkDeleteButton(group);
    }

    toggleBulkDeleteButton(groupId) {
        const btn = document.getElementById('clearGroupScheduleBtn');
        if (!btn) return;
        if (groupId) {
            btn.style.display = 'flex';
            const g = this.allGroups.find(x => x.id.toString() === groupId);
            if (g) btn.title = `Wyczyść plan dla: ${g.name}`;
        } else { btn.style.display = 'none'; }
    }

    resetFilters() {
        document.getElementById('typeFilter').value = '';
        document.getElementById('groupFilter').value = '';
        document.getElementById('teacherFilter').value = '';
        document.getElementById('searchInput').value = '';
        document.getElementById('showArchivedToggle').checked = false;
        this.applyFilters();
    }

    updatePaginationUI() {
        const total = this.filteredData.length;
        this.totalPages = this.pageSize === 'all' ? 1 : Math.max(1, Math.ceil(total / this.pageSize));
        document.getElementById('currentPageTop').textContent = this.currentPage;
        document.getElementById('totalPagesTop').textContent = this.totalPages;
        document.getElementById('prevPageTop').disabled = (this.currentPage <= 1);
        document.getElementById('nextPageTop').disabled = (this.currentPage >= this.totalPages);
        this.renderFilteredPage();
    }

    renderFilteredPage() {
        const data = this.pageSize === 'all'
            ? this.filteredData
            : this.filteredData.slice((this.currentPage - 1) * this.pageSize, this.currentPage * this.pageSize);
        this.renderTable(data);
    }

    changePage(p) { if (p >= 1 && p <= this.totalPages) { this.currentPage = p; this.updatePaginationUI(); } }
    handlePageSizeChange(e) { this.pageSize = e.target.value === 'all' ? 'all' : parseInt(e.target.value); this.currentPage = 1; this.updatePaginationUI(); }

    // Table Rendering

    renderTable(data) {
        const container = document.querySelector('.table-scroll-container');
        const table = document.getElementById('scheduleTable');
        const body = document.getElementById('scheduleTableBody');
        
        let emptyState = container.querySelector('.empty-state-message');
        
        if (data.length === 0) {
            body.innerHTML = '';
            table.style.display = 'none';
            if (!emptyState) {
                emptyState = document.createElement('div');
                emptyState.className = 'empty-state-message';
                emptyState.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 1rem; text-align: center;';
                emptyState.innerHTML = `
                    <div style="font-size: 3.5rem; color: var(--text-muted, #9ca3af); margin-bottom: 1rem; opacity: 0.5;">
                        <i class="fas fa-calendar-times"></i>
                    </div>
                    <h3 style="margin: 0 0 0.5rem 0; color: var(--text-color, #77787bff); font-size: 1.25rem;">Brak danych do wyświetlenia</h3>
                    <p style="margin: 0; color: var(--text-muted, #6b7280); max-width: 400px; font-size: 0.95rem;">Nie znaleziono żadnych zajęć.</p>
                `;
                container.appendChild(emptyState);
            }
            return;
        }

        if (emptyState) emptyState.remove();
        table.style.display = 'table';

        body.innerHTML = data.map(item => {
            const type       = ScheduleManagement.CONFIG.CLASS_TYPES[item.classType] || item.classType;
            const credit     = ScheduleManagement.CONFIG.CREDIT_TYPES[item.creditType] || (item.creditType || '-');
            const teachers   = (item.teachers || []).map(t => Utils.escapeHtml(t)).join(', ') || '-';
            const groups     = item.studentGroups?.map(g => Utils.escapeHtml(g.name)).join(', ') || '-';
            const groupNum   = Utils.escapeHtml(item.groupNumber || '-');
            const spec       = Utils.escapeHtml(item.specialization || '-');
            const occCount   = (item.occurrences || []).length;
            const firstOcc   = (item.occurrences || [])[0];
            const firstDate  = firstOcc ? this.formatOccurrenceShort(firstOcc) : '-';
            const archBadge  = item.archived ? '<span class="week-badge" style="background:#4b5563;margin-left:6px;">Archiwum</span>' : '';
            const archAction = item.archived
                ? `<button class="action-btn btn-restore" title="Przywróć" data-id="${item.id}"><i class="fas fa-box-open"></i></button>`
                : `<button class="action-btn btn-archive" title="Archiwizuj" data-id="${item.id}"><i class="fas fa-archive"></i></button>`;

            return `
            <tr>
                <td>${item.id}</td>
                <td><strong>${Utils.escapeHtml(item.title)}</strong></td>
                <td class="teacher-cell">${teachers}</td>
                <td>${groupNum}</td>
                <td>${spec}</td>
                <td><span class="class-type-badge ${item.classType}">${type}</span></td>
                <td><span class="week-badge">${Utils.escapeHtml(credit)}</span>${archBadge}</td>
                <td title="${Utils.escapeHtml((item.occurrences||[]).map(o => this.formatOccurrenceShort(o)).join(', '))}">
                    <span class="occ-summary">${firstDate}</span>
                    ${occCount > 1 ? `<span class="occ-count">+${occCount - 1}</span>` : ''}
                </td>
                ${!this.isStarosta ? `<td>${groups}</td>` : ''}
                <td>
                    <div class="action-buttons">
                        <button class="action-btn btn-edit" title="Edytuj" data-schedule='${JSON.stringify(item).replace(/'/g, "&#39;")}'>
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn btn-delete" title="Usuń" data-id="${item.id}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        ${archAction}
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    formatOccurrenceShort(occ) {
        if (!occ || !occ.startDateTime) return '';
        const dt = occ.startDateTime;
        // e.g. "2026-04-14T11:30:00" → "14.04 11:30"
        const parts = dt.split('T');
        const dateParts = parts[0].split('-');
        const time = parts[1] ? parts[1].substring(0, 5) : '';
        return `${dateParts[2]}.${dateParts[1]} ${time}`;
    }

    renderErrorState() {
        document.getElementById('scheduleTableBody').innerHTML = `<tr><td colspan="10" style="text-align:center;padding:2rem;color:red;">Błąd ładowania danych.</td></tr>`;
    }

    // Modal

    async openModal(data = null) {
        const modal  = document.getElementById('scheduleModal');
        const form   = document.getElementById('scheduleForm');
        form.reset();

        // Reset state
        this.currentTeachers = [];
        document.getElementById('occurrencesList').innerHTML = '';

        if (data) {
            this.isEditing = true; this.currentEditId = data.id;
            document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> Edycja zajęć';
            document.getElementById('title').value          = data.title || '';
            document.getElementById('classType').value      = data.classType || 'WYKLAD';
            document.getElementById('creditType').value     = data.creditType || 'ZALICZENIE';
            document.getElementById('groupNumber').value    = data.groupNumber || '';
            document.getElementById('specialization').value = data.specialization || '';

            // Populate teachers
            this.currentTeachers = [...(data.teachers || [])];
            this.renderTeacherTags();

            // Populate occurrences
            (data.occurrences || []).forEach(occ => this.addOccurrenceRow(occ));

            // Populate groups
            const select = document.getElementById('studentGroups');
            if (data.studentGroups) {
                const ids = data.studentGroups.map(g => g.id.toString());
                Array.from(select.options).forEach(o => o.selected = ids.includes(o.value));
            }
        } else {
            document.getElementById('modalTitle').innerHTML = '<i class="fas fa-plus"></i> Dodaj zajęcia';
            this.renderTeacherTags();
            // Start with one empty occurrence row
            this.addOccurrenceRow();
            
            // Pre-select group for Starosta
            if (this.isStarosta && this.starostaGroupId) {
                const select = document.getElementById('studentGroups');
                Array.from(select.options).forEach(o => o.selected = (parseInt(o.value) === this.starostaGroupId));
            }
        }

        modal.classList.add('active');
    }

    closeModal() {
        document.getElementById('scheduleModal').classList.remove('active');
        this.isEditing = false; this.currentEditId = null;
    }

    // Save

    async saveSchedule(force = false) {
        // Finalize any uncommitted teacher input
        const teacherInput = document.getElementById('teacherInput');
        if (teacherInput?.value?.trim()) this.addTeacher();

        if (this.currentTeachers.length === 0) {
            Utils.showToast('Dodaj co najmniej jednego prowadzącego.', 'error');
            return;
        }

        const occurrences = this.collectOccurrences();
        if (occurrences.length === 0) {
            Utils.showToast('Dodaj co najmniej jeden termin zajęć.', 'error');
            return;
        }

        // WALIDACJA TERMINÓW
        let hasErrors = false;
        occurrences.forEach((occ, idx) => {
            const start = new Date(occ.startDateTime);
            const end = new Date(occ.endDateTime);
            const durationHours = (end - start) / (1000 * 60 * 60);

            if (end <= start) {
                Utils.showToast(`Termin #${idx + 1}: Data zakończenia musi być po dacie rozpoczęcia.`, 'error');
                hasErrors = true;
            } else if (durationHours > 24) { // Slightly higher threshold for blocking save than for preview warning
                Utils.showToast(`Termin #${idx + 1}: Wykryto czas trwania powyżej 24h. Sprawdź daty!`, 'error');
                hasErrors = true;
            }
        });

        if (hasErrors) return;

        const formData = {
            title:          document.getElementById('title').value,
            teachers:       [...this.currentTeachers],
            classType:      document.getElementById('classType').value,
            creditType:     document.getElementById('creditType').value,
            groupNumber:    document.getElementById('groupNumber').value || null,
            specialization: document.getElementById('specialization').value || null,
            studentGroupIds: Array.from(document.getElementById('studentGroups').selectedOptions).map(o => parseInt(o.value)),
            occurrences
        };

        this.lastSavedFormData = formData;
        const url    = this.isEditing ? `${ScheduleManagement.CONFIG.API.SCHEDULE}/${this.currentEditId}` : ScheduleManagement.CONFIG.API.SCHEDULE;
        const method = this.isEditing ? 'PUT' : 'POST';

        try {
            const res = await fetch(`${url}${force ? '?force=true' : ''}`, {
                method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData)
            });

            if (res.status === 409) {
                const info = await res.json();
                this.openCollisionModal(info.message || 'Wykryto kolizję w sali lub planie wykładowcy.');
                return;
            }

            if (!res.ok) {
                const err = await res.json().catch(() => ({ message: `Status: ${res.status}` }));
                throw new Error(err.message || err.detail || 'Błąd zapisu');
            }

            const wasEditing = this.isEditing;
            this.closeModal();
            this.closeCollisionModal();
            await this.loadSchedule();
            Utils.showToast(wasEditing ? 'Zaktualizowano pomyślnie.' : 'Zajęcia zostały dodane.', 'success');
        } catch (error) {
            Utils.showToast(error.message, 'error');
        }
    }

    // Modals (collision / delete)

    openCollisionModal(details) {
        const detailsDiv = document.getElementById('collisionDetails');
        if (detailsDiv) {
            const formatted = details.split(';')
                .filter(d => d.trim().length > 0)
                .map(d => `<span><i class="fas fa-exclamation-circle"></i> ${Utils.escapeHtml(d.trim())}</span>`)
                .join('');
            detailsDiv.innerHTML = formatted;
        }
        document.getElementById('collisionModal')?.classList.add('active');
    }

    closeCollisionModal() { document.getElementById('collisionModal')?.classList.remove('active'); }

    openDeleteConfirmModal(id, msg, type = 'single') {
        document.getElementById('deleteModalText').innerHTML = msg;
        this.pendingDeleteId = id; this.pendingDeleteType = type;
        document.getElementById('deleteConfirmOverlay').classList.add('active');
    }

    async deleteSchedule(id) {
        const row = Array.from(document.querySelectorAll('#scheduleTableBody tr'))
            .find(tr => tr.querySelector('.btn-delete')?.getAttribute('data-id') === id.toString());
        if (row) row.style.display = 'none';

        const toastHtml = `<button class="btn-undo-toast" onclick="scheduleManager.undoDelete('${id}')">Cofnij</button>`;
        const toast = Utils.showToast('Zajęcia zostały usunięte.', 'success', { actionHtml: toastHtml, duration: 0, closable: false });

        const timerId = setTimeout(() => this.executeActualDelete(id, toast, row), 5000);
        this.deletionTimers.set(id.toString(), { timerId, toast, row });
    }

    undoDelete(id) {
        const data = this.deletionTimers.get(id.toString());
        if (!data) return;
        clearTimeout(data.timerId);
        if (data.row) data.row.style.display = '';
        if (data.toast?.parentElement) { data.toast.classList.add('fade-out'); setTimeout(() => data.toast.remove(), 300); }
        Utils.showToast('Cofnięto usunięcie zajęć.', 'info');
        this.deletionTimers.delete(id.toString());
    }

    async executeActualDelete(id, toast, row) {
        this.deletionTimers.delete(id.toString());
        try {
            const res = await fetch(`${ScheduleManagement.CONFIG.API.SCHEDULE}/${id}`, { method: 'DELETE' });
            if (toast?.parentElement) { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 300); }
            if (!res.ok) throw new Error(`Status: ${res.status}`);
            await this.loadSchedule();
        } catch (e) {
            if (row) row.style.display = '';
            Utils.showToast('Nie udało się trwale usunąć zajęć.', 'error');
        }
    }

    async executeBulkDelete(groupId) {
        try {
            const res = await fetch(`${ScheduleManagement.CONFIG.API.SCHEDULE}/group/${groupId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(`Status: ${res.status}`);
            Utils.showToast('Plan dla grupy został wyczyszczony.', 'success');
            await this.loadSchedule();
        } catch (e) { Utils.showToast(e.message, 'error'); }
    }

    clearGroupSchedule() {
        const groupId = document.getElementById('groupFilter').value;
        if (!groupId) return;
        const g = this.allGroups.find(x => x.id.toString() === groupId);
        this.openDeleteConfirmModal(groupId, `Czy na pewno chcesz usunąć <strong>wszystkie zajęcia</strong> dla kierunku <strong>${g?.name || ''}</strong>?`, 'bulk');
    }

    async archiveSchedule(id) {
        try {
            const res = await fetch(`${ScheduleManagement.CONFIG.API.SCHEDULE}/${id}/archive`, { method: 'PUT' });
            if (!res.ok) throw new Error(`Status: ${res.status}`);
            Utils.showToast('Zarchiwizowane.', 'success'); await this.loadSchedule();
        } catch (e) { Utils.showToast(e.message, 'error'); }
    }

    async restoreSchedule(id) {
        try {
            const res = await fetch(`${ScheduleManagement.CONFIG.API.SCHEDULE}/${id}/restore`, { method: 'PUT' });
            if (!res.ok) throw new Error(`Status: ${res.status}`);
            Utils.showToast('Przywrócone.', 'success'); await this.loadSchedule();
        } catch (e) { Utils.showToast(e.message, 'error'); }
    }

    async archiveActiveEntries() {
        const year = window.prompt('Podaj nazwę planu (opcjonalnie):');
        if (year === null) return;
        const q = year.trim() ? `?yearPlan=${encodeURIComponent(year.trim())}` : '';
        try {
            const res = await fetch(`${ScheduleManagement.CONFIG.API.SCHEDULE}/archive${q}`, { method: 'PUT' });
            if (!res.ok) throw new Error(`Status: ${res.status}`);
            const r = await res.json();
            Utils.showToast(`Zarchiwizowano ${r.archivedCount} zajęć.`, 'success'); await this.loadSchedule();
        } catch (e) { Utils.showToast(e.message, 'error'); }
    }

    // Export CSV

    openExportModal() {
        const modal = document.getElementById('exportModal');
        const countEl = document.getElementById('exportCount');
        if (countEl) countEl.textContent = this.filteredData.length;
        modal?.classList.add('active');
    }

    closeExportModal() { document.getElementById('exportModal')?.classList.remove('active'); }

    exportCsv() {
        let csv = 'data:text/csv;charset=utf-8,\uFEFF';
        const head = [];
        if (document.getElementById('exId')?.checked)            head.push('ID');
        if (document.getElementById('exTitle')?.checked)         head.push('Przedmiot');
        if (document.getElementById('exTeacher')?.checked)       head.push('Prowadzący');
        if (document.getElementById('exGroupNumber')?.checked)   head.push('Grupa');
        if (document.getElementById('exSpecialization')?.checked) head.push('Specjalność');
        if (document.getElementById('exType')?.checked)          head.push('Typ');
        if (document.getElementById('exCreditType')?.checked)    head.push('Zaliczenie');
        if (document.getElementById('exOccurrences')?.checked)   head.push('Terminy');
        if (document.getElementById('exGroups')?.checked)        head.push('Kierunki');

        csv += head.join(';') + '\n';

        this.filteredData.forEach(i => {
            const r = [];
            if (document.getElementById('exId')?.checked)            r.push(i.id);
            if (document.getElementById('exTitle')?.checked)         r.push(`"${i.title}"`);
            if (document.getElementById('exTeacher')?.checked)       r.push(`"${(i.teachers || []).join(', ')}"`);
            if (document.getElementById('exGroupNumber')?.checked)   r.push(`"${i.groupNumber || ''}"`);
            if (document.getElementById('exSpecialization')?.checked) r.push(`"${i.specialization || ''}"`);
            if (document.getElementById('exType')?.checked)          r.push(ScheduleManagement.CONFIG.CLASS_TYPES[i.classType] || i.classType);
            if (document.getElementById('exCreditType')?.checked)    r.push(ScheduleManagement.CONFIG.CREDIT_TYPES[i.creditType] || i.creditType);
            
            if (document.getElementById('exOccurrences')?.checked) {
                const occString = (i.occurrences || []).map(o => this.formatOccurrenceShort(o) + (o.room ? ` (s.${o.room})` : '')).join(' | ');
                r.push(`"${occString}"`);
            }

            if (document.getElementById('exGroups')?.checked)        r.push(`"${i.studentGroups?.map(g => g.name).join(', ')}"`);
            
            csv += r.join(';') + '\n';
        });

        const link = document.createElement('a');
        link.href = encodeURI(csv);
        link.download = 'harmonogram.csv';
        link.click();
        this.closeExportModal();
    }

    // PREVIEW SYSTEM

    showPreview() {
        const title = document.getElementById('title').value.trim();
        if (!title) {
            Utils.showToast('Wprowadź nazwę przedmiotu.', 'error');
            return;
        }

        const occurrences = this.collectOccurrences();
        if (occurrences.length === 0) {
            Utils.showToast('Dodaj co najmniej jeden termin zajęć.', 'info');
            return;
        }

        // WALIDACJA TERMINÓW
        let hasErrors = false;
        let hasWarnings = false;

        occurrences.forEach((occ, idx) => {
            const start = new Date(occ.startDateTime);
            const end = new Date(occ.endDateTime);
            const durationMs = end - start;
            const durationHours = durationMs / (1000 * 60 * 60);

            if (end <= start) {
                Utils.showToast(`Termin #${idx + 1}: Data zakończenia musi być po dacie rozpoczęcia.`, 'error');
                hasErrors = true;
            } else if (durationHours > 12) {
                Utils.showToast(`Termin #${idx + 1}: Wykryto bardzo długi czas trwania (${durationHours.toFixed(1)}h). Sprawdź daty!`, 'warning');
                hasWarnings = true;
            }
        });

        if (hasErrors) return;

        // RENDEROWANIE PODGLĄDU
        const body = document.getElementById('previewBody');
        const classType = document.getElementById('classType').value;
        const creditType = document.getElementById('creditType').value;
        const groupNum = document.getElementById('groupNumber').value.trim();
        const spec = document.getElementById('specialization').value.trim();
        
        const selectedGroups = Array.from(document.getElementById('studentGroups').selectedOptions)
            .map(opt => opt.textContent);

        let html = `
            <div class="preview-section">
                <div class="preview-header-main">
                    <div>
                        <h2 class="preview-title-large">${Utils.escapeHtml(title)}</h2>
                        <div style="margin-top: 5px;">
                            <span class="class-type-badge ${classType}">${ScheduleManagement.CONFIG.CLASS_TYPES[classType]}</span>
                            <span class="preview-tag">${ScheduleManagement.CONFIG.CREDIT_TYPES[creditType]}</span>
                        </div>
                    </div>
                </div>

                <div class="preview-grid">
                    <div class="preview-item">
                        <label>Prowadzący</label>
                        <div class="preview-tags">
                            ${this.currentTeachers.map(t => `<span class="preview-tag">${Utils.escapeHtml(t)}</span>`).join('') || '<em>Nie przypisano</em>'}
                        </div>
                    </div>
                    <div class="preview-item">
                        <label>Kierunki / Grupy</label>
                        <div class="preview-tags">
                            ${selectedGroups.map(g => `<span class="preview-tag">${Utils.escapeHtml(g)}</span>`).join('') || '<em>Brak</em>'}
                        </div>
                    </div>
                    <div class="preview-item">
                        <label>Grupa / Specjalność</label>
                        <span>${Utils.escapeHtml(groupNum) || '-'}${spec ? ` (${Utils.escapeHtml(spec)})` : ''}</span>
                    </div>
                </div>
            </div>

            <h4 style="margin-bottom: 1rem;">Zaplanowane terminy (${occurrences.length})</h4>
            <div class="preview-occurrences-list">
                ${occurrences.map((occ, idx) => {
                    const start = new Date(occ.startDateTime);
                    const end = new Date(occ.endDateTime);
                    const durationHours = (end - start) / (1000 * 60 * 60);
                    const isLong = durationHours > 10;

                    return `
                        <div class="preview-occ-card">
                            <div class="preview-occ-info">
                                <div class="preview-occ-time">
                                    <i class="far fa-clock"></i> 
                                    ${this.formatDateTimeRange(occ.startDateTime, occ.endDateTime)}
                                </div>
                                <div class="preview-occ-loc">
                                    <i class="fas fa-map-marker-alt"></i> 
                                    ${Utils.escapeHtml(occ.room || 'Brak sali')} ${occ.buildingCode ? `(${Utils.escapeHtml(occ.buildingCode)})` : ''}
                                    ${occ.location ? ` - ${Utils.escapeHtml(occ.location)}` : ''}
                                </div>
                            </div>
                            <div class="preview-occ-duration ${isLong ? 'warning' : ''}" title="${isLong ? 'Uwaga: Wyjątkowo długi czas trwania' : ''}">
                                ${durationHours.toFixed(1)}h
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        body.innerHTML = html;
        document.getElementById('previewModal').classList.add('active');
    }

    closePreview() {
        document.getElementById('previewModal').classList.remove('active');
    }

    formatDateTimeRange(startStr, endStr) {
        const start = new Date(startStr);
        const end = new Date(endStr);
        
        const dateOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
        const timeOptions = { hour: '2-digit', minute: '2-digit' };
        
        const date = start.toLocaleDateString('pl-PL', dateOptions);
        const startTime = start.toLocaleTimeString('pl-PL', timeOptions);
        const endTime = end.toLocaleTimeString('pl-PL', timeOptions);

        // Check if same day
        const isSameDay = start.toDateString() === end.toDateString();
        
        if (isSameDay) {
            return `<strong>${date}</strong>/ ${startTime} - ${endTime}`;
        } else {
            const endDate = end.toLocaleDateString('pl-PL', dateOptions);
            return `<strong>${date} ${startTime}</strong> do <strong>${endDate} ${endTime}</strong>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.scheduleManager = new ScheduleManagement();
});