/**
 * admin-analytics.js — Panel analityczny (pobiera dane z /api/activity/summary)
 */
(function () {
    'use strict';

    let chartInstance = null;
    const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

    async function loadAnalytics() {
        try {
            const res = await fetch('/api/activity/summary', {
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            if (!res.ok) throw new Error('Błąd pobierania danych');
            const data = await res.json();
            
            // Zachowaj dla obserwatora theme'ów
            window.__analyticsData = data;
            
            renderKpi(data);
            renderDailyChart(data.dailyStats);
            renderPagesTable(data.topPages);
            renderClicksTable(data.topClicks);
            renderUsersTable(data.userActivity);
        } catch (e) {
            console.error('Analytics load error:', e);
            document.querySelectorAll('.loading-cell').forEach(cell => {
                cell.className = 'empty-cell';
                cell.innerHTML = '<span class="error-msg">Nie udało się załadować statystyk</span>';
            });
        }
    }

    function renderKpi(data) {
        setEl('totalPageViews', data.totalPageViews.toLocaleString('pl-PL'));
        setEl('totalSessions', data.totalSessions.toLocaleString('pl-PL'));
        // Używa teraz prawdziwego licznika bez limitu TOP_20
        setEl('totalClicks', (data.totalClicks || 0).toLocaleString('pl-PL'));
        
        // Zastępuje listę prawdziwym agregatem per UID (korzystając z danych bazy) 
        // fallback do tabeli jeśli zaszła by dziwna nieścisłość
        const activeUsersCount = data.totalActiveUsers || data.userActivity.length;
        setEl('activeUsers', activeUsersCount.toLocaleString('pl-PL'));
    }

    function renderDailyChart(dailyStats) {
        const emptyEl = document.getElementById('dailyEmpty');
        if (!dailyStats || dailyStats.length === 0) {
            document.getElementById('dailyChart').style.display = 'none';
            if (emptyEl) emptyEl.style.display = 'flex';
            return;
        }
        
        document.getElementById('dailyChart').style.display = 'block';
        if (emptyEl) emptyEl.style.display = 'none';
        
        const labels = dailyStats.map(d => d.date);
        const values = dailyStats.map(d => d.count);
        const ctx = document.getElementById('dailyChart').getContext('2d');
        if (chartInstance) chartInstance.destroy();
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#6c63ff';
        const isDk = isDark();

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Zdarzenia',
                    data: values,
                    borderColor: accent,
                    backgroundColor: accent + '22',
                    borderWidth: 2,
                    pointRadius: 3,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        ticks: { color: isDk ? '#9ca3af' : '#6b7280', maxTicksLimit: 10 },
                        grid: { color: isDk ? '#2d2d2d' : '#f3f4f6' }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: isDk ? '#9ca3af' : '#6b7280', precision: 0 },
                        grid: { color: isDk ? '#2d2d2d' : '#f3f4f6' }
                    }
                }
            }
        });
    }

    // Nasłuchuj zmian motywu, by dynamicznie odświeżać wykres 
    const observer = new MutationObserver(mutations => {
        mutations.forEach(m => {
            if (m.attributeName === 'data-theme' && window.__analyticsData && chartInstance) {
                renderDailyChart(window.__analyticsData.dailyStats);
            }
        });
    });
    observer.observe(document.documentElement, { attributes: true });

    function renderPagesTable(pages) {
        const tbody = document.getElementById('pagesBody');
        if (!pages || pages.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="empty-cell">Brak danych</td></tr>';
            return;
        }
        tbody.innerHTML = pages.map(p => {
            const avg = p.avgDurationMs ? formatDuration(p.avgDurationMs) : '—';
            return `<tr>
                <td class="page-cell" title="${escHtml(p.page)}">${escHtml(p.page)}</td>
                <td class="num-cell">${p.visits.toLocaleString('pl-PL')}</td>
                <td class="num-cell">${avg}</td>
            </tr>`;
        }).join('');
    }

    function renderClicksTable(clicks) {
        const tbody = document.getElementById('clicksBody');
        if (!clicks || clicks.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="empty-cell">Brak danych</td></tr>';
            return;
        }
        const max = clicks[0].count;
        tbody.innerHTML = clicks.map(c => {
            const pct = max > 0 ? Math.round((c.count / max) * 100) : 0;
            return `<tr>
                <td>${escHtml(c.eventName)}</td>
                <td class="num-cell">${c.count.toLocaleString('pl-PL')}</td>
                <td>
                    <div class="bar-wrap">
                        <div class="bar-fill" style="width:${pct}%"></div>
                        <span class="bar-pct">${pct}%</span>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    function renderUsersTable(users) {
        const tbody = document.getElementById('usersBody');
        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">Brak danych</td></tr>';
            return;
        }
        tbody.innerHTML = users.map((u, i) => `<tr>
            <td class="rank-cell">${i + 1}</td>
            <td>${escHtml(u.fullName)}</td>
            <td class="num-cell">${u.sessions.toLocaleString('pl-PL')}</td>
            <td class="num-cell">${u.totalEvents.toLocaleString('pl-PL')}</td>
        </tr>`).join('');
    }

    function formatDuration(ms) {
        if (ms < 1000) return ms + 'ms';
        const s = Math.round(ms / 1000);
        if (s < 60) return s + 's';
        return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
    }

    function escHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function setEl(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    document.addEventListener('DOMContentLoaded', loadAnalytics);
})();
