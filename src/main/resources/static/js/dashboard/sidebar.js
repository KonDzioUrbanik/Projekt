document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    const STORAGE_KEY = 'sidebarState';

    // Obsługa zwijania (Desktop)
    if (sidebar && toggleBtn) {
        const savedState = localStorage.getItem(STORAGE_KEY);
        if (savedState === 'collapsed') {
            sidebar.classList.add('collapsed');
        }

        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            
            // Zapisz stan
            localStorage.setItem(STORAGE_KEY, sidebar.classList.contains('collapsed') ? 'collapsed' : 'expanded');

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