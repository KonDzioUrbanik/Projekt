const CONFIG = {
    API: {
        CHANGE_PASSWORD: '/api/users/me/password'
    },
    VALIDATION: {
        MIN_PASSWORD_LENGTH: 6
    }
};

document.querySelector('form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const currentPassword = document.querySelector('input[name="currentPassword"]').value;
    const newPassword = document.querySelector('input[name="newPassword"]').value;
    const confirmPassword = document.querySelector('input[name="confirmPassword"]').value;
    const messageContainer = document.getElementById('changePasswordMessage') || document.createElement('div');
    
    // Upewnij się, że kontener komunikatów istnieje
    if (!messageContainer.id) {
        messageContainer.id = 'changePasswordMessage';
        messageContainer.className = 'form-message';
        this.insertBefore(messageContainer, this.firstChild);
    }
    
    // walidacja po stronie klienta
    if(newPassword !== confirmPassword){
        displayMessage(messageContainer, 'Nowe hasła nie są identyczne!');
        return;
    }
    
    if(newPassword.length < CONFIG.VALIDATION.MIN_PASSWORD_LENGTH){
        displayMessage(messageContainer, `Hasło musi mieć minimum ${CONFIG.VALIDATION.MIN_PASSWORD_LENGTH} znaków!`);
        return;
    }
    
    const passwordData = {
        currentPassword: currentPassword,
        newPassword: newPassword,
        confirmPassword: confirmPassword
    };
    
    try{
        const response = await fetch(CONFIG.API.CHANGE_PASSWORD, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(passwordData)
        });
        
        if(response.ok){
            displayMessage(messageContainer, 'Hasło zostało zmienione pomyślnie!', true);
            redirectAfterDelay('/dashboard');
        } else {
            const error = await response.text();
            displayMessage(messageContainer, 'Błąd: ' + error);
        }
        
    } 
    catch (error){
        console.error('Błąd zmiany hasła:', error);
        displayMessage(messageContainer, 'Wystąpił błąd podczas zmiany hasła: ' + error.message);
    }
});