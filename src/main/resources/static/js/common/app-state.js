(function () {
    'use strict';

    var roleMeta = document.querySelector('meta[name="user-role"]');
    var userRole = roleMeta ? roleMeta.getAttribute('content') : '';
    if (userRole === 'ROLE_ADMIN' || userRole === 'ADMIN') return;

    var ENDPOINT = '/api/preferences/sync';
    var SESSION_KEY = 'pans_state_sid';
    var SESSION_TS_KEY = 'pans_state_ts';
    var SESSION_TTL = 30 * 60 * 1000;

    function getOrCreateSession() {
        var sid = localStorage.getItem(SESSION_KEY);
        var ts = parseInt(localStorage.getItem(SESSION_TS_KEY) || '0', 10);
        var now = Date.now();

        if (!sid || (now - ts > SESSION_TTL)) {
            try { sid = crypto.randomUUID(); }
            catch (e) { sid = Date.now().toString(36) + Math.random().toString(36).slice(2); }
            localStorage.setItem(SESSION_KEY, sid);
        }
        localStorage.setItem(SESSION_TS_KEY, now.toString());
        return sid;
    }

    var refreshTimeout;
    function refreshSession() {
        clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(function() {
            localStorage.setItem(SESSION_TS_KEY, Date.now().toString());
        }, 5000);
    }
    ['click', 'mousemove', 'keypress', 'scroll'].forEach(function(e) {
        document.addEventListener(e, refreshSession, { passive: true });
    });

    var sessionId = getOrCreateSession();

    if (window.location.pathname.startsWith('/api') || window.location.pathname.startsWith('/preferences') || window.location.pathname.startsWith('/ws')) {
        return;
    }

    var currentPage = window.location.pathname;
    
    function sanitize(str, max) {
        if (!str) return 'Unknown';
        var clean = str.replace(/\s+/g, ' ').trim();
        return clean.length <= max ? clean : clean.substring(0, max);
    }

    function sendEvent(eventType, eventName, durationMs) {
        var payload = { sessionId: sessionId, eventType: eventType, page: currentPage };
        if (eventName) payload.eventName = sanitize(eventName, 100);
        if (durationMs != null) payload.durationMs = Math.round(durationMs);

        var json = JSON.stringify(payload);

        try {
            if (navigator.sendBeacon) {
                var blob = new Blob([json], { type: 'application/json' });
                var success = navigator.sendBeacon(ENDPOINT, blob);
                if (success) return;
            }
        } catch (e) {}

        try {
            var csrfMeta = document.querySelector('meta[name="_csrf"]');
            var csrfHeaderMeta = document.querySelector('meta[name="_csrf_header"]');
            var csrfToken = csrfMeta ? csrfMeta.getAttribute('content') : '';
            var csrfHeader = csrfHeaderMeta ? csrfHeaderMeta.getAttribute('content') : 'X-CSRF-TOKEN';

            fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    [csrfHeader]: csrfToken
                },
                body: json
            }).catch(function () {});
        } catch (e) {}
    }

    var PAGE_VIEW_KEY = 'pans_last_pv';
    var lastPV = parseInt(sessionStorage.getItem(PAGE_VIEW_KEY) || '0', 10);
    if (Date.now() - lastPV > 3000) {
        sendEvent('PAGE_VIEW', null, null);
        sessionStorage.setItem(PAGE_VIEW_KEY, Date.now().toString());
    }

    var activeTimeMs = 0;
    var lastActiveStart = document.visibilityState === 'visible' ? Date.now() : 0;

    function updateActiveTime() {
        if (lastActiveStart > 0) {
            activeTimeMs += (Date.now() - lastActiveStart);
            lastActiveStart = Date.now();
        }
    }

    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
            lastActiveStart = Date.now();
        } else {
            updateActiveTime();
            lastActiveStart = 0;
            if (!navigator.sendBeacon) reportTimeOnPage();
        }
    });

    function reportTimeOnPage() {
        updateActiveTime();
        if (activeTimeMs > 0) {
            sendEvent('PAGE_VIEW', 'time_on_page', activeTimeMs);
            activeTimeMs = 0;
        }
    }

    window.addEventListener('pagehide', reportTimeOnPage);

    var recentClicks = new Set();

    document.addEventListener('click', function (e) {
        if (!e.target) return;
        var el = e.target.closest('a, button, [data-track]');
        if (!el) return;

        var name = el.getAttribute('data-track');
        if (!name) {
            if (el.tagName === 'A') {
                if (el.href && (el.href.indexOf('/logout') !== -1 || el.href.indexOf('/api/auth/logout') !== -1)) {
                    localStorage.removeItem(SESSION_KEY);
                }
                name = 'link_click:' + (el.getAttribute('href') || el.innerText);
            } else if (el.tagName === 'BUTTON') {
                name = 'button_click:' + (el.innerText || el.getAttribute('type'));
            }
        }
        name = sanitize(name, 50);

        if (recentClicks.has(name)) return;
        recentClicks.add(name);
        setTimeout(function() { recentClicks.delete(name); }, 300);

        sendEvent('CLICK', name, null);
    }, { passive: true });

    document.addEventListener('submit', function (e) {
        var form = e.target;
        var name = form ? form.getAttribute('data-track-form') || ('form_submit:' + (form.getAttribute('action') || form.id)) : 'Unknown Form';
        sendEvent('FORM_SUBMIT', sanitize(name, 50), null);
    }, { passive: true });

})();
