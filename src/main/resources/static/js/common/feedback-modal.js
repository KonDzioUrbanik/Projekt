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
            charCount: document.getElementById('charCount')
        };
    },

    // Podpięcie event listenerów
    attachEventListeners() {
        // Otwieranie modalu
        this.elements.btn.addEventListener('click', () => this.open());

        // Zamykanie modalu
        this.elements.closeBtn.addEventListener('click', () => this.close());
        this.elements.cancelBtn.addEventListener('click', () => this.close());
        // this.elements.modal.addEventListener('click', (e) => {
        //     if (e.target === this.elements.modal) this.close();
        // });

        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.elements.modal.classList.contains('active')) {
                this.close();
            }
        });

        // Licznik znaków
        this.elements.description.addEventListener('input', () => this.updateCharCount());

        // Submit formularza
        this.elements.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submit();
        });
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
        const length = this.elements.description.value.length;
        this.elements.charCount.textContent = length;
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

        // Dane formularza
        const data = {
            type: formData.get('type'),
            title: formData.get('title').trim(),
            description: formData.get('description').trim(),
            email: formData.get('email')?.trim() || null,
            url: window.location.href,
            userAgent: navigator.userAgent
        };

        // Walidacja
        if (!data.title || !data.description) {
            this.showMessage('Wszystkie wymagane pola muszą zostać wypełnione.', 'error');
            return;
        }

        if (data.title.length < 5) {
            this.showMessage('Tytuł musi zawierać minimum 5 znaków.', 'error');
            return;
        }

        if (data.description.length < 10) {
            this.showMessage('Opis musi zawierać minimum 10 znaków.', 'error');
            return;
        }

        // Disable button
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Wysyłanie...';

        try {
            const response = await fetch(this.CONFIG.API.SUBMIT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error('Błąd serwera');
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
            this.showMessage('Nie udało się wysłać zgłoszenia. Sprawdź połączenie internetowe i spróbuj ponownie.', 'error');
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
