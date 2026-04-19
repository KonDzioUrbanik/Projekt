document.addEventListener('DOMContentLoaded', () => {
    initResourcesDashboard();
});

let storageChart = null;

async function initResourcesDashboard() {
    // Initial load
    await Promise.all([
        adminUtils.refreshGlobalMetrics(),
        fetchResourceStats(),
        fetchResourceHistory()
    ]);

    // Periodic updates
    setInterval(() => adminUtils.refreshGlobalMetrics(), 10000); // 10s is safer for 429s (global is 100/min)
    setInterval(() => fetchResourceStats(), 30000);
    setInterval(() => fetchTopUsers(), 60000);
    
    // Fetch Top Users now
    await fetchTopUsers();

    // Event listeners
    const refreshBtn = document.getElementById('refreshStatsBtn');
    if (refreshBtn) {
        refreshBtn.onclick = async () => {
            const icon = refreshBtn.querySelector('i');
            icon.classList.add('fa-spin');
            refreshBtn.disabled = true;
            try {
                await fetch('/api/admin/resources/refresh');
                await Promise.all([
                    fetchResourceStats(),
                    fetchTopUsers()
                ]);
                Utils.showToast('Statystyki zostały przeliczone pomyślnie.', 'success');
            } catch (e) {
                console.error('Refresh failed:', e);
                Utils.showToast('Błąd podczas odświeżania statystyk.', 'error');
            } finally {
                icon.classList.remove('fa-spin');
                refreshBtn.disabled = false;
            }
        };
    }
}

async function fetchResourceStats() {
    try {
        const response = await fetch('/api/admin/resources/stats');
        const stats = await adminUtils.handleFetchResponse(response);
        updateStorageUI(stats);
    } catch (error) {
        console.error('Error fetching resource stats:', error);
    }
}

function updateStorageUI(stats) {
    const formatSize = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const totalLimit = stats.totalLimit || (10 * 1024 * 1024 * 1024);
    
    // Summary row
    document.getElementById('totalSizeValue').textContent = formatSize(stats.totalDbSize);
    document.getElementById('avatarSizeValue').textContent = formatSize(stats.avatarLogicalSize);
    document.getElementById('attachmentSizeValue').textContent = formatSize(stats.attachmentLogicalSize);

    // Progress
    const totalPercent = Math.min(100, Math.round((stats.totalDbSize / totalLimit) * 100));
    const totalBar = document.getElementById('totalProgress');
    if (totalBar) {
        totalBar.style.width = totalPercent + '%';
        totalBar.className = 'progress-bar-fill ' + (totalPercent > 90 ? 'danger' : totalPercent > 70 ? 'warning' : '');
    }
    document.getElementById('totalPercent').textContent = totalPercent + '%';

    // Details logic
    document.getElementById('avatarCount').textContent = stats.totalFileCount + ' plików (ogółem)';
    document.getElementById('attachmentCount').textContent = 'Dane użytkowników: ' + formatSize(stats.totalLogicalSize);
    
    // Last Sync
    const syncTimeEl = document.getElementById('lastSyncTime');
    if (syncTimeEl) {
        syncTimeEl.textContent = new Date().toLocaleTimeString();
    }
}

async function fetchResourceHistory() {
    try {
        const response = await fetch('/api/admin/resources/history');
        const history = await adminUtils.handleFetchResponse(response);
        renderTrendChart(history);
        calculateRealPrediction(history);
    } catch (error) {
        console.error('Error fetching history:', error);
    }
}

function renderTrendChart(history) {
    const canvas = document.getElementById('storageTrendChart');
    if (!history || history.length === 0) {
        document.getElementById('storageTrendChart').parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;opacity:0.5;font-style:italic;">Brak danych historycznych</div>';
        return;
    }
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (storageChart) {
        storageChart.destroy();
    }
    
    const data = [...history].reverse();
    
    storageChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(h => new Date(h.timestamp).toLocaleDateString()),
            datasets: [{
                label: 'Rozmiar bazy (bytes)',
                data: data.map(h => h.totalDbSize),
                borderColor: '#4f46e5',
                backgroundColor: 'rgba(79, 70, 229, 0.05)',
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: '#4f46e5'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return 'Rozmiar: ' + formatSizeStatic(context.raw);
                        }
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: false, 
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#94a3b8',
                        callback: function(value) { return formatSizeStatic(value); }
                    }
                },
                x: { 
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

function formatSizeStatic(bytes) {
    if (bytes === undefined || bytes === null || isNaN(bytes) || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function calculateRealPrediction(history) {
    const predEl = document.getElementById('predictionDays');
    if (!predEl) return;

    if (history.length < 2) {
        predEl.textContent = 'Brak danych';
        return;
    }

    const latest = history[0];
    const oldest = history[history.length - 1];
    
    const deltaSize = latest.totalDbSize - oldest.totalDbSize;
    const deltaTime = new Date(latest.timestamp) - new Date(oldest.timestamp);
    const daysDiff = deltaTime / (1000 * 60 * 60 * 24);
    
    if (deltaSize <= 0 || daysDiff <= 0) {
        predEl.textContent = '> 1 rok';
        return;
    }

    const growthPerDay = deltaSize / daysDiff;
    const totalLimit = latest.totalLimit || (10 * 1024 * 1024 * 1024);
    const remaining = (totalLimit * 0.9) - latest.totalDbSize;
    
    const daysLeft = Math.round(remaining / growthPerDay);
    predEl.textContent = '~' + Math.max(1, daysLeft) + ' dni';
}
async function fetchTopUsers() {
    try {
        const response = await fetch('/api/admin/resources/top-users');
        const users = await adminUtils.handleFetchResponse(response);
        const tbody = document.getElementById('topUsersBody');
        if (!tbody) return;

        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Brak danych o zużyciu zasobów.</td></tr>';
            return;
        }

        const formatSize = (bytes) => {
            if (!bytes || bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        tbody.innerHTML = users.map((user, index) => {
            const rank = index + 1;
            let rankHtml = '';
            if (rank === 1) rankHtml = '<div class="rank-badge rank-1">1</div>';
            else if (rank === 2) rankHtml = '<div class="rank-badge rank-2">2</div>';
            else if (rank === 3) rankHtml = '<div class="rank-badge rank-3">3</div>';
            else rankHtml = `<div class="rank-badge rank-other">${rank}</div>`;

            return `
                <tr>
                    <td style="text-align: center;">${rankHtml}</td>
                    <td style="font-weight:600; opacity:0.6; font-size: 0.8rem;">#${user.id}</td>
                    <td>
                        <div class="user-info-brief">
                            <a href="/profile/user?userId=${user.id}" class="user-profile-link" title="Przejdź do profilu użytkownika">
                                <span class="user-name-cell">${adminUtils.escapeHtml(user.firstName || user.first_name || 'Użytkownik')} ${adminUtils.escapeHtml(user.lastName || user.last_name || '')}</span>
                                <i class="fas fa-external-link-alt"></i>
                            </a>
                            <span class="user-email-cell">${adminUtils.escapeHtml(user.email)}</span>
                        </div>
                    </td>
                    <td style="text-align: right;" class="storage-cell">
                        <i class="fas fa-portrait" style="font-size: 0.7rem; opacity: 0.4; margin-right: 4px;" title="Awatary"></i>
                        ${formatSize(user.avatarSize)}
                    </td>
                    <td style="text-align: right;" class="storage-cell">
                        <i class="fas fa-paperclip" style="font-size: 0.7rem; opacity: 0.4; margin-right: 4px;" title="Załączniki"></i>
                        ${formatSize(user.attachmentSize)}
                    </td>
                    <td style="text-align: right;" class="storage-cell total">
                        ${formatSize(user.totalSize)}
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error fetching top users:', error);
        const tbody = document.getElementById('topUsersBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center text-error" style="padding: 2rem;">Błąd ładowania rankingu.</td></tr>';
    }
}
