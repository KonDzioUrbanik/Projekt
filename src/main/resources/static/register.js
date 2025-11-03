document.addEventListener('DOMContentLoaded', () => {


    const registerForm = document.getElementById('registerForm');
    const errorMessageContainer = document.getElementById('errorMessageContainer');


    registerForm.addEventListener('submit', async (event) => {


        event.preventDefault();
        errorMessageContainer.innerHTML = '';

        const firstName = document.getElementById('imie').value;
        const lastName = document.getElementById('nazwisko').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const passwordConfirm = document.getElementById('password-confirm').value;
        const role = document.getElementById('role').value;
        const nrAlbumu = document.getElementById('nrAlbumu').value; // To jest string!

        if (password !== passwordConfirm) {
            displayError('Hasła nie są identyczne.');
            return; // Przerywamy wysyłkę
        }

        const data = {
            firstName: firstName,
            lastName: lastName,
            email: email,
            password: password,
            role: role,
            nrAlbumu: parseInt(nrAlbumu, 10)
        };


        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify(data)
            });


            if (response.ok) {
                // Sukces! (Status 201 Created)
                console.log('Rejestracja udana!');
                // Przekierowujemy na stronę logowania
                window.location.href = '/login';
            } else {
                // Błąd! (np. 400 - walidacja, 409 - email zajęty)
                // Próbujemy odczytać szczegóły błędu z ProblemDetail
                const errorData = await response.json();
                console.error('Błąd rejestracji:', errorData);

                // Wyświetlamy błąd użytkownikowi
                let errorMsg = errorData.detail || 'Wystąpił błąd. Spróbuj ponownie.';

                // Jeśli to błąd walidacji, pokażemy listę błędów
                if (errorData.errors) {
                    errorMsg += '<ul>';
                    for (const field in errorData.errors) {
                        errorMsg += `<li>${field}: ${errorData.errors[field]}</li>`;
                    }
                    errorMsg += '</ul>';
                }
                displayError(errorMsg);
            }
        } catch (error) {
            // Błąd sieciowy (np. brak połączenia z serwerem)
            console.error('Błąd sieci:', error);
            displayError('Błąd połączenia z serwerem. Spróbuj ponownie później.');
        }
    });

    // Funkcja pomocnicza do wyświetlania błędów
    function displayError(message) {
        errorMessageContainer.innerHTML = `<div class="error-message">${message}</div>`;
    }
});