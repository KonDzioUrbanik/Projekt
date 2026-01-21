class ScheduleManagement{
    static CONFIG = {
        API: {
            SCHEDULE: '/api/schedule',
            SCHEDULE_ALL: '/api/schedule/all',
            GROUPS: '/api/groups'
        },
        DAY_NAMES: {
            'Monday': 'Poniedziałek',
            'Tuesday': 'Wtorek',
            'Wednesday': 'Środa',
            'Thursday': 'Czwartek',
            'Friday': 'Piątek',
            'Saturday': 'Sobota',
            'Sunday': 'Niedziela'
        },
        CLASS_TYPES: {
            'WYKLAD': 'Wykład',
            'CWICZENIA': 'Ćwiczenia laboratoryjne',
            'LABORATORIUM': 'Laboratorium',
            'PROJEKT': 'Projekt zespołowy',
            'SEMINARIUM': 'Seminarium',
            'KONSULTACJE': 'Konsultacje'
        }
    };

    constructor(){
        this.scheduleData = [];
        this.filteredData = [];
        this.isEditing = false;
        this.currentEditId = null;
        this.allGroups = []; // przechowywanie wszystkich kierunków

        this.initializeEventListeners();
        this.loadGroups();
        this.loadSchedule();
    }

    initializeEventListeners(){
        // przycisk dodawania
        document.getElementById('addScheduleBtn').addEventListener('click', () => {
            this.openModal();
        });

        // zamkniecie modala
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.closeModal();
        });

        // klikniecie poza modalem
        document.getElementById('scheduleModal').addEventListener('click', (e) => {
            if(e.target.id === 'scheduleModal'){
                //this.closeModal(); // (opcjonalnie mozna usunac)
            }
        });

        // formularz
        document.getElementById('scheduleForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSchedule();
        });

        // filtry
        document.getElementById('dayFilter').addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('typeFilter').addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('resetFilters').addEventListener('click', () => {
            this.resetFilters();
        });
    }

    async loadSchedule(){
        const loading = document.getElementById('loading');
        const tableBody = document.getElementById('scheduleTableBody');

        loading.classList.add('active');

        try{
            const response = await fetch(ScheduleManagement.CONFIG.API.SCHEDULE_ALL);

            if(!response.ok){
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.scheduleData = await response.json();
            this.filteredData = [...this.scheduleData];
            this.renderTable();
        } 
        catch (error){
            console.error('Błąd ładowania harmonogramu:', error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 2rem;">
                        <div style="color: #ef4444;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 2rem;"></i>
                            <p style="margin-top: 1rem;">Błąd ładowania danych: ${error.message}</p>
                        </div>
                    </td>
                </tr>
            `;
        } 
        finally{
            loading.classList.remove('active');
        }
    }

    async loadGroups(){
        try{
            const response = await fetch(ScheduleManagement.CONFIG.API.GROUPS);
            if(!response.ok){
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.allGroups = await response.json();
            this.populateGroupsSelect();
        } 
        catch (error){
            console.error('Błąd ładowania kierunków:', error);
        }
    }

    populateGroupsSelect(){
        const groupsSelect = document.getElementById('studentGroups');
        groupsSelect.innerHTML = '';
        
        // Sortowanie alfabetyczne
        const sortedGroups = [...this.allGroups].sort((a, b) => 
            a.name.localeCompare(b.name, 'pl')
        );
        
        sortedGroups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            groupsSelect.appendChild(option);
        });
    }

    renderTable(){
        const tableBody = document.getElementById('scheduleTableBody');

        if(this.filteredData.length === 0){
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 2rem;">
                        <div class="empty-state">
                            <h3>Brak zajęć</h3>
                            <p>Nie znaleziono żadnych zajęć.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = this.filteredData.map(item => `
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
                        <button class="btn-edit" onclick="scheduleManagement.editSchedule(${item.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-delete" onclick="scheduleManagement.deleteSchedule(${item.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    applyFilters(){
        const dayFilter = document.getElementById('dayFilter').value;
        const typeFilter = document.getElementById('typeFilter').value;

        this.filteredData = this.scheduleData.filter(item => {
            const dayMatch = !dayFilter || item.dayOfWeek === dayFilter;
            const typeMatch = !typeFilter || item.classType === typeFilter;
            return dayMatch && typeMatch;
        });

        this.renderTable();
    }

    resetFilters(){
        document.getElementById('dayFilter').value = '';
        document.getElementById('typeFilter').value = '';
        this.filteredData = [...this.scheduleData];
        this.renderTable();
    }

    openModal(data = null){
        const modal = document.getElementById('scheduleModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('scheduleForm');

        form.reset();

        if(data){
            // tryb edycji
            this.isEditing = true;
            this.currentEditId = data.id;
            modalTitle.innerHTML = '<i class="fas fa-edit"></i> Edytuj zajęcia';

            document.getElementById('scheduleId').value = data.id;
            document.getElementById('title').value = data.title;
            document.getElementById('room').value = data.room;
            document.getElementById('teacher').value = data.teacher;
            document.getElementById('classType').value = data.classType;
            document.getElementById('dayOfWeek').value = data.dayOfWeek;
            document.getElementById('startTime').value = this.formatTimeForInput(data.startTime);
            document.getElementById('endTime').value = this.formatTimeForInput(data.endTime);
            
            // Zaznacz przypisane kierunki
            const groupsSelect = document.getElementById('studentGroups');
            if(data.studentGroups && data.studentGroups.length > 0){
                const groupIds = data.studentGroups.map(g => g.id.toString());
                Array.from(groupsSelect.options).forEach(option => {
                    option.selected = groupIds.includes(option.value);
                });
            }
        } 
        else{
            // tryb dodawania
            this.isEditing = false;
            this.currentEditId = null;
            modalTitle.innerHTML = '<i class="fas fa-plus"></i> Dodaj zajęcia';
        }

        modal.classList.add('active');
    }

    closeModal(){
        const modal = document.getElementById('scheduleModal');
        modal.classList.remove('active');
        this.isEditing = false;
        this.currentEditId = null;
    }

    async saveSchedule(){
        // Pobierz wybrane kierunki
        const groupsSelect = document.getElementById('studentGroups');
        const selectedGroupIds = Array.from(groupsSelect.selectedOptions).map(opt => parseInt(opt.value));
        
        const formData = {
            title: document.getElementById('title').value,
            room: document.getElementById('room').value,
            teacher: document.getElementById('teacher').value,
            classType: document.getElementById('classType').value,
            dayOfWeek: document.getElementById('dayOfWeek').value,
            startTime: document.getElementById('startTime').value + ':00',  // Format HH:MM:SS
            endTime: document.getElementById('endTime').value + ':00',      // Format HH:MM:SS
            studentGroupIds: selectedGroupIds
        };

        try{
            let response;
            if(this.isEditing){
                // aktualizacja
                response = await fetch(`${ScheduleManagement.CONFIG.API.SCHEDULE}/${this.currentEditId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
            } 
            else{
                // nowe zajecia
                response = await fetch(ScheduleManagement.CONFIG.API.SCHEDULE, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
            }

            if(!response.ok){
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // zapisanie stanu przed zamknieciem modala
            const wasEditing = this.isEditing;
            
            this.closeModal();
            this.loadSchedule();
            
            this.showNotification(
                wasEditing ? 'Zajęcia zostały zaktualizowane' : 'Zajęcia zostały dodane',
                'success'
            );
        } 
        catch (error){
            console.error('Błąd zapisu:', error);
            this.showNotification('Błąd podczas zapisywania: ' + error.message, 'error');
        }
    }

    async editSchedule(id){
        const item = this.scheduleData.find(s => s.id === id);
        if(item){
            this.openModal(item);
        }
    }

    async deleteSchedule(id){
        if(!confirm('Czy na pewno chcesz usunąć te zajęcia?')){
            return;
        }

        try{
            const response = await fetch(`${ScheduleManagement.CONFIG.API.SCHEDULE}/${id}`, {
                method: 'DELETE'
            });

            if(!response.ok){
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.loadSchedule();
            this.showNotification('Zajęcia zostały usunięte', 'success');
        } 
        catch (error){
            console.error('Błąd usuwania:', error);
            this.showNotification('Błąd podczas usuwania: ' + error.message, 'error');
        }
    }

    formatTime(timeObj){
        if(!timeObj) return '';

        // obsluga formatu string (HH:MM:SS lub HH:MM)
        if(typeof timeObj === 'string'){
            const parts = timeObj.split(':');
            return `${parts[0]}:${parts[1]}`;
        }

        // obsluga formatu obiektowego {hour, minute, second}
        if(typeof timeObj === 'object' && timeObj.hour !== undefined){
            const h = String(timeObj.hour).padStart(2, '0');
            const m = String(timeObj.minute).padStart(2, '0');
            return `${h}:${m}`;
        }

        return '';
    }

    formatTimeForInput(timeObj){
        if(!timeObj) return '';

        if(typeof timeObj === 'string'){
            const parts = timeObj.split(':');
            return `${parts[0]}:${parts[1]}`;
        }

        if(typeof timeObj === 'object' && timeObj.hour !== undefined){
            const h = String(timeObj.hour).padStart(2, '0');
            const m = String(timeObj.minute).padStart(2, '0');
            return `${h}:${m}`;
        }

        return '';
    }

    parseTimeInput(timeString){
        const [hour, minute] = timeString.split(':').map(Number);
        return {
            hour: hour,
            minute: minute,
            second: 0,
            nano: 0
        };
    }

    showNotification(message, type = 'info'){
        // prosty toast notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease;
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
