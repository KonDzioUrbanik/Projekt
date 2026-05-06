'use strict';

/* WSPÓLNE NARZĘDZIA DLA MODUŁÓW AUTORYZACJI */

const AUTH_CONFIG = {
    API: {
        LOGIN: '/api/auth/login',
        REGISTER: '/api/auth/register',
        FORGOT_PASSWORD: '/api/auth/forgot-password',
        RESET_PASSWORD: '/api/auth/reset-password'
    },
    TIMING: {
        REDIRECT_DELAY: 500,
        BUTTON_DISABLE_TIMEOUT: 3000
    },
    REGEX: {
        // Akceptujemy domenę uczelnianą
        STUDENT_EMAIL: /^\d+@student\.kpu\.krosno\.pl$/,
        ONLY_DIGITS: /^\d+$/,
        EMAIL_BASIC: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        // Ujednolicony regex dla silnego hasła: min 8 znaków, duża, mała, cyfra, znak specjalny
        STRONG_PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$#!%*?&])[A-Za-z\d@$#!%*?&]{8,}$/
    },
    DOMAINS: {
        STUDENT: '@student.kpu.krosno.pl'
    }
};

/**
 * Ujednolicona walidacja siły hasła
 */
function validateStrongPassword(password) {
    return AUTH_CONFIG.REGEX.STRONG_PASSWORD.test(password);
}

/**
 * Inicjalizuje przełącznik widoczności hasła (oczko)
 */
function initPasswordToggle(inputId, toggleId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    
    if (input && toggle) {
        toggle.addEventListener('click', function() {
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }
}

/* Wyświetla komunikat HTML w kontenerze (tylko dla zaufanego HTML) */
function displayMessage(container, message, isSuccess = false) {
    if (!container) return;
    container.innerHTML = message;
    container.className = isSuccess ? 'form-message success' : 'form-message error';
    container.setAttribute('role', 'alert');
    container.setAttribute('aria-live', isSuccess ? 'polite' : 'assertive');
}

/* Bezpieczna wersja displayMessage dla czystego tekstu (ZAPOBIEGA XSS) */
function displaySafeMessage(container, text, isSuccess = false) {
    if (!container) return;
    container.textContent = text;
    container.className = isSuccess ? 'form-message success' : 'form-message error';
    container.setAttribute('role', 'alert');
    container.setAttribute('aria-live', isSuccess ? 'polite' : 'assertive');
}

/* Konwertuje numer albumu na pełny adres email studenta */
function convertToStudentEmail(input) {
    const trimmedInput = input.trim();
    
    // Jeśli to same cyfry, dodaj domenę studencką
    if (AUTH_CONFIG.REGEX.ONLY_DIGITS.test(trimmedInput)) {
        return trimmedInput + AUTH_CONFIG.DOMAINS.STUDENT;
    }
    
    return trimmedInput;
}

/* Waliduje format emaila studenckiego */
function validateStudentEmail(email) {
    return AUTH_CONFIG.REGEX.STUDENT_EMAIL.test(email);
}

/* Wyłącza przycisk i zmienia jego tekst */
function disableButton(button, text) {
    if (button) {
        button.disabled = true;
        const span = button.querySelector('span');
        if (span) {
            span.dataset.oldHtml = span.innerHTML;
            span.textContent = text;
        } else {
            button.dataset.oldHtml = button.innerHTML;
            button.textContent = text;
        }
    }
}

/* Włącza przycisk i przywraca jego tekst */
function enableButton(button, text = null) {
    if (button) {
        button.disabled = false;
        const oldHtml = button.dataset.oldHtml;
        const span = button.querySelector('span');
        
        if (text) {
            if (span) span.innerHTML = text;
            else button.innerHTML = text;
        } else if (oldHtml) {
            if (span) span.innerHTML = oldHtml;
            else button.innerHTML = oldHtml;
        }
    }
}

/* Przekierowuje na podany URL po opóźnieniu przy użyciu replace (lepsze dla Security) */
function redirectAfterDelay(url, delay = AUTH_CONFIG.TIMING.REDIRECT_DELAY) {
    setTimeout(() => {
        window.location.replace(url);
    }, delay);
}

/* Escapuje HTML - helper dla komunikatów błędów */
function escapeHtmlForAuth(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* Obsługuje błędy HTTP i zwraca odpowiedni komunikat */
function getErrorMessage(response, data = {}) {
    let errorMsg = 'Wystąpił nieoczekiwany błąd. Proszę skontaktować się z administratorem.';
    
    switch (response.status) {
        case 400:
            errorMsg = data.message || 'Nieprawidłowe dane formularza.';
            break;
        case 401:
            errorMsg = data.message || 'Nieprawidłowy e-mail lub hasło.';
            break;
        case 403:
            errorMsg = data.message || 'Brak uprawnień do wykonania tej operacji.';
            break;
        case 404:
            errorMsg = data.message || 'Zasób nie został znaleziony.';
            break;
        case 429:
            errorMsg = data.message || 'Zbyt wiele prób. Spróbuj ponownie za chwilę.';
            break;
        case 500:
            errorMsg = data.reason || data.message || 'Wewnętrzny błąd serwera.';
            break;
        default:
            errorMsg = data.message || data.detail || errorMsg;
    }
    
    let safeErrorMsg = escapeHtmlForAuth(errorMsg);
    
    if (data.errors && Array.isArray(data.errors)) {
        safeErrorMsg += '<ul class="error-list">';
        data.errors.forEach(err => {
            safeErrorMsg += `<li>${escapeHtmlForAuth(err)}</li>`;
        });
        safeErrorMsg += '</ul>';
    }
    
    return safeErrorMsg;
}
