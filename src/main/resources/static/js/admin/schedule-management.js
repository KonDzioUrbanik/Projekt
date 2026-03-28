'use strict';

class ScheduleManagement {
    static CONFIG = {
        API: {
            SCHEDULE: '/api/schedule',
            SCHEDULE_ALL: '/api/schedule/all',
            GROUPS: '/api/groups'
        },
        DAY_NAMES: {
            'Monday': 'Poniedziałek', 'Tuesday': 'Wtorek', 'Wednesday': 'Środa',
            'Thursday': 'Czwartek', 'Friday': 'Piątek', 'Saturday': 'Sobota', 'Sunday': 'Niedziela'
        },
        CLASS_TYPES: {
            'WYKLAD': 'Wykład', 'CWICZENIA': 'Ćwiczenia laboratoryjne', 'LABORATORIUM': 'Laboratorium',
            'PROJEKT': 'Projekt', 'SEMINARIUM': 'Seminarium', 'KONSULTACJE': 'Konsultacje'
        },
        WEEK_TYPES: {
            'ALL': 'Każdy', 'WEEK_A': 'Tydzień A', 'WEEK_B': 'Tydzień B', 'CUSTOM': 'Niestandardowy'
        }
    };

    constructor(){
        this.scheduleData = [];
        this.filteredData = [];
        
        this.currentPage = 1;
        this.pageSize = 50;
        this.totalPages = 1;

        this.isEditing = false;
        this.currentEditId = null;
        this.allGroups = [];
        this.pendingForceSave = false;
        this.lastSavedFormData = null;
        this.deletionTimers = new Map();

        this.initializeEventListeners();
        this.loadGroups();
        this.loadSchedule();
    }

    initializeEventListeners(){
        document.getElementById('addScheduleBtn').addEventListener('click', () => this.openModal());
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
        
        document.getElementById('scheduleForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSchedule(false);
        });

