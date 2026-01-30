document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("forgotPasswordForm");
    const message = document.getElementById("forgotMessage");
    const button = document.getElementById("forgotButton");

    const COOLDOWN_KEY = 'lastPasswordResetRequest';
    const COOLDOWN_SECONDS = 60;

    // Sprawdź cooldown przy załadowaniu strony
    checkCooldownOnLoad();

    function checkCooldownOnLoad() {
        const lastRequest = localStorage.getItem(COOLDOWN_KEY);
        if (!lastRequest) return;

        const lastRequestTime = parseInt(lastRequest, 10);
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - lastRequestTime) / 1000);
        const remainingSeconds = COOLDOWN_SECONDS - elapsedSeconds;

        if (remainingSeconds > 0) {
            // Wznów cooldown
            startCooldown(remainingSeconds);
        } else {
            // Cooldown minął, usuń z localStorage
            localStorage.removeItem(COOLDOWN_KEY);
        }
    }

    function startCooldown(seconds) {
        let remaining = seconds;
        button.disabled = true;
        button.style.opacity = '0.6';
        button.style.cursor = 'not-allowed';

        const interval = setInterval(() => {
            if (remaining <= 0) {
                clearInterval(interval);
                button.style.opacity = '';
                button.style.cursor = '';
                enableButton(button, "Wyślij link resetujący");
                localStorage.removeItem(COOLDOWN_KEY);
            } else {
                button.innerHTML = `<span>Wyślij ponownie (${remaining}s)</span>`;
                remaining--;
            }
        }, 1000);
    }

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
                displayMessage(message, data.message || "Na podany adres e-mail został wysłany link umożliwiający zresetowanie hasła. Sprawdź swoją skrzynkę odbiorczą.", true);
                
                // Zapisz timestamp i start cooldown
                localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
                startCooldown(COOLDOWN_SECONDS);
            }
            else if (response.status === 429) {
                // Rate limiting - parsuj ile sekund pozostało z komunikatu
                const errorMsg = data.message || data.detail || "";
                const match = errorMsg.match(/(\d+)\s+sekund/);
                const remainingSeconds = match ? parseInt(match[1], 10) : COOLDOWN_SECONDS;
                
                // NIE wyświetlaj error message, od razu start cooldown na przycisku
                message.textContent = "";
                message.className = "form-message";
                
                // Zapisz timestamp (cofnięty o różnicę pozostałych sekund)
                const adjustedTimestamp = Date.now() - ((COOLDOWN_SECONDS - remainingSeconds) * 1000);
                localStorage.setItem(COOLDOWN_KEY, adjustedTimestamp.toString());
                
                startCooldown(remainingSeconds);
            }
            else{
                const errorMsg = getErrorMessage(response, data);
                displayMessage(message, errorMsg);
                enableButton(button, "Wyślij link resetujący");
            }

        } 
        catch (err){
            console.error("Błąd połączenia:", err);
            displayMessage(message, "Nie udało się nawiązać połączenia z serwerem. Sprawdź swoje połączenie internetowe i spróbuj ponownie.");
            enableButton(button, "Wyślij link resetujący");
        }
    });
});
