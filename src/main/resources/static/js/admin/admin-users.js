// filtrowanie i wyszukiwanie użytkowników

const searchInput = document.getElementById('searchInput');
const roleFilter = document.getElementById('roleFilter');
const groupFilter = document.getElementById('groupFilter');
const resetFiltersBtn = document.getElementById('resetFilters');
const tableRows = document.querySelectorAll('.users-table tbody tr');
const resultsCount = document.getElementById('resultsCount');
const resultsText = document.getElementById('resultsText');

// funkcja do wypełnienia filtra grup unikalnymi wartościami z tabeli
function populateGroupFilter(){
    const groups = new Set();
    
    tableRows.forEach(row => {
        const groupCell = row.querySelector('td:nth-child(6)');
        if(groupCell){
            const groupText = groupCell.textContent.trim();

            if(groupText && groupText !== 'Brak'){
                groups.add(groupText);
            }
        }
    });
    
    // sortowanie alfabetyczne
    const sortedGroups = Array.from(groups).sort();
    
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
        const fullName = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
        const email = row.querySelector('td:nth-child(3)').textContent.toLowerCase();
        const role = row.querySelector('.badge').textContent.trim();
        const group = row.querySelector('td:nth-child(6)').textContent.trim();
        
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
    
    if(count === 0){
        resultsText.textContent = 'użytkowników';
    } 
    else if(count === 1){
        resultsText.textContent = 'użytkownik';
    } 
    else if(count % 10 >= 2 && count % 10 <= 4 && (count < 10 || count > 20)){
        resultsText.textContent = 'użytkowników';
    } 
    else{
        resultsText.textContent = 'użytkowników';
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
        
        if(columnIndex === 1){ // Imię i Nazwisko
            aValue = a.querySelector('td:nth-child(2) span').textContent.trim().toLowerCase();
            bValue = b.querySelector('td:nth-child(2) span').textContent.trim().toLowerCase();
        }
        else if(columnIndex === 4){ // Rola
            aValue = a.querySelector('.badge').textContent.trim();
            bValue = b.querySelector('.badge').textContent.trim();
        }
        else{
            aValue = a.querySelector(`td:nth-child(${columnIndex + 1})`).textContent.trim();
            bValue = b.querySelector(`td:nth-child(${columnIndex + 1})`).textContent.trim();
        }
        
        // obsługa wartości "Brak" i "-"
        if(aValue === 'Brak' || aValue === '-') aValue = '';
        if(bValue === 'Brak' || bValue === '-') bValue = '';
        
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

    document.getElementById("editEmail").value = email;
    document.getElementById("editUserName").innerText = firstName + " " + lastName;
    document.getElementById("editUserEmailDisplay").innerText = email;
    document.getElementById("editRole").value = role;

    modal.classList.add("active");
}

function closeEditModal(){
    document.getElementById("editUserModal").classList.remove("active");
}

document.getElementById("editUserForm").addEventListener("submit", function (e){
    e.preventDefault();
    
    const email = document.getElementById("editEmail").value;
    const newRole = document.getElementById("editRole").value;

    alert("Zapisano");

    closeEditModal();
});
