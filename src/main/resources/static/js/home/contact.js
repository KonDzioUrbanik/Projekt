/* Skrypt obsługujący formularz kontaktowy */

document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('publicContactForm');
    const submitBtn = document.getElementById('submitContactBtn');
    const btnText = submitBtn?.querySelector('.btn-text');
    const spinner = document.getElementById('submitSpinner');

    // Elementy Modala
    const statusModal = document.getElementById('statusModal');
    const modalIconWrap = document.getElementById('modalIconWrap');
    const modalIcon = document.getElementById('modalIcon');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    
    let isSuccessState = false;

    // Funkcja do pokazywania modala
    function showModal(type, title, message) {
        if (!statusModal) return;
        
        // Zmień zawartość i ikony w zależności od typu
        if (type === 'success') {
            modalIconWrap.className = 'modal-icon-wrap success';
            modalIcon.className = 'fas fa-check';
            isSuccessState = true;
        } else {
            modalIconWrap.className = 'modal-icon-wrap error';
            modalIcon.className = 'fas fa-exclamation';
            isSuccessState = false;
        }

        modalTitle.textContent = title;
        modalMessage.textContent = message;

        // Pokaż modal usuwając .d-none i dodając .show
        statusModal.classList.remove('d-none');
        // Małe opóźnienie by animacja CSS zadziałała
        setTimeout(() => {
            statusModal.classList.add('show');
        }, 10);
    }

    // Zamknięcie modala
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', function() {
            statusModal.classList.remove('show');
            setTimeout(() => {
                statusModal.classList.add('d-none');
                
                // Jeśli sukces, to przekieruj po zamknięciu modala
                if (isSuccessState) {
                    window.location.href = '/';
                }
            }, 300); // 300ms odpowiada czasowi transition w CSS
        });
    }

    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            // Zabezpieczenie przed podwójnym wysłaniem
            if (submitBtn.disabled) return;

            // Zmiana stanu przycisku
            submitBtn.disabled = true;
            if (btnText) btnText.classList.add('d-none');
            if (spinner) spinner.classList.remove('d-none');

            const formData = new FormData(contactForm);

            try {
                // Fetch request na publiczny endpoint API
                const response = await fetch('/api/feedback', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    // Próba odczytania JSONa od serwera (np. komunikat 429 Too Many Requests)
                    let errorData;
                    try {
                        errorData = await response.json();
                    } catch (parseErr) {
                        throw new Error(`Wystąpił błąd po stronie serwera (Kod: ${response.status}). Spróbuj ponownie później.`);
                    }
                    // Jeśli response.ok = false i json poprawnie zwrócony, rzuć błąd z message pochodzącym z serwera
                    throw new Error(errorData.message || 'Wystąpił nieoczekiwany błąd serwera.');
                }

                // Sukces
                const data = await response.json();
                
                // Pokaż Modal
                showModal('success', 'Wysłano pomyślnie!', 'Twoje zgłoszenie zostało wysłane do administracji serwisu. Otrzymasz odpowiedź tak szybko, jak to możliwe.');
                
                // Czyszczenie formularza i przywracanie domyślnej kategorii
                contactForm.reset();
                document.getElementById('contactType').value = 'OTHER';

            } catch (error) {
                console.error('Błąd podczas wysyłania zgłoszenia:', error);
                const errorMsg = error.message || 'Brak zasięgu lub błąd sieci. Spróbuj ponownie później.';
                
                showModal('error', 'Wystąpił błąd', errorMsg);
            } finally {
                // Przywracanie stanu przycisku
                submitBtn.disabled = false;
                if (btnText) btnText.classList.remove('d-none');
                if (spinner) spinner.classList.add('d-none');
            }
        });
    }
});
