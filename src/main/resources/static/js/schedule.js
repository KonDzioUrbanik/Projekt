class ScheduleCalendar{
    constructor(){
        this.scheduleData = [];
        this.apiEndpoint = '/api/schedule';
        
        this.dayNames = {
            'MONDAY': 'Poniedziałek',
            'TUESDAY': 'Wtorek',
            'WEDNESDAY': 'Środa',
            'THURSDAY': 'Czwartek',
            'FRIDAY': 'Piątek'
        };
        
        this.loadSchedule();
    }

    // tymczasowe dane do testow
    // mozna jeszcze dodac typ zajec (wyklad, cwiczenia laboratoryjne, cwiczenia projektowe)
    getMockData(){
        return [
            {
                id: 1,
                title: "Programowanie w Javie",
                room: "A-101",
                teacher: "Dr Jan Kowalski",
                dayOfWeek: "MONDAY",
                startTime: { hour: 8, minute: 0, second: 0, nano: 0 },
                endTime: { hour: 9, minute: 30, second: 0, nano: 0 }
            },
            {
                id: 2,
                title: "Bazy danych",
                room: "B-205",
                teacher: "Prof. Anna Nowak",
                dayOfWeek: "MONDAY",
                startTime: { hour: 10, minute: 0, second: 0, nano: 0 },
                endTime: { hour: 11, minute: 30, second: 0, nano: 0 }
            },
            {
                id: 3,
                title: "Algorytmy i struktury danych",
                room: "C-301",
                teacher: "Dr Piotr Wiśniewski",
                dayOfWeek: "TUESDAY",
                startTime: { hour: 8, minute: 0, second: 0, nano: 0 },
                endTime: { hour: 9, minute: 30, second: 0, nano: 0 }
            },
            {
                id: 4,
                title: "Inżynieria oprogramowania",
                room: "A-102",
                teacher: "Mgr Katarzyna Lewandowska",
                dayOfWeek: "TUESDAY",
                startTime: { hour: 12, minute: 0, second: 0, nano: 0 },
                endTime: { hour: 13, minute: 30, second: 0, nano: 0 }
            },
            {
                id: 5,
                title: "Systemy operacyjne",
                room: "D-401",
                teacher: "Dr Tomasz Zieliński",
                dayOfWeek: "WEDNESDAY",
                startTime: { hour: 9, minute: 45, second: 0, nano: 0 },
                endTime: { hour: 11, minute: 15, second: 0, nano: 0 }
            },
            {
                id: 6,
                title: "Sieci komputerowe",
                room: "E-501",
                teacher: "Prof. Marek Kamiński",
                dayOfWeek: "WEDNESDAY",
                startTime: { hour: 13, minute: 15, second: 0, nano: 0 },
                endTime: { hour: 14, minute: 45, second: 0, nano: 0 }
            },
            {
                id: 7,
                title: "Matematyka dyskretna",
                room: "F-102",
                teacher: "Dr Ewa Mazur",
                dayOfWeek: "THURSDAY",
                startTime: { hour: 8, minute: 0, second: 0, nano: 0 },
                endTime: { hour: 9, minute: 30, second: 0, nano: 0 }
            },
            {
                id: 8,
                title: "Programowanie obiektowe",
                room: "A-101",
                teacher: "Dr Jan Kowalski",
                dayOfWeek: "THURSDAY",
                startTime: { hour: 10, minute: 0, second: 0, nano: 0 },
                endTime: { hour: 11, minute: 30, second: 0, nano: 0 }
            },
            {
                id: 9,
                title: "Laboratorium Java",
                room: "LAB-2",
                teacher: "Mgr Paweł Dąbrowski",
                dayOfWeek: "FRIDAY",
                startTime: { hour: 12, minute: 0, second: 0, nano: 0 },
                endTime: { hour: 14, minute: 30, second: 0, nano: 0 }
            },
            {
                id: 10,
                title: "Projekt zespołowy",
                room: "C-303",
                teacher: "Dr Anna Nowak",
                dayOfWeek: "FRIDAY",
                startTime: { hour: 15, minute: 0, second: 0, nano: 0 },
                endTime: { hour: 16, minute: 30, second: 0, nano: 0 }
            }
        ];
    }
    
    // zaladowanie harmonogramu zajec z API
    async loadSchedule(){
        const loading = document.getElementById('loading');
        const grid = document.getElementById('scheduleGrid');
        
        loading.classList.add('active');
        grid.style.display = 'none';
        
        // odkomentuj dla api
        // try{
        //     const response = await fetch(this.apiEndpoint);
        //     this.scheduleData = await response.json();
        //     this.renderSchedule();
        // } 
        // catch (error){
        //     console.error('Błąd:', error);
        //     grid.innerHTML = '<div class="error-message"><h3>Błąd ładowania harmonogramu zajęć</h3></div>';
        // } 
        // finally{
        //     loading.classList.remove('active');
        //     grid.style.display = 'grid';
        // }


        // tymczasowe dane do testow
        try{            
            // opoznienie do symulacji ladowania
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // zaladowanie przykladowych danych
            this.scheduleData = this.getMockData();
            
            console.log('Załadowano mockowe dane:', this.scheduleData);
            
            this.renderSchedule();
            
        } 
        catch(error){
            console.error('Błąd:', error);
            grid.innerHTML = '<div class="error-message"><h3>Błąd ładowania harmonogramu zajęć</h3></div>';
            grid.style.display = 'block';
        } 
        finally{
            loading.classList.remove('active');
            grid.style.display = 'grid';
        }
    }
    
    // renderowanie harmonogramu zajec
    renderSchedule(){
        const grid = document.getElementById('scheduleGrid');
        grid.innerHTML = '';
        
        // sprwadzenie czy sa dane
        if(!this.scheduleData || this.scheduleData.length === 0){
            grid.innerHTML = `
                <div class="empty-schedule">
                    <div class="empty-icon"></div>
                    <h3>Brak harmonogramu zajęć</h3>
                    <p>Nie znaleziono żadnych zajęć w systemie.</p>
                </div>
            `;
            grid.style.display = 'block';
            return;
        }
        
        // naglowek godzin
        grid.innerHTML += '<div class="time-header">Godziny</div>';
        
        // naglowki dni
        Object.values(this.dayNames).forEach(dayName => {
            grid.innerHTML += `<div class="day-header">${dayName}</div>`;
        });
        
        // grupowanie zajec wedlug dni
        const grouped = this.groupByDay();
        
        // znalezienie unikalnych godzin
        const timeSlots = this.getTimeSlots();
        
        // dla kazdej godziny
        timeSlots.forEach(slot => {
            // Kolumna z godziną
            grid.innerHTML += `<div class="time-slot">${slot}</div>`;
            
            // dla kazdego dnia
            Object.keys(this.dayNames).forEach(dayKey => {
                const classes = this.getClassesFor(dayKey, slot, grouped);
                const cell = document.createElement('div');
                cell.className = 'class-cell';
                
                if(classes.length > 0){
                    classes.forEach(c => {
                        cell.innerHTML += `
                            <div class="class-item">
                                <div class="class-title">${c.title}</div>
                                <div class="class-time">${this.formatTime(c.startTime)} - ${this.formatTime(c.endTime)}</div>
                                ${c.teacher ? `<div class="class-teacher">${c.teacher}</div>` : ''}
                                ${c.room ? `<div class="class-room">${c.room}</div>` : ''}
                                <div class="class-type">np. Wykład, Ćwiczenia projektowe, Ćwiczenia laboratoryjne</div>

                            </div>
                            
                        `;
                        /* cos takiego chyba
                        ${c.type ? `<div class="class-type">${c.type}</div>` : ''} */
                    });
                } 
                else{
                    cell.classList.add('empty');
                }
                
                grid.appendChild(cell);
            });
        });
    }
    
    // grupowanie zajec wedlug dni
    groupByDay(){
        const grouped = {};
        this.scheduleData.forEach(item => {
            if (!grouped[item.dayOfWeek]) grouped[item.dayOfWeek] = [];
            grouped[item.dayOfWeek].push(item);
        });

        return grouped;
    }
    
    // pobranie wszystkich unikalnych godzin
    getTimeSlots(){
        const slots = new Set();
        this.scheduleData.forEach(item => {
            slots.add(`${this.formatTime(item.startTime)} - ${this.formatTime(item.endTime)}`);
        });

        return Array.from(slots).sort();
    }
    
    // znalezienie zajec dla dnia i godziny
    getClassesFor(day, slot, grouped){
        if(!grouped[day]) return [];

        return grouped[day].filter(item => {
            const itemSlot = `${this.formatTime(item.startTime)} - ${this.formatTime(item.endTime)}`;
            return itemSlot === slot;
        });
    }
    
    // formatowanie czasu
    formatTime(timeObj) {
        if (!timeObj) return '';

        const h = String(timeObj.hour).padStart(2, '0');
        const m = String(timeObj.minute).padStart(2, '0');

        return `${h}:${m}`;
    }
}

// inicjalizacja
document.addEventListener('DOMContentLoaded', () => {
});

window.ScheduleCalendar = ScheduleCalendar;