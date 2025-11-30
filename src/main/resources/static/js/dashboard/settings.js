document.addEventListener('DOMContentLoaded', function(){
    const profileForm = document.getElementById('profileForm');
    const messageDiv = document.getElementById('profileMessage');
    const saveButton = document.getElementById('saveButton');
    const cancelButton = document.getElementById('cancelButton');

    // obsluga anulowania zapisywania profilu
    cancelButton.addEventListener('click', function(){
        if (confirm('Czy na pewno chcesz anulować? Niezapisane zmiany zostaną utracone.')){
            window.location.href = '/dashboard';
        }
    });

     // obsluga zapisu profilu
    profileForm.addEventListener('submit', async function(e){
        e.preventDefault();
        
        // Walidacja
        if (!validateForm()){
            return;
        }

         // zebranie danych z formularza
        const profileData = {
            firstName: document.getElementById('firstName').value.trim(),
            lastName: document.getElementById('lastName').value.trim() || null
        };

        
        try{
            // wylaczenie przycisku i pokazanie spinnera
            saveButton.disabled = true;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Zapisywanie...</span>';
            
            const response = await fetch('/api/users/me', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include', // wazne dla sesji/ciasteczek
                body: JSON.stringify(profileData)
            })

             if(response.ok){
                const updatedUser = await response.json();
                showMessage('Profil zaktualizowany pomyślnie!', 'success');
                
                // opcjonalnie: przekierowanie do panelu startowego po 1 sekundzie
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1000);

            } 
            else{
                let errorMessage = 'Błąd aktualizacji profilu';
                
                try{
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } 
                catch{
                    errorMessage = await response.text() || errorMessage;
                }
                
                throw new Error(errorMessage);
            }
        } 
        catch(error){
            console.error('Błąd:', error);
            showMessage(error.message || 'Wystąpił błąd podczas aktualizacji profilu', 'error');  
        } 
        finally{
            //przywrocenie przycisku
            saveButton.disabled = false;
            saveButton.innerHTML = '<i class="fas fa-save"></i> <span>Zapisz zmiany</span>';
        }
    });

     // funkcja walidacji formularza
    function validateForm(){
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();

        // walidacja imienia
        if(!firstName || firstName.length < 2){
            showMessage('Imię musi mieć co najmniej 2 znaki', 'error');
            return false;
        }

        // walidacja nazwiska
        if (!lastName || lastName.length < 2){
            showMessage('Nazwisko musi mieć co najmniej 2 znaki', 'error');
            return false;
        }

        return true;
    }

    // funkcja wyswietlania komunikatow
    function showMessage(message, type){
        messageDiv.className = 'form-message ' + type;
        
        let icon = 'fa-info-circle';
        if(type === 'success') icon = 'fa-check-circle';
        if(type === 'error') icon = 'fa-exclamation-circle';
        
        messageDiv.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
        messageDiv.style.display = 'block';
        
        // przewin do komunikatu
        messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // inicjalizacja awatara z inicjalow
    function initializeAvatar(){
        const firstName = document.getElementById('firstName').value || '';
        const lastName = document.getElementById('lastName').value || '';
        const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || 'PL';
        
        const avatarSpan = document.querySelector('.avatar span');
        if(avatarSpan && !document.querySelector('.avatar').style.backgroundImage){
            avatarSpan.textContent = initials;
        }
    }

    // aktualizowanie inicjalow przy zmianie imienia lub nazwiska
    // document.getElementById('firstName').addEventListener('input', initializeAvatar);
    // document.getElementById('lastName').addEventListener('input', initializeAvatar);

    // inicjalizacja przy zaladowaniu
    initializeAvatar();
});