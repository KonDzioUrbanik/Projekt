document.querySelector('form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const currentPassword = document.querySelector('input[name="currentPassword"]').value;
    const newPassword = document.querySelector('input[name="newPassword"]').value;
    const confirmPassword = document.querySelector('input[name="confirmPassword"]').value;
    
    // walidacja po stronie klienta
    if(newPassword !== confirmPassword){
        alert('Nowe hasła nie są identyczne!');
        return;
    }
    
    if(newPassword.length < 6){
        alert('Hasło musi mieć minimum 6 znaków!');
        return;
    }
    
    const passwordData = {
        currentPassword: currentPassword,
        newPassword: newPassword,
        confirmPassword: confirmPassword
    };
    
    try{
        const response = await fetch('/api/users/me/password', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(passwordData)
        });
        
        if(response.ok){
            alert('Hasło zostało zmienione pomyślnie!');
            window.location.href = '/dashboard';
        } else {
            const error = await response.text();
            alert('Błąd: ' + error);
        }
        
    } 
    catch (error){
        alert('Wystąpił błąd podczas zmiany hasła: ' + error.message);
    }
});