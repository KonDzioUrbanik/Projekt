(function() {
    'use strict';

    const STORAGE_KEY = 'pans_portal_welcomed';

    function initWelcomeModal() {
        const hasBeenWelcomed = localStorage.getItem(STORAGE_KEY);
        
        if (!hasBeenWelcomed) {
            const overlay = document.getElementById('welcomeModalOverlay');
            const startBtn = document.getElementById('welcomeStartBtn');

            if (overlay && startBtn) {
                // Małe opóźnienie dla lepszego efektu
                setTimeout(() => {
                    overlay.classList.add('active');
                }, 800);

                startBtn.addEventListener('click', () => {
                    overlay.classList.remove('active');
                    localStorage.setItem(STORAGE_KEY, 'true');
                    
                    // Usuń z DOM po animacji
                    setTimeout(() => {
                        overlay.remove();
                    }, 500);
                });
            }
        }
    }

    // Inicjalizacja po załadowaniu DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWelcomeModal);
    } else {
        initWelcomeModal();
    }
})();
