/* Dynamiczne Breadcrumbs - generowane na bazie data-active-page */

(function () {
    'use strict';

    /**
     * Mapa stron -> { label, href, parent }
     * parent = klucz rodzica w mapie (null dla korzeni)
     */
    const PAGE_MAP = {
        /* Korzeń */
        home: {
            label: 'Strona główna',
            href: '/home',
            parent: null
        },
        
        /* Główne panele (Logiczne grupowanie) */
        'student-panel': {
            label: 'Panel Studenta',
            href: '/student/dashboard',
            parent: 'home'
        },
        'admin-panel': {
            label: 'Panel Administracyjny',
            href: '/admin/dashboard',
            parent: 'home'
        },
        'starosta-panel': {
            label: 'Panel Starosty',
            href: '/starosta/dashboard',
            parent: 'home'
        },

        /* Dashboard Użytkownika (Podwiązane pod Panel Studenta) */
        calendar: {
            label: 'Kalendarz',
            href: '/student/calendar',
            parent: 'student-panel'
        },
        schedule: {
            label: 'Harmonogram zajęć',
            href: '/student/schedule',
            parent: 'student-panel'
        },
        attendance: {
            label: 'Obecności',
            href: '/student/attendance',
            parent: 'student-panel'
        },
        forum: {
            label: 'Forum',
            href: '/student/forum',
            parent: 'student-panel'
        },
        notes: {
            label: 'Notatki',
            href: '/student/notes',
            parent: 'student-panel'
        },
        'university-calendar-public': {
            label: 'Kalendarz akademicki',
            href: '/student/university-calendar',
            parent: 'student-panel'
        },
        profile: {
            label: 'Mój profil',
            href: '/profile',
            parent: 'home'
        },
        settings: {
            label: 'Edycja profilu',
            href: '/settings',
            parent: 'home'
        },

        /* Panel Administratora (Podwiązane pod Panel Administracyjny) */
        users: {
            label: 'Użytkownicy',
            href: '/admin/users',
            parent: 'admin-panel'
        },
        announcement: {
            label: 'Ogłoszenia',
            href: '/admin/announcement',
            parent: 'admin-panel'
        },
        'post-control': {
            label: 'Moderacja',
            href: '/admin/post-control',
            parent: 'admin-panel'
        },
        'schedule-management': {
            label: 'Zarządzanie planem',
            href: '/admin/schedule-management',
            parent: 'admin-panel'
        },
        'groups-management': {
            label: 'Kierunki',
            href: '/admin/groups-management',
            parent: 'admin-panel'
        },
        'university-calendar': {
            label: 'Kalendarz akademicki',
            href: '/admin/university-calendar',
            parent: 'admin-panel'
        },
        alerts: {
            label: 'Alerty',
            href: '/admin/alerts',
            parent: 'admin-panel'
        },
        feedback: {
            label: 'Zgłoszenia',
            href: '/admin/feedback',
            parent: 'admin-panel'
        }
    };

    /**
     * Zwraca dynamicznego "rodzica" paneli w zależności od tego, jaki panel jest oznaczony jako ".active" lub po adresie URL
     */
    function getDynamicPanelParent() {
        const activeLink = document.querySelector('.btn-navbar-left.active');
        if (activeLink) {
            const href = activeLink.getAttribute('href');
            if (href) {
                if (href.includes('/student/')) return 'student-panel';
                if (href.includes('/starosta/')) return 'starosta-panel';
                if (href.includes('/admin/')) return 'admin-panel';
            }
        }
        
        // Jeśli nie ma activeLink (otwarte z menu górnego), sprawdźmy poprzednią ścieżkę jeśli dostępna
        // Tymczasowe rozwiązanie fallback
        return 'home';
    }

    /**
     * Buduje hierarchię breadcrumbów od bieżącej strony do korzenia
     */
    function buildCrumbs(pageKey, dynamicTitle = null) {
        const crumbs = [];
        let current = pageKey;

        // Dynamiczne podpięcie stron ogólnych pod aktualnie używany panel
        if ((current === 'profile' || current === 'settings') && PAGE_MAP[current]) {
            PAGE_MAP[current].parent = getDynamicPanelParent();
        }

        // Jeśli podano dynamiczny tytuł, to aktualna strona (pageKey) staje się rodzicem dla tego tytułu
        if (dynamicTitle && PAGE_MAP[current]) {
            crumbs.unshift({
                label: dynamicTitle,
                href: '#', // Ostani element i tak nie jest linkiem
                parent: current
            });
            // Ostatni element (dynamiczny) ma rodzica równego obecnej widokowi
        }

        while (current && PAGE_MAP[current]) {
            crumbs.unshift(Object.assign({}, PAGE_MAP[current]));
            current = PAGE_MAP[current].parent;
        }

        return crumbs;
    }

    /**
     * Renderuje breadcrumbs do kontenera
     */
    function renderBreadcrumbs() {
        const container = document.getElementById('breadcrumbs');
        if (!container) return;

        const main = document.querySelector('.navbar-middle');
        const activePage = main?.dataset?.activePage;
        
        // Pętla pobiera dynamiczny tytuł podstrony (np. z edytora notatki)
        const dynamicTitle = main?.dataset?.breadcrumbTitle || null;

        if (!activePage || activePage === 'home') {
            container.style.display = 'none';
            return;
        }

        const crumbs = buildCrumbs(activePage, dynamicTitle);
        if (crumbs.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.innerHTML = crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            const separator = index > 0
                ? '<span class="breadcrumb-separator">/</span>'
                : '';

            const safeLabel = Utils.escapeHtml(crumb.label);

            if (isLast) {
                return `${separator}<span class="breadcrumb-item active">${safeLabel}</span>`;
            }

            return `${separator}<a href="${crumb.href}" class="breadcrumb-item">${safeLabel}</a>`;
        }).join('');

        container.style.display = '';
    }

    // Inicjalizacja po załadowaniu DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderBreadcrumbs);
    } else {
        renderBreadcrumbs();
    }

    // Dodanie obserwatora mutacji, by automatycznie odświeżać breadcrumbs przy zmianie atrybutów
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && 
               (mutation.attributeName === 'data-active-page' || mutation.attributeName === 'data-breadcrumb-title')) {
                renderBreadcrumbs();
            }
        });
    });

    const mainNode = document.querySelector('.navbar-middle');
    if (mainNode) {
        observer.observe(mainNode, { attributes: true });
    }

    // Eksport API - dodana funkcja wymuszająca aktualizację z dynamicznym tytułem
    window.Breadcrumbs = { 
        render: renderBreadcrumbs,
        updateTitle: function(title) {
            const main = document.querySelector('.navbar-middle');
            if (main) {
                if (title) {
                    main.setAttribute('data-breadcrumb-title', title);
                } else {
                    main.removeAttribute('data-breadcrumb-title');
                }
            }
        }
    };
})();
