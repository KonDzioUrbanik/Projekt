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
    
    // Escapowanie HTML dla bezpieczeństwa (XSS prevention)
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
    let errorMsg = 'Wystąpił nieoczekiwany błąd. Proszę skontaktować się z administratorem, jeśli problem będzie się powtarzać.';
    
    switch (response.status) {
        case 400:
            errorMsg = data.message || 'Nieprawidłowe dane formularza. Sprawdź poprawność wypełnienia wszystkich pól.';
            break;
        case 401:
            errorMsg = data.message || 'Nieprawidłowe dane uwierzytelniające. Sprawdź adres e-mail i hasło.';
            break;
        case 403:
            errorMsg = data.message || 'Nie masz uprawnień do wykonania tej operacji.';
            break;
        case 404:
            errorMsg = data.message || 'Usługa jest tymczasowo niedostępna. Spróbuj ponownie za chwilę.';
            break;
        case 500:
            errorMsg = 'Błąd serwera. Spróbuj ponownie później lub skontaktuj się z administratorem.';
            break;
        default:
            errorMsg = data.message || data.detail || 'Wystąpił nieoczekiwany błąd. Proszę skontaktować się z administratorem, jeśli problem będzie się powtarzać.';
    }
    
    // Escapowanie głównego komunikatu
    let safeErrorMsg = escapeHtmlForAuth(errorMsg);
    
    // Dodanie listy błędów walidacji, jeśli istnieje (każdy element escapowany)
    if (data.errors && Array.isArray(data.errors)) {
        safeErrorMsg += '<ul>';
        data.errors.forEach(err => {
            safeErrorMsg += `<li>${escapeHtmlForAuth(err)}</li>`;
        });
        safeErrorMsg += '</ul>';
    }
    
    return safeErrorMsg;
}
