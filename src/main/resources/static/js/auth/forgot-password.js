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
                // Zapisz timestamp i start cooldown
                localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
                
                // Pokaż modal sukcesu
                const overlay = document.createElement('div');
                overlay.className = 'success-overlay';
                overlay.onclick = (e) => e.stopPropagation();
                
                overlay.innerHTML = `
                    <div class="success-checkmark">
                        <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                            <circle class="checkmark-circle" cx="26" cy="26" r="25"/>
                            <path class="checkmark-check" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                        </svg>
                        <h3>Wysłano link!</h3>
                        <p>${data.message || "Na podany adres e-mail został wysłany link umożliwiający zresetowanie hasła. Sprawdź swoją skrzynkę odbiorczą."}</p>
                        <p style="margin-top: 15px; font-size: 0.9em; color: var(--text-light);">
                            Przekierowanie do logowania za <span id="redirectCountdown" style="font-weight: bold; color: var(--color-primary, #005efa);">5</span> s...
                        </p>
                    </div>
                `;

                document.body.appendChild(overlay);

                // Animacja wejścia
                setTimeout(() => overlay.classList.add('show'), 10);

                // Licznik
                let secondsLeft = 5;
                const countdownElement = document.getElementById('redirectCountdown');
                
                const interval = setInterval(() => {
                    secondsLeft--;
                    if (countdownElement) countdownElement.textContent = secondsLeft;
                    
                    if (secondsLeft <= 0) {
                        clearInterval(interval);
                        overlay.classList.remove('show');
                        setTimeout(() => overlay.remove(), 300);
                        window.location.href = '/login';
                    }
                }, 1000);
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
