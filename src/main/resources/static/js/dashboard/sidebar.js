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
            localStorage.setItem(STORAGE_KEY, sidebar.classList.contains('collapsed') ? 'collapsed' : 'expanded');
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