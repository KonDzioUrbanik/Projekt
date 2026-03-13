// filtrowanie i wyszukiwanie użytkowników

const CONFIG = {
    SELECTORS: {
        FULL_NAME_CELL: 'td:nth-child(2)',
        EMAIL_CELL: 'td:nth-child(3)',
        ROLE_BADGE: '.badge',
        GROUP_CELL: 'td:nth-child(5)',
        NAME_SPAN: 'td:nth-child(2) span'
    },
    COLUMNS: {
        ID: 0,
        FULL_NAME: 1,
        EMAIL: 2,
        ROLE: 3,
        GROUP: 4,
        YEAR: 5,
        ALBUM: 6
    },
    EMPTY_VALUES: ['Brak', '-', '', 'Nie przypisano kierunku']
};

const searchInput = document.getElementById('searchInput');
const roleFilter = document.getElementById('roleFilter');
const groupFilter = document.getElementById('groupFilter');
const yearFilter = document.getElementById('yearFilter');
const statusFilter = document.getElementById('statusFilter');
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
    
    // wyczyszenie i odbudowanie opcji - najpierw "Wszystkie", potem "Nie przypisano kierunku", potem kierunki
    groupFilter.innerHTML = '<option value="">Wszystkie</option>';
    
    // dodanie opcji "Nie przypisano kierunku" jako drugiej
    const noGroupOption = document.createElement('option');
    noGroupOption.value = 'Nie przypisano kierunku'; 
    noGroupOption.textContent = 'Nie przypisano kierunku';
    groupFilter.appendChild(noGroupOption);
    
    // dodanie posortowanych kierunków
    sortedGroups.forEach(group => {
        const option = document.createElement('option');
        option.value = group;
        option.textContent = group;
        groupFilter.appendChild(option);
    });
}

function filterUsers() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedRole = roleFilter.value;
    const selectedGroup = groupFilter.value;
    const selectedYear = yearFilter.value;
    const selectedStatus = statusFilter.value;
    
    // najpierw usuń paginację (pokaż wszystko) aby filtr działał na całości
    // potem paginacja zostanie zaaplikowana ponownie
    
    // resetuj filteredRows
    filteredRows = [];
    
    tableRows.forEach(row => {
        const fullName = row.querySelector(CONFIG.SELECTORS.FULL_NAME_CELL).textContent.toLowerCase();
        const email = row.querySelector(CONFIG.SELECTORS.EMAIL_CELL).textContent.toLowerCase();
        const role = row.querySelector(CONFIG.SELECTORS.ROLE_BADGE).textContent.trim();
        const group = row.querySelector(CONFIG.SELECTORS.GROUP_CELL).textContent.trim();
        
        // pobieranie danych z atrybutów data-*
        const year = row.getAttribute('data-year');
        const status = row.getAttribute('data-status'); // "true" lub "false"
        
        const matchesSearch = fullName.includes(searchTerm) || email.includes(searchTerm);
        const matchesRole = !selectedRole || role === selectedRole;
        const matchesGroup = !selectedGroup || group === selectedGroup;
        const matchesYear = !selectedYear || year === selectedYear;
        const matchesStatus = !selectedStatus || status === selectedStatus;
        
        // usuń klasę ukrywania filtra
        row.classList.remove('user-row-hidden');
        
        if(matchesSearch && matchesRole && matchesGroup && matchesYear && matchesStatus){
            filteredRows.push(row);
        } else {
            row.classList.add('user-row-hidden');
        }
    });
    
    // resetuj stronę do 1 przy każdej zmianie filtrów
    currentPage = 1;
    
    // aktualizuj handle wszystkie wartości powiązane z pageSizeTop
    if (pageSizeTopSelect.value === 'all') {
        pageSize = filteredRows.length;
    }
    
    // zastosuj paginację na przefiltrowanych wynikach
    applyPagination();
    
    updateResultsCounter(filteredRows.length);
}

function resetFilters(){
    searchInput.value = '';
    roleFilter.value = '';
    groupFilter.value = '';
    yearFilter.value = '';
    statusFilter.value = '';
    
    // wywołaj filtrowanie
    const originalFilterUsers = filterUsers; // referencja do funkcji
    
    filterUsers();
}

function updateResultsCounter(count) {
    if (resultsCount) {
        resultsCount.textContent = count;
        if (count === 1) {
            resultsText.textContent = 'użytkownik';
        } else {
            resultsText.textContent = 'użytkowników';
        }
    }
}

// event listeners
searchInput.addEventListener('input', filterUsers);
roleFilter.addEventListener('change', filterUsers);
groupFilter.addEventListener('change', filterUsers);
yearFilter.addEventListener('change', filterUsers);
statusFilter.addEventListener('change', filterUsers);
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
    // zachowanie opcji "Nie przypisano do kierunku"
    groupSelect.innerHTML = '<option value="">Nie przypisano do kierunku</option>';
    
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

        alert("Zmiany zostały pomyślnie zapisane.");
        closeEditModal();
        location.reload(); // przeladowanie strony aby zachowac kolejnosc z backendu
    } 
    catch (error){
        console.error('Błąd:', error);
        alert("Wystąpił błąd podczas zapisywania zmian. Sprawdź połączenie i spróbuj ponownie. Szczegóły: " + error.message);
    }
});

//  PAGINACJA

let currentPage = 1;
let pageSize = 50;  // domyślnie 50 użytkowników na stronę
let filteredRows = []; // przechowuje przefiltrowane wiersze

// elementy DOM dla paginacji
const currentPageTopEl = document.getElementById('currentPageTop');
const totalPagesTopEl = document.getElementById('totalPagesTop');
const prevPageTopBtn = document.getElementById('prevPageTop');
const nextPageTopBtn = document.getElementById('nextPageTop');
const pageSizeTopSelect = document.getElementById('pageSizeTop');

function initPagination() {
    // filteredRows będzie aktualizowane przez filterUsers
    filteredRows = Array.from(tableRows);
    
    // ustawienie event listenerów
    prevPageTopBtn.addEventListener('click', () => changePage(-1));
    nextPageTopBtn.addEventListener('click', () => changePage(1));
    pageSizeTopSelect.addEventListener('change', handlePageSizeChange);
    
    // początkowa paginacja
    applyPagination();
}

function handlePageSizeChange() {
    const value = pageSizeTopSelect.value;
    pageSize = value === 'all' ? filteredRows.length : parseInt(value);
    currentPage = 1;
    applyPagination();
}

function changePage(delta) {
    const totalPages = getTotalPages();
    const newPage = currentPage + delta;
    
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        applyPagination();
    }
}

function getTotalPages() {
    if (pageSize === 0 || filteredRows.length === 0) return 1;
    return Math.ceil(filteredRows.length / pageSize);
}

function applyPagination() {
    const totalPages = getTotalPages();
    
    // ukrycie wszystkich wierszy najpierw
    tableRows.forEach(row => row.classList.add('pagination-hidden'));
    
    // obliczenie zakresu wierszy do pokazania
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = pageSizeTopSelect.value === 'all' ? filteredRows.length : Math.min(startIndex + pageSize, filteredRows.length);
    
    // pokazanie wierszy na aktualnej stronie
    for (let i = startIndex; i < endIndex; i++) {
        if (filteredRows[i]) {
            filteredRows[i].classList.remove('pagination-hidden');
        }
    }
    
    // aktualizacja UI paginacji
    updatePaginationUI(totalPages);
}

function updatePaginationUI(totalPages) {
    currentPageTopEl.textContent = currentPage;
    totalPagesTopEl.textContent = totalPages;
    
    // włączenie/wyłączenie przycisków
    prevPageTopBtn.disabled = currentPage <= 1;
    nextPageTopBtn.disabled = currentPage >= totalPages;
}

// aktualizacja funkcji filterUsers aby współpracowała z paginacją
const originalFilterUsers = filterUsers;
filterUsers = function() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedRole = roleFilter.value;
    const selectedGroup = groupFilter.value;
    
    // resetuj filteredRows
    filteredRows = [];
    
    tableRows.forEach(row => {
        const fullName = row.querySelector(CONFIG.SELECTORS.FULL_NAME_CELL).textContent.toLowerCase();
        const email = row.querySelector(CONFIG.SELECTORS.EMAIL_CELL).textContent.toLowerCase();
        const role = row.querySelector(CONFIG.SELECTORS.ROLE_BADGE).textContent.trim();
        const group = row.querySelector(CONFIG.SELECTORS.GROUP_CELL).textContent.trim();
        
        const matchesSearch = fullName.includes(searchTerm) || email.includes(searchTerm);
        const matchesRole = !selectedRole || role === selectedRole;
        const matchesGroup = !selectedGroup || group === selectedGroup;
        
        // usuń klasę ukrywania filtra (teraz używamy tylko klasy paginacji)
        row.classList.remove('user-row-hidden');
        
        if(matchesSearch && matchesRole && matchesGroup){
            filteredRows.push(row);
        } else {
            row.classList.add('user-row-hidden');
        }
    });
    
    // resetuj stronę do 1 przy każdej zmianie filtrów
    currentPage = 1;
    
    // aktualizuj handle wszystkie wartości powiązane z pageSizeTop
    if (pageSizeTopSelect.value === 'all') {
        pageSize = filteredRows.length;
    }
    
    // zastosuj paginację na przefiltrowanych wynikach
    applyPagination();
    
    updateResultsCounter(filteredRows.length);
};

// inicjalizacja paginacji po załadowaniu DOM
document.addEventListener('DOMContentLoaded', () => {
    // inicjalizacja filtrów (kierunki)
    populateGroupFilter();
    
    // zaladowanie grup dla modalu edycji
    loadGroups();

    // poczekaj chwilę na inne inicjalizacje
    setTimeout(initPagination, 100);
});

// MODAL EKSPORTU CSV

// otwórz modal eksportu zamiast bezpośrednio eksportować
document.getElementById('exportCsvBtn').addEventListener('click', openExportModal);

function openExportModal() {
    const modal = document.getElementById('exportModal');
    
    // aktualizuj licznik - zawsze eksportujemy wszystkich przefiltrowanych
    document.getElementById('exportCount').textContent = filteredRows.length;
    
    modal.classList.add('active');
}

function closeExportModal() {
    document.getElementById('exportModal').classList.remove('active');
}

function toggleAllColumns(checked) {
    document.getElementById('exportId').checked = checked;
    document.getElementById('exportName').checked = checked;
    document.getElementById('exportEmail').checked = checked;
    document.getElementById('exportAlbum').checked = checked;
    document.getElementById('exportRole').checked = checked;
    document.getElementById('exportGroup').checked = checked;
    document.getElementById('exportYear').checked = checked;
}

function performExport() {
    // zawsze eksportuj przefiltrowane wiersze
    const rowsToExport = filteredRows;
    
    if (rowsToExport.length === 0) {
        alert('Brak danych do eksportu.');
        return;
    }
    
    // pobierz wybrane kolumny
    const columns = {
        id: document.getElementById('exportId').checked,
        name: document.getElementById('exportName').checked,
        email: document.getElementById('exportEmail').checked,
        album: document.getElementById('exportAlbum').checked,
        role: document.getElementById('exportRole').checked,
        group: document.getElementById('exportGroup').checked,
        year: document.getElementById('exportYear').checked
    };
    
    // sprawdź czy wybrano przynajmniej jedną kolumnę
    if (!Object.values(columns).some(v => v)) {
        alert('Wybierz przynajmniej jedną kolumnę do eksportu.');
        return;
    }
    
    // buduj nagłówki
    const headers = [];
    if (columns.id) headers.push('ID');
    if (columns.name) headers.push('Imię i nazwisko');
    if (columns.email) headers.push('Email');
    if (columns.role) headers.push('Rola');
    if (columns.group) headers.push('Kierunek');
    if (columns.year) headers.push('Rok studiów');
    if (columns.album) headers.push('Numer albumu');
    
    // zbierz dane z wierszy
    const csvData = rowsToExport.map(row => {
        const rowData = [];
        
        if (columns.id) {
            rowData.push(escapeCSV(row.querySelector('td:nth-child(1)').textContent.trim()));
        }
        if (columns.name) {
            const fullName = row.querySelector('td:nth-child(2) span')?.textContent.trim() || 
                             row.querySelector('td:nth-child(2)').textContent.trim();
            rowData.push(escapeCSV(fullName));
        }
        if (columns.email) {
            rowData.push(escapeCSV(row.querySelector('td:nth-child(3)').textContent.trim()));
        }
        if (columns.role) {
            rowData.push(escapeCSV(row.querySelector('.badge')?.textContent.trim() || ''));
        }
        if (columns.group) {
            rowData.push(escapeCSV(row.querySelector('td:nth-child(5)').textContent.trim()));
        }
        if (columns.year) {
            rowData.push(escapeCSV(row.querySelector('td:nth-child(6)').textContent.trim()));
        }
        if (columns.album) {
            rowData.push(escapeCSV(row.querySelector('td:nth-child(7)').textContent.trim()));
        }
        
        return rowData;
    });
    
    // zbuduj string CSV
    const csvContent = [headers.join(';'), ...csvData.map(row => row.join(';'))].join('\n');
    
    // dodaj BOM dla poprawnego wyświetlania polskich znaków w Excel
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // utwórz link do pobrania
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // nazwa pliku z datą
    const date = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `uzytkownicy_export_${date}.csv`);
    
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // zamknij modal po eksporcie
    closeExportModal();
}

function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    // jeśli zawiera separator, cudzysłów lub nową linię - owiń w cudzysłowy
    if (stringValue.includes(';') || stringValue.includes('"') || stringValue.includes('\n')) {
        return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    return stringValue;
}

// zamknij modal po kliknięciu poza nim
document.getElementById('exportModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeExportModal();
    }
});

