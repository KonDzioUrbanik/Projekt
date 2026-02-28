/* Dynamiczne Breadcrumbs - generowane na bazie data-active-page */

(function () {
    'use strict';

    /**
     * Mapa stron -> { label, icon, parent }
     * parent = klucz rodzica w mapie (null dla korzeni)
     */
    const PAGE_MAP = {
        /* Dashboard (Użytkownik) */
        home: {
            label: 'Strona główna',
            href: '/dashboard',
            parent: null
        },
        calendar: {
            label: 'Kalendarz',
            href: '/dashboard/calendar',
            parent: 'home'
        },
        schedule: {
            label: 'Harmonogram zajęć',
            href: '/dashboard/schedule',
            parent: 'home'
        },
        attendance: {
            label: 'Obecności',
            href: '/dashboard/attendance',
            parent: 'home'
        },
        forum: {
            label: 'Forum',
            href: '/dashboard/forum',
            parent: 'home'
        },
        notes: {
            label: 'Notatki',
            href: '/dashboard/notes',
            parent: 'home'
        },
        'university-calendar-public': {
            label: 'Kalendarz akademicki',
            href: '/dashboard/university-calendar',
            parent: 'home'
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

        /* Admin */
        users: {
            label: 'Użytkownicy',
            href: '/admin/users',
            parent: 'home'
        },
        announcement: {
            label: 'Ogłoszenia',
            href: '/admin/announcement',
            parent: 'home'
        },
        'post-control': {
            label: 'Moderacja',
            href: '/admin/post-control',
            parent: 'home'
        },
        'schedule-management': {
            label: 'Zarządzanie planem',
            href: '/admin/schedule-management',
            parent: 'home'
        },
        'groups-management': {
            label: 'Kierunki',
            href: '/admin/groups-management',
            parent: 'home'
        },
        'university-calendar': {
            label: 'Kalendarz akademicki',
            href: '/admin/university-calendar',
            parent: 'home'
        },
        alerts: {
            label: 'Alerty',
            href: '/admin/alerts',
            parent: 'home'
        },
        feedback: {
            label: 'Zgłoszenia',
            href: '/admin/feedback',
            parent: 'home'
        }
    };

    /**
     * Buduje hierarchię breadcrumbów od bieżącej strony do korzenia
     */
    function buildCrumbs(pageKey) {
        const crumbs = [];
        let current = pageKey;

        while (current && PAGE_MAP[current]) {
            crumbs.unshift(PAGE_MAP[current]);
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

        if (!activePage || activePage === 'home') {
            container.style.display = 'none';
            return;
        }

        const crumbs = buildCrumbs(activePage);
        if (crumbs.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.innerHTML = crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            const separator = index > 0
                ? '<span class="breadcrumb-separator">/</span>'
                : '';

            if (isLast) {
                return `${separator}<span class="breadcrumb-item active">${crumb.label}</span>`;
            }

            return `${separator}<a href="${crumb.href}" class="breadcrumb-item">${crumb.label}</a>`;
        }).join('');

        container.style.display = '';
    }

    // Inicjalizacja po załadowaniu DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderBreadcrumbs);
    } else {
        renderBreadcrumbs();
    }

    // Eksport API
    window.Breadcrumbs = { render: renderBreadcrumbs };
})();
