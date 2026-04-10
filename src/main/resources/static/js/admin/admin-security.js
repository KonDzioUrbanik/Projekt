let currentSecurityPage = 0;
let currentSecurityPageSize = 15;

document.addEventListener('DOMContentLoaded', () => {
    initSecurityDashboard();
    
    const refreshBtn = document.getElementById('refreshSecurity');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => fetchSecurityData(true, 0));
    }
    
    const clearBtn = document.getElementById('clearSecurityLogs');
    if (clearBtn) {
        clearBtn.addEventListener('click', confirmClearLogs);
    }
});

async function initSecurityDashboard() {
    await Promise.all([
        adminUtils.refreshGlobalMetrics(),
        fetchSecurityData(false, 0)
    ]);

    setInterval(() => adminUtils.refreshGlobalMetrics(), 30000);
}

async function fetchSecurityData(isManual = false, page = 0) {
    const btn = document.getElementById('refreshSecurity');
    const icon = btn ? btn.querySelector('i') : null;
    currentSecurityPage = page;
    
    if (icon) icon.classList.add('fa-spin');
    if (btn) btn.disabled = true;

    try {
        const [eventsRes, suspiciousRes] = await Promise.all([
            fetch(`/api/admin/security/events?page=${page}&size=${currentSecurityPageSize}`),
            fetch('/api/admin/security/suspicious')
        ]);
        
        const pageData = await adminUtils.handleFetchResponse(eventsRes);
        const suspicious = await adminUtils.handleFetchResponse(suspiciousRes);
        
        renderEventsTable(pageData.content, suspicious);
        renderPagination(pageData);
        updateSecurityStats(pageData.content, suspicious);
        
        if (isManual) {
            Utils.showToast('Dane bezpieczeństwa zostały odświeżone.', 'success');
        }
    } catch (error) {
        console.error('Error fetching security data:', error);
        adminUtils.showError('securityAuditBody', 'Nie udało się pobrać danych bezpieczeństwa.');
        if (isManual) {
            Utils.showToast('Błąd podczas odświeżania danych bezpieczeństwa.', 'error');
        }
    } finally {
        if (icon) icon.classList.remove('fa-spin');
        if (btn) btn.disabled = false;
    }
}

function renderEventsTable(events, suspicious = {}) {
    const tbody = document.getElementById('securityAuditBody');
    if (!tbody) return;

    if (!events || events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem; opacity:0.6;">Brak zarejestrowanych zdarzeń.</td></tr>';
        return;
    }

    tbody.innerHTML = events.map(e => {
        const isSuspicious = suspicious[e.ipAddress] !== undefined;
        return `
            <tr class="${isSuspicious ? 'suspicious-row' : ''}">
                <td style="white-space:nowrap; opacity:0.8;">${new Date(e.timestamp).toLocaleString()}</td>
                <td>
                    <span class="event-type-badge ${getBadgeClass(e.eventType)}">
                        ${adminUtils.escapeHtml(e.eventType)}
                    </span>
                </td>
                <td style="font-family: monospace;">
                    ${isSuspicious ? '<i class="fas fa-exclamation-triangle suspicious-ip-warning" title="Adres oznaczony jako podejrzany"></i>' : ''}
                    ${adminUtils.escapeHtml(e.ipAddress || '—')}
                </td>
                <td class="audit-details" title="${adminUtils.escapeHtml(e.details)}">${adminUtils.escapeHtml(e.details)}</td>
            </tr>
        `;
    }).join('');
}

function renderPagination(pageData) {
    const container = document.getElementById('securityPagination');
    if (!container) return;

    const { totalPages, number, first, last } = pageData;
    
    container.innerHTML = `
        <div class="pagination-controls-wrap">
            <div class="pagination-group">
                <span>Pokaż:</span>
                <select class="pagination-select" onchange="changePageSize(this.value)">
                    <option value="15" ${currentSecurityPageSize === 15 ? 'selected' : ''}>15</option>
                    <option value="30" ${currentSecurityPageSize === 30 ? 'selected' : ''}>30</option>
                    <option value="50" ${currentSecurityPageSize === 50 ? 'selected' : ''}>50</option>
                    <option value="100" ${currentSecurityPageSize === 100 ? 'selected' : ''}>100</option>
                </select>
            </div>
            
            <div class="pagination-group">
                <span>Skocz do:</span>
                <input type="number" class="pagination-input" min="1" max="${totalPages}" value="${number + 1}" 
                       onkeypress="if(event.key === 'Enter') jumpToPage(this.value, ${totalPages})">
            </div>
        </div>

        <div class="pagination-main">
            <button class="pagination-btn" ${first ? 'disabled' : ''} onclick="fetchSecurityData(false, ${number - 1})">
                <i class="fas fa-chevron-left"></i> Poprzednia
            </button>
            <span class="pagination-info">Strona ${number + 1} z ${totalPages}</span>
            <button class="pagination-btn" ${last ? 'disabled' : ''} onclick="fetchSecurityData(false, ${number + 1})">
                Następna <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    `;
}

window.changePageSize = (newSize) => {
    currentSecurityPageSize = parseInt(newSize);
    fetchSecurityData(false, 0);
};

window.jumpToPage = (pageStr, totalPages) => {
    let pageNum = parseInt(pageStr);
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;
    if (pageNum > totalPages) pageNum = totalPages;
    fetchSecurityData(false, pageNum - 1);
};

function getBadgeClass(type) {
    if (type.includes('FAILED') || type.includes('BRUTE')) return 'badge-failed';
    if (type.includes('SUCCESSFUL')) return 'badge-success';
    return 'badge-warning';
}

function updateSecurityStats(events, suspicious) {
    // Statystyki pobieramy z bieżącej strony lub osobnego endpointu jeśli potrzebne
    // Dla uproszczenia liczymy z tego co przyszło w page.content (lub pomijamy jeśli ma być globane)
    const failed24h = events.filter(e => 
        e.eventType === 'FAILED_LOGIN' && 
        new Date(e.timestamp) > new Date(Date.now() - 24*60*60*1000)
    ).length;
    
    const countEl = document.getElementById('failedLoginsCount');
    if (countEl) countEl.textContent = failed24h;

    const suspEl = document.getElementById('suspiciousIpsCount');
    if (suspEl) {
        const ips = Object.keys(suspicious);
        suspEl.textContent = ips.length;
        if (ips.length > 0) {
            suspEl.title = "Podejrzane adresy (kliknij aby skopiować): " + ips.join(', ');
            suspEl.onclick = () => {
                navigator.clipboard.writeText(ips.join(', '));
                Utils.showToast('Skopiowano podejrzane adresy IP.', 'info');
            };
        } else {
            suspEl.title = "";
            suspEl.style.cursor = 'default';
            suspEl.onclick = null;
        }
    }

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
                fetchSecurityData(true, 0);
            } else {
                throw new Error('Failed to clear logs');
            }
        } catch (error) {
            alert('Błąd podczas czyszczenia logów.');
        }
    }
}
