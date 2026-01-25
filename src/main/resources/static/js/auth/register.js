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
            displayMessage(errorMessageContainer, 'Wprowadzone hasła nie są identyczne. Upewnij się, że oba pola zawierają to samo hasło.');
            return;
        }

        // sprawdzenie czy pola nie sa puste
        if (!firstName || !lastName || !email || !password /*|| !role || !nrAlbumu*/){
            displayMessage(errorMessageContainer, 'Wszystkie pola formularza są wymagane. Proszę uzupełnić brakujące informacje.');
            return;
        }

        // sprawdzenie formatu email
        if(!validateStudentEmail(email)){
            displayMessage(errorMessageContainer, 'Adres e-mail jest nieprawidłowy. Użyj formatu: numer_albumu@student.kpu.krosno.pl (np. 123456@student.kpu.krosno.pl)');
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
                displayMessage(errorMessageContainer, 'Rejestracja przebiegła pomyślnie! Na podany adres e-mail został wysłany link aktywacyjny.', true);
                
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
            displayMessage(errorMessageContainer, 'Nie udało się nawiązać połączenia z serwerem. Spróbuj ponownie za chwilę.');
        }
        finally{
            enableButton(registerButton, 'Zarejestruj się');
        }
    });
});