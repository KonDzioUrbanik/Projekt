/**
 * admin-analytics.js — Panel analityczny
 * Pobiera dane z: /api/preferences/state
 */
(function () {
    'use strict';

    const SELECTORS = {
        totalPageViews: 'totalPageViews',
        totalSessions: 'totalSessions',
        totalClicks: 'totalClicks',
        activeUsers: 'activeUsers',
        dailyChart: 'dailyChart',
        dailyEmpty: 'dailyEmpty',
        pagesBody: 'pagesBody',
        clicksBody: 'clicksBody',
        usersBody: 'usersBody',
        deviceBody: 'deviceBody',
        errorsBody: 'errorsBody',
        scrollBody: 'scrollBody'
    };

    let chartInstance = null;

    /**
     * Główna funkcja inicjalizująca panel
     */
    async function init() {
        const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

        // 1. Pobieranie danych
        const loadData = async () => {
            try {
                const res = await fetch('/api/preferences/state', {
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });
                if (!res.ok) throw new Error('Błąd HTTP');
                return await res.json();
            } catch (err) {
                console.error('[Analytics] Fetch failed:', err);
                return null;
            }
        };

        // 2. Renderowanie komponentów
        const render = (data) => {
            if (!data) {
                document.querySelectorAll('.loading-cell').forEach(c => c.innerHTML = 'Błąd ładowania');
                return;
            }

            renderKpi(data);
            renderDailyChart(data.dailyStats || [], isDark);
            renderTable(SELECTORS.pagesBody, data.topPages, row => `
                <tr>
                    <td class="page-cell" title="${esc(row.page)}">${esc(row.page)}</td>
                    <td class="num-cell">${(row.visits || 0).toLocaleString('pl-PL')}</td>
                    <td class="num-cell">${row.avgDurationMs ? formatDuration(row.avgDurationMs) : '—'}</td>
                </tr>
            `);
            renderTable(SELECTORS.clicksBody, data.topClicks, (row, i, arr) => {
                const max = arr[0].count || 1;
                const pct = Math.round(((row.count || 0) / max) * 100);
                return `
                <tr>
                    <td>${esc(row.eventName)}</td>
                    <td class="num-cell">${(row.count || 0).toLocaleString('pl-PL')}</td>
                    <td>
                        <div class="bar-wrap">
                            <div class="bar-fill" style="width:${pct}%"></div>
                            <span class="bar-pct">${pct}%</span>
                        </div>
                    </td>
                </tr>`;
            });
            renderTable(SELECTORS.usersBody, data.userActivity, (row, i) => `
                <tr>
                    <td class="rank-cell">${i + 1}</td>
                    <td>${esc(row.fullName)}</td>
                    <td class="num-cell">${(row.sessions || 0).toLocaleString('pl-PL')}</td>
                    <td class="num-cell">${(row.totalEvents || 0).toLocaleString('pl-PL')}</td>
                </tr>
            `);
            renderTable(SELECTORS.deviceBody, data.deviceStats, row => `
                <tr>
                    <td class="device-cell">${esc(row.deviceInfo)}</td>
                    <td class="num-cell">${(row.count || 0).toLocaleString('pl-PL')}</td>
                </tr>
            `);
            renderTable(SELECTORS.errorsBody, data.recentErrors, row => `
                <tr>
                    <td class="error-cell text-danger" title="${esc(row.eventName)}">
                        <i class="fas fa-bug"></i> ${esc(row.eventName)}
                    </td>
                    <td class="num-cell">
                        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem;">
                            <span>${(row.count || 0).toLocaleString('pl-PL')}</span>
                            <button class="delete-err-btn" title="Usuń ten błąd" data-event-name="${esc(row.eventName)}">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `);
            renderTable(SELECTORS.scrollBody, data.scrollDepthStats, row => {
                const label = (row.eventName || '').replace('reached_', '').replace('_percent', '%');
                return `
                <tr>
                    <td class="page-cell">${esc(label)}</td>
                    <td class="num-cell">${(row.count || 0).toLocaleString('pl-PL')}</td>
                </tr>`;
            });
        };

        const renderKpi = (data) => {
            setVal(SELECTORS.totalPageViews, data.totalPageViews);
            setVal(SELECTORS.totalSessions, data.totalSessions);
            setVal(SELECTORS.totalClicks, data.totalClicks);
            setVal(SELECTORS.activeUsers, data.totalActiveUsers || (data.userActivity ? data.userActivity.length : 0));
        };

        const renderDailyChart = (stats, isDarkTheme) => {
            const canvas = document.getElementById(SELECTORS.dailyChart);
            const empty = document.getElementById(SELECTORS.dailyEmpty);
            if (!canvas) return;

            if (stats.length === 0) {
                canvas.style.display = 'none';
                if (empty) empty.style.display = 'flex';
                return;
            }

            canvas.style.display = 'block';
            if (empty) empty.style.display = 'none';

            const ctx = canvas.getContext('2d');
            if (chartInstance) chartInstance.destroy();

            const accent = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#6c63ff';
            const textCol = isDarkTheme() ? '#9ca3af' : '#6b7280';
            const gridCol = isDarkTheme() ? '#2d2d2d' : '#f3f4f6';

            chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: stats.map(s => s.date),
                    datasets: [{
                        data: stats.map(s => s.count),
                        borderColor: accent,
                        backgroundColor: accent + '22',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: textCol }, grid: { color: gridCol } },
                        y: { beginAtZero: true, ticks: { color: textCol, precision: 0 }, grid: { color: gridCol } }
                    }
                }
            });
        };

        // 3. Obserwowanie zmian motywu (izolowane w init)
        let lastData = await loadData();
        render(lastData);

        const observer = new MutationObserver(() => {
            if (lastData) renderDailyChart(lastData.dailyStats || [], isDark);
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        // 4. Obsługa usuwania błędów (delegacja)
        const errorsBody = document.getElementById(SELECTORS.errorsBody);
        if (errorsBody) {
            errorsBody.addEventListener('click', async (e) => {
                const btn = e.target.closest('.delete-err-btn');
                if (!btn) return;
                
                const eventName = btn.dataset.eventName;
                if (!eventName) return;

                if (!confirm(`Czy na pewno chcesz usunąć wszystkie wystąpienia błędu: "${eventName}"?`)) {
                    return;
                }

                try {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    
                    const res = await fetch(`/api/preferences/errors?eventName=${encodeURIComponent(eventName)}`, {
                        method: 'DELETE',
                        headers: { 'X-Requested-With': 'XMLHttpRequest' }
                    });

                    if (res.ok) {
                        Utils.showToast('Błąd został usunięty z bazy.', 'success');
                        lastData = await loadData(); // Odśwież dane
                        render(lastData);
                    } else {
                        throw new Error('Błąd serwera');
                    }
                } catch (err) {
                    console.error('[Analytics] Delete failed:', err);
                    Utils.showToast('Nie udało się usunąć błędu.', 'error');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-times"></i>';
                }
            });
        }
    }

    // --- Helpery ---
    function renderTable(id, items, templateFn) {
        const el = document.getElementById(id);
        if (!el) return;
        if (!items || items.length === 0) {
            el.innerHTML = `<tr><td colspan="10" class="empty-cell">Brak danych</td></tr>`;
            return;
        }
        el.innerHTML = items.map(templateFn).join('');
    }

    function setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = (val || 0).toLocaleString('pl-PL');
    }

    function formatDuration(ms) {
        const s = Math.round(ms / 1000);
        if (s < 60) return `${s}s`;
        return `${Math.floor(s / 60)}m ${s % 60}s`;
    }

    function esc(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, m => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m]));
    }

    document.addEventListener('DOMContentLoaded', init);
})();
