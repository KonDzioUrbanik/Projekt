class GroupsManagement{
    constructor(){
        this.apiEndpoint = '/api/groups';
        this.groups = [];
        this.filteredGroups = [];
        this.isEditing = false;
        this.currentEditId = null;
        this.currentSort = 'id-asc';
        this.searchQuery = '';
        this.yearFilter = '';
        this.fieldFilter = '';
        this.modeFilter = '';

        this.initializeEventListeners();
        this.loadGroups();
    }

    initializeEventListeners(){
        document.getElementById('addGroupBtn').addEventListener('click', () => {
            this.openModal();
        });

        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('groupModal').addEventListener('click', (e) => {
            if(e.target.id === 'groupModal'){
                this.closeModal();
            }
        });

        document.getElementById('groupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveGroup();
        });

        // Event listenery dla filtrowania i sortowania
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.applyFiltersAndSort();
        });

        document.getElementById('yearFilter').addEventListener('change', (e) => {
            this.yearFilter = e.target.value;
            this.applyFiltersAndSort();
        });

        document.getElementById('fieldFilter').addEventListener('change', (e) => {
            this.fieldFilter = e.target.value;
            this.applyFiltersAndSort();
        });

        document.getElementById('modeFilter').addEventListener('change', (e) => {
            this.modeFilter = e.target.value;
            this.applyFiltersAndSort();
        });

        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.applyFiltersAndSort();
        });
    }

    async loadGroups(){
        const loading = document.getElementById('loading');
        const groupsList = document.getElementById('groupsList');

        loading.classList.add('active');

        try{
            const response = await fetch(this.apiEndpoint);

            if(!response.ok){
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.groups = await response.json();
            this.populateFilterOptions();
            this.applyFiltersAndSort();
        } 
        catch (error){
            console.error('Błąd ładowania grup:', error);
            groupsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Błąd ładowania danych</h3>
                    <p>${error.message}</p>
                </div>
            `;
        } 
        finally{
            loading.classList.remove('active');
        }
    }

    parseGroupInfo(groupName){
        const info = {
            year: null,
            field: null,
            mode: null
        };

        // Wyciągnięcie roku studiów (cyfry rzymskie: I, II, III, IV, V)
        const yearMatch = groupName.match(/\b([IV]{1,3}|V)\b/);
        if(yearMatch){
            info.year = yearMatch[1];
        }

        // Wyciągnięcie trybu studiów - najpierw sprawdzamy "niestacjonarne"
        const lowerName = groupName.toLowerCase();
        if(lowerName.includes('niestacjonarne')){
            info.mode = 'niestacjonarne';
        } else if(lowerName.includes('stacjonarne')){
            info.mode = 'stacjonarne';
        }

        // Wyciągnięcie kierunku
        info.field = this.extractFieldName(groupName);

        return info;
    }

    extractFieldName(groupName){
        // Usuń wszystkie znane elementy, zostaw tylko nazwę kierunku
        let field = groupName;
        
        // Usuń cyfry rzymskie (rok studiów)
        field = field.replace(/\b([IV]{1,3}|V)\b/g, '');
        
        // Usuń rok kalendarzowy (4 cyfry)
        field = field.replace(/\b20\d{2}\b/g, '');
        
        // Usuń wszystkie warianty trybu studiów
        field = field.replace(/\b(nie)?stacjonarn(e|y|a|ym|ego|ych)?\b/gi, '');
        
        // Usuń znaki interpunkcyjne
        field = field.replace(/[,\-\(\)]/g, ' ');
        
        // Usuń wielokrotne spacje i trim
        field = field.replace(/\s+/g, ' ').trim();
        
        // Normalizacja - zamień na pierwszą literę wielką, reszta mała
        if(field){
            field = field.charAt(0).toUpperCase() + field.slice(1).toLowerCase();
        }
        
        return field || null;
    }

    populateFilterOptions(){
        const fields = new Set();

        this.groups.forEach(group => {
            const info = this.parseGroupInfo(group.name);
            if(info.field) fields.add(info.field);
        });

        // Wypełnienie selecta dla kierunku
        const fieldFilter = document.getElementById('fieldFilter');
        const currentFieldValue = fieldFilter.value;
        fieldFilter.innerHTML = '<option value="">Wszystkie</option>';
        Array.from(fields).sort().forEach(field => {
            const option = document.createElement('option');
            option.value = field;
            option.textContent = field;
            fieldFilter.appendChild(option);
        });
        if(currentFieldValue) fieldFilter.value = currentFieldValue;
    }

    applyFiltersAndSort(){
        // Filtrowanie
        this.filteredGroups = this.groups.filter(group => {
            const matchesSearch = group.name.toLowerCase().includes(this.searchQuery);
            
            const info = this.parseGroupInfo(group.name);
            const matchesYear = !this.yearFilter || info.year === this.yearFilter;
            const matchesField = !this.fieldFilter || info.field === this.fieldFilter;
            const matchesMode = !this.modeFilter || info.mode === this.modeFilter;
            
            return matchesSearch && matchesYear && matchesField && matchesMode;
        });

        // Sortowanie
        this.filteredGroups.sort((a, b) => {
            switch(this.currentSort){
                case 'id-asc':
                    return a.id - b.id;
                case 'id-desc':
                    return b.id - a.id;
                case 'name-asc':
                    return a.name.localeCompare(b.name);
                case 'name-desc':
                    return b.name.localeCompare(a.name);
                default:
                    return 0;
            }
        });

        this.updateStats();
        this.renderGroups();
    }

    updateStats(){
        const groupsCount = document.getElementById('groupsCount');
        groupsCount.textContent = this.filteredGroups.length;
    }

    renderGroups(){
        const groupsList = document.getElementById('groupsList');

        if(this.filteredGroups.length === 0){
            if(this.searchQuery){
                groupsList.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <h3>Nie znaleziono grup</h3>
                        <p>Brak grup pasujących do frazy: "<strong>${this.searchQuery}</strong>"</p>
                    </div>
                `;
            } else {
                groupsList.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <h3>Brak dodanych grup studenckich</h3>
                    </div>
                `;
            }
            return;
        }

        groupsList.innerHTML = this.filteredGroups.map(group => {
            // Wyróżnienie wyszukiwanej frazy
            let displayName = group.name;
            if(this.searchQuery){
                const regex = new RegExp(`(${this.searchQuery})`, 'gi');
                displayName = group.name.replace(regex, '<mark>$1</mark>');
            }

            return `
            <div class="group-card">
                <div class="group-card-header">
                    <div class="group-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="group-info">
                        <h4>${displayName}</h4>
                        <span class="group-id">ID: ${group.id}</span>
                    </div>
                </div>
                <div class="group-actions">
                    <button class="btn-edit" onclick="groupsManagement.editGroup(${group.id})">
                        <i class="fas fa-edit"></i> Edytuj
                    </button>
                    <button class="btn-delete" onclick="groupsManagement.deleteGroup(${group.id})">
                        <i class="fas fa-trash"></i> Usuń
                    </button>
                </div>
            </div>
        `;
        }).join('');
    }

    openModal(data = null){
        const modal = document.getElementById('groupModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('groupForm');

        form.reset();

        if(data){
            this.isEditing = true;
            this.currentEditId = data.id;
            modalTitle.innerHTML = '<i class="fas fa-edit"></i> Edytuj grupę';
            document.getElementById('groupId').value = data.id;
            document.getElementById('groupName').value = data.name;
        } 
        else{
            this.isEditing = false;
            this.currentEditId = null;
            modalTitle.innerHTML = '<i class="fas fa-plus"></i> Dodaj grupę';
        }

        modal.classList.add('active');
    }

    closeModal(){
        const modal = document.getElementById('groupModal');
        modal.classList.remove('active');
        this.isEditing = false;
        this.currentEditId = null;
    }

    async saveGroup(){
        const groupName = document.getElementById('groupName').value.trim();

        if(!groupName){
            alert('Wprowadź nazwę grupy');
            return;
        }

        const groupData = { name: groupName };

        try{
            let response;
            if(this.isEditing){
                response = await fetch(`${this.apiEndpoint}/${this.currentEditId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(groupData)
                });
            } 
            else{
                response = await fetch(this.apiEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(groupData)
                });
            }

            if(!response.ok){
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const wasEditing = this.isEditing;
            
            this.closeModal();
            this.loadGroups();
            
            this.showNotification(
                wasEditing ? 'Grupa została zaktualizowana' : 'Grupa została dodana',
                'success'
            );
        } 
        catch(error){
            console.error('Błąd zapisu:', error);
            this.showNotification('Błąd podczas zapisywania: ' + error.message, 'error');
        }
    }

    async editGroup(id){
        const group = this.groups.find(g => g.id === id);
        if(group){
            this.openModal(group);
        }
    }

    async deleteGroup(id){
        const group = this.groups.find(g => g.id === id);
        if(!confirm(`Czy na pewno chcesz usunąć grupę "${group.name}"?\n\nUwaga: Studenci przypisani do tej grupy zostaną z niej usunięci.`)){
            return;
        }

        try{
            const response = await fetch(`${this.apiEndpoint}/${id}`, {
                method: 'DELETE'
            });

            if(!response.ok){
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.loadGroups();
            this.showNotification('Grupa została usunięta', 'success');
        } 
        catch (error){
            console.error('Błąd usuwania:', error);
            this.showNotification('Błąd podczas usuwania: ' + error.message, 'error');
        }
    }

    showNotification(message, type = 'info'){
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

let groupsManagement;

document.addEventListener('DOMContentLoaded', () => {
    groupsManagement = new GroupsManagement();
});

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
