document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const message = document.getElementById("loginMessage");
    const button = document.getElementById("loginButton");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value.trim();

        if (!email || !password) {
            message.textContent = "Uzupełnij wszystkie pola.";
            message.style.color = "red";
            return;
        }

        // Włącz loader i zablokuj przycisk
        button.disabled = true;
        button.querySelector("span").textContent = "Logowanie...";
        message.textContent = "";

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            });

            // Próbujemy odczytać JSON (ProblemDetail przy błędzie lub UserResponseDto przy sukcesie)
            const data = await response.json();

            if (!response.ok) {
                // POPRAWKA: Używamy 'data.detail' (z ProblemDetail) zamiast 'data.message'
                message.textContent = data.detail || "Nieprawidłowe dane logowania.";
                message.style.color = "red";
            } else {
                // POPRAWKA: Usuwamy logikę JWT (token i localStorage)
                // Sesja jest zarządzana automatycznie przez cookie.
                message.textContent = "Zalogowano pomyślnie!";
                message.style.color = "green";

                // Przekierowanie po chwili
                setTimeout(() => {
                    window.location.href = "/dashboard";
                }, 1000);
            }
        } catch (err) {
            console.error("Błąd logowania:", err);
            message.textContent = "Błąd połączenia z serwerem.";
            message.style.color = "red";
        } finally {
            // Odblokuj przycisk niezależnie od wyniku
            button.disabled = false;
            button.querySelector("span").textContent = "Zaloguj się";
        }
    });
});