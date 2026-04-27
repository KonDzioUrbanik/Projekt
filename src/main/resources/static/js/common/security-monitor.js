(function() {
    'use strict';

    /**
     * Client-Side Threat Intelligence Monitor
     * Przechwytuje i raportuje podejrzane aktywności do AdminSecurityAuditService.
     */

    // Debouncing, aby nie zalewać bazy wieloma raportami tego samego typu w krótkim czasie
    const _sentThreats = new Set();
    const sendThreatLog = (type, details) => {
        const key = `${type}:${details}`;
        if (_sentThreats.has(key)) return;
        
        _sentThreats.add(key);
        setTimeout(() => _sentThreats.delete(key), 30000); // Zapomnij po 30s

        fetch('/api/security/report-threat', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ type: type, details: details })
        }).catch(() => { /* Cicho ignorujemy błędy wysyłki sieciowej */ });
    };

    // 1. Monitorowanie pól tekstowych (Input Honeypot)
    document.addEventListener('change', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            const val = (e.target.value || '').toLowerCase();
            if (val.length < 4) return;

            const suspiciousPatterns = [
                { reg: /<script|javascript:|alert\(|onerror=/i, type: 'XSS_ATTEMPT' },
                { reg: /union select|drop table|truncate |or 1=1|--|; waitfor delay/i, type: 'SQLI_ATTEMPT' }
            ];

            for (const pattern of suspiciousPatterns) {
                if (pattern.reg.test(val)) {
                    sendThreatLog(pattern.type, `Podejrzany wpis w ${e.target.name || e.target.id || 'polu'}: ${val.substring(0, 50)}...`);
                    break;
                }
            }
        }
    });

    // 2. Monitorowanie manipulacji DOM (Attributes Tampering)
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes') {
                const target = mutation.target;

                // WYJĄTEK: Nie raportujemy zmian dla elementów ignorowanych lub przycisków w trakcie ładowania
                if (target.dataset.securityIgnore === 'true' || 
                    target.closest('.journey-overlay') || // Ignoruj zmiany w samym modalu analityki
                    (target.tagName === 'BUTTON' && (target.querySelector('.fa-spinner') || target.querySelector('.fa-sync-alt')))) {
                    return;
                }

                // Ktoś odblokował przycisk lub pole zablokowane przez system
                if (mutation.attributeName === 'disabled' && !target.disabled) {
                    // Sprawdzamy czy to nie jest zwykłe odblokowanie po zakończeniu akcji (np. fetch)
                    // Prawdziwy haker odblokowuje pole, które zwykle nie ma ikony ładowania.
                    sendThreatLog('DOM_TAMPERING', `Złośliwie odblokowano element: ${target.tagName}#${target.id || 'none'}`);
                }
                // Próba zmiany typu pola (np. z hidden na text lub z password na text)
                if (mutation.attributeName === 'type' && mutation.oldValue) {
                    sendThreatLog('DOM_TAMPERING', `Zmiana typu elementu: ${target.tagName}#${target.id || 'none'} z ${mutation.oldValue} na ${target.type}`);
                }
            }
        });
    });

    // Start obserwacji (subtree: true pozwala patrzeć w głąb całego DOM)
    if (document.body) {
        observer.observe(document.body, { 
            attributes: true, 
            subtree: true, 
            attributeFilter: ['disabled', 'readonly', 'type'],
            attributeOldValue: true
        });
    }

    // 3. Monitorowanie błędów krytycznych (Frontend Error Leak)
    window.addEventListener('error', (event) => {
        // Ignorujemy błędy rozszerzeń lub banalne 
        if (!event.message || event.message.includes('Extension')) return;
        
        sendThreatLog('FRONTEND_ERROR', `Błąd JS: ${event.message} w ${event.filename || 'unknown'}:${event.lineno || 0}`);
    });
})();
