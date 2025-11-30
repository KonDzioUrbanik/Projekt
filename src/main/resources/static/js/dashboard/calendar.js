
class FullCalendarInitializer {
    constructor() {
        this.calendarEl = document.getElementById('calendarGrid');
        this.currentMonthNameEl = document.getElementById('currentMonth');
        this.calendarInstance = null; // Instancja kalendarza (FullCalendar)
        this.loadingEl = document.getElementById('loadingCalendar');

        this.prevMonthBtn = document.getElementById('prevMonthBtn');
        this.nextMonthBtn = document.getElementById('nextMonthBtn');
        this.todayBtn = document.getElementById('todayBtn');
        
        this.navigationSetupDone = false; // Flaga, by nie dodawać wielokrotnie słuchaczy do przycisków
    }

    /**
     * Inicjalizuje lub ponownie inicjalizuje kalendarz FullCalendar.
     * @param {Array} eventsData - Dane zdarzeń w formacie FullCalendar.
     */
    async renderCalendar(eventsData = []) {
        if (!this.calendarEl || !this.currentMonthNameEl || !this.loadingEl) {
            console.error("Brak wymaganych elementów DOM.");
            return;
        }

        this.loadingEl.classList.add('active');
        this.calendarEl.style.display = 'none';
        
        // Zniszczenie istniejącej instancji przed utworzeniem nowej
        if (this.calendarInstance) {
            this.calendarInstance.destroy();
            this.calendarInstance = null;
        }

        //Symulacja danych
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            // Inicjalizacja FullCalendar
            this.calendarInstance = new FullCalendar.Calendar(this.calendarEl, {
                initialView: 'dayGridMonth',
                initialDate: new Date(),
                locale: 'pl',
                firstDay: 1, 
                height: 'auto',

                headerToolbar: {
                    left: 'prev',
                    right: 'next',
                    center: 'title',
                    right: 'today next'
                },

                // Tutaj można dodać events: this.fetchEventsFromApi(),
                events: eventsData,
                eventContent: this.customEventContent,
                datesSet: this.updateMonthTitle.bind(this)
            });
            
            this.calendarInstance.render();
            
            // Ustawienie nasłuchiwania dla niestandardowej nawigacji tylko raz
            if (!this.navigationSetupDone) {
                 this.setupNavigation();
                 this.navigationSetupDone = true;
            }
            
            window.fullCalendarInstance = this.calendarInstance;

        } catch (error) {
            console.error('Błąd inicjalizacji/ładowania kalendarza:', error);
            // Wyświetlenie komunikatu o błędzie, jeśli błąd dotyczy ładowania danych
            if (this.calendarEl) {
                this.calendarEl.innerHTML = '<div class="error-message"><h3>Błąd ładowania kalendarza</h3></div>';
                this.calendarEl.style.display = 'block';
            }
        } finally {
            // 2. UKRYJ EKRAN ŁADOWANIA I POKAŻ KALENDARZ
            this.loadingEl.classList.remove('active');
            
            // Pokazujemy kalendarz tylko jeśli nie wystąpił błąd krytyczny
            // (FullCalendar wstrzykuje swoje elementy do środka calendarEl)
            this.calendarEl.style.display = 'block';
            
            // Ważne dla FullCalendar: czasem po zmianie display:none -> block trzeba przeliczyć rozmiar
            if (this.calendarInstance) {
                this.calendarInstance.updateSize();
            }
        }
    }

    // Metoda obsługująca niestandardowe renderowanie zdarzeń
    customEventContent(arg) {
        const title = arg.event.title.split(' ')[0];
        const time = arg.event.extendedProps.time || '';

        let dot = document.createElement('span');
        dot.className = 'event-dot';

        let titleContainer = document.createElement('div');
        titleContainer.className = 'fc-event-title-container';
        titleContainer.innerHTML = `<strong>${title}</strong> ${time}`;

        let eventWrapper = document.createElement('div');
        eventWrapper.className = 'event-item-custom';
        eventWrapper.appendChild(dot);
        eventWrapper.appendChild(titleContainer);

        return { domNodes: [eventWrapper] };
    }

    // Metoda aktualizująca wyświetlaną nazwę miesiąca
    updateMonthTitle(info) {
        const monthName = FullCalendar.formatDate(info.view.currentStart, {
            month: 'long',
            locale: 'pl'
        });
        this.currentMonthNameEl.innerHTML = `<h2></h2> ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`;
    }

    // Metoda do konfiguracji przycisków nawigacyjnych
    setupNavigation() {
        if (this.prevMonthBtn) {
            this.prevMonthBtn.addEventListener('click', () => this.calendarInstance.prev());
        }
        if (this.nextMonthBtn) {
            this.nextMonthBtn.addEventListener('click', () => this.calendarInstance.next());
        }
        if (this.todayBtn) {
            this.todayBtn.addEventListener('click', () => this.calendarInstance.today());
        }
    }
}

// Udostępnienie klasy globalnie, bez automatycznej inicjalizacji
window.FullCalendarInitializer = FullCalendarInitializer;