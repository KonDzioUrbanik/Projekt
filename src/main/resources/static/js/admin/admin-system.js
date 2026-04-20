'use strict';

class AdminSystem {
    constructor() {
        this.settings = {};
        this.isRefreshing = false;

        // Mapa przyjaznych nazw dla kluczy ustawień — używana w komunikatach toast
        this.FRIENDLY_NAMES = {
            global_maintenance: 'Tryb konserwacji (globalny)',
            registration_enabled: 'Rejestracja kont',
            login_enabled: 'Logowanie do platformy',
            module_notes: 'Moduł Notatek',
            module_schedule: 'Moduł Harmonogramu zajęć',
            module_announcements: 'Moduł Ogłoszeń grupy',
            module_calendar: 'Moduł Kalendarza',
            module_attendance: 'Moduł Obecności',
            module_forum: 'Moduł Forum',
            module_university_calendar: 'Moduł Kalendarza akademickiego',
            module_semester_progress: 'Moduł Postępu semestru',
            module_starosta_announcements: 'Moduł Ogłoszeń Starosty',
            module_starosta_schedule: 'Moduł Harmonogramu Starosty',
            module_chat: 'Moduł Chat',
            module_analytics: 'Moduł Analityki',
            global_banner_text: 'Komunikat globalny',
        };

        // Dozwolone wartości Logback leveli — chroni przed CSS injection
        this.VALID_LOG_LEVELS = new Set(['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE']);

        this.init();
    }

    async init() {
        this.initializeEventListeners();
        await this.loadSettings();
        await Promise.all([
            this.refreshHealth(),
            adminUtils.refreshGlobalMetrics(),
            this.loadLogs()
        ]);

        // Intervals for background updates
        setInterval(() => this.refreshHealth(), 30000);
        setInterval(() => adminUtils.refreshGlobalMetrics(), 10000); // 10s polling across all tabs
        setInterval(() => this.loadLogs(), 15000);
    }

