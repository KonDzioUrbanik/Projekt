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

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const newPassword = newPasswordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();

        // Walidacja pól
        if (!newPassword || !confirmPassword) {
            displayMessage(message, "Wszystkie pola są wymagane.");
            return;
        }

        // Sprawdzenie minimalnej długości hasła
        if (newPassword.length < 6) {
            displayMessage(message, "Hasło musi zawierać co najmniej 6 znaków.");
            return;
        }

        // Sprawdzenie zgodności haseł
        if (newPassword !== confirmPassword) {
            displayMessage(message, "Hasła nie są zgodne.");
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

            let data = {};
            try {
                data = await response.json();
            } catch {
                data = {};
            }

            if (response.ok) {
                displayMessage(message, "Hasło zostało pomyślnie zmienione. Za chwilę zostaniesz przekierowany do strony logowania.", true);
                
                // Przekierowanie do logowania po 2 sekundach
                setTimeout(() => {
                    window.location.href = "/login";
                }, 2000);
            } else {
                const errorMsg = getErrorMessage(response, data);
                displayMessage(message, errorMsg);
            }

        } catch (err) {
            console.error("Błąd połączenia:", err);
            displayMessage(message, "Nie udało się nawiązać połączenia z serwerem. Sprawdź swoje połączenie internetowe i spróbuj ponownie.");
        } finally {
            enableButton(button, '<i class="fas fa-key"></i><span>Ustaw nowe hasło</span>');
        }
    });
});
