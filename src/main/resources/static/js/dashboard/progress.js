/**
 * Academic Progress Page Logic
 * Handles fetching data from API and rendering the semester progress components.
 */
'use strict';

class AcademicProgress {
    constructor() {
        this.apiEndpoint = '/api/academic-progress';
        this.data = null;
        
        this.init();
    }

    async init() {
        try {
            await this.loadData();
            if (this.data) {
                this.renderAll();
            } else {
                this.showError();
            }
        } catch (error) {
            console.error('Error initializing academic progress:', error);
            this.showError();
        }
    }

    async loadData() {
        const response = await fetch(this.apiEndpoint);
        if (response.ok) {
            this.data = await response.json();
        } else {
            console.error('Failed to fetch academic progress data');
        }
    }

    renderAll() {
        this.renderWeekStatus();
        this.renderProgressBar();
        this.renderCountdowns();
        this.renderUpcomingEvents();
        
        if (!this.data.semesterStart) {
            document.getElementById('noDataInfo').style.display = 'flex';
        }
    }

    renderWeekStatus() {
        const weekTypeEl = document.getElementById('currentWeekType');
        if (weekTypeEl && this.data.currentWeekType) {
            const label = this.data.currentWeekType === 'WEEK_A' ? 'Tydzień A' : 'Tydzień B';
            weekTypeEl.textContent = label;
            
            // Optional: add class for styling
            document.getElementById('weekTypeBadge').classList.add(this.data.currentWeekType.toLowerCase());
        }
    }

    renderProgressBar() {
        const bar = document.getElementById('semesterProgressBar');
        const percentage = document.getElementById('progressPercentage');
        const dayCount = document.getElementById('dayCount');
        const dates = document.getElementById('semesterDates');

        const progressValue = Math.min(100, Math.max(0, this.data.semesterProgress));
        
        const titleEl = document.getElementById('semesterNameTitle');
        if (titleEl && this.data.semesterName) {
            titleEl.textContent = `Mój semestr - semestr ${this.data.semesterName}`;
        }
        
        if (bar) bar.style.width = `${progressValue}%`;
        if (percentage) percentage.textContent = `${progressValue}%`;
        
        if (dayCount) {
             if (this.data.currentDay === 0 && progressValue === 0) {
                 dayCount.textContent = `Semestr jeszcze się nie rozpoczął`;
             } else if (progressValue === 100) {
                 dayCount.textContent = `Semestr zakończony`;
             } else {
                 dayCount.textContent = `Dzień ${this.data.currentDay} z ${this.data.totalDays}`;
             }
        }

        if (dates && this.data.semesterStart && this.data.semesterEnd) {
            const startStr = this.formatDate(this.data.semesterStart);
            const endStr = this.formatDate(this.data.semesterEnd);
            dates.textContent = `${startStr} - ${endStr}`;
        }
    }

    renderCountdowns() {
        // Break
        const breakName = document.getElementById('breakName');
        const daysToBreak = document.getElementById('daysToBreak');
        const breakCard = document.querySelector('.break-card');
        
        if (this.data.nearestBreak) {
            if (breakName) breakName.textContent = this.data.nearestBreak.title;
            if (daysToBreak) daysToBreak.textContent = this.data.daysToBreak;
            if (this.data.daysToBreak === 0) {
                if (breakName) breakName.textContent = `${this.data.nearestBreak.title} (Trwa)`;
                breakCard?.classList.add('active-event');
            }
        } else {
            if (breakName) breakName.textContent = 'Brak zaplanowanych przerw';
            if (daysToBreak) daysToBreak.textContent = '-';
        }

        // Session
        const sessionName = document.getElementById('sessionName');
        const daysToSession = document.getElementById('daysToSession');
        const sessionCard = document.querySelector('.session-card');

        if (this.data.nearestSession) {
            if (sessionName) sessionName.textContent = this.data.nearestSession.title;
            if (daysToSession) daysToSession.textContent = this.data.daysToSession;
            if (this.data.daysToSession === 0) {
                if (sessionName) sessionName.textContent = `${this.data.nearestSession.title} (Trwa)`;
                sessionCard?.classList.add('active-event');
            }
        } else {
            if (sessionName) sessionName.textContent = 'Brak zaplanowanych sesji';
            if (daysToSession) daysToSession.textContent = '-';
        }
    }

    renderUpcomingEvents() {
        const container = document.getElementById('upcomingEventsList');
        
        container.innerHTML = '';
        
        if (this.data.timelineEvents && this.data.timelineEvents.length > 0) {
            const today = new Date();
            today.setHours(0,0,0,0);
            
            // Filter future events and sort
            const upcoming = this.data.timelineEvents
                .filter(e => new Date(e.dateTo || e.dateFrom) >= today && e.type !== 'DIDACTIC')
                .sort((a, b) => new Date(a.dateFrom) - new Date(b.dateFrom))
                .slice(0, 5); // Take top 5
                
            if (upcoming.length === 0) {
                container.innerHTML = '<div class="text-muted text-center w-100" style="padding: 2rem;">Brak nadchodzących wydarzeń w tym semestrze</div>';
                return;
            }

            upcoming.forEach((event, index) => {
                const item = document.createElement('div');
                item.className = `event-list-item type-${event.type.toLowerCase()}`;
                item.style.opacity = '0';
                item.style.animation = `fadeInUp 0.4s ease forwards ${index * 0.1}s`;
                
                let iconClass = 'fas fa-calendar-alt';
                if (event.type === 'EXAM') iconClass = 'fas fa-file-signature';
                if (event.type === 'BREAK') iconClass = 'fas fa-umbrella-beach';
                if (event.type === 'HOLIDAY') iconClass = 'fas fa-flag';
                
                // Calculate days left
                const eventDate = new Date(event.dateFrom);
                eventDate.setHours(0,0,0,0);
                const diffTime = eventDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                let daysText = `<div class="event-days">${diffDays}</div><div class="event-days-label">dni</div>`;
                if (diffDays === 0) daysText = `<div class="event-days" style="color:var(--progress-accent);">Dzisiaj</div>`;
                else if (diffDays === 1) daysText = `<div class="event-days">Jutro</div>`;

                item.innerHTML = `
                    <div class="event-icon-wrapper">
                        <i class="${iconClass}"></i>
                    </div>
                    <div class="event-details">
                        <div class="event-title">${event.title}</div>
                        <div class="event-date">${this.formatDateRange(event.dateFrom, event.dateTo)}</div>
                    </div>
                    <div class="event-countdown">
                        ${daysText}
                    </div>
                `;
                
                container.appendChild(item);
            });
        } else {
            container.innerHTML = '<div class="text-muted text-center w-100" style="padding: 2rem;">Brak wydarzeń w kalendarzu</div>';
        }
    }

    formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    formatDateRange(dateFrom, dateTo) {
        if (!dateFrom) return '';
        const dFrom = new Date(dateFrom);
        const fromStr = dFrom.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
        
        if (!dateTo || dateFrom === dateTo) return fromStr;
        
        const dTo = new Date(dateTo);
        const toStr = dTo.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
        
        if (dFrom.getFullYear() === dTo.getFullYear() && dFrom.getMonth() === dTo.getMonth()) {
            return `${dFrom.getDate()} - ${dTo.getDate()} ${dTo.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}`;
        } else if (dFrom.getFullYear() === dTo.getFullYear()) {
             return `${dFrom.getDate()} ${dFrom.toLocaleDateString('pl-PL', { month: 'long' })} - ${dTo.getDate()} ${dTo.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}`;
        }
        
        return `${fromStr} - ${toStr}`;
    }

    formatDateShort(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
    }

    showError() {
        const container = document.querySelector('.page-container');
        if (container) {
            container.innerHTML = `
                <div class="info-banner">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Wystąpił błąd podczas ładowania danych postępu. Spróbuj odświeżyć stronę.</span>
                </div>
            `;
        }
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    window.academicProgress = new AcademicProgress();
});