        // Filtry
        document.getElementById('dayFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('typeFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('groupFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('teacherFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('showArchivedToggle').addEventListener('change', () => this.applyFilters());
        document.getElementById('weekType').addEventListener('change', () => this.toggleCustomWeeksField());

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
    }

    async loadSchedule(){
        const loading = document.getElementById('loading');
        loading.classList.add('active');
        try {
            const response = await fetch(ScheduleManagement.CONFIG.API.SCHEDULE_ALL);
            if(!response.ok) throw new Error(`Status: ${response.status}`);
            this.scheduleData = await response.json();
            this.populateTeacherFilter();
            this.applyFilters();
        } catch (error) {
            console.error('Błąd:', error);
            this.renderErrorState();
        } finally {
            loading.classList.remove('active');
        }
    }

    async loadGroups(){
        try {
            const res = await fetch(ScheduleManagement.CONFIG.API.GROUPS);
            if(!res.ok) throw new Error(`Status: ${res.status}`);
            this.allGroups = await res.json();
            this.populateGroupsSelect();
            this.populateGroupFilter();
        } catch (error) { console.error('Błąd grup:', error); }
    }

    populateGroupsSelect(){
        const select = document.getElementById('studentGroups');
        if (!select) return;
        select.innerHTML = '';
        [...this.allGroups].sort((a,b) => a.name.localeCompare(b.name, 'pl')).forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.name;
            select.appendChild(opt);
        });
    }

    populateGroupFilter(){
        const filter = document.getElementById('groupFilter');
        if (!filter) return;
        filter.innerHTML = '<option value="">Wszystkie kierunki</option>';
        [...this.allGroups].sort((a,b) => a.name.localeCompare(b.name, 'pl')).forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.name;
            filter.appendChild(opt);
        });
    }

    populateTeacherFilter(){
        const filter = document.getElementById('teacherFilter');
        if (!filter) return;
        filter.innerHTML = '<option value="">Wszyscy wykładowcy</option>';
        const teachers = [...new Set(this.scheduleData.map(i => i.teacher).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'pl'));
        teachers.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t; opt.textContent = t; filter.appendChild(opt);
        });
    }

    applyFilters(){
        const day = document.getElementById('dayFilter').value;
        const type = document.getElementById('typeFilter').value;
        const group = document.getElementById('groupFilter').value;
        const teacher = document.getElementById('teacherFilter').value;
        const q = document.getElementById('searchInput').value.toLowerCase().trim();
        const arch = document.getElementById('showArchivedToggle').checked;

        this.filteredData = this.scheduleData.filter(item => {
            if (day && item.dayOfWeek !== day) return false;
            if (type && item.classType !== type) return false;
            if (teacher && item.teacher !== teacher) return false;
            if (group && (!item.studentGroups || !item.studentGroups.some(g => g.id.toString() === group))) return false;
            if (q) {
                const text = `${item.title} ${item.room} ${item.teacher} ${item.studentGroups?.map(g => g.name).join(' ')}`.toLowerCase();
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

    resetFilters(){
        document.getElementById('dayFilter').value = '';
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
        const data = this.pageSize === 'all' ? this.filteredData : this.filteredData.slice((this.currentPage - 1) * this.pageSize, this.currentPage * this.pageSize);
        this.renderTable(data);
    }

    changePage(p) { if(p >= 1 && p <= this.totalPages) { this.currentPage = p; this.updatePaginationUI(); } }
    handlePageSizeChange(e) { this.pageSize = e.target.value === 'all' ? 'all' : parseInt(e.target.value); this.currentPage = 1; this.updatePaginationUI(); }

    renderTable(data){
        const body = document.getElementById('scheduleTableBody');
        if(data.length === 0){
            body.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:2rem;">Brak wyników.</td></tr>`;
            return;
        }

        body.innerHTML = data.map(item => {
            const day = ScheduleManagement.CONFIG.DAY_NAMES[item.dayOfWeek] || item.dayOfWeek;
            const type = ScheduleManagement.CONFIG.CLASS_TYPES[item.classType] || item.classType;
            const weeks = this.formatWeekTypeLabel(item);
            const groups = item.studentGroups?.map(g => Utils.escapeHtml(g.name)).join(', ') || '-';
            const groupNum = Utils.escapeHtml(item.groupNumber || '-');
            const spec = Utils.escapeHtml(item.specialization || '-');
            const archBadge = item.archived ? '<span class="week-badge" style="background:#4b5563;margin-left:6px;">Archiwum</span>' : '';
            const archAction = item.archived
                ? `<button class="action-btn btn-restore" title="Przywróć" data-id="${item.id}"><i class="fas fa-box-open"></i></button>`
                : `<button class="action-btn btn-archive" title="Archiwizuj" data-id="${item.id}"><i class="fas fa-archive"></i></button>`;

            return `
            <tr>
                <td>${item.id}</td>
                <td><strong>${Utils.escapeHtml(item.title)}</strong></td>
                <td>${groupNum}</td>
                <td>${spec}</td>
                <td><span class="day-badge">${day}</span></td>
                <td>${this.formatTime(item.startTime)} - ${this.formatTime(item.endTime)}</td>
                <td>${Utils.escapeHtml(item.room)}</td>
                <td>${Utils.escapeHtml(item.teacher)}</td>
                <td><span class="class-type-badge ${item.classType}">${type}</span></td>
                <td><span class="week-badge">${weeks}</span>${archBadge}</td>
                <td>${groups}</td>
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

    renderErrorState() {
        document.getElementById('scheduleTableBody').innerHTML = `<tr><td colspan="10" style="text-align:center;padding:2rem;color:red;">Błąd ładowania danych.</td></tr>`;
    }

    async openModal(data = null){
        const modal = document.getElementById('scheduleModal');
        const form = document.getElementById('scheduleForm');
        form.reset();
        
        if (!Utils.AcademicConfig) {
            await Utils.initAcademicConfig();
        }
        if(data){
            this.isEditing = true; this.currentEditId = data.id;
            document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> Edycja zajęć';
            document.getElementById('title').value = data.title;
            document.getElementById('room').value = data.room;
            document.getElementById('teacher').value = data.teacher;
            document.getElementById('groupNumber').value = data.groupNumber || '';
            document.getElementById('specialization').value = data.specialization || '';
            document.getElementById('classType').value = data.classType;
            document.getElementById('weekType').value = data.weekType || 'ALL';
            
            // Checkboxy tygodni
            this.generateCustomWeeksCheckboxes();
            const customWeeksArr = (data.customWeeks || '').split(',').map(s=>s.trim());
            document.querySelectorAll('input[name="customWeek"]').forEach(cb => {
                cb.checked = customWeeksArr.includes(cb.value);
            });
            document.getElementById('dayOfWeek').value = data.dayOfWeek;
            document.getElementById('startTime').value = this.formatTimeForInput(data.startTime);
            document.getElementById('endTime').value = this.formatTimeForInput(data.endTime);
            const select = document.getElementById('studentGroups');
            if(data.studentGroups){
                const ids = data.studentGroups.map(g => g.id.toString());
                Array.from(select.options).forEach(o => o.selected = ids.includes(o.value));
            }
        } else {
            this.isEditing = false; this.currentEditId = null;
            document.getElementById('modalTitle').innerHTML = '<i class="fas fa-plus"></i> Dodaj zajęcia';
            this.generateCustomWeeksCheckboxes();
            document.querySelectorAll('input[name="customWeek"]').forEach(cb => cb.checked = false);
        }
        this.toggleCustomWeeksField();
        modal.classList.add('active');
    }

    closeModal(){
        document.getElementById('scheduleModal').classList.remove('active');
        this.isEditing = false; this.currentEditId = null;
    }

    async saveSchedule(force = false){
        const weekType = document.getElementById('weekType').value;
        
        let normCustom = null;
        if (weekType === 'CUSTOM') {
             const customCheckboxes = document.querySelectorAll('input[name="customWeek"]:checked');
             normCustom = Array.from(customCheckboxes).map(cb => cb.value).join(',');
             if (!normCustom) { 
                 Utils.showToast('Zaznacz przynajmniej jeden tydzień niestandardowy.', 'error'); 
                 return; 
             }
        }

        const formData = {
            title: document.getElementById('title').value,
            room: document.getElementById('room').value,
            teacher: document.getElementById('teacher').value,
            groupNumber: document.getElementById('groupNumber').value || null,
            specialization: document.getElementById('specialization').value || null,
            classType: document.getElementById('classType').value,
            weekType,
            customWeeks: normCustom,
            dayOfWeek: document.getElementById('dayOfWeek').value,
            startTime: document.getElementById('startTime').value + ':00',
            endTime: document.getElementById('endTime').value + ':00',
            studentGroupIds: Array.from(document.getElementById('studentGroups').selectedOptions).map(o => parseInt(o.value))
        };

        if (formData.startTime >= formData.endTime) {
            Utils.showToast('Godzina zakończenia musi być późniejsza niż godzina rozpoczęcia.', 'error');
            return;
        }

        this.lastSavedFormData = formData;
        const url = this.isEditing ? `${ScheduleManagement.CONFIG.API.SCHEDULE}/${this.currentEditId}` : ScheduleManagement.CONFIG.API.SCHEDULE;
        const method = this.isEditing ? 'PUT' : 'POST';

        try {
            const res = await fetch(`${url}${force ? '?force=true' : ''}`, {
                method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(formData)
            });

            if (res.status === 409) {
                const info = await res.json();
                this.openCollisionModal(info.message || 'Wykryto kolizję w sali lub planie wykładowcy.');
                return;
            }

            if(!res.ok) {
                const err = await res.json().catch(() => ({message: `Status: ${res.status}`}));
                throw new Error(err.message || err.detail || 'Błąd zapisu');
            }

            const wasEditing = this.isEditing;
            this.closeModal();
            this.closeCollisionModal();
            this.loadSchedule();
            Utils.showToast(wasEditing ? 'Zaktualizowano pomyślnie.' : 'Zajęcia zostały dodane.', 'success');
        } catch (error) {
            Utils.showToast(error.message, 'error');
        }
    }

    openCollisionModal(details) {
        const detailsDiv = document.getElementById('collisionDetails');
        if (detailsDiv) {
            // Rozdziel ostrzeżenia średnikiem, a potem każde z nich sformatuj
            const formatted = details.split(';')
                .filter(d => d.trim().length > 0)
                .map(d => {
                    const escaped = Utils.escapeHtml(d.trim()).replace(/\n/g, '<br>');
                    return `<span><i class="fas fa-exclamation-circle"></i> ${escaped}</span>`;
                })
                .join('');
            detailsDiv.innerHTML = formatted;
        }
        document.getElementById('collisionModal')?.classList.add('active');
    }

    closeCollisionModal() {
        document.getElementById('collisionModal')?.classList.remove('active');
    }

    openDeleteConfirmModal(id, msg, type = 'single') {
        const overlay = document.getElementById('deleteConfirmOverlay');
        document.getElementById('deleteModalText').innerHTML = msg;
        this.pendingDeleteId = id; this.pendingDeleteType = type;
        overlay.classList.add('active');
    }

    async deleteSchedule(id) {
        const row = Array.from(document.querySelectorAll('#scheduleTableBody tr'))
            .find(tr => tr.querySelector('.btn-delete')?.getAttribute('data-id') === id.toString());

        if (row) row.style.display = 'none';

        const toastHtml = `<button class="btn-undo-toast" onclick="scheduleManager.undoDelete('${id}')">Cofnij</button>`;
        const toast = Utils.showToast('Zajęcia zostały usunięte.', 'success', { 
            actionHtml: toastHtml, 
            duration: 0, 
            closable: false 
        });

        const timerId = setTimeout(() => {
            this.executeActualDelete(id, toast, row);
        }, 5000);

        this.deletionTimers.set(id.toString(), { timerId, toast, row });
    }

    undoDelete(id) {
        const data = this.deletionTimers.get(id.toString());
        if (!data) return;

        clearTimeout(data.timerId);
        if (data.row) data.row.style.display = '';

        if (data.toast && data.toast.parentElement) {
            data.toast.classList.add('fade-out');
            setTimeout(() => data.toast.remove(), 300);
        }

        Utils.showToast('Cofnięto usunięcie zajęć.', 'info');
        this.deletionTimers.delete(id.toString());
    }

    async executeActualDelete(id, toast, row) {
        this.deletionTimers.delete(id.toString());
        try {
            const res = await fetch(`${ScheduleManagement.CONFIG.API.SCHEDULE}/${id}`, { method: 'DELETE' });
            if (toast && toast.parentElement) {
                toast.classList.add('fade-out');
                setTimeout(() => toast.remove(), 300);
            }
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
            if(!res.ok) throw new Error(`Status: ${res.status}`);
            Utils.showToast('Plan dla grupy został wyczyszczony.', 'success');
            await this.loadSchedule();
        } catch (e) { Utils.showToast(e.message, 'error'); }
    }

    async archiveSchedule(id) {
        try {
            const res = await fetch(`${ScheduleManagement.CONFIG.API.SCHEDULE}/${id}/archive`, { method: 'PUT' });
            if(!res.ok) throw new Error(`Status: ${res.status}`);
            Utils.showToast('Zarchiwizowane.', 'success'); await this.loadSchedule();
        } catch (e) { Utils.showToast(e.message, 'error'); }
    }

    async restoreSchedule(id) {
        try {
            const res = await fetch(`${ScheduleManagement.CONFIG.API.SCHEDULE}/${id}/restore`, { method: 'PUT' });
            if(!res.ok) throw new Error(`Status: ${res.status}`);
            Utils.showToast('Przywrócone.', 'success'); await this.loadSchedule();
        } catch (e) { Utils.showToast(e.message, 'error'); }
    }

    async archiveActiveEntries() {
        const year = window.prompt('Podaj nazwę planu (opcjonalnie):');
        if (year === null) return;
        const q = year.trim() ? `?yearPlan=${encodeURIComponent(year.trim())}` : '';
        try {
            const res = await fetch(`${ScheduleManagement.CONFIG.API.SCHEDULE}/archive${q}`, { method: 'PUT' });
            if(!res.ok) throw new Error(`Status: ${res.status}`);
            const r = await res.json();
            Utils.showToast(`Zarchiwizowano ${r.archivedCount} zajęć.`, 'success'); await this.loadSchedule();
        } catch (e) { Utils.showToast(e.message, 'error'); }
    }

    exportCsv() {
        const cols = { id: 'exId', title: 'exTitle', day: 'exDay', time: 'exTime', room: 'exRoom', teacher: 'exTeacher', type: 'exType', week: 'exWeek', groups: 'exGroups' };
        let csv = "data:text/csv;charset=utf-8,\uFEFF";
        let head = [];
        if(document.getElementById(cols.id).checked) head.push("ID");
        if(document.getElementById(cols.title).checked) head.push("Przedmiot");
        if(document.getElementById(cols.day).checked) head.push("Dzień");
        if(document.getElementById(cols.time).checked) head.push("Godziny");
        if(document.getElementById(cols.room).checked) head.push("Sala");
        if(document.getElementById(cols.teacher).checked) head.push("Prowadzący");
        if(document.getElementById(cols.type).checked) head.push("Typ");
        if(document.getElementById(cols.week).checked) head.push("Tydzień");
        if(document.getElementById(cols.groups).checked) head.push("Kierunki");
        csv += head.join(";") + "\n";
        this.filteredData.forEach(i => {
            let r = [];
            if(document.getElementById(cols.id).checked) r.push(i.id);
            if(document.getElementById(cols.title).checked) r.push(`"${i.title}"`);
            if(document.getElementById(cols.day).checked) r.push(ScheduleManagement.CONFIG.DAY_NAMES[i.dayOfWeek] || i.dayOfWeek);
            if(document.getElementById(cols.time).checked) r.push(`${this.formatTime(i.startTime)} - ${this.formatTime(i.endTime)}`);
            if(document.getElementById(cols.room).checked) r.push(`"${i.room}"`);
            if(document.getElementById(cols.teacher).checked) r.push(`"${i.teacher}"`);
            if(document.getElementById(cols.type).checked) r.push(ScheduleManagement.CONFIG.CLASS_TYPES[i.classType] || i.classType);
            if(document.getElementById(cols.week).checked) r.push(ScheduleManagement.CONFIG.WEEK_TYPES[i.weekType] || i.weekType);
            if(document.getElementById(cols.groups).checked) r.push(`"${i.studentGroups?.map(g=>g.name).join(', ')}"`);
            csv += r.join(";") + "\n";
        });
        const link = document.createElement("a"); link.href = encodeURI(csv); link.download = "harmonogram.csv"; link.click();
        this.closeExportModal();
    }

    formatTime(t){
        if(!t) return '';
        if(typeof t === 'string') return t.substring(0, 5);
        if(t.hour !== undefined) return `${String(t.hour).padStart(2,'0')}:${String(t.minute).padStart(2,'0')}`;
        return '';
    }
    formatTimeForInput(t){ return this.formatTime(t); }

    toggleCustomWeeksField() {
        const row = document.getElementById('customWeeksRow');
        if (row) {
            const isCustom = document.getElementById('weekType').value === 'CUSTOM';
            row.style.display = isCustom ? '' : 'none';
        }
    }

    generateCustomWeeksCheckboxes() {
        const container = document.getElementById('customWeeksContainer');
        if (!container || !Utils.AcademicConfig || container.children.length > 0) return;
        
        const winterStart = new Date(Utils.AcademicConfig.winterSemesterStart).getTime();
        const summerStart = new Date(Utils.AcademicConfig.summerSemesterStart).getTime();
        const summerEnd = new Date(Utils.AcademicConfig.summerSemesterEnd).getTime();
        
        const msPerWeek = 7 * 24 * 60 * 60 * 1000;
        const winterWeeks = Math.ceil((summerStart - winterStart) / msPerWeek);
        const summerWeeks = Math.ceil((summerEnd - summerStart) / msPerWeek);
        const maxWeeks = Math.max(winterWeeks, summerWeeks);
        
        let html = '';
        for(let i=1; i<=maxWeeks; i++) {
            html += `
                <label class="week-checkbox">
                    <input type="checkbox" name="customWeek" value="${i}">
                    <span>Tydz. ${i}</span>
                </label>
            `;
        }
        container.innerHTML = html;
    }

    formatWeekTypeLabel(i) {
        if (i.weekType === 'CUSTOM') return `Niestandardowy (${i.customWeeks || ''})`;
        return ScheduleManagement.CONFIG.WEEK_TYPES[i.weekType] || i.weekType || 'Każdy';
    }
}

document.addEventListener('DOMContentLoaded', () => { 
    window.scheduleManager = new ScheduleManagement(); 
});

const style = document.createElement('style');
style.textContent = `
    .collision-details { 
        background: #fffaf0; 
        color: #9c4221; 
        padding: 1.25rem; 
        border-radius: 8px; 
        margin-bottom: 1rem; 
        font-size: 0.95rem; 
        text-align: left; 
        max-height: 250px; 
        overflow-y: auto;
        border: 1px solid #feebc8;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .collision-details span {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        line-height: 1.4;
    }
    .collision-details i {
        margin-top: 3px;
        color: #dd6b20;
    }
    [data-theme="dark"] .collision-details {
        background: rgba(221, 107, 32, 0.1);
        color: #fbd38d;
        border-color: rgba(221, 107, 32, 0.3);
    }

    .btn-undo-toast {
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: #fff;
        padding: 4px 12px;
        border-radius: 6px;
        font-size: 0.8rem;
        cursor: pointer;
        margin-left: 12px;
        transition: all 0.2s ease;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: inline-flex;
        align-items: center;
        backdrop-filter: blur(4px);
    }

    .btn-undo-toast:hover {
        background: rgba(255, 255, 255, 0.35);
        border-color: rgba(255, 255, 255, 0.5);
        transform: translateY(-1px);
    }

    [data-theme="light"] .toast.success .btn-undo-toast {
        background: rgba(6, 95, 70, 0.1);
        color: #065f46;
        border-color: rgba(6, 95, 70, 0.2);
    }

    [data-theme="light"] .toast.success .btn-undo-toast:hover {
        background: rgba(6, 95, 70, 0.2);
        border-color: rgba(6, 95, 70, 0.3);
    }
`;
document.head.appendChild(style);
