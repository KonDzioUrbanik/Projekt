document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("resetPasswordForm");
    const message = document.getElementById("resetMessage");
    const button = document.getElementById("resetButton");
    const newPasswordInput = document.getElementById("newPassword");
    const confirmPasswordInput = document.getElementById("confirmPassword");

    // Pobranie tokenu z URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    // Sprawdzenie czy token istnieje
    if (!token) {
        displayMessage(message, "Brak tokenu resetowania hasła. Link może być nieprawidłowy.");
        button.disabled = true;
        return;
    }

    // Inicjalizacja podglądu haseł
    initPasswordToggle('newPassword', 'toggleNewPassword');
    initPasswordToggle('confirmPassword', 'toggleConfirmPassword');

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const newPassword = newPasswordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();

        // 1. Walidacja pól
        if (!newPassword || !confirmPassword) {
            displaySafeMessage(message, "Wszystkie pola są wymagane.");
            return;
        }

        // 2. Sprawdzenie zgodności haseł
        if (newPassword !== confirmPassword) {
            displaySafeMessage(message, "Hasła nie są zgodne.");
            return;
        }

        // 3. Sprawdzenie siły hasła (Ujednolicona polityka)
        if (!validateStrongPassword(newPassword)) {
            displaySafeMessage(message, "Hasło nie spełnia wymogów bezpieczeństwa (min. 8 znaków, duża i mała litera, cyfra oraz znak specjalny).");
            return;
        }

        // Blokowanie przycisku i pokazanie loadera
        disableButton(button, "Resetowanie...");
        message.textContent = "";
        message.className = "form-message";

        try {
            const response = await fetch(AUTH_CONFIG.API.RESET_PASSWORD, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    token: token,
                    newPassword: newPassword,
                    confirmPassword: confirmPassword
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                displayMessage(message, "Hasło zostało pomyślnie zmienione. Za chwilę zostaniesz przekierowany do strony logowania.", true);
                
                // Przekierowanie do logowania (bezpieczne replace)
                redirectAfterDelay("/login", 2000);
            } else {
                const errorMsg = getErrorMessage(response, data);
                displayMessage(message, errorMsg);
            }

        } catch (err) {
            console.error("Błąd połączenia:", err);
            displaySafeMessage(message, "Nie udało się nawiązać połączenia z serwerem. Spróbuj ponownie za chwilę.");
        } finally {
            enableButton(button, '<i class="fas fa-key"></i><span>Ustaw nowe hasło</span>');
        }
    });
});
