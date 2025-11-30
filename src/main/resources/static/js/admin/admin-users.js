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
