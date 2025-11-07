document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("forgotPasswordForm");
    const message = document.getElementById("forgotMessage");
    const button = document.getElementById("forgotButton");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();

        // Walidacja pola
        if (!email){
            message.textContent = "Podaj adres e-mail.";
            message.className = "form-message error";
            return;
        }

        // Blokowanie przycisku i pokazanie loadera
        button.disabled = true;
        button.querySelector("span").textContent = "Wysyłanie...";
        message.textContent = "";
        message.className = "form-message";

        try{
            const response = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            let data = {};
            try{
                data = await response.json();
            } 
            catch{
                data = {};
            }

            if(response.ok){
                message.textContent = data.message || "Na podany adres e-mail wysłano link resetujący.";
                message.className = "form-message success";
            }
            else{
                let errorMsg = "Nie udało się wysłać linku resetującego.";

                switch (response.status) {
                    case 400:
                        errorMsg = data.message || "Nieprawidłowy adres e-mail.";
                        break;
                    case 401:
                        errorMsg = data.message || "To konto użytkownika nie jest aktywowane.";
                        break;
                    case 404:
                        errorMsg = data.message || "Nie znaleziono użytkownika o podanym adresie e-mail.";
                        break;
                    case 500:
                        errorMsg = "Błąd serwera. Spróbuj ponownie później.";
                        break;
                }

                message.textContent = errorMsg;
                message.className = "form-message error";
            }

        } 
        catch (err){
            console.error("Błąd połączenia:", err);
            message.textContent = "Nie można połączyć się z serwerem.";
            message.className = "form-message error";
        } 
        finally{
            button.disabled = false;
            button.querySelector("span").textContent = "Wyślij link resetujący";
        }
    });
});
