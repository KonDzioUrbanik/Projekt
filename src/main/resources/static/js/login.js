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
            message.className = "form-message error"; // Użycie klas CSS
            return;
        }

        // Włącz loader i zablokuj przycisk
        button.disabled = true;
        button.querySelector("span").textContent = "Logowanie...";
        message.textContent = "";
        message.className = "form-message";

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok){
                message.textContent = data.detail || "Nieprawidłowe dane logowania.";
                console.log(data.detail);
                message.className = "form-message error";
            } 
            else{
                message.textContent = "Zalogowano pomyślnie!";
                message.className = "form-message success";

                // Przekierowanie po chwili
                setTimeout(() => {
                    window.location.href = "/dashboard";
                }, 1000);
            }
        } catch (err) {
            console.error("Błąd logowania:", err);
            message.textContent = "Błąd połączenia z serwerem.";
            message.className = "form-message error";
        } 
        finally{
            // Odblokuj przycisk niezależnie od wyniku
            button.disabled = false;
            button.querySelector("span").textContent = "Zaloguj się";
        }
    });
});