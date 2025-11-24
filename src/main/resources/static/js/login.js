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
            displayError("Uzupełnij wszystkie pola.");
            return;
        }

        // obsluga logowania za pomoca samego numeru albumu
        const onlyDigitsRegex = /^\d+$/;
        if (onlyDigitsRegex.test(email)) {
            email += "@student.kpu.krosno.pl";
        }

        // zablokowanie przycisku
        loginButton.disabled = true;

        try{
            const response = await fetch("/api/auth/login", {
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
                displayError("Zalogowano pomyślnie!", true);

                // przekierowanie na strone dashboard po 500ms
                setTimeout(() => {
                    window.location.href = "/dashboard";
                }, 500);
            } 
            else{
                // BŁĘDY
                let errorMsg = "Nieprawidłowe dane logowania.";

                switch (response.status){
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

                displayError(errorMsg);
            }
        } 
        catch(error){
            console.error("Błąd połączenia:", error);
            displayError("Nie można połączyć się z serwerem.");
        } 
        finally{
            // odblokowanie przycisku
            loginButton.disabled = false;
        }
    });

    function displayError(message, isSuccess = false){
        errorMessageContainer.innerHTML = message; 
        
        if(isSuccess){
            errorMessageContainer.className = "form-message success";
        } 
        else{
            errorMessageContainer.className = "form-message error";
        }
    }
});