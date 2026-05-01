'use strict';

class AdminScheduleView extends ScheduleCalendar {
    constructor() {
        super();
        this.groupSelector = document.getElementById('adminGroupSelector');
        this.initialState = document.getElementById('adminInitialState');
        this.scheduleControls = document.getElementById('adminScheduleControls');
        this.grid = document.getElementById('scheduleGrid');
        
        this.setupAdminListeners();
        this.loadGroups();
    }

    // Nadpisujemy loadData, aby nie ładować harmonogramu na starcie
    async loadData() {
        const loading = document.getElementById('loading');
        loading?.classList.add('active');

        try {
            await Promise.all([
                this.loadAcademicConfig(),
                this.loadCalendarEvents()
            ]);
            
            this.populateWeekSelector();
            this.updateControls();
        } catch(error) {
            console.error('Błąd inicjalizacji widoku admina:', error);
        } finally {
            loading?.classList.remove('active');
        }
    }

    async loadGroups() {
        try {
            const res = await fetch('/api/groups');
            if (res.ok) {
                const groups = await res.json();
                this.populateGroupSelector(groups);
            }
        } catch (e) {
            console.error('Błąd ładowania grup:', e);
        }
    }

    populateGroupSelector(groups) {
        if (!this.groupSelector) return;
        
        // Wyciągamy unikalne nazwy kierunków (bez dopisku stacjonarne/niestacjonarne)
        const fieldsOfStudy = new Set();
        groups.forEach(group => {
            // Wycinamy " stacjonarne" lub " niestacjonarne" z końca nazwy
            const baseName = group.name.replace(/\s+(stacjonarne|niestacjonarne)$/i, '').trim();
            fieldsOfStudy.add(baseName);
        });

        // Sortowanie alfabetyczne
        const sortedFields = Array.from(fieldsOfStudy).sort((a, b) => a.localeCompare(b, 'pl'));
        
        // Wyczyść i dodaj opcje
        this.groupSelector.innerHTML = '<option value="" selected>-- Wybierz z listy --</option>';
        
        sortedFields.forEach(field => {
            const opt = document.createElement('option');
            opt.value = field;
            opt.textContent = field;
            this.groupSelector.appendChild(opt);
        });
    }

    setupAdminListeners() {
        this.groupSelector?.addEventListener('change', (e) => {
            const fieldName = e.target.value;
            if (fieldName) {
                this.loadAggregatedSchedule(fieldName);
            } else {
                this.showEmptyState();
            }
        });
    }

    async loadAggregatedSchedule(fieldName) {
        const loading = document.getElementById('loading');
        loading?.classList.add('active');
        this.initialState.style.display = 'none';
        this.grid.style.display = 'none';

        try {
            const res = await fetch(`/api/schedule/field?name=${encodeURIComponent(fieldName)}`);
            if (res.ok) {
                this.scheduleData = await res.json();
                this.renderFilters();
                this.renderSchedule();
                
                this.scheduleControls.style.display = 'flex';
                this.grid.style.display = 'grid';
                
                setTimeout(() => this.scrollToCurrentTime(), 150);
            } else {
                throw new Error('Nie udało się pobrać harmonogramu dla wybranego kierunku');
            }
        } catch (e) {
            Utils.showToast(e.message, 'error');
            this.showEmptyState();
        } finally {
            loading?.classList.remove('active');
        }
    }

    showEmptyState() {
        this.scheduleData = [];
        this.initialState.style.display = 'flex';
        this.scheduleControls.style.display = 'none';
        this.grid.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.adminScheduleView = new AdminScheduleView();
});
