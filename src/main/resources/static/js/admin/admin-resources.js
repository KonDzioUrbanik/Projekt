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
    document.getElementById('avatarSizeValue').textContent = formatSize(stats.totalAvatarSize);
    document.getElementById('attachmentSizeValue').textContent = formatSize(stats.totalAttachmentSize);

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
    document.getElementById('attachmentCount').textContent = 'Relatywne wykorzystanie limitu';
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
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Brak danych o zużyciu zasobów.</td></tr>';
            return;
        }

        const formatSize = (bytes) => {
            if (!bytes || bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        tbody.innerHTML = users.map(user => `
            <tr>
                <td style="font-weight:600; opacity:0.7;">#${user.id}</td>
                <td>${adminUtils.escapeHtml(user.first_name || user.firstName)} ${adminUtils.escapeHtml(user.last_name || user.lastName)}</td>
                <td style="opacity:0.8;">${adminUtils.escapeHtml(user.email)}</td>
                <td style="font-family:monospace;">${formatSize(user.avatarSize || user.avatar_size)}</td>
                <td style="font-family:monospace;">${formatSize(user.attachmentSize || user.attachment_size)}</td>
                <td style="font-family:monospace; font-weight:700;">${formatSize(user.totalSize || user.total_size)}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error fetching top users:', error);
        const tbody = document.getElementById('topUsersBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-error">Błąd ładowania danych.</td></tr>';
    }
}
