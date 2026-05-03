
class FullCalendarInitializer {
    static CONFIG = {
        TIMING: {
            LOADING_DELAY: 500,
            RESIZE_DELAY: 100
        },
        LOCALE: 'pl',
        ERROR_MESSAGES: {
            INIT_ERROR: 'Błąd ładowania kalendarza',
            NO_ELEMENTS: 'Brak wymaganych elementów DOM.'
        },
        CALENDAR_OPTIONS: {
            FIRST_DAY: 1
        }
    };

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
            console.error(FullCalendarInitializer.CONFIG.ERROR_MESSAGES.NO_ELEMENTS);
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
        await new Promise(resolve => setTimeout(resolve, FullCalendarInitializer.CONFIG.TIMING.LOADING_DELAY));

        try {
            // Inicjalizacja FullCalendar
            this.calendarInstance = new FullCalendar.Calendar(this.calendarEl, {
                initialView: 'dayGridMonth',
                initialDate: new Date(),
                locale: FullCalendarInitializer.CONFIG.LOCALE,
                firstDay: FullCalendarInitializer.CONFIG.CALENDAR_OPTIONS.FIRST_DAY, 
                height: 'auto',
                handleWindowResize: true,
                windowResizeDelay: FullCalendarInitializer.CONFIG.TIMING.RESIZE_DELAY,

                eventDidMount: function(info) {
                    const title = info.event.title.toLowerCase();
                    const element = info.el;
                    
                    if (title.includes('wykład')) {
                        element.style.setProperty('background-color', '#3b82f6', 'important');
                        element.style.setProperty('border-color', '#2563eb', 'important');
                    } else if (title.includes('ćwiczenia') || title.includes('laboratoria')) {
                        element.style.setProperty('background-color', '#10b981', 'important');
                        element.style.setProperty('border-color', '#059669', 'important');
                    } else if (title.includes('egzamin') || title.includes('sesja')) {
                        element.style.setProperty('background-color', '#ef4444', 'important');
                        element.style.setProperty('border-color', '#dc2626', 'important');
                    }
                },

                headerToolbar: {
                    left: 'prev',
                    right: 'next',
                    center: 'title',
                    right: 'today next'
                },


                // Tutaj można dodać events: this.fetchEventsFromApi(),
                events: eventsData,
                eventContent: this.customEventContent,
                datesSet: this.updateMonthTitle.bind(this), 

                //WYSKAKUJĄCE OKIENKO ===
                eventClick: function(info) {
                    info.jsEvent.preventDefault(); // Blokuje domyślne zachowanie przeglądarki
                    
                    // Wstrzykujemy dane do okienka
                    document.getElementById('modalEventTitle').innerText = info.event.title;
                    document.getElementById('modalEventType').innerText = info.event.extendedProps.type || 'Wydarzenie';
                    document.getElementById('modalEventDate').innerText = info.event.extendedProps.formattedDateRange || info.event.start.toLocaleDateString();
                    
                    // Pokazujemy okienko
                    document.getElementById('eventModal').style.display = 'block';
                }
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
                this.calendarEl.innerHTML = `<div class="error-message"><h3>${FullCalendarInitializer.CONFIG.ERROR_MESSAGES.INIT_ERROR}</h3></div>`;
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
        
        let boldTitle = document.createElement('strong');
        boldTitle.textContent = title;
        
        titleContainer.appendChild(boldTitle);
        titleContainer.appendChild(document.createTextNode(` ${time}`));

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
            locale: FullCalendarInitializer.CONFIG.LOCALE
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

// Filtrowanie
async function fetchAndRenderFilteredEvents() {
    const filterSelect = document.getElementById('eventTypeFilter');
    const selectedType = filterSelect.value;
    
    const initializer = window.calendarInitializerInstance || new FullCalendarInitializer();
    // Żeby nie tworzyć w kółko nowych instancji
    window.calendarInitializerInstance = initializer;

    try {
        let apiUrl = '/api/calendar';
        if (selectedType !== 'ALL') {
            apiUrl = `/api/calendar/filter?type=${selectedType}`;
        }
        
        // Pokazujemy loader
        if(initializer.loadingEl) initializer.loadingEl.classList.add('active');
        if(initializer.calendarEl) initializer.calendarEl.style.display = 'none';

        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`Błąd HTTP: ${response.status}`);
        }
        
        const rawData = await response.json();
        
        // Mapowanie DTO ze Springa na format FullCalendar
        const formattedEvents = rawData.map(event => ({
            id: event.id,
            title: event.title,
            start: event.dateFrom,
            end: event.dateTo,
            backgroundColor: event.markerColor || '#3788d8', // Domyślny kolor jeśli brak
            extendedProps: {
                type: event.type,
                formattedDateRange: event.formattedDateRange // <-- TO DODAJEMY
            }
        }));

        await initializer.renderCalendar(formattedEvents);

    } catch (error) {
        console.error("Błąd podczas pobierania filtrowanych zdarzeń:", error);
    }
}

// --- EKSPORT DO ICS ---
document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('exportIcsBtn');
    
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            // Pobieramy instancję z Twojej klasy!
            const calendar = window.fullCalendarInstance; 
            
            if (!calendar) {
                alert("Kalendarz jeszcze się nie załadował!");
                return;
            }

            const events = calendar.getEvents();
            if (events.length === 0) {
                alert("Brak wydarzeń do wyeksportowania.");
                return;
            }

            let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Twoja Uczelnia//Kalendarz//PL\n";

            events.forEach(event => {
                const start = event.start ? event.start.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' : '';
                const end = event.end ? event.end.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' : start;

                icsContent += "BEGIN:VEVENT\n";
                if (start) icsContent += `DTSTART:${start}\n`;
                if (end) icsContent += `DTEND:${end}\n`;
                icsContent += `SUMMARY:${event.title}\n`;
                
                if (event.extendedProps) {
                    if (event.extendedProps.room) icsContent += `LOCATION:${event.extendedProps.room}\n`;
                    if (event.extendedProps.lecturer) icsContent += `DESCRIPTION:Prowadzący: ${event.extendedProps.lecturer}\n`;
                }
                icsContent += "END:VEVENT\n";
            });

            icsContent += "END:VCALENDAR";

            const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'moj_plan_zajec.ics');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }
});
