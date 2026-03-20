(function () {
    'use strict';

    const listEl = document.getElementById('homeAnnouncementsList');
    const emptyEl = document.getElementById('homeAnnouncementsEmpty');
    const errorEl = document.getElementById('homeAnnouncementsError');

    if (!listEl || !emptyEl || !errorEl) return;

    const LIMIT = 3;

    document.addEventListener('DOMContentLoaded', loadAnnouncements);

    async function loadAnnouncements() {
        hideAllStates();

        try {
            let announcements = await fetchAnnouncements('/api/announcements/group');

            // Dla admina bez grupy fallback do pełnej listy systemowej.
            if (Array.isArray(announcements) && announcements.length === 0) {
                try {
                    announcements = await fetchAnnouncements('/api/announcements/all');
                } catch (_) {
                    // Dla nie-admina endpoint /all jest niedostępny - ignorujemy fallback.
                }
            }

            const latest = Array.isArray(announcements) ? announcements.slice(0, LIMIT) : [];
            if (latest.length === 0) {
                emptyEl.style.display = '';
                return;
            }

            listEl.innerHTML = latest.map(renderAnnouncementCard).join('');
        } catch (_) {
            errorEl.style.display = '';
        }
    }

    async function fetchAnnouncements(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('request_failed');
        }
        return response.json();
    }

    function renderAnnouncementCard(item) {
        const createdAt = item.createdAt
            ? new Date(item.createdAt).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })
            : '-';
        const title = Utils.escapeHtml(item.title || 'Bez tytułu');
        const content = Utils.escapeHtml(item.content || '');
        const groupName = Utils.escapeHtml(item.targetGroupName || 'Brak grupy');
        const authorName = Utils.escapeHtml([item.authorFirstName, item.authorLastName].filter(Boolean).join(' ') || 'Nieznany autor');

        return `
            <article class="home-ann-card">
                <div class="home-ann-card-header">
                    <div class="home-ann-heading">
                        <span class="home-ann-kicker">Ostatnie ogłoszenie</span>
                        <h4 class="home-ann-title">${title}</h4>
                    </div>
                    <span class="home-ann-date">
                        <i class="fas fa-clock"></i>
                        ${createdAt}
                    </span>
                </div>
                <p class="home-ann-content">${content}</p>
                <div class="home-ann-footer">
                    <div class="home-ann-meta">
                        <i class="fas fa-users"></i>
                        <span>${groupName}</span>
                    </div>
                    <div class="home-ann-author">
                        <i class="fas fa-user"></i>
                        <span>${authorName}</span>
                    </div>
                </div>
            </article>
        `;
    }

    function hideAllStates() {
        listEl.innerHTML = '';
        emptyEl.style.display = 'none';
        errorEl.style.display = 'none';
    }

})();


