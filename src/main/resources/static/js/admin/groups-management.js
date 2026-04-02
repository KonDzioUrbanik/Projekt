class GroupsManagement{
    static CONFIG = {
        API_ENDPOINT: '/api/groups',
        SORT_OPTIONS: {
            ID_ASC: 'id-asc',
            ID_DESC: 'id-desc',
            NAME_ASC: 'name-asc',
            NAME_DESC: 'name-desc'
        },
        FILTERS: {
            ALL: ''
        },
        DEFAULT_SORT: 'id-asc'
    };

    constructor(){
        this.groups = [];
        this.filteredGroups = [];
        this.isEditing = false;
        this.currentEditId = null;
        this.currentSort = GroupsManagement.CONFIG.DEFAULT_SORT;
        this.searchQuery = '';
        this.yearFilter = '';
        this.fieldFilter = '';
        this.modeFilter = '';
        this.pendingDeleteId = null;

        this.initializeEventListeners();
        this.initDeleteModal();
        this.loadGroups();
    }

    normalizeGroupName(name) {
        return (name || '').trim().replace(/\s+/g, ' ').toLowerCase();
    }

    hasDuplicateName(name) {
        const normalizedCandidate = this.normalizeGroupName(name);
        return this.groups.some(group => {
            if (this.isEditing && group.id === this.currentEditId) {
                return false;
            }
            return this.normalizeGroupName(group.name) === normalizedCandidate;
        });
    }

    initDeleteModal() {
        const btnCancel = document.getElementById('btnCancelDelete');
        const btnConfirm = document.getElementById('btnConfirmDelete');
        const overlay = document.getElementById('deleteConfirmOverlay');

        if (btnCancel && overlay) {
            btnCancel.addEventListener('click', () => {
                overlay.classList.remove('active');
                this.pendingDeleteId = null;
            });
        }

        if (btnConfirm && overlay) {
            btnConfirm.addEventListener('click', () => {
                overlay.classList.remove('active');
                if (this.pendingDeleteId) {
                    this.executeDelete(this.pendingDeleteId);
                }
            });
        }
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
            const response = await fetch(GroupsManagement.CONFIG.API_ENDPOINT);

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
                    <h3>Nie udało się załadować listy kierunków</h3>
                    <p>Sprawdź połączenie internetowe i odśwież stronę.</p>
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
        if (!groupsCount) {
            return;
        }
        groupsCount.textContent = this.groups.length;
    }

    renderGroups(){
        const groupsList = document.getElementById('groupsList');

        if(this.filteredGroups.length === 0){
            if(this.searchQuery){
                groupsList.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <h3>Nie znaleziono kierunków</h3>
                        <p>Brak kierunków pasujących do frazy: "<strong>${Utils.escapeHtml(this.searchQuery)}</strong>"</p>
                    </div>
                `;
            } else {
                groupsList.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <h3>Brak dodanych kierunków</h3>
                    </div>
                `;
            }
            return;
        }

        groupsList.innerHTML = this.filteredGroups.map(group => {
            // Wyróżnienie wyszukiwanej frazy
            let displayName = Utils.escapeHtml(group.name);
            if(this.searchQuery){
                const regex = new RegExp(`(${Utils.escapeHtml(this.searchQuery)})`, 'gi');
                displayName = displayName.replace(regex, '<mark>$1</mark>');
            }

            return `
            <div class="group-card">
                <div class="group-card-header">
                    <div class="group-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="group-info">
                        <h4 title="${Utils.escapeHtml(group.name)}">${displayName}</h4>
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
            modalTitle.innerHTML = '<i class="fas fa-edit"></i> Edytuj kierunek';
            document.getElementById('groupId').value = data.id;
            document.getElementById('groupName').value = data.name;
        } 
        else{
            this.isEditing = false;
            this.currentEditId = null;
            modalTitle.innerHTML = '<i class="fas fa-plus"></i> Dodaj kierunek';
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
            Utils.showToast('Pole nazwy kierunku jest wymagane.', 'warning');
            return;
        }

        if (this.hasDuplicateName(groupName)) {
            Utils.showToast(`Kierunek o nazwie "${groupName}" już istnieje.`, 'warning');
            return;
        }

        const groupData = { name: groupName };

        try{
            let response;
            if(this.isEditing){
                response = await fetch(`${GroupsManagement.CONFIG.API_ENDPOINT}/${this.currentEditId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(groupData)
                });
            } 
            else{
                response = await fetch(GroupsManagement.CONFIG.API_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(groupData)
                });
            }

            if(!response.ok){
                let message = 'Wystąpił błąd podczas zapisywania kierunku.';
                try {
                    const errorText = await response.text();
                    if (errorText) {
                        try {
                            const errorData = JSON.parse(errorText);
                            message = errorData.detail || errorData.message || message;
                        } catch {
                            message = errorText;
                        }
                    }
                } catch { /* ignore read error */ }
                throw new Error(message);
            }

            const wasEditing = this.isEditing;
            
            if (wasEditing) {
                this.closeModal();
            } else {
                document.getElementById('groupForm').reset();
            }

            this.loadGroups();
            
            Utils.showToast(
                wasEditing ? 'Kierunek został zaktualizowany.' : 'Kierunek został dodany.',
                'success'
            );
        } 
        catch(error){
            if (!String(error.message || '').includes('już istnieje')) {
                console.error('Błąd zapisu:', error);
            }
            Utils.showToast(error.message || 'Wystąpił błąd podczas zapisywania kierunku. Sprawdź poprawność danych i spróbuj ponownie.', 'error');
        }
    }

    async editGroup(id){
        const group = this.groups.find(g => g.id === id);
        if(group){
            this.openModal(group);
        }
    }

    deleteGroup(id){
        const group = this.groups.find(g => g.id === id);
        const overlay = document.getElementById('deleteConfirmOverlay');
        if (!overlay) {
            if(confirm(`Czy na pewno chcesz usunąć kierunek "${group.name}"? Studenci przypisani do tego kierunku zostaną od niego odłączeni. Ta operacja jest nieodwracalna.`)){
                this.executeDelete(id);
            }
            return;
        }

        this.pendingDeleteId = id;
        overlay.classList.add('active');
    }

    executeDelete(id) {
        const groupToDelete = this.groups.find(s => s.id === id);
        if (!groupToDelete) return;

        // Optimistically remove from UI
        this.groups = this.groups.filter(item => item.id !== id);
        this.applyFiltersAndSort();

        let isUndone = false;
        
        const toast = Utils.showToast('Kierunek usunięty', 'success', {
            actionHtml: '<button class="btn-undo-toast" id="undo-btn">COFNIJ</button>',
            duration: 5000
        });

        if (toast) {
            const undoBtn = toast.querySelector('#undo-btn');
            if (undoBtn) {
                undoBtn.addEventListener('click', () => {
                    isUndone = true;
                    toast.classList.add('fade-out');
                    setTimeout(() => toast.remove(), 300);

                    // Przywracamy dane
                    this.groups.push(groupToDelete);
                    this.applyFiltersAndSort();
                    Utils.showToast('Cofnięto usunięcie. Kierunek przywrócony.', 'info');
                });
            }
        }

        // Oczekujemy 5 sekund, potem request właściwy
        setTimeout(async () => {
            if (!isUndone) {
                if (toast && toast.parentElement) {
                    toast.classList.add('fade-out');
                    setTimeout(() => toast.remove(), 300);
                }

                try {
                    const response = await fetch(`${GroupsManagement.CONFIG.API_ENDPOINT}/${id}`, { method: 'DELETE' });
                    
                    if (!response.ok) {
                        throw new Error('Nie udało się trwale usunąć kierunku.');
                    }
                } catch (error) {
                    console.error('Błąd usuwania:', error);
                    // Jeśli błąd, przywracamy po cichu do danych
                    if (!this.groups.some(g => g.id === groupToDelete.id)) {
                        this.groups.push(groupToDelete);
                        this.applyFiltersAndSort();
                    }
                    Utils.showToast(error.message || 'Błąd usuwania z serwera.', 'error');
                }
            }
        }, 5000);
    }
}

let groupsManagement;

document.addEventListener('DOMContentLoaded', () => {
    groupsManagement = new GroupsManagement();
});
