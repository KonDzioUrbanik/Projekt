document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const message = document.getElementById("loginMessage");
    const button = document.getElementById("loginButton");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value.trim();

        // Walidacja pól
        if (!email || !password) {
            message.textContent = "Uzupełnij wszystkie pola.";
            message.className = "form-message error";
            return;
        }

        // Blokuj przycisk i pokaż loader
        button.disabled = true;
        button.querySelector("span").textContent = "Logowanie...";
        message.textContent = "";
        message.className = "form-message";

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            let data = null;
            try {
                data = await response.json();
            } catch {
                // jeśli backend zwróci pustą odpowiedź
                data = {};
            }

            // Obsługa odpowiedzi HTTP
            if (response.ok){
                message.textContent = "Zalogowano pomyślnie!";
                message.className = "form-message success";

                // Przekierowanie po 1s
                setTimeout(() => {
                    window.location.href = "/dashboard";
                }, 500);
            } else {
                // Obsługa statusów błędów
                let errorMsg = "Nieprawidłowe dane logowania.";

                switch (response.status) {
                    case 400:
                        errorMsg = data.message || "Nieprawidłowe dane formularza.";
                        break;
                    case 401:
                        errorMsg = data.message || "Nieprawidłowy e-mail lub hasło.";
                        break;
                    case 403:
                        errorMsg = data.message || "Brak uprawnień do logowania.";
                        break;
                    case 404:
                        errorMsg = "Usługa logowania niedostępna (404).";
                        break;
                    case 500:
                        errorMsg = "Błąd serwera. Spróbuj ponownie później.";
                        break;
                    default:
                        errorMsg = data.message || "Wystąpił nieoczekiwany błąd.";
                }

                message.textContent = errorMsg;
                message.className = "form-message error";
            }
        } catch (err) {
            console.error("Błąd połączenia:", err);
            message.textContent = "Nie można połączyć się z serwerem.";
            message.className = "form-message error";
        } finally {
            // Odblokowanie przycisku
            button.disabled = false;
            button.querySelector("span").textContent = "Zaloguj się";
        }
    });
});
