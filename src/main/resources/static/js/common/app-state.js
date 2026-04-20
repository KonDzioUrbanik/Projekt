(function () {
    'use strict';

    // 1. Defensywne pobieranie ról
    var roleMeta = document.querySelector('meta[name="user-role"]');
    var userRole = roleMeta ? roleMeta.getAttribute('content') : '';
    var isAdmin = (userRole === 'ROLE_ADMIN' || userRole === 'ADMIN');

    // 2. Konfiguracja i Cache CSRF (pobierany raz na starcie)
    var ENDPOINT = '/api/preferences/sync';
    var SESSION_KEY = 'pans_state_sid';
    var SESSION_TS_KEY = 'pans_state_ts';
    var SESSION_TTL = 30 * 60 * 1000;
    var IDLE_TIMEOUT = 5 * 60 * 1000;
    
    var csrfMeta = document.querySelector('meta[name="_csrf"]');
    var csrfHeaderMeta = document.querySelector('meta[name="_csrf_header"]');
    var CSRF_TOKEN = csrfMeta ? csrfMeta.getAttribute('content') : '';
    var CSRF_HEADER = csrfHeaderMeta ? csrfHeaderMeta.getAttribute('content') : 'X-CSRF-TOKEN';

    // 3. Stan sesji i liczników
    var sessionId = getOrCreateSession();
    var eventCount = 0;
    var lastReset = Date.now();
    var lastActivity = Date.now();
    var activeTimeMs = 0;
    var lastActiveStart = Date.now();
    var sentMarkers = {};
    var recentClicks = {}; 
    var scrollTicking = false;

    function getOrCreateSession() {
        var sid = localStorage.getItem(SESSION_KEY);
        var ts = parseInt(localStorage.getItem(SESSION_TS_KEY) || '0', 10);
        var now = Date.now();

        if (!sid || (now - ts > SESSION_TTL)) {
            try { sid = crypto.randomUUID(); }
            catch (e) { sid = now.toString(36) + Math.random().toString(36).slice(2); }
            localStorage.setItem(SESSION_KEY, sid);
        }
        localStorage.setItem(SESSION_TS_KEY, now.toString());
        return sid;
    }

    function getPagePath() {
        return window.location.pathname + window.location.search;
    }

    function sanitize(str, max) {
        if (!str) return '';
        var clean = str.replace(/\s+/g, ' ').trim();
        return clean.length <= max ? clean : clean.substring(0, max);
    }

    // 4. Główna funkcja wysyłająca - używa fetch + keepalive
    function sendEvent(eventType, eventName, durationMs, pageOverride) {
        var now = Date.now();
        if (now - lastReset > 60000) {
            eventCount = 0;
            lastReset = now;
        }
        if (eventCount >= 100) return; // Rate limit
        eventCount++;

        // Nie śledzimy aktywności ADMINów (oprócz błędów)
        if (isAdmin && eventType !== 'ERROR') return;

        var payload = {
            sessionId: sessionId,
            eventType: eventType,
            page: pageOverride || getPagePath(),
            eventName: eventName ? sanitize(eventName, 255) : null,
            durationMs: durationMs != null ? Math.round(durationMs) : null
        };

        var headers = { 'Content-Type': 'application/json' };
        if (CSRF_TOKEN) headers[CSRF_HEADER] = CSRF_TOKEN;

        fetch(ENDPOINT, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload),
            keepalive: true 
        }).catch(function() {
            // Ciche ignorowanie błędu (keepalive i tak wyśle żądanie w tle przy nawigacji)
        });
    }

    // 5. Śledzenie odsłon (SPA i Standard)
    function trackPageView(isSPA) {
        if (isSPA) reportTimeOnPage(); // Raportuj czas poprzedniej strony przy nawigacji SPA
        var path = getPagePath();
        if (path.indexOf('/api') !== -1 || path.indexOf('/ws') !== -1) return;

        if (isSPA) {
            sentMarkers = {}; // Reset markerów scrolla przy nawigacji SPA
        }
        
        var navType = 'load';
        try { navType = performance.getEntriesByType("navigation")[0].type; } catch(e) {}
        
        sendEvent('PAGE_VIEW', (isSPA ? 'spa_navigation' : navType), null);

        // Baseline 0% Scroll Depth - opóźnienie 250ms (Safe Entry vs Rate Limit)
        setTimeout(function() {
            var p = getPagePath();
            if (!sentMarkers[p + ':0']) {
                sentMarkers[p + ':0'] = true;
                sendEvent('SCROLL_DEPTH', 'reached_0_percent', null, p);
            }
        }, 250);

        // Informacje o urządzeniu (raz na sesję) - opóźnienie 500ms, aby nie kolidować z PAGE_VIEW (limit 100ms)
        if (!isSPA && localStorage.getItem('pans_device_tracked') !== sessionId) {
            setTimeout(function() {
                var browser = (function() {
                    var ua = navigator.userAgent;
                    if (ua.indexOf('Firefox') > -1) return 'Firefox';
                    if (ua.indexOf('Edg') > -1) return 'Edge';
                    if (ua.indexOf('Chrome') > -1) return 'Chrome';
                    if (ua.indexOf('Safari') > -1) return 'Safari';
                    return 'Inna';
                })();
                var info = 'Browser:' + browser + ', Res:' + screen.width + 'x' + screen.height + ', Platform:' + navigator.platform;
                sendEvent('DEVICE_INFO', info, null);
                localStorage.setItem('pans_device_tracked', sessionId);
            }, 500);
        }
    }

    // 6. Obsługa aktywności i czasu na stronie
    function updateActiveTime() {
        if (lastActiveStart > 0) {
            var now = Date.now();
            if (now - lastActivity < IDLE_TIMEOUT) {
                activeTimeMs += (now - lastActiveStart);
            }
            lastActiveStart = now;
        }
    }

    function reportTimeOnPage() {
        updateActiveTime();
        if (activeTimeMs > 1000) {
            sendEvent('PAGE_VIEW', 'time_on_page', activeTimeMs);
            activeTimeMs = 0;
        }
    }

    // Zabezpieczenie przed utratą danych przy zamykaniu (nowy standard visibilitychange)
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') {
            reportTimeOnPage();
            lastActiveStart = 0;
        } else {
            lastActiveStart = Date.now();
            lastActivity = Date.now();
        }
    });

    window.addEventListener('pagehide', reportTimeOnPage);

    // 7. Śledzenie błędów
    window.addEventListener('error', function(e) {
        if (e.message && (e.message.indexOf('ResizeObserver') !== -1 || e.message.indexOf('Extension') !== -1)) return;
        var msg = 'Error: ' + e.message + ' at ' + (e.filename ? e.filename.split('/').pop() : 'unknown') + ':' + e.lineno;
        sendEvent('ERROR', msg, null);
    });

    window.addEventListener('unhandledrejection', function(e) {
        var reason = e.reason || 'Unknown promise rejection';
        var msg = 'PromiseRejection: ' + (reason.message || reason);
        sendEvent('ERROR', msg, null);
    });

    // 8. Głębokość przewijania (Scroll Depth)
    // 8. Uniwersalne śledzenie głębokości przewijania (v1.4.3)
    // Nasłuchujemy na document z capture:true, aby złapać scroll z dowolnego kontenera (np. sekcji .main)
    document.addEventListener('scroll', function(e) {
        if (scrollTicking) return;
        scrollTicking = true;

        window.requestAnimationFrame(function() {
            // Detekcja aktywnego kontenera scrolla
            var el = (e.target === document) ? (document.scrollingElement || document.documentElement) : e.target;
            if (!el || el.scrollHeight <= el.clientHeight + 50) { 
                scrollTicking = false; 
                return; 
            }

            var docHeight = el.scrollHeight;
            var winHeight = (el === document.documentElement || el === document.body) ? window.innerHeight : el.clientHeight;
            var scrollTop = el.scrollTop;
            var scrollPercent = Math.round(((scrollTop + winHeight) / docHeight) * 100);
            var triggerPage = getPagePath();

            [0, 25, 50, 75, 100].forEach(function(m, idx) {
                var markerId = triggerPage + ':' + m;
                if (scrollPercent >= m && !sentMarkers[markerId]) {
                    sentMarkers[markerId] = true;
                    // Staggering 250ms, aby uniknąć kolizji w bazie przy gwałtownych burstach
                    setTimeout(function() {
                        sendEvent('SCROLL_DEPTH', 'reached_' + m + '_percent', null, triggerPage);
                    }, idx * 250);
                }
            });
            scrollTicking = false;
        });
    }, true); // Capture: true pozwala złapać eventy scrolla z dowolnych dzieci (np. .main)

    // 9. Interakcje (Click) z ochroną przed dublowaniem
    document.addEventListener('click', function(e) {
        var el = e.target.closest('a, button, [data-track]');
        if (!el || el.hasAttribute('data-no-track')) return;

        var name = el.getAttribute('data-track');
        if (!name) {
            var label = (el.getAttribute('title') || el.getAttribute('aria-label') || el.id || el.innerText || '').trim();
            if (el.tagName === 'A') {
                var href = el.getAttribute('href') || '';
                name = 'link:' + (label || sanitize(href, 50));
                if (href.indexOf('logout') !== -1) {
                    reportTimeOnPage(); // Raportuj czas PRZED wylogowaniem
                    localStorage.removeItem(SESSION_KEY);
                    
                    // Zapobiegamy natychmiastowej nawigacji, aby dać czas na wysłanie fetch (nawet z keepalive)
                    e.preventDefault();
                    var targetUrl = el.href;
                    setTimeout(function() {
                        window.location.href = targetUrl;
                    }, 150);
                }
            } else {
                name = el.tagName.toLowerCase() + ':' + (label || 'unnamed');
            }
        }
        
        var clickId = getPagePath() + ':' + name;
        if (recentClicks[clickId]) return;
        recentClicks[clickId] = true;
        setTimeout(function() { delete recentClicks[clickId]; }, 500);

        sendEvent('CLICK', name, null);
    });

    // Inicjalizacja
    trackPageView(false);

    // SPA support
    var pushState = history.pushState;
    history.pushState = function() {
        pushState.apply(history, arguments);
        trackPageView(true);
    };
    window.addEventListener('popstate', function() { trackPageView(true); });

})();
