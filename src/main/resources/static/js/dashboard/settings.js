document.addEventListener('DOMContentLoaded', function(){
    const profileForm = document.getElementById('profileForm');
    const messageDiv = document.getElementById('profileMessage');
    const saveButton = document.getElementById('saveButton');
    const cancelButton = document.getElementById('cancelButton');
    
    let messageTimeout = null; // timer dla auto-ukrywania komunikatu

    // inicjalizacja
    async function initialize(){
        try{
            const response = await fetch('/api/users/me', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                credentials: 'include'
            });
            
            if(response.ok){
                const userData = await response.json();
                
                // ustaw wartości pól
                if(userData.nickName) document.getElementById('nickName').value = userData.nickName;
                
                // Parsowanie numeru telefonu (prefix + numer)
                if(userData.phoneNumber) {
                    const phoneStr = userData.phoneNumber;
                    // Sprawdź czy zaczyna się od +
                    if(phoneStr.startsWith('+')) {
                        // Znajdź gdzie kończy się prefix (pierwsze nie-cyfry po +)
                        const match = phoneStr.match(/^(\+\d+)(\d+)$/);
                        if(match) {
                            const prefix = match[1];
                            const number = match[2];
                            
                            // Ustaw prefix jeśli jest w opcjach
                            const prefixSelect = document.getElementById('phonePrefix');
                            const prefixOption = Array.from(prefixSelect.options).find(opt => opt.value === prefix);
                            if(prefixOption) {
                                prefixSelect.value = prefix;
                            }
                            
                            // Ustaw numer (ostatnie 9 cyfr)
                            document.getElementById('phone').value = number.slice(-9);
                        }
                    } else {
                        // Bez prefiksu, po prostu ustaw numer
                        document.getElementById('phone').value = phoneStr;
                    }
                }
                
                const fieldOfStudySelect = document.getElementById('fieldOfStudy');
                const yearOfStudySelect = document.getElementById('yearOfStudy');
                const studyModeSelect = document.getElementById('studyMode');
                
                if(userData.fieldOfStudy){
                    fieldOfStudySelect.value = userData.fieldOfStudy;
                    fieldOfStudySelect.dataset.wasSet = 'true';
                }
                
                if(userData.yearOfStudy){
                    yearOfStudySelect.value = userData.yearOfStudy.toString();
                    yearOfStudySelect.dataset.wasSet = 'true';
                }
                
                if(userData.studyMode){
                    studyModeSelect.value = userData.studyMode;
                    studyModeSelect.dataset.wasSet = 'true';
                }
                
                if(userData.bio) document.getElementById('bio').value = userData.bio;
            }
        } 
        catch(error){
            console.error('Błąd pobierania danych użytkownika:', error);
        }
    }

    // wywołaj inicjalizację
    initialize();

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
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const nickName = document.getElementById('nickName').value.trim();
        const phonePrefix = document.getElementById('phonePrefix').value;
        const phoneNumber = document.getElementById('phone').value.trim();
        const fieldOfStudy = document.getElementById('fieldOfStudy').value;
        const yearOfStudy = document.getElementById('yearOfStudy').value;
        const studyMode = document.getElementById('studyMode').value;
        const bio = document.getElementById('bio').value.trim();

        // Walidacja - firstName i lastName
        if(!firstName || !lastName){
            saveButton.disabled = false;
            saveButton.innerHTML = '<i class="fas fa-save"></i> <span>Zapisz zmiany</span>';
            return;
        }

        // Połącz prefix i numer telefonu
        let fullPhoneNumber = null;
        if(phoneNumber && phoneNumber.length > 0) {
            fullPhoneNumber = phonePrefix + phoneNumber;
        }

        // Budowanie obiektu
        const profileData = {
            firstName: firstName,
            lastName: lastName,
            nickName: nickName.length > 0 ? nickName : null,
            phoneNumber: fullPhoneNumber,
            phoneNumber: phoneNumber.length > 0 ? phoneNumber.replace(/\s/g, '') : null,
            fieldOfStudy: fieldOfStudy.length > 0 ? fieldOfStudy : null,
            studyMode: studyMode.length > 0 ? studyMode : null,
            bio: bio.length > 0 ? bio : null
        };

        // Rok studiów - jeśli ma wartość, wysyłaj
        if(yearOfStudy && yearOfStudy.length > 0) {
            profileData.yearOfStudy = yearOfStudy;
        }

        console.log('Wysyłane dane:', profileData);
        
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
                console.log('Odpowiedź serwera:', updatedUser);
                showMessage('Profil zaktualizowany pomyślnie!', 'success');
                
                // Oznacz pola jako ustawione
                const fieldOfStudySelect = document.getElementById('fieldOfStudy');
                const yearOfStudySelect = document.getElementById('yearOfStudy');
                const studyModeSelect = document.getElementById('studyMode');
                
                if(fieldOfStudy && fieldOfStudy.length > 0) {
                    fieldOfStudySelect.dataset.wasSet = 'true';
                }
                if(yearOfStudy && yearOfStudy.length > 0) {
                    yearOfStudySelect.dataset.wasSet = 'true';
                }
                if(studyMode && studyMode.length > 0) {
                    studyModeSelect.dataset.wasSet = 'true';
                }
            } 
            else{
                let errorMessage = 'Błąd aktualizacji profilu';
                
                try{
                    const errorData = await response.json();
                    console.error('Błąd z serwera:', errorData);
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } 
                catch{
                    const textError = await response.text();
                    console.error('Błąd tekstowy:', textError);
                    errorMessage = textError || errorMessage;
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
        const bio = document.getElementById('bio').value.trim();
        const phoneNumber = document.getElementById('phone').value.trim();
        const fieldOfStudy = document.getElementById('fieldOfStudy').value;
        const yearOfStudy = document.getElementById('yearOfStudy').value;
        const studyMode = document.getElementById('studyMode').value;

        // walidacja bio (max 500 znaków)
        if(bio && bio.length > 500){
            showMessage('Opis "O mnie" może mieć maksymalnie 500 znaków', 'error');
            return false;
        }

        // walidacja telefonu - jeśli jest podany, musi być dokładnie 9 cyfr
        if(phoneNumber && phoneNumber.length > 0) {
            if(!/^\d{9}$/.test(phoneNumber)) {
                showMessage('Numer telefonu musi składać się z dokładnie 9 cyfr', 'error');
                return false;
            }
        }

        const fieldOfStudySelect = document.getElementById('fieldOfStudy');
        const yearOfStudySelect = document.getElementById('yearOfStudy');
        const studyModeSelect = document.getElementById('studyMode');

        // Jeśli pole było już ustawione, nie może być puste
        if(fieldOfStudySelect.dataset.wasSet === 'true' && (!fieldOfStudy || fieldOfStudy.length === 0)) {
            showMessage('Musisz wybrać kierunek studiów.', 'error');
            return false;
        }

        if(yearOfStudySelect.dataset.wasSet === 'true' && (!yearOfStudy || yearOfStudy.length === 0)) {
            showMessage('Musisz wybrać rok studiów.', 'error');
            return false;
        }

        if(studyModeSelect.dataset.wasSet === 'true' && (!studyMode || studyMode.length === 0)) {
            showMessage('Musisz wybrać tryb studiów.', 'error');
            return false;
        }

        return true;
    }

    // funkcja wyswietlania komunikatow
    function showMessage(message, type){
        // Wyczyść poprzedni timer jeśli istnieje
        if(messageTimeout) {
            clearTimeout(messageTimeout);
            messageTimeout = null;
        }
        
        messageDiv.className = 'form-message ' + type;
        
        let icon = 'fa-info-circle';
        if(type === 'success') icon = 'fa-check-circle';
        if(type === 'error') icon = 'fa-exclamation-circle';
        
        messageDiv.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
        messageDiv.style.display = 'block';
        
        // przewin do komunikatu
        messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // automatyczne ukrycie komunikatu po 5 sekundach
        messageTimeout = setTimeout(() => {
            messageDiv.style.display = 'none';
            messageDiv.className = 'form-message';
            messageDiv.innerHTML = '';
            messageTimeout = null;
        }, 5000);
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

    // inicjalizacja przy zaladowaniu
    initializeAvatar();
});