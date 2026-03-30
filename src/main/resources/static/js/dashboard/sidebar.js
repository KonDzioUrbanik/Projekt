document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    const STORAGE_KEY = 'sidebarState';
    const MOBILE_BREAKPOINT = 992; // px

    // Funkcja aktualizująca ikonę przycisku
    function updateSidebarIcon(isCollapsed) {
        if (!toggleBtn) return;
        const icon = toggleBtn.querySelector('i');
        if (!icon) return;

        if (isCollapsed) {
            icon.classList.replace('fa-times', 'fa-bars');
        } else {
            icon.classList.replace('fa-bars', 'fa-times');
        }
    }

    // Funkcja sprawdzająca responsywność
    function handleResponsiveState() {
        if (!sidebar) return;
        
        const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
        
        if (isMobile) {
            // Na mobile zawsze usuń klasę collapsed
            sidebar.classList.remove('collapsed');
            updateSidebarIcon(false);
        } else {
            // Na desktop przywróć zapisany stan
            const savedState = localStorage.getItem(STORAGE_KEY);
            const isCollapsed = savedState === 'collapsed';
            
            if (isCollapsed) {
                sidebar.classList.add('collapsed');
            } else {
                sidebar.classList.remove('collapsed');
            }
            updateSidebarIcon(isCollapsed);
        }
    }

    // Obsługa zwijania (Desktop)
    if (sidebar && toggleBtn) {
        // Inicjalizacja przy załadowaniu
        handleResponsiveState();

        // Nasłuchiwanie na zmiany rozmiaru okna
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                handleResponsiveState();
            }, 150); // Debounce 150ms
        });

        toggleBtn.addEventListener('click', () => {
            const isCollapsed = sidebar.classList.toggle('collapsed');
            updateSidebarIcon(isCollapsed);
            
            // Zapisz stan tylko dla desktop
            localStorage.setItem(STORAGE_KEY, isCollapsed ? 'collapsed' : 'expanded');

            setTimeout(() => {
                // Sprawdzamy, czy FullCalendar jest aktywny na stronie
                if (window.fullCalendarInstance) {
                    window.fullCalendarInstance.updateSize();
                }
                
                if (window.scheduleCalendar && window.scheduleCalendar.calendar) {
                    window.scheduleCalendar.calendar.updateSize();
                }
            }, 350);
        });
    }

    // Obsługa scrollowania do aktywnego elementu (Mobile)
    const navContainer = document.querySelector('.side-nav');
    const activeLink = document.querySelector('.side-nav .active');

    if (navContainer && activeLink) {
        activeLink.scrollIntoView({
            behavior: 'auto',
            block: 'nearest',
            inline: 'center'
        });
    }
});