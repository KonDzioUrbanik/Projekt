document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("forgotPasswordForm");
    const message = document.getElementById("forgotMessage");
    const button = document.getElementById("forgotButton");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();

        // Walidacja pola
        if (!email){
            displayMessage(message, "Pole adresu e-mail jest wymagane.");
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
                displayMessage(message, data.message || "Na podany adres e-mail został wysłany link umożliwiający zresetowanie hasła. Sprawdź swoją skrzynkę odbiorcą.", true);
            }
            else{
                const errorMsg = getErrorMessage(response, data);
                displayMessage(message, errorMsg);
            }

        } 
        catch (err){
            console.error("Błąd połączenia:", err);
            displayMessage(message, "Nie udało się nawiązać połączenia z serwerem. Sprawdź swoje połączenie internetowe i spróbuj ponownie.");
        } 
        finally{
            enableButton(button, "Wyślij link resetujący");
        }
    });
});
