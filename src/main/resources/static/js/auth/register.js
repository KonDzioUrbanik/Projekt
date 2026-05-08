'use strict';

document.addEventListener('DOMContentLoaded', () => {

    const registerForm = document.getElementById('registerForm');
    const errorMessageContainer = document.getElementById('errorMessageContainer');
    const registerButton = document.getElementById('registerButton');
    const passwordInput = document.getElementById('password');
    const passwordRequirements = document.getElementById('passwordRequirements');

    // wymagania walidacji hasla
    const requirements = {
        length: { regex: /.{8,}/, id: 'req-length' },
        uppercase: { regex: /[A-Z]/, id: 'req-uppercase' },
        lowercase: { regex: /[a-z]/, id: 'req-lowercase' },
        number: { regex: /\d/, id: 'req-number' },
        special: { regex: /[@$#!%*?&]/, id: 'req-special' }
    };

    function updatePasswordRequirements() {
        const password = passwordInput.value;
        
        Object.entries(requirements).forEach(([key, req]) => {
            const element = document.getElementById(req.id);
            if (!element) return;
            
            const icon = element.querySelector('i');
            if (req.regex.test(password)) {
                element.classList.remove('unmet');
                element.classList.add('met');
                icon.classList.remove('fa-times-circle');
                icon.classList.add('fa-check-circle');
            } else {
                element.classList.remove('met');
                element.classList.add('unmet');
                icon.classList.remove('fa-check-circle');
                icon.classList.add('fa-times-circle');
            }
        });
    }

    // Show password requirements when user starts typing
    passwordInput.addEventListener('focus', () => {
        passwordRequirements.style.display = 'block';
    });

    passwordInput.addEventListener('input', () => {
        updatePasswordRequirements();
    });

    // Inicjalizacja podglądu haseł
    initPasswordToggle('password', 'togglePassword');
    initPasswordToggle('password-confirm', 'togglePasswordConfirm');

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        // wyczyszczenie poprzednich komunikatow
        errorMessageContainer.innerHTML = '';
        errorMessageContainer.className = "form-message";

        const firstName = document.getElementById('imie').value.trim();
        const lastName = document.getElementById('nazwisko').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = passwordInput.value;
        const passwordConfirm = document.getElementById('password-confirm').value;

        // 1. Sprawdzenie czy pola nie sa puste
        if (!firstName || !lastName || !email || !password || !passwordConfirm){
            displaySafeMessage(errorMessageContainer, 'Wszystkie pola formularza są wymagane. Proszę uzupełnić brakujące informacje.');
            return;
        }

        // 2. Sprawdzenie czy hasla sa identyczne
        if (password !== passwordConfirm){
            displaySafeMessage(errorMessageContainer, 'Wprowadzone hasła nie są identyczne. Upewnij się, że oba pola zawierają to samo hasło.');
            return;
        }

        // 3. Sprawdzenie siły hasła (KRYTYCZNE ZABEZPIECZENIE)
        if (!validateStrongPassword(password)) {
            displaySafeMessage(errorMessageContainer, 'Hasło nie spełnia wszystkich wymogów bezpieczeństwa. Upewnij się, że zawiera minimum 8 znaków, wielką i małą literę, cyfrę oraz znak specjalny.');
            return;
        }

        // 4. Sprawdzenie formatu email
        if(!validateStudentEmail(email)){
            displaySafeMessage(errorMessageContainer, 'Adres e-mail jest nieprawidłowy. Użyj formatu: numer_albumu@student.kpu.krosno.pl (np. 123456@student.kpu.krosno.pl)');
            return;
        }

        const data = {
            firstName: firstName,
            lastName: lastName,
            email: email,
            password: password
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

            const result = await response.json().catch(() => ({}));

            // obsluga odpowiedzi HTTP
            if(response.ok){
                displayMessage(errorMessageContainer, 'Rejestracja przebiegła pomyślnie! Na podany adres e-mail został wysłany link aktywacyjny.', true);
                
                // przekierowanie na strone logowania (bezpieczne replace)
                redirectAfterDelay('/login', 2000);
            }
            else{
                const errorMsg = getErrorMessage(response, result);
                displayMessage(errorMessageContainer, errorMsg);
            }
        }
        catch (error){
            console.error('Błąd sieci:', error);
            displaySafeMessage(errorMessageContainer, 'Nie udało się nawiązać połączenia z serwerem. Spróbuj ponownie za chwilę.');
        }
        finally{
            enableButton(registerButton, '<span>Utwórz konto</span>');
        }
    });
});
