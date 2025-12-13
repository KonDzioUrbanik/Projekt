class GroupsManagement{
    constructor(){
        this.apiEndpoint = '/api/groups';
        this.groups = [];
        this.isEditing = false;
        this.currentEditId = null;

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
            console.log('Załadowano grupy:', this.groups);
            this.renderGroups();
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

    renderGroups(){
        const groupsList = document.getElementById('groupsList');

        if(this.groups.length === 0){
            groupsList.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <i class="fas fa-users"></i>
                    <h3>Brak dodanych grup studenckich</h3>
                </div>
            `;
            return;
        }

        groupsList.innerHTML = this.groups.map(group => `
            <div class="group-card">
                <div class="group-card-header">
                    <div class="group-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="group-info">
                        <h3>${group.name}</h3>
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
        `).join('');
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

            this.closeModal();
            this.loadGroups();
            
            this.showNotification(
                this.isEditing ? 'Grupa została zaktualizowana' : 'Grupa została dodana',
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
