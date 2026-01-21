document.addEventListener('DOMContentLoaded', () => {

    const registerForm = document.getElementById('registerForm');
    const errorMessageContainer = document.getElementById('errorMessageContainer');
    const registerButton = document.getElementById('registerButton');

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        // wyczyszczenie poprzednich komunikatow
        errorMessageContainer.innerHTML = '';
        errorMessageContainer.className = "form-message";

        const firstName = document.getElementById('imie').value;
        const lastName = document.getElementById('nazwisko').value;
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const passwordConfirm = document.getElementById('password-confirm').value;
        // const role = document.getElementById('role').value;
        // const nrAlbumu = document.getElementById('nrAlbumu').value;

        // sprawdzenie czy hasla sa identyczne
        if (password !== passwordConfirm){
            displayMessage(errorMessageContainer, 'Hasła nie są identyczne.');
            return;
        }

        // sprawdzenie czy pola nie sa puste
        if (!firstName || !lastName || !email || !password /*|| !role || !nrAlbumu*/){
            displayMessage(errorMessageContainer, 'Wszystkie pola są wymagane.');
            return;
        }

        // sprawdzenie formatu email
        if(!validateStudentEmail(email)){
            displayMessage(errorMessageContainer, 'Nieprawidłowy e-mail. \nAdres e-mail musi składać się z numeru albumu (same cyfry) oraz domeny @student.kpu.krosno.pl');
            return;
        }

        const data = {
            firstName: firstName,
            lastName: lastName,
            email: email,
            password: password
            // role: role,
            // nrAlbumu: parseInt(nrAlbumu, 10)
        };

        try{
            disableButton(registerButton, 'Rejestrowanie...');

            const response = await fetch(AUTH_CONFIG.API.REGISTER, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify(data)
            });

            // obsluga odpowiedzi HTTP
            if(response.ok){
                displayMessage(errorMessageContainer, 'Zarejestrowano pomyślnie!', true);
                
                // przekierowanie na strone logowania
                redirectAfterDelay('/login');
            }
            else{
                const errorData = await response.json();
                console.error('Błąd rejestracji:', errorData);

                const errorMsg = getErrorMessage(response, errorData);
                displayMessage(errorMessageContainer, errorMsg);
            }
        } 
        catch (error){
            console.error('Błąd sieci:', error);
            displayMessage(errorMessageContainer, 'Błąd połączenia z serwerem. Spróbuj ponownie później.');
        }
        finally{
            enableButton(registerButton, 'Zarejestruj się');
        }
    });
});