// filtrowanie i wyszukiwanie użytkowników

const CONFIG = {
    SELECTORS: {
        FULL_NAME_CELL: 'td:nth-child(2)',
        EMAIL_CELL: 'td:nth-child(3)',
        ROLE_BADGE: '.badge',
        GROUP_CELL: 'td:nth-child(6)',
        NAME_SPAN: 'td:nth-child(2) span'
    },
    COLUMNS: {
        ID: 0,
        FULL_NAME: 1,
        EMAIL: 2,
        ROLE: 4,
        GROUP: 5
    },
    EMPTY_VALUES: ['Brak', '-', '']
};

const searchInput = document.getElementById('searchInput');
const roleFilter = document.getElementById('roleFilter');
const groupFilter = document.getElementById('groupFilter');
const resetFiltersBtn = document.getElementById('resetFilters');
const tableRows = document.querySelectorAll('.users-table tbody tr');
const resultsCount = document.getElementById('resultsCount');
const resultsText = document.getElementById('resultsText');

// funkcja do wypełnienia filtra kierunków unikalnymi wartościami z tabeli
function populateGroupFilter(){
    const groups = new Set();
    
    // pobranie aktualnych wierszy (wszystkie, nie tylko tableRows)
    const currentRows = document.querySelectorAll('.users-table tbody tr');
    currentRows.forEach(row => {
        const groupCell = row.querySelector(CONFIG.SELECTORS.GROUP_CELL);
        if(groupCell){
            const groupText = groupCell.textContent.trim();

            if(groupText && !CONFIG.EMPTY_VALUES.includes(groupText)){
                groups.add(groupText);
            }
        }
    });
    
    // sortowanie alfabetyczne
    const sortedGroups = Array.from(groups).sort();
    
    // wyczyszenie i odbudowanie opcji
    groupFilter.innerHTML = '<option value="">Wszystkie grupy</option>';
    
    // dodanie opcji do selecta
    sortedGroups.forEach(group => {
        const option = document.createElement('option');
        option.value = group;
        option.textContent = group;
        groupFilter.appendChild(option);
    });
}

function filterUsers(){
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedRole = roleFilter.value;
    const selectedGroup = groupFilter.value;
    
    let visibleCount = 0;
    
    tableRows.forEach(row => {
        const fullName = row.querySelector(CONFIG.SELECTORS.FULL_NAME_CELL).textContent.toLowerCase();
        const email = row.querySelector(CONFIG.SELECTORS.EMAIL_CELL).textContent.toLowerCase();
        const role = row.querySelector(CONFIG.SELECTORS.ROLE_BADGE).textContent.trim();
        const group = row.querySelector(CONFIG.SELECTORS.GROUP_CELL).textContent.trim();
        
        const matchesSearch = fullName.includes(searchTerm) || email.includes(searchTerm);
        const matchesRole = !selectedRole || role === selectedRole;
        const matchesGroup = !selectedGroup || group === selectedGroup;
        
        if(matchesSearch && matchesRole && matchesGroup){
            row.classList.remove('user-row-hidden');
            visibleCount++;
        } 
        else{
            row.classList.add('user-row-hidden');
        }
    });
    
    updateResultsCounter(visibleCount);
}

function updateResultsCounter(count){
    resultsCount.textContent = count;
    
    // pokazanie/ukrycie komunikatu o braku wyników w tbody tabeli
    const tableBody = document.querySelector('.users-table tbody');
    const existingEmptyRow = tableBody.querySelector('.empty-state-row');
    
    if(count === 0){
        resultsText.textContent = 'użytkowników';
        
        // dodanie wiersza z komunikatem jeśli nie istnieje
        if(!existingEmptyRow){
            const emptyRow = document.createElement('tr');
            emptyRow.className = 'empty-state-row';
            emptyRow.innerHTML = `
                <td colspan="7" style="text-align: center; padding: 2rem;">
                    <div class="empty-state">
                        <h3>Brak wyników</h3>
                        <p>Nie znaleziono żadnych użytkowników.</p>
                    </div>
                </td>
            `;
            tableBody.appendChild(emptyRow);
        }
    } 
    else{
        // usunięcie wiersza z komunikatem jeśli istnieje
        if(existingEmptyRow){
            existingEmptyRow.remove();
        }
        
        if(count === 1){
            resultsText.textContent = 'użytkownik';
        } 
        else if(count % 10 >= 2 && count % 10 <= 4 && (count < 10 || count > 20)){
            resultsText.textContent = 'użytkowników';
        } 
        else{
            resultsText.textContent = 'użytkowników';
        }
    }
}

function resetFilters(){
    searchInput.value = '';
    roleFilter.value = '';
    groupFilter.value = '';
    filterUsers();
}

// event listeners
searchInput.addEventListener('input', filterUsers);
roleFilter.addEventListener('change', filterUsers);
groupFilter.addEventListener('change', filterUsers);
resetFiltersBtn.addEventListener('click', resetFilters);

// inicjalizacja przy załadowaniu strony
document.addEventListener('DOMContentLoaded', () => {
    populateGroupFilter();
    updateResultsCounter(tableRows.length);
    initSorting();
    loadGroups();
});

// sortowanie tabeli
let currentSortColumn = null;
let currentSortOrder = 'asc';
let originalOrder = [];

function initSorting(){
    const sortableHeaders = document.querySelectorAll('.sortable');
    
    // zapisanie oryginalnej kolejności wierszy
    originalOrder = Array.from(tableRows);
    
    sortableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const column = parseInt(header.getAttribute('data-column'));
            const type = header.getAttribute('data-type');
            sortTable(column, type, header);
        });
    });
}

function sortTable(columnIndex, dataType, headerElement){
    const tbody = document.querySelector('.users-table tbody');
    const rowsArray = Array.from(tableRows);
    
    // określenie kierunku sortowania (asc -> desc -> domyślna wartość)
    if(currentSortColumn === columnIndex){
        if(currentSortOrder === 'asc'){
            currentSortOrder = 'desc';
        } 
        else if(currentSortOrder === 'desc'){
            currentSortOrder = null; // reset do domyślnej kolejności
            currentSortColumn = null;
        }
    } 
    else{
        currentSortOrder = 'asc';
        currentSortColumn = columnIndex;
    }
    
    // resetowanie ikon we wszystkich nagłówkach
    document.querySelectorAll('.sortable .sort-icon').forEach(icon => {
        icon.className = 'fas fa-sort sort-icon';
    });
    
    // jeśli reset do domyślnej kolejności
    if(currentSortOrder === null){
        originalOrder.forEach(row => tbody.appendChild(row));
        return;
    }
    
    // ustawienie odpowiedniej ikony
    const icon = headerElement.querySelector('.sort-icon');
    icon.className = currentSortOrder === 'asc' ? 'fas fa-sort-up sort-icon' : 'fas fa-sort-down sort-icon';
    
    // sortowanie wierszy
    rowsArray.sort((a, b) => {
        let aValue, bValue;
        
        if(columnIndex === CONFIG.COLUMNS.FULL_NAME){ // Imię i Nazwisko
            aValue = a.querySelector(CONFIG.SELECTORS.NAME_SPAN).textContent.trim().toLowerCase();
            bValue = b.querySelector(CONFIG.SELECTORS.NAME_SPAN).textContent.trim().toLowerCase();
        }
        else if(columnIndex === CONFIG.COLUMNS.ROLE){ // Rola
            aValue = a.querySelector(CONFIG.SELECTORS.ROLE_BADGE).textContent.trim();
            bValue = b.querySelector(CONFIG.SELECTORS.ROLE_BADGE).textContent.trim();
        }
        else{
            aValue = a.querySelector(`td:nth-child(${columnIndex + 1})`).textContent.trim();
            bValue = b.querySelector(`td:nth-child(${columnIndex + 1})`).textContent.trim();
        }
        
        // obsługa wartości pustych
        if(CONFIG.EMPTY_VALUES.includes(aValue)) aValue = '';
        if(CONFIG.EMPTY_VALUES.includes(bValue)) bValue = '';
        
        // sortowanie według typu
        if(dataType === 'number'){
            aValue = aValue === '' ? -Infinity : parseFloat(aValue);
            bValue = bValue === '' ? -Infinity : parseFloat(bValue);
            return currentSortOrder === 'asc' ? aValue - bValue : bValue - aValue;
        } 
        else{
            if(currentSortOrder === 'asc'){
                return aValue.localeCompare(bValue, 'pl');
            } 
            else{
                return bValue.localeCompare(aValue, 'pl');
            }
        }
    });
    
    // ponowne dodanie posortowanych wierszy do tabeli
    rowsArray.forEach(row => tbody.appendChild(row));
}

// modal edycji użytkownika
function openEditModal(btn){
    const modal = document.getElementById("editUserModal");

    const email = btn.getAttribute("data-email");
    const firstName = btn.getAttribute("data-firstname");
    const lastName = btn.getAttribute("data-lastname");
    const role = btn.getAttribute("data-role");
    const group = btn.getAttribute("data-group");

    document.getElementById("editEmail").value = email;
    document.getElementById("editUserName").innerText = firstName + " " + lastName;
    document.getElementById("editUserEmailDisplay").innerText = email;
    document.getElementById("editRole").value = role;
    
    // ustawienie kierunku - znalezienie ID kierunku po nazwie
    const groupSelect = document.getElementById("editGroup");
    groupSelect.value = ""; // domyślnie brak kierunku
    
    if (group && group !== 'Brak'){
        const matchingGroup = allGroups.find(g => g.name === group);
        if(matchingGroup){
            groupSelect.value = matchingGroup.id;
        }
    }

    modal.classList.add("active");
}

function closeEditModal(){
    document.getElementById("editUserModal").classList.remove("active");
}

// ladowanie grup z API
let allGroups = [];

async function loadGroups(){
    try{
        const response = await fetch('/api/groups');
        if(!response.ok){
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        allGroups = await response.json();
        populateGroupSelect();
    } 
    catch (error){
        console.error('Błąd ładowania kierunków:', error);
    }
}

function populateGroupSelect(){
    const groupSelect = document.getElementById('editGroup');
    // zachowanie opcji "Brak kierunku"
    groupSelect.innerHTML = '<option value="">Brak kierunku</option>';
    
    // sortowanie alfabetyczne kierunków po nazwie
    const sortedGroups = [...allGroups].sort((a, b) => a.name.localeCompare(b.name));
    
    sortedGroups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = group.name;
        groupSelect.appendChild(option);
    });
}

// zapisywanie zmian uzytkownika
document.getElementById("editUserForm").addEventListener("submit", async function (e){
    e.preventDefault();
    
    const email = document.getElementById("editEmail").value;
    const newRole = document.getElementById("editRole").value;
    const groupId = document.getElementById("editGroup").value;

    try {
        // zmiana roli
        const roleResponse = await fetch(`/api/users/role/update/${email}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                newRole: newRole 
            })
        });

        if(!roleResponse.ok){
            throw new Error('Błąd podczas zmiany roli');
        }

        // przypisanie do kierunku (zawsze wywołaj, nawet jeśli groupId jest puste - wtedy wyśle null)
        const groupResponse = await fetch(`/api/users/assignGroup/${email}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ groupId: groupId ? parseInt(groupId) : null })
        });

        if(!groupResponse.ok){
            throw new Error('Błąd podczas przypisywania do kierunku');
        }

        alert("Zmiany zostały zapisane pomyślnie!");
        closeEditModal();
        location.reload(); // przeladowanie strony aby zachowac kolejnosc z backendu
    } 
    catch (error){
        console.error('Błąd:', error);
        alert("Wystąpił błąd podczas zapisywania zmian: " + error.message);
    }
});

