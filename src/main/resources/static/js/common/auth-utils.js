/* WSPÓLNE NARZĘDZIA DLA MODUŁÓW AUTORYZACJI */

const AUTH_CONFIG = {
    API: {
        LOGIN: '/api/auth/login',
        REGISTER: '/api/auth/register',
        FORGOT_PASSWORD: '/api/auth/reset-password/request',
        RESET_PASSWORD: '/api/auth/reset-password/reset'
    },
    TIMING: {
        REDIRECT_DELAY: 500,
        BUTTON_DISABLE_TIMEOUT: 3000
    },
    REGEX: {
        STUDENT_EMAIL: /^\d+@student\.kpu\.krosno\.pl$/,
        ONLY_DIGITS: /^\d+$/,
        EMAIL_BASIC: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    DOMAINS: {
        STUDENT: '@student.kpu.krosno.pl'
    }
};

/* Wyświetla komunikat błędu lub sukcesu w kontenerze */
function displayMessage(container, message, isSuccess = false) {
    if (!container) {
        console.error('Brak kontenera dla komunikatu');
        return;
    }
    
    container.innerHTML = message;
    container.className = isSuccess ? 'form-message success' : 'form-message error';
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
            span.textContent = text;
        } else {
            button.textContent = text;
        }
    }
}

/* Włącza przycisk i przywraca jego tekst */
function enableButton(button, text) {
    if (button) {
        button.disabled = false;
        const span = button.querySelector('span');
        if (span) {
            span.textContent = text;
        } else {
            button.textContent = text;
        }
    }
}

/* Przekierowuje na podany URL po opóźnieniu */
function redirectAfterDelay(url, delay = AUTH_CONFIG.TIMING.REDIRECT_DELAY) {
    setTimeout(() => {
        window.location.href = url;
    }, delay);
}

/* Obsługuje błędy HTTP i zwraca odpowiedni komunikat */
function getErrorMessage(response, data = {}) {
    let errorMsg = 'Wystąpił nieoczekiwany błąd.';
    
    switch (response.status) {
        case 400:
            errorMsg = data.message || 'Nieprawidłowe dane formularza.';
            break;
        case 401:
            errorMsg = data.message || 'Nieprawidłowe dane uwierzytelniające.';
            break;
        case 403:
            errorMsg = data.message || 'Brak uprawnień.';
            break;
        case 404:
            errorMsg = data.message || 'Usługa niedostępna.';
            break;
        case 500:
            errorMsg = 'Błąd serwera. Spróbuj ponownie później.';
            break;
        default:
            errorMsg = data.message || data.detail || 'Wystąpił nieoczekiwany błąd.';
    }
    
    // Dodanie listy błędów walidacji, jeśli istnieje
    if (data.errors && Array.isArray(data.errors)) {
        errorMsg += '<ul>';
        data.errors.forEach(err => {
            errorMsg += `<li>${err}</li>`;
        });
        errorMsg += '</ul>';
    }
    
    return errorMsg;
}
