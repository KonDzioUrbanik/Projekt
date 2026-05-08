const CONFIG = {
    API: {
        CHANGE_PASSWORD: '/api/users/me/password'
    },
    VALIDATION: {
        MIN_PASSWORD_LENGTH: 6
    }
};

// Inicjalizacja podglądu haseł (dla wszystkich 3 pól)
initPasswordToggle('currentPassword', 'toggleCurrentPassword');
initPasswordToggle('newPassword', 'toggleNewPassword');
initPasswordToggle('confirmPassword', 'toggleConfirmPassword');

document.querySelector('form').addEventListener('submit', async function(e) {
    e.preventDefault();
   
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const messageContainer = document.getElementById('changePasswordMessage') || document.createElement('div');
   
    // Upewnij się, że kontener komunikatów istnieje
    if (!messageContainer.id) {
        messageContainer.id = 'changePasswordMessage';
        messageContainer.className = 'form-message';
        this.insertBefore(messageContainer, this.firstChild);
    }
   
    // 1. Walidacja zgodności
    if(newPassword !== confirmPassword){
        displaySafeMessage(messageContainer, 'Wprowadzone hasła nie są identyczne. Upewnij się, że oba pola zawierają to samo hasło.');
        return;
    }
   
    // 2. Walidacja siły hasła (Ujednolicona polityka)
    if(!validateStrongPassword(newPassword)){
        displaySafeMessage(messageContainer, 'Nowe hasło nie spełnia wymogów bezpieczeństwa (min. 8 znaków, duża i mała litera, cyfra oraz znak specjalny).');
        return;
    }
   
    const passwordData = {
        currentPassword: currentPassword,
        newPassword: newPassword,
        confirmPassword: confirmPassword
    };
   
    const submitBtn = this.querySelector('button[type="submit"]');

    try{
        disableButton(submitBtn, 'Zmienianie...');

        const response = await fetch(CONFIG.API.CHANGE_PASSWORD, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(passwordData)
        });
       
        if(response.ok){
            displayMessage(messageContainer, 'Hasło zostało pomyślnie zmienione! Zostaniesz przekierowany za chwilę...', true);
            
            // Bezpieczne przekierowanie
            redirectAfterDelay('/home', 2000);
        } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = getErrorMessage(response, errorData);
            displayMessage(messageContainer, errorMsg);
        }
       
    } catch (error){
        console.error('Błąd zmiany hasła:', error);
        displaySafeMessage(messageContainer, 'Wystąpił błąd podczas zmiany hasła. Spróbuj ponownie później.');
    } finally {
        enableButton(submitBtn, '<span>Zmień hasło</span>');
    }
});