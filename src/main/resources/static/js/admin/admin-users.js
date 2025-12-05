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
});

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
