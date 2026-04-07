const adminUtils = {
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    async handleFetchResponse(response) {
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || 'Fetch failed');
        }
        return response.json();
    },

    showError(containerId, message) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `<div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${this.escapeHtml(message)}</p>
            </div>`;
        }
    },

    async refreshGlobalMetrics() {
        try {
            const response = await fetch('/api/admin/health/live');
            if (!response.ok) return;
            const metrics = await response.json();

            // Uptime
            const s = metrics.uptimeSeconds;
            const d = Math.floor(s / 86400);
            const h = Math.floor((s % 86400) / 3600);
            const m = Math.floor((s % 3600) / 60);
            const uptimeValue = document.getElementById('uptimeValue');
            if (uptimeValue) uptimeValue.textContent = `${d}d ${h}h ${m}m`;

            // Requests
            const totalRequestsValue = document.getElementById('totalRequestsValue');
            if (totalRequestsValue) totalRequestsValue.textContent = metrics.totalRequests.toLocaleString();

            // Errors
            const errorRateValue = document.getElementById('errorRateValue');
            const errorsSummaryItem = document.getElementById('errorsSummaryItem');
            if (errorRateValue && errorsSummaryItem) {
                errorRateValue.textContent = `${metrics.errorRequests} / ${metrics.clientErrors}`;
                
                // Visual state (Red = 5xx, Orange = 4xx, Green = OK)
                errorsSummaryItem.classList.remove('status-ok', 'status-warning', 'status-error');
                if (metrics.errorRequests > 0) {
                    errorsSummaryItem.classList.add('status-error');
                } else if (metrics.clientErrors > 0) {
                    errorsSummaryItem.classList.add('status-warning');
                } else {
                    errorsSummaryItem.classList.add('status-ok');
                }

                // Unified Tooltip (4xx & 5xx)
                let tooltip = `5xx: Błędy serwera, 4xx: Błędy klienta`;
                
                if (metrics.recent5xxPaths && metrics.recent5xxPaths.length > 0) {
                    tooltip += `\n\n[!] OSTATNIE 5xx (BŁĘDY SERWERA):\n${metrics.recent5xxPaths.slice(0, 5).join('\n')}`;
                }
                
                if (metrics.recent4xxPaths && metrics.recent4xxPaths.length > 0) {
                    tooltip += `\n\n[?] OSTATNIE 4xx (BŁĘDY KLIENTA):\n${metrics.recent4xxPaths.slice(0, 5).join('\n')}`;
                }
                
                errorsSummaryItem.title = tooltip;

                // Behavior: Click to scroll to logs (if on system page)
                if (!errorsSummaryItem.dataset.listenerSet) {
                    errorsSummaryItem.style.cursor = 'pointer';
                    errorsSummaryItem.addEventListener('click', () => {
                        const logsCard = document.querySelector('.logs-card');
                        if (logsCard) {
                            logsCard.scrollIntoView({ behavior: 'smooth' });
                        } else {
                            // If not on system page, maybe redirect? 
                            // But user says "obojetnie w ktorej zakładce", 
                            // usually scrolling is enough if the card exists.
                        }
                    });
                    errorsSummaryItem.dataset.listenerSet = 'true';
                }
            }

            // Backend Status (Unified top bar)
            const backendStatusValue = document.getElementById('backendStatusValue');
            if (backendStatusValue) {
                const status = metrics.statusBackend || (metrics.status === 'UP' ? 'SPRAWNY' : 'AWARIA');
                backendStatusValue.textContent = status;
                
                const parent = backendStatusValue.closest('.summary-item');
                if (parent) {
                    parent.classList.remove('status-ok', 'status-warning', 'status-error');
                    if (status === 'SPRAWNY' || status === 'OK') parent.classList.add('status-ok');
                    else if (status === 'OSTRZEŻENIE') {
                        parent.classList.add('status-warning');
                        backendStatusValue.title = "Problemy z niektórymi usługami (np. SMTP)";
                    } else parent.classList.add('status-error');
                }
            }
            
            // Last sync
            const lastSync = document.getElementById('lastSyncTime');
            if (lastSync) lastSync.textContent = new Date().toLocaleTimeString();
        } catch (e) {
            console.error('Global metrics fetch failed:', e);
        }
    }
};

window.adminUtils = adminUtils;
