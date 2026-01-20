document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("forgotPasswordForm");
    const message = document.getElementById("forgotMessage");
    const button = document.getElementById("forgotButton");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();

        // Walidacja pola
        if (!email){
            displayMessage(message, "Podaj adres e-mail.");
            return;
        }

        // Blokowanie przycisku i pokazanie loadera
        disableButton(button, "Wysyłanie...");
        message.textContent = "";
        message.className = "form-message";

        try{
            const response = await fetch(AUTH_CONFIG.API.FORGOT_PASSWORD, {
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
                displayMessage(message, data.message || "Na podany adres e-mail wysłano link resetujący.", true);
            }
            else{
                const errorMsg = getErrorMessage(response, data);
                displayMessage(message, errorMsg);
            }

        } 
        catch (err){
            console.error("Błąd połączenia:", err);
            displayMessage(message, "Nie można połączyć się z serwerem.");
        } 
        finally{
            enableButton(button, "Wyślij link resetujący");
        }
    });
});
