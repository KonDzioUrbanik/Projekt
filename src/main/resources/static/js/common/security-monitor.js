(function() {
    'use strict';

    /**
     * Client-Side Threat Intelligence Monitor
     * Przechwytuje i raportuje podejrzane aktywności do AdminSecurityAuditService.
     */

    // Debouncing, aby nie zalewać bazy wieloma raportami tego samego typu w krótkim czasie
    const _sentThreats = new Set();
    const _appDisabled = new WeakSet();
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
    const ignoreModifications = function(element) {
        if (element && element.dataset) {
            element.dataset.securityIgnore = 'true';
            setTimeout(() => {
                if (element && element.dataset) delete element.dataset.securityIgnore;
            }, 100);
        }
    };

    const originalSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) {
        if (['disabled', 'readonly', 'type', 'action', 'src'].includes(name.toLowerCase())) {
            ignoreModifications(this);
        }
        return originalSetAttribute.call(this, name, value);
    };

    const originalRemoveAttribute = Element.prototype.removeAttribute;
    Element.prototype.removeAttribute = function(name) {
        if (['disabled', 'readonly', 'type', 'action', 'src'].includes(name.toLowerCase())) {
            ignoreModifications(this);
        }
        return originalRemoveAttribute.call(this, name);
    };

    const patchDisabledProperty = (proto) => {
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'disabled');
        if (descriptor && descriptor.set && !proto._disabledPatched) {
            const originalSet = descriptor.set;
            Object.defineProperty(proto, 'disabled', {
                get: descriptor.get,
                set: function(value) {
                    if (value === true) {
                        _appDisabled.add(this);
                    } else {
                        _appDisabled.delete(this);
                    }
                    ignoreModifications(this);
                    originalSet.call(this, value);
                },
                configurable: true
            });
            proto._disabledPatched = true;
        }
    };

    [HTMLElement.prototype, HTMLButtonElement.prototype, HTMLInputElement.prototype, HTMLSelectElement.prototype, HTMLTextAreaElement.prototype].forEach(patchDisabledProperty);

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
                            const trustedDomains = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
                            const isTrusted = trustedDomains.some(domain => src.includes(domain));
                            
                            if (src && !src.includes(window.location.hostname) && !src.startsWith('/') && !src.startsWith('data:') && !isTrusted) {
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
