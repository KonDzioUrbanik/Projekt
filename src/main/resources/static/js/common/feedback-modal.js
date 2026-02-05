'use strict';

/* FEEDBACK MODAL - Obsługa zgłaszania problemów */

const FeedbackModal = {
    // Konfiguracja
    CONFIG: {
        API: {
            SUBMIT: '/api/feedback'
        },
        MAX_DESCRIPTION_LENGTH: 1000
    },

    // Elementy DOM
    elements: null,

    // Inicjalizacja
    init() {
        this.cacheElements();
        this.attachEventListeners();
    },

    // Cachowanie elementów DOM
    // Cachowanie elementów DOM
    cacheElements() {
        this.elements = {
            btn: document.getElementById('feedbackBtn'),
            modal: document.getElementById('feedbackModal'),
            closeBtn: document.getElementById('closeFeedbackModal'),
            cancelBtn: document.getElementById('cancelFeedback'),
            form: document.getElementById('feedbackForm'),
            submitBtn: document.getElementById('submitFeedback'),
            message: document.getElementById('feedbackMessage'),
            description: document.getElementById('feedback-description'),
            charCount: document.getElementById('charCount'),
            fileInput: document.getElementById('feedback-file')
        };
    },

    // Podpięcie event listenerów
    attachEventListeners() {
        // Otwieranie modalu
        this.elements.btn.addEventListener('click', () => this.open());

        // Zamykanie modalu
        this.elements.closeBtn.addEventListener('click', () => this.close());
        this.elements.cancelBtn.addEventListener('click', () => this.close());
        
        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.elements.modal.classList.contains('active')) {
                this.close();
            }
        });

        // Licznik znaków
        this.elements.description.addEventListener('input', () => this.updateCharCount());

        // Walidacja pliku przy wyborze
        if (this.elements.fileInput) {
            this.elements.fileInput.addEventListener('change', (e) => this.validateFile(e.target));
        }

        // Submit formularza
        this.elements.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submit();
        });
    },

    validateFile(input) {
        const file = input.files[0];
        if (!file) return;

        // Walidacja rozmiaru (5MB)
        if (file.size > 5 * 1024 * 1024) {
            this.showMessage('Plik jest zbyt duży (maksymalnie 5MB).', 'error');
            input.value = ''; // Reset input
            return;
        }

        // Walidacja rozszerzenia
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf'];
        const fileName = file.name.toLowerCase();
        const isValid = allowedExtensions.some(ext => fileName.endsWith('.' + ext));

        if (!isValid) {
            this.showMessage('Niedozwolony format pliku. Dozwolone: jpg, jpeg, png, pdf.', 'error');
            input.value = ''; // Reset input
            return;
        }

        this.hideMessage();
    },

    // Otwieranie modalu
    open() {
        this.elements.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        this.hideMessage();
    },

    // Zamykanie modalu
    close() {
        this.elements.modal.classList.remove('active');
        document.body.style.overflow = '';
        this.reset();
    },

    // Reset formularza
    reset() {
        this.elements.form.reset();
        this.updateCharCount();
        this.hideMessage();
    },

    // Aktualizacja licznika znaków
    updateCharCount() {
        if (this.elements.description) {
            const length = this.elements.description.value.length;
            if (this.elements.charCount) {
                this.elements.charCount.textContent = length;
            }
        }
    },

    // Pokazywanie wiadomości
    showMessage(text, type = 'success') {
        this.elements.message.textContent = text;
        this.elements.message.className = `feedback-message ${type}`;
    },

    // Ukrywanie wiadomości
    hideMessage() {
        this.elements.message.className = 'feedback-message';
    },

    // Wysyłanie formularza
    async submit() {
        const submitBtn = this.elements.submitBtn;
        const formData = new FormData(this.elements.form);
        
        // Dodatkowe metadane
        formData.append('url', window.location.href);
        formData.append('userAgent', navigator.userAgent);

        // Pobranie wartości do walidacji
        const title = formData.get('title')?.trim();
        const description = formData.get('description')?.trim();
        const file = formData.get('file');

        // Walidacja
        if (!title || !description) {
            this.showMessage('Wszystkie wymagane pola muszą zostać wypełnione.', 'error');
            return;
        }

        if (title.length < 5) {
            this.showMessage('Tytuł musi zawierać minimum 5 znaków.', 'error');
            return;
        }

        if (description.length < 10) {
            this.showMessage('Opis musi zawierać minimum 10 znaków.', 'error');
            return;
        }

        // Walidacja pliku (rozmiar)
        if (file && file.size > 0 && file.size > 5 * 1024 * 1024) { // 5MB
            this.showMessage('Plik jest zbyt duży (maksymalnie 5MB).', 'error');
            return;
        }

        // Disable button
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Wysyłanie...';

        try {
            const response = await fetch(this.CONFIG.API.SUBMIT, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                // Próba odczytania komunikatu błędu z backendu
                let errorMsg = 'Błąd serwera';
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorMsg;
                } catch(e) {
                    // Fallback to text if not JSON
                    try {
                         const text = await response.text();
                         if(text) errorMsg = text;
                    } catch(e2) {}
                }
                throw new Error(errorMsg);
            }

            const result = await response.json();

            // Sukces
            this.showMessage('Dziękujemy za zgłoszenie. Wkrótce się tym zajmiemy.', 'success');
            
            // Zamknięcie modalu po 2 sekundach
            setTimeout(() => {
                this.close();
            }, 2000);

        } 
        catch (error) {
            console.error('Błąd wysyłania zgłoszenia:', error);
            this.showMessage(error.message || 'Nie udało się wysłać zgłoszenia. Sprawdź połączenie internetowe i spróbuj ponownie.', 'error');
        } 
        finally {
            // Enable button
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Wyślij';
        }
    }
};

// Inicjalizacja po załadowaniu DOM
document.addEventListener('DOMContentLoaded', () => {
    FeedbackModal.init();
});
