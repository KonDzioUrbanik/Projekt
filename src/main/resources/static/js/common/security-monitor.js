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

    // Monitorowanie manipulacji DOM (Attributes Tampering)
    const originalDisabledDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'disabled')
        || Object.getOwnPropertyDescriptor(Element.prototype, 'disabled');

    if (originalDisabledDescriptor && originalDisabledDescriptor.set) {
        Object.defineProperty(HTMLElement.prototype, 'disabled', {
            get: originalDisabledDescriptor.get,
            set: function(value) {
                if (value === true) {
                    _appDisabled.add(this); // aplikacja blokuje element - zapamiętaj
                } else {
                    _appDisabled.delete(this); // aplikacja odblokowuje - usuń ze zbioru
                }
                originalDisabledDescriptor.set.call(this, value);
            },
            configurable: true
        });
    }

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // 2a. Monitorowanie atrybutów (Attributes Tampering)
            if (mutation.type === 'attributes') {
                const target = mutation.target;

                if (target.dataset.securityIgnore === 'true' || target.closest('.journey-overlay')) {
                    return;
                }

                // Odblokowanie elementu (disabled)
                if (mutation.attributeName === 'disabled' && !target.disabled) {
                    if (_appDisabled.has(target)) return;
                    if (target.tagName === 'BUTTON' && (target.querySelector('.fa-spinner') || target.querySelector('.fa-sync-alt'))) return;
                    sendThreatLog('DOM_TAMPERING', `Złośliwie odblokowano element: ${target.tagName}#${target.id || 'none'}`);
                }

                // Usunięcie blokady edycji (readonly)
                if (mutation.attributeName === 'readonly' && !target.readOnly && mutation.oldValue !== null) {
                    sendThreatLog('DOM_TAMPERING', `Usunięto blokadę edycji (readonly): ${target.tagName}#${target.id || 'none'}`);
                }

                // Próba zmiany typu pola (np. password -> text)
                if (mutation.attributeName === 'type' && mutation.oldValue && mutation.oldValue !== target.type) {
                    const sensitiveOldTypes = ['password', 'hidden'];
                    if (sensitiveOldTypes.includes(mutation.oldValue)) {
                        sendThreatLog('DOM_TAMPERING', `Zmiana typu elementu: ${target.tagName}#${target.id || 'none'} z ${mutation.oldValue} na ${target.type}`);
                    }
                }

                // Próba zmiany akcji formularza (Phishing/Data Exfiltration)
                if (mutation.attributeName === 'action' && target.tagName === 'FORM' && mutation.oldValue) {
                    sendThreatLog('FORM_HIJACKING', `Zmiana celu formularza: ${target.id || 'none'} z ${mutation.oldValue} na ${target.action}`);
                }

                // Próba zmiany źródła skryptu lub iframe
                if (mutation.attributeName === 'src' && (target.tagName === 'SCRIPT' || target.tagName === 'IFRAME') && mutation.oldValue) {
                    sendThreatLog('CODE_INJECTION', `Zmiana źródła ${target.tagName}: z ${mutation.oldValue} na ${target.src}`);
                }
            }

            // 2b. Monitorowanie dodawania nowych elementów (Child List Injection)
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element
                        if (node.tagName === 'SCRIPT' || node.tagName === 'IFRAME') {
                            // Ignoruj jeśli to nasze własne skrypty (można rozszerzyć o listę zaufanych domen)
                            const src = node.src || '';
                            if (src && !src.includes(window.location.hostname) && !src.startsWith('/') && !src.startsWith('data:')) {
                                sendThreatLog('CODE_INJECTION', `Wstrzyknięto podejrzany element ${node.tagName}: src=${src}`);
                            }
                        }
                    }
                });
            }
        });
    });

    // Start obserwacji (subtree: true pozwala patrzeć w głąb całego DOM)
    if (document.body) {
        observer.observe(document.body, { 
            attributes: true, 
            childList: true, // Wykrywanie nowych elementów
            subtree: true, 
            attributeFilter: ['disabled', 'readonly', 'type', 'action', 'src'],
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
