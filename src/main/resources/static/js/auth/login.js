'use strict';

document.addEventListener("DOMContentLoaded", () => {

    const loginForm = document.getElementById("loginForm");
    const errorMessageContainer = document.getElementById("loginMessage"); 
    const loginButton = document.getElementById("loginButton");

    // Obsługa pokazywania/ukrywania hasła
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const emailInput = document.getElementById("email");
    const rememberMeCheckbox = document.getElementById("remember-me");

    // Przywracanie zapamiętanego e-maila
    const savedEmail = localStorage.getItem('remembered_email');
    if (savedEmail && emailInput) {
        emailInput.value = savedEmail;
        
        // Małe opóźnienie i seria zdarzeń, aby "zmotywować" Password Managery
        setTimeout(() => {
            emailInput.dispatchEvent(new Event('input', { bubbles: true }));
            emailInput.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Niektóre przeglądarki czekają na blur lub focus pola hasła
            emailInput.blur();
            if (passwordInput && !passwordInput.value) {
                // Skupienie na haśle często wyzwala podpowiedź w Chrome/Edge
                passwordInput.focus();
            }
        }, 150);
        
        if (rememberMeCheckbox) {
            rememberMeCheckbox.checked = true;
        }
    }

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            // Przełącz typ pola
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);

            // Przełącz ikonę
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        // wyczyszczenie poprzednich komunikatow
        errorMessageContainer.innerHTML = '';
        errorMessageContainer.className = "form-message";

        let email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value.trim();
        const rememberMe = document.getElementById("remember-me")?.checked || false;

        // walidacja pol
        if(!email || !password){
            displayMessage(errorMessageContainer, "Proszę uzupełnić wszystkie wymagane pola.");
            return;
        }

        // konwersja numeru albumu na email
        email = convertToStudentEmail(email);

        // zablokowanie przycisku
        disableButton(loginButton, "Logowanie...");

        try{
            const response = await fetch(AUTH_CONFIG.API.LOGIN, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, rememberMe }),
            });

            let data = null;
            try{
                data = await response.json();
            } 
            catch(jsonError){
                // Serwer nie zwrócił poprawnego JSON - używamy pustego obiektu
                console.warn('Odpowiedź serwera nie jest poprawnym JSON:', jsonError);
                data = {};
            }

            // obsluga odpowiedzi HTTP
            if(response.ok){
                // SUKCES 

                if (rememberMe && email) {
                    localStorage.setItem('remembered_email', email);
                } else {
                    localStorage.removeItem('remembered_email');
                }
                
                localStorage.removeItem('remembered_password');

                displayMessage(errorMessageContainer, "Logowanie przebiegło pomyślnie. Przekierowywanie...", true);
                
                // przekierowanie na strone dashboard
                redirectAfterDelay("/dashboard");
            } 
            else{
                // BŁĘDY
                const errorMsg = getErrorMessage(response, data);
                displayMessage(errorMessageContainer, errorMsg);
            }
        } 
        catch(error){
            console.error("Błąd połączenia:", error);
            displayMessage(errorMessageContainer, "Nie udało się nawiązać połączenia z serwerem. Sprawdź połączenie internetowe i spróbuj ponownie.");
        } 
        finally{
            // odblokowanie przycisku
            enableButton(loginButton, "Zaloguj się");
        }
    });
});