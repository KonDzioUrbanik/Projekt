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
            displayError('Hasła nie są identyczne.');
            return;
        }

        // sprawdzenie czy pola nie sa puste
        if (!firstName || !lastName || !email || !password /*|| !role || !nrAlbumu*/){
            displayError('Wszystkie pola są wymagane.');
            return;
        }

        // sprawdzenie formatu email
        const studentEmailRegex = /^\d+@student\.kpu\.krosno\.pl$/;

        if(!studentEmailRegex.test(email)){
            displayError('Nieprawidłowy e-mail. \nAdres e-mail musi składać się z numeru albumu (same cyfry) oraz domeny @student.kpu.krosno.pl');
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
            registerButton.disabled = true; // zablokawanie przycisku

            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify(data)
            });

            // obsluga odpowiedzi HTTP
            if(response.ok){
                displayError('Zarejestrowano pomyślnie!', true);
                
                 // przekierowanie na strone logowania po 500ms
                setTimeout(() => {
                    window.location.href = '/login';
                }, 500);
            }
            else{
                const errorData = await response.json();
                console.error('Błąd rejestracji:', errorData);

                // wyswietlenie bledu uzytkownikowi
                let errorMsg = errorData.detail || 'Wystąpił błąd. Spróbuj ponownie.';

                if (errorData.errors){
                    errorMsg += '<ul>';
                    for(const field in errorData.errors){
                        errorMsg += `<li>${field}: ${errorData.errors[field]}</li>`;
                    }
                    errorMsg += '</ul>';
                }
                displayError(errorMsg);

                registerButton.disabled = false; // odblokowanie przycisku
            }
        } 
        catch (error){
            console.error('Błąd sieci:', error);
            displayError('Błąd połączenia z serwerem. Spróbuj ponownie później.');

            registerButton.disabled = false; // odblokowanie przycisku
        }
    });

    // funkcja pomocnicza do wyswietlania bledow/sukcesu
    function displayError(message, isSuccess = false){
        errorMessageContainer.innerHTML = message; // uzycie innerHTML, aby renderowac liste <ul>

        if(isSuccess){
            errorMessageContainer.className = "form-message success";
        } 
        else{
            errorMessageContainer.className = "form-message error";
        }
    }
});