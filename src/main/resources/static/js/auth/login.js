document.addEventListener("DOMContentLoaded", () => {

    const loginForm = document.getElementById("loginForm");
    const errorMessageContainer = document.getElementById("loginMessage"); 
    const loginButton = document.getElementById("loginButton");

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        // wyczyszczenie poprzednich komunikatow
        errorMessageContainer.innerHTML = '';
        errorMessageContainer.className = "form-message";

        let email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value.trim();

        // walidacja pol
        if(!email || !password){
            displayMessage(errorMessageContainer, "Uzupełnij wszystkie pola.");
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
                body: JSON.stringify({ email, password }),
            });

            let data = null;
            try{
                data = await response.json();
            } 
            catch{
                data = {};
            }

            // obsluga odpowiedzi HTTP
            if(response.ok){
                // SUKCES 
                displayMessage(errorMessageContainer, "Zalogowano pomyślnie!", true);
                
                // przekierowanie na strone dashboard
                redirectAfterDelay("/dashboard");
            } 
            else{
                // BŁĘDY
                const errorMsg = getErrorMessage(response, data);
                displayMessage(errorMessageContainer, errorMsg);
            }
        } 
        catch(error){
            console.error("Błąd połączenia:", error);
            displayMessage(errorMessageContainer, "Nie można połączyć się z serwerem.");
        } 
        finally{
            // odblokowanie przycisku
            enableButton(loginButton, "Zaloguj się");
        }
    });
});