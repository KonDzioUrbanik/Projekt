document.addEventListener('DOMContentLoaded', () => {
    initSecurityDashboard();
    
    const refreshBtn = document.getElementById('refreshSecurity');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', fetchSecurityData);
    }
    
    const clearBtn = document.getElementById('clearSecurityLogs');
    if (clearBtn) {
        clearBtn.addEventListener('click', confirmClearLogs);
    }
});

async function initSecurityDashboard() {
    await Promise.all([
        adminUtils.refreshGlobalMetrics(),
        fetchSecurityData()
    ]);

    setInterval(() => adminUtils.refreshGlobalMetrics(), 10000); // Sync with other tabs
}

async function fetchSecurityData() {
    const btn = document.getElementById('refreshSecurity');
    if (btn) btn.classList.add('fa-spin-active');

    try {
        const [eventsRes, suspiciousRes] = await Promise.all([
            fetch('/api/admin/security/events'),
            fetch('/api/admin/security/suspicious')
        ]);
        
        const events = await adminUtils.handleFetchResponse(eventsRes);
        const suspicious = await adminUtils.handleFetchResponse(suspiciousRes);
        
        renderEventsTable(events);
        updateSecurityStats(events, suspicious);
    } catch (error) {
        console.error('Error fetching security data:', error);
        adminUtils.showError('securityAuditBody', 'Nie udało się pobrać danych bezpieczeństwa.');
    } finally {
        if (btn) btn.classList.remove('fa-spin-active');
    }
}

function renderEventsTable(events) {
    const tbody = document.getElementById('securityAuditBody');
    if (!tbody) return;

    if (!events || events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem; opacity:0.6;">Brak zarejestrowanych zdarzeń.</td></tr>';
        return;
    }

    tbody.innerHTML = events.slice(0, 50).map(e => `
        <tr>
            <td style="white-space:nowrap; opacity:0.8;">${new Date(e.timestamp).toLocaleString()}</td>
            <td>
                <span class="event-type-badge ${getBadgeClass(e.eventType)}">
                    ${adminUtils.escapeHtml(e.eventType)}
                </span>
            </td>
            <td style="font-family: monospace;">${adminUtils.escapeHtml(e.ipAddress || '—')}</td>
            <td class="audit-details" title="${adminUtils.escapeHtml(e.details)}">${adminUtils.escapeHtml(e.details)}</td>
        </tr>
    `).join('');
}

function getBadgeClass(type) {
    if (type.includes('FAILED') || type.includes('BRUTE')) return 'badge-failed';
    if (type.includes('SUCCESSFUL')) return 'badge-success';
    return 'badge-warning';
}

function updateSecurityStats(events, suspicious) {
    const failed24h = events.filter(e => 
        e.eventType === 'FAILED_LOGIN' && 
        new Date(e.timestamp) > new Date(Date.now() - 24*60*60*1000)
    ).length;
    
    const countEl = document.getElementById('failedLoginsCount');
    if (countEl) countEl.textContent = failed24h;

    const suspEl = document.getElementById('suspiciousIpsCount');
    if (suspEl) suspEl.textContent = Object.keys(suspicious).length;

    analyzeSecurityStatus(failed24h, Object.keys(suspicious).length);
}

function analyzeSecurityStatus(failed, suspicious) {
    const safetyValueEl = document.getElementById('systemSafetyValue');
    const safetyItemEl = document.getElementById('systemSafetyItem');

    if (safetyValueEl && safetyItemEl) {
        let status = 'BEZPIECZNY';
        let statusClass = 'status-ok';

        if (failed > 50 || suspicious > 5) {
            status = 'ZAGROŻONY';
            statusClass = 'status-error';
        } else if (failed > 10 || suspicious > 0) {
            status = 'OSTRZEŻENIE';
            statusClass = 'status-warning';
        }

        safetyValueEl.textContent = status;
        safetyItemEl.className = 'summary-item ' + statusClass;
    }
}

async function confirmClearLogs() {
    if (confirm('Czy na pewno chcesz WYCZYŚCIĆ WSZYSTKIE logi bezpieczeństwa? Tej operacji nie można cofnąć.')) {
        try {
            const res = await fetch('/api/admin/security/events', { method: 'DELETE' });
            if (res.ok) {
                fetchSecurityData();
            } else {
                throw new Error('Failed to clear logs');
            }
        } catch (error) {
            alert('Błąd podczas czyszczenia logów.');
        }
    }
}
