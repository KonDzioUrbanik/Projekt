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

            const data = await response.json();

            if (!response.ok) {
                message.textContent = data.message || "Nieprawidłowe dane logowania.";
                message.style.color = "red";
            } else {
                const token = data.token || data.accessToken;
                localStorage.setItem("jwtToken", token);
                message.textContent = "Zalogowano pomyślnie!";
                message.style.color = "green";

                // przekierowanie po chwili
                setTimeout(() => {
                    window.location.href = "/";
                }, 1000);
            }
        } catch (err) {
            console.error("Błąd logowania:", err);
            message.textContent = "Błąd połączenia z serwerem.";
            message.style.color = "red";
        } finally {
            button.disabled = false;
            button.querySelector("span").textContent = "Zaloguj się";
        }
    });
});