    initializeEventListeners() {
        document.getElementById('refreshHealth').addEventListener('click', () => {
            this.refreshHealth(true);
            adminUtils.refreshGlobalMetrics();
        });
        
        // Logs actions
        const clearLogsBtn = document.getElementById('clearLogsBtn');
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => this.clearLogs());
        }

        // Banner actions
        document.getElementById('saveBanner').addEventListener('click', () => this.saveBanner());
        document.getElementById('clearBanner').addEventListener('click', () => {
            if (!window.confirm('Czy na pewno chcesz usunąć globalny komunikat? Zniknie natychmiast dla wszystkich użytkowników.')) {
                return;
            }
            document.getElementById('bannerText').value = '';
            this.saveBanner();
        });

        // Toggles — delegacja zdarzeń dla wszystkich przełączników
        document.querySelectorAll('.switch input').forEach(input => {
            input.addEventListener('change', (e) => this.handleToggleChange(e));
        });

        // Modal potwierdzenia trybu konserwacji
        this.initMaintenanceModal();
    }

    /**
     * Inicjalizuje obsługę modala potwierdzenia trybu konserwacji.
     * Modal jest wspólnym wzorcem — używa .modal-overlay + klasy 'active'.
     */
    initMaintenanceModal() {
        const modal  = document.getElementById('maintenanceConfirmModal');
        const btnCancel  = document.getElementById('btnCancelMaintenance');
        const btnConfirm = document.getElementById('btnConfirmMaintenance');
        if (!modal || !btnCancel || !btnConfirm) return;

        // Zamknięcie przez kliknięcie tła
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this._closeMaintenanceModal(false);
        });
        // Zamknięcie klawiszem Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                this._closeMaintenanceModal(false);
            }
        });

        btnCancel.addEventListener('click',  () => this._closeMaintenanceModal(false));
        btnConfirm.addEventListener('click', () => this._closeMaintenanceModal(true));
    }

    _closeMaintenanceModal(confirmed) {
        const modal = document.getElementById('maintenanceConfirmModal');
        if (modal) modal.classList.remove('active');
        if (this._maintenanceModalResolve) {
            this._maintenanceModalResolve(confirmed);
            this._maintenanceModalResolve = null;
        }
    }

    /** Otwiera modal i zwraca Promise<boolean> — true = potwierdzone, false = anulowane. */
    _showMaintenanceModal() {
        return new Promise((resolve) => {
            this._maintenanceModalResolve = resolve;
            const modal = document.getElementById('maintenanceConfirmModal');
            if (modal) modal.classList.add('active');
        });
    }

    /**
     * Obsługa zmiany przełącznika.
     * Dla globalnego trybu konserwacji wymagane potwierdzenie przez modal —
     * jedno kliknięcie może zablokować dostęp do platformy dla wszystkich użytkowników.
     */
    async handleToggleChange(e) {
        const key = e.target.id.replace('toggle-', '');
        const value = e.target.checked ? 'true' : 'false';

        if (key === 'global_maintenance' && value === 'true') {
            const confirmed = await this._showMaintenanceModal();
            if (!confirmed) {
                e.target.checked = false;
                return;
            }
        }

        this.updateSetting(key, value);
    }

    async loadSettings() {
        try {
            const response = await fetch('/api/system/settings');
            if (!response.ok) throw new Error('Błąd pobierania ustawień');

            const data = await response.json();
            data.forEach(setting => {
                this.settings[setting.settingKey] = setting.settingValue;

                const toggle = document.getElementById(`toggle-${setting.settingKey}`);
                if (toggle) {
                    toggle.checked = setting.settingValue === 'true';
                }

                if (setting.settingKey === 'global_banner_text') {
                    const bannerEl = document.getElementById('bannerText');
                    if (bannerEl) {
                        bannerEl.value = setting.settingValue || '';
                        const counter = document.getElementById('bannerCharCount');
                        if (counter) counter.textContent = bannerEl.value.length;
                    }
                }
            });

            this.updateLastSyncTime();
        } catch (error) {
            console.error('System settings load failed:', error);
            Utils.showToast('Nie udało się załadować ustawień systemu.', 'error');
        }
    }

    async updateSetting(key, value) {
        try {
            const response = await fetch('/api/system/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });

            if (!response.ok) {
                // Serwer zwraca JSON z polem "error" przy błędzie walidacji
                let errMsg = 'Błąd podczas aktualizacji ustawienia.';
                try {
                    const errData = await response.json();
                    if (errData && errData.error) errMsg = errData.error;
                } catch (_) { /* ignoruj błąd parsowania */ }
                throw new Error(errMsg);
            }

            const name = this.FRIENDLY_NAMES[key] || `ustawienie "${key}"`;
            Utils.showToast(`Pomyślnie zaktualizowano: ${name}`, 'success');
            this.updateLastSyncTime();
        } catch (error) {
            console.error('Update setting failed:', error);
            Utils.showToast(error.message || 'Błąd podczas aktualizacji ustawienia.', 'error');
            // Przywróć poprzedni stan w UI w razie błędu
            this.loadSettings();
        }
    }

    async saveBanner() {
        const textarea = document.getElementById('bannerText');
        const text = textarea.value.trim();

        const MAX_LENGTH = 500;
        if (text.length > MAX_LENGTH) {
            Utils.showToast(`Treść bannera jest za długa (${text.length}/${MAX_LENGTH} znaków).`, 'error');
            return;
        }

        await this.updateSetting('global_banner_text', text);
    }

    async refreshHealth(isManual = false) {
        if (this.isRefreshing) return;
        this.isRefreshing = true;

        const btn = document.getElementById('refreshHealth');
        const icon = btn ? btn.querySelector('i') : null;
        if (icon) icon.classList.add('fa-spin');
        if (btn) btn.disabled = true;

        try {
            const response = await fetch('/api/system/health');
            if (!response.ok) throw new Error('Błąd health check');

            const health = await response.json();
            this.updateHealthIndicator('dbStatus', health.database);
            this.updateHealthIndicator('smtpStatus', health.smtp);
            this.updateLastSyncTime();

            if (isManual) {
                Utils.showToast('Stan usług został odświeżony.', 'success');
            }
        } catch (error) {
            console.error('Health check failed:', error);
            this.updateHealthIndicator('dbStatus', false);
            this.updateHealthIndicator('smtpStatus', false);
            if (isManual) {
                Utils.showToast('Błąd podczas odświeżania stanu usług.', 'error');
            }
        } finally {
            this.isRefreshing = false;
            if (icon) icon.classList.remove('fa-spin');
            if (btn) btn.disabled = false;
        }
    }

    updateHealthIndicator(id, status) {
        const el = document.getElementById(id);
        if (!el) return;

        el.className = 'health-status-indicator ' + (status ? 'status-online' : 'status-offline');
        el.querySelector('.status-text').textContent = status ? 'Działa' : 'Błąd połączenia';
    }

    updateLastSyncTime() {
        const el = document.getElementById('lastSyncTime');
        if (el) {
            el.textContent = new Date().toLocaleTimeString();
        }
    }

    async loadLogs() {
        try {
            const response = await fetch('/api/system/logs');
            if (!response.ok) throw new Error('Błąd pobierania logów');

            const logs = await response.json();
            const listElement  = document.getElementById('logsList');
            const emptyElement = document.getElementById('logsEmpty');

            if (!listElement || !emptyElement) return;

            if (!logs || logs.length === 0) {
                listElement.style.display = 'none';
                emptyElement.style.display = 'block';
                return;
            }

            listElement.style.display = 'block';
            emptyElement.style.display = 'none';
            listElement.innerHTML = logs.map(log => this.renderLogEntry(log)).join('');

        } catch (error) {
            console.error('Logs fetch failed:', error);
        }
    }

    async clearLogs() {
        if (!window.confirm('Czy na pewno chcesz wyczyścić wszystkie logi systemowe?')) {
            return;
        }

        const btn = document.getElementById('clearLogsBtn');
        if (btn) btn.disabled = true;

        try {
            const response = await fetch('/api/system/logs', {
                method: 'DELETE',
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });

            if (response.ok) {
                Utils.showToast('Logi systemowe zostały wyczyszczone.', 'success');
                await this.loadLogs();
            } else {
                throw new Error('Błąd serwera');
            }
        } catch (error) {
            console.error('Clear logs failed:', error);
            Utils.showToast('Nie udało się wyczyścić logów.', 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    /**
     * Renderuje pojedynczy wpis logu.
     * log.level jest weryfikowany względem whitelisty przed użyciem jako className,
     * co chroni przed CSS injection, gdyby payload logu zawierał znaki specjalne.
     */
    renderLogEntry(log) {
        const time = new Date(log.timestamp).toLocaleTimeString();
        // Whitelist leveli — nie ufamy wartości z serwera jako class name bez walidacji
        const safeLevel = this.VALID_LOG_LEVELS.has(log.level) ? log.level : 'UNKNOWN';
        const safeMsg   = this.escapeHtml(log.message);

        return `<div class="log-entry">
            <span class="log-time">${time}</span>
            <span class="log-level ${safeLevel}">${safeLevel}</span>
            <span class="log-msg">${safeMsg}</span>
        </div>`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

let adminSystem;
document.addEventListener('DOMContentLoaded', () => {
    adminSystem = new AdminSystem();
});
