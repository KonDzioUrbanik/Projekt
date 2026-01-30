/* Zmiana motywu - przełączanie jasny/ciemny */

(function() {
    'use strict';

    const STORAGE_KEY = 'theme';
    const DARK_THEME = 'dark';
    const LIGHT_THEME = 'light';

    /* Pobiera preferowany motyw użytkownika */
    function getPreferredTheme() {
        // Sprawdź localStorage
        const storedTheme = localStorage.getItem(STORAGE_KEY);
        if (storedTheme) {
            return storedTheme;
        }

        // Sprawdź preferencje systemowe
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return DARK_THEME;
        }

        // Domyślnie jasny motyw
        return LIGHT_THEME;
    }

    /* Zastosuj motyw w dokumencie */
    function applyTheme(theme) {
        if (theme === DARK_THEME) {
            document.documentElement.setAttribute('data-theme', DARK_THEME);
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    /* Zapisz wybór motywu w localStorage */
    function saveTheme(theme) {
        localStorage.setItem(STORAGE_KEY, theme);
    }

    /* Przełącz między jasnym a ciemnym motywem */
    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === DARK_THEME ? LIGHT_THEME : DARK_THEME;
        
        applyTheme(newTheme);
        saveTheme(newTheme);
        updateToggleButtonsUI(newTheme);
        
        return newTheme;
    }

    /* Aktualizuj tekst przycisku w zależności od aktywnego motywu */
    function updateToggleButtonsUI(theme) {
        // Aktualizuj tekst w dropdown menu
        const dropdownText = document.querySelector('#themeToggleDropdown .theme-toggle-text');
        if (dropdownText) {
            dropdownText.textContent = theme === DARK_THEME 
                ? 'Przełącz na motyw jasny' 
                : 'Przełącz na motyw ciemny';
        }
    }

    /* Zainicjuj motyw przy ładowaniu strony */
    function initTheme() {
        const theme = getPreferredTheme();
        applyTheme(theme);
    }

    /* Podepnij listenery do przycisków przełączania motywu */
    function setupToggleListeners() {
        // Pływający przycisk (strony auth/landing)
        const floatingToggle = document.getElementById('themeToggleBtn');
        if (floatingToggle) {
            floatingToggle.addEventListener('click', function(e) {
                e.preventDefault();
                toggleTheme();
            });
        }

        // Przycisk w nawigacji (strona główna)
        const navToggle = document.getElementById('navThemeToggle');
        if (navToggle) {
            navToggle.addEventListener('click', function(e) {
                e.preventDefault();
                toggleTheme();
            });
        }

        // Przycisk w dropdown menu (dashboard)
        const dropdownToggle = document.getElementById('themeToggleDropdown');
        if (dropdownToggle) {
            dropdownToggle.addEventListener('click', function(e) {
                e.preventDefault();
                toggleTheme();
            });
        }
    }

    /* Nasłuchuj zmian motywu systemowego */
    function setupSystemThemeListener() {
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            
            mediaQuery.addEventListener('change', function(e) {
                // Auto-przełączaj tylko jeśli użytkownik nie zapisał wyboru
                const storedTheme = localStorage.getItem(STORAGE_KEY);
                if (!storedTheme) {
                    const newTheme = e.matches ? DARK_THEME : LIGHT_THEME;
                    applyTheme(newTheme);
                }
            });
        }
    }

    // Zainicjuj motyw natychmiast, aby uniknąć migotania
    initTheme();

    // Podepnij listenery po załadowaniu DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setupToggleListeners();
            setupSystemThemeListener();
            // Ustaw początkowy tekst w dropdown
            updateToggleButtonsUI(getPreferredTheme());
        });
    } else {
        setupToggleListeners();
        setupSystemThemeListener();
        // Ustaw początkowy tekst w dropdown
        updateToggleButtonsUI(getPreferredTheme());
    }

    // Udostępnij API do użycia zewnętrznego
    window.ThemeManager = {
        toggle: toggleTheme,
        setTheme: function(theme) {
            applyTheme(theme);
            saveTheme(theme);
        },
        getTheme: function() {
            return document.documentElement.getAttribute('data-theme') || LIGHT_THEME;
        }
    };

})();
