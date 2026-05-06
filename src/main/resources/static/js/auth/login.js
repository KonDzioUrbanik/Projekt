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

    // Obsługa komunikatów o błędach z URL (np. po wylogowaniu przez blokadę konta)
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam) {
        let message = "";
        if (errorParam === 'blocked') {
            message = "Twoje konto zostało zablokowane przez administratora. Skontaktuj się z obsługą.";
        } else if (errorParam === 'inactive') {
            message = "Twoje konto nie jest jeszcze aktywne. Sprawdź swoją skrzynkę e-mail i kliknij w link aktywacyjny.";
        } else if (errorParam === 'error') {
            message = "Wystapił błąd sesji lub Twoje konto przestało być dostępne. Proszę zalogować się ponownie.";
        }
        
        if (message && errorMessageContainer) {
            displayMessage(errorMessageContainer, message);
        }
    }

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

    initPasswordToggle('password', 'togglePassword');

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
            displaySafeMessage(errorMessageContainer, "Proszę uzupełnić wszystkie wymagane pola.");
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

            const data = await response.json().catch(() => ({}));

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
                
                // przekierowanie na strone główną portalu (bezpieczne replace)
                redirectAfterDelay("/home", 500);
            } 
            else{
                // BŁĘDY
                const errorMsg = getErrorMessage(response, data);
                displayMessage(errorMessageContainer, errorMsg);
            }
        } 
        catch(error){
            console.error("Błąd połączenia:", error);
            displaySafeMessage(errorMessageContainer, "Nie udało się nawiązać połączenia z serwerem. Sprawdź połączenie internetowe.");
        } 
        finally{
            // odblokowanie przycisku
            enableButton(loginButton, "<span>Zaloguj się</span>");
        }
    });
});