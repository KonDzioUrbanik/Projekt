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
        }
    };

    constructor(){
        this.scheduleData = [];
        this.filteredData = [];
        
        // Paginacja
        this.currentPage = 1;
        this.pageSize = 50;
        this.totalPages = 1;

        this.isEditing = false;
        this.currentEditId = null;
        this.allGroups = [];

        this.initializeEventListeners();
        this.loadGroups();
        this.loadSchedule();
    }

    initializeEventListeners(){
        // Modale i formularze
        document.getElementById('addScheduleBtn').addEventListener('click', () => this.openModal());
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
        
        document.getElementById('scheduleModal').addEventListener('click', (e) => {
            if(e.target.id === 'scheduleModal') { /* opcjonalnie zamknij */ }
        });

        document.getElementById('scheduleForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSchedule();
        });

        // Filtry
        document.getElementById('dayFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('typeFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('searchInput').addEventListener('input', () => this.applyFilters());
        document.getElementById('resetFilters').addEventListener('click', () => this.resetFilters());

        // Paginacja
        document.getElementById('prevPageTop').addEventListener('click', () => this.changePage(this.currentPage - 1));
        document.getElementById('nextPageTop').addEventListener('click', () => this.changePage(this.currentPage + 1));
        document.getElementById('pageSizeTop').addEventListener('change', (e) => this.handlePageSizeChange(e));

        // Eksport CSV
        const openExportBtn = document.getElementById('openExportModalBtn');
        if (openExportBtn) {
            openExportBtn.addEventListener('click', () => this.openExportModal());
        }
        
        const closeExportBtn = document.getElementById('closeExportModalBtn');
        if (closeExportBtn) {
            closeExportBtn.addEventListener('click', () => this.closeExportModal());
        }

        const cancelExportBtn = document.getElementById('cancelExportBtn');
        if (cancelExportBtn) {
            cancelExportBtn.addEventListener('click', () => this.closeExportModal());
        }
        
        const performExportBtn = document.getElementById('performExportBtn');
        if (performExportBtn) {
            performExportBtn.addEventListener('click', () => this.exportCsv());
        }
        
        // Zaznaczanie kolumn w eksporcie
        const selectAllBtn = document.getElementById('selectAllCols');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                document.querySelectorAll('.export-columns input[type="checkbox"]').forEach(ch => ch.checked = true);
            });
        }
        const deselectAllBtn = document.getElementById('deselectAllCols');
        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => {
                document.querySelectorAll('.export-columns input[type="checkbox"]').forEach(ch => ch.checked = false);
            });
        }

        // Obsługa akcji w tabeli (Delegacja zdarzeń)
        const tableBody = document.getElementById('scheduleTableBody');
        if (tableBody) {
            tableBody.addEventListener('click', (e) => {
                // Obsługa przycisku edycji (także kliknięcie w ikonę)
                const editBtn = e.target.closest('.btn-edit');
                if (editBtn) {
                    const scheduleData = JSON.parse(editBtn.getAttribute('data-schedule'));
                    this.openModal(scheduleData);
                    return;
                }

                // Obsługa przycisku usuwania
                const deleteBtn = e.target.closest('.btn-delete');
                if (deleteBtn) {
                    const id = deleteBtn.getAttribute('data-id');
                    if(confirm('Czy na pewno chcesz usunąć te zajęcia?')) {
                        this.deleteSchedule(id);
                    }
                    return;
                }
            });
        }
    }

    // Ładowanie danych
    async loadSchedule(){
        const loading = document.getElementById('loading');
        loading.classList.add('active');

        try {
            const response = await fetch(ScheduleManagement.CONFIG.API.SCHEDULE_ALL);
            if(!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            this.scheduleData = await response.json();
            this.applyFilters(); // To wywoła renderTable (przez updatePaginationUI)
        } catch (error) {
            console.error('Błąd ładowania:', error);
            this.renderErrorState();
        } finally {
            loading.classList.remove('active');
        }
    }

    async loadGroups(){
        try {
            const response = await fetch(ScheduleManagement.CONFIG.API.GROUPS);
            if(!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            this.allGroups = await response.json();
            this.populateGroupsSelect();
        } catch (error) {
            console.error('Błąd ładowania kierunków:', error);
        }
    }

    populateGroupsSelect(){
        const groupsSelect = document.getElementById('studentGroups');
        groupsSelect.innerHTML = '';
        const sortedGroups = [...this.allGroups].sort((a, b) => a.name.localeCompare(b.name, 'pl'));
        
        sortedGroups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            groupsSelect.appendChild(option);
        });
    }

    // Filtrowanie i Paginacja
    applyFilters(){
        const dayFilter = document.getElementById('dayFilter').value;
        const typeFilter = document.getElementById('typeFilter').value;
        const searchText = document.getElementById('searchInput').value.toLowerCase().trim();

        this.filteredData = this.scheduleData.filter(item => {
            const dayMatch = !dayFilter || item.dayOfWeek === dayFilter;
            const typeMatch = !typeFilter || item.classType === typeFilter;
            const itemGroups = item.studentGroups ? item.studentGroups.map(g => g.name).join(' ').toLowerCase() : '';
            
            let searchMatch = true;
            if (searchText) {
                const title = (item.title || '').toLowerCase();
                const room = (item.room || '').toLowerCase();
                const teacher = (item.teacher || '').toLowerCase();
                
                searchMatch = title.includes(searchText) || 
                              room.includes(searchText) || 
                              teacher.includes(searchText) ||
                              itemGroups.includes(searchText);
            }

            return dayMatch && typeMatch && searchMatch;
        });

        this.updateResultsCounter();
        this.currentPage = 1; // Reset do pierwszej strony po filtracji
        this.updatePaginationUI();
    }

    resetFilters(){
        document.getElementById('dayFilter').value = '';
        document.getElementById('typeFilter').value = '';
        document.getElementById('searchInput').value = '';
        this.applyFilters();
    }
    
    updateResultsCounter() {
        const countSpan = document.getElementById('resultsCount');
        const textSpan = document.getElementById('resultsText');
        
        if (countSpan) countSpan.textContent = this.filteredData.length;
        
        if (textSpan) {
            const count = this.filteredData.length;
            if (count === 1) textSpan.textContent = "zajęcia";
            else if (count >= 2 && count <= 4) textSpan.textContent = "zajęcia";
            else textSpan.textContent = "zajęć";
        }
    }

    updatePaginationUI() {
        const totalItems = this.filteredData.length;
        
        if (this.pageSize === 'all') {
            this.totalPages = 1;
        } else {
            this.totalPages = Math.ceil(totalItems / this.pageSize);
            if (this.totalPages < 1) this.totalPages = 1;
        }

        // Aktualizacja labeli
        document.getElementById('currentPageTop').textContent = this.currentPage;
        document.getElementById('totalPagesTop').textContent = this.totalPages;

        // Stan przycisków
        document.getElementById('prevPageTop').disabled = (this.currentPage <= 1);
        document.getElementById('nextPageTop').disabled = (this.currentPage >= this.totalPages);

        this.renderFilteredPage();
    }

    renderFilteredPage() {
        let itemsToRender = [];

        if (this.pageSize === 'all') {
            itemsToRender = this.filteredData;
        } else {
            const startIndex = (this.currentPage - 1) * this.pageSize;
            const endIndex = startIndex + parseInt(this.pageSize);
            itemsToRender = this.filteredData.slice(startIndex, endIndex);
        }

        this.renderTable(itemsToRender);
    }

    changePage(newPage) {
        if (newPage >= 1 && newPage <= this.totalPages) {
            this.currentPage = newPage;
            this.updatePaginationUI();
        }
    }

    handlePageSizeChange(e) {
        this.pageSize = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
        this.currentPage = 1;
        this.updatePaginationUI();
    }

    renderTable(data){
        const tableBody = document.getElementById('scheduleTableBody');

        if(data.length === 0){
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 2rem;">
                        <div class="empty-state">
                            <h3>Brak zajęć</h3>
                            <p>Nie znaleziono żadnych zajęć spełniających kryteria.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = data.map(item => `
            <tr>
                <td>${item.id}</td>
                <td><strong>${item.title}</strong></td>
                <td><span class="day-badge">${ScheduleManagement.CONFIG.DAY_NAMES[item.dayOfWeek]}</span></td>
                <td>${this.formatTime(item.startTime)} - ${this.formatTime(item.endTime)}</td>
                <td>${item.room}</td>
                <td>${item.teacher}</td>
                <td><span class="class-type-badge ${item.classType}">${ScheduleManagement.CONFIG.CLASS_TYPES[item.classType]}</span></td>
                <td>${item.studentGroups && item.studentGroups.length > 0 
                    ? item.studentGroups.map(g => g.name).join(', ') 
                    : '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn btn-edit" title="Edytuj" data-schedule='${JSON.stringify(item).replace(/'/g, "&#39;")}'>
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn btn-delete" title="Usuń" data-id="${item.id}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    renderErrorState() {
        const tableBody = document.getElementById('scheduleTableBody');
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 2rem;">
                    <div style="color: #ef4444;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 2rem;"></i>
                        <p style="margin-top: 1rem;">Nie udało się załadować danych. Sprawdź połączenie.</p>
                    </div>
                </td>
            </tr>
        `;
    }

    // CRUD
    openModal(data = null){
        const modal = document.getElementById('scheduleModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('scheduleForm');

        form.reset();

        if(data){
            this.isEditing = true;
            this.currentEditId = data.id;
            modalTitle.innerHTML = 'Edycja zajęć';

            document.getElementById('scheduleId').value = data.id;
            document.getElementById('title').value = data.title;
            document.getElementById('room').value = data.room;
            document.getElementById('teacher').value = data.teacher;
            document.getElementById('classType').value = data.classType;
            document.getElementById('dayOfWeek').value = data.dayOfWeek;
            document.getElementById('startTime').value = this.formatTimeForInput(data.startTime);
            document.getElementById('endTime').value = this.formatTimeForInput(data.endTime);
            
            const groupsSelect = document.getElementById('studentGroups');
            if(data.studentGroups && data.studentGroups.length > 0){
                const groupIds = data.studentGroups.map(g => g.id.toString());
                Array.from(groupsSelect.options).forEach(option => {
                    option.selected = groupIds.includes(option.value);
                });
            }
        } else {
            this.isEditing = false;
            this.currentEditId = null;
            modalTitle.innerHTML = 'Dodaj zajęcia';
        }
        modal.classList.add('active');
    }

    closeModal(){
        document.getElementById('scheduleModal').classList.remove('active');
        this.isEditing = false;
        this.currentEditId = null;
    }

    async saveSchedule(){
        const groupsSelect = document.getElementById('studentGroups');
        const selectedGroupIds = Array.from(groupsSelect.selectedOptions).map(opt => parseInt(opt.value));
        
        const formData = {
            title: document.getElementById('title').value,
            room: document.getElementById('room').value,
            teacher: document.getElementById('teacher').value,
            classType: document.getElementById('classType').value,
            dayOfWeek: document.getElementById('dayOfWeek').value,
            startTime: document.getElementById('startTime').value + ':00',
            endTime: document.getElementById('endTime').value + ':00',
            studentGroupIds: selectedGroupIds
        };

        try {
            let response;
            if(this.isEditing){
                response = await fetch(`${ScheduleManagement.CONFIG.API.SCHEDULE}/${this.currentEditId}`, {
                    method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(formData)
                });
            } else {
                response = await fetch(ScheduleManagement.CONFIG.API.SCHEDULE, {
                    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(formData)
                });
            }

            if(!response.ok) throw new Error(`Status: ${response.status}`);

            const wasEditing = this.isEditing;
            this.closeModal();
            this.loadSchedule(); // Przeładuje dane i zaaplikuje filtry/paginację
            this.showNotification(wasEditing ? 'Zajęcia zaktualizowane' : 'Zajęcia dodane', 'success');
        } catch (error) {
            console.error('Błąd zapisu:', error);
            this.showNotification('Wystąpił błąd podczas zapisywania.', 'error');
        }
    }

    async editSchedule(id){
        const item = this.scheduleData.find(s => s.id === id);
        if(item) this.openModal(item);
    }

    async deleteSchedule(id){
        if(!confirm('Czy usunąć te zajęcia?')) return;

        try {
            const response = await fetch(`${ScheduleManagement.CONFIG.API.SCHEDULE}/${id}`, { method: 'DELETE' });
            if(!response.ok) throw new Error(`Status: ${response.status}`);
            this.loadSchedule();
            this.showNotification('Usunięto pomyślnie.', 'success');
        } catch (error) {
            console.error('Błąd usuwania:', error);
            this.showNotification('Błąd usuwania: ' + error.message, 'error');
        }
    }

    // Eksport CSV
    openExportModal() {
        document.getElementById('exportCount').textContent = this.filteredData.length;
        document.getElementById('exportModal').classList.add('active');
    }

    closeExportModal() {
        document.getElementById('exportModal').classList.remove('active');
    }

    exportCsv() {
        const includeId = document.getElementById('exId').checked;
        const includeTitle = document.getElementById('exTitle').checked;
        const includeDay = document.getElementById('exDay').checked;
        const includeTime = document.getElementById('exTime').checked;
        const includeRoom = document.getElementById('exRoom').checked;
        const includeTeacher = document.getElementById('exTeacher').checked;
        const includeType = document.getElementById('exType').checked;
        const includeGroups = document.getElementById('exGroups').checked;

        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // BOM
        
        let headers = [];
        if (includeId) headers.push("ID");
        if (includeTitle) headers.push("Przedmiot");
        if (includeDay) headers.push("Dzień");
        if (includeTime) headers.push("Godziny");
        if (includeRoom) headers.push("Sala");
        if (includeTeacher) headers.push("Prowadzący");
        if (includeType) headers.push("Typ");
        if (includeGroups) headers.push("Kierunki");
        
        csvContent += headers.join(";") + "\n";

        this.filteredData.forEach(item => {
            let row = [];
            if (includeId) row.push(item.id);
            if (includeTitle) row.push(`"${item.title.replace(/"/g, '""')}"`);
            if (includeDay) row.push(ScheduleManagement.CONFIG.DAY_NAMES[item.dayOfWeek] || item.dayOfWeek);
            if (includeTime) row.push(`${this.formatTime(item.startTime)} - ${this.formatTime(item.endTime)}`);
            if (includeRoom) row.push(`"${item.room}"`);
            if (includeTeacher) row.push(`"${item.teacher}"`);
            if (includeType) row.push(ScheduleManagement.CONFIG.CLASS_TYPES[item.classType] || item.classType);
            if (includeGroups) {
                const groups = item.studentGroups ? item.studentGroups.map(g => g.name).join(', ') : '';
                row.push(`"${groups}"`);
            }
            csvContent += row.join(";") + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "harmonogram_zajec.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.closeExportModal();
    }

    // Helpery
    formatTime(timeObj){
        if(!timeObj) return '';
        if(typeof timeObj === 'string') { const parts = timeObj.split(':'); return `${parts[0]}:${parts[1]}`; }
        if(typeof timeObj === 'object' && timeObj.hour !== undefined) {
             const h = String(timeObj.hour).padStart(2, '0');
             const m = String(timeObj.minute).padStart(2, '0');
             return `${h}:${m}`;
        }
        return '';
    }

    formatTimeForInput(timeObj){ return this.formatTime(timeObj); }

    showNotification(message, type = 'info'){
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; padding: 1rem 1.5rem;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10000; animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// gloalna instancja
let scheduleManagement;

// inicjalizacja po zaladowaniu strony
document.addEventListener('DOMContentLoaded', () => {
    scheduleManagement = new ScheduleManagement();
});

// style dla animacji
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn{
        from{
            transform: translateX(400px);
            opacity: 0;
        }
        to{
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut{
        from{
            transform: translateX(0);
            opacity: 1;
        }
        to{
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
