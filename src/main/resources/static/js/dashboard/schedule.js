class ScheduleCalendar{
    constructor(){
        this.scheduleData = [];
        this.apiEndpoint = '/api/schedule';
        
        this.dayNames = {
            'Monday': 'Poniedziałek',
            'Tuesday': 'Wtorek',
            'Wednesday': 'Środa',
            'Thursday': 'Czwartek',
            'Friday': 'Piątek',
            'Saturday': 'Sobota',
            'Sunday': 'Niedziela'
        };
        
        this.classTypeNames = {
            'WYKLAD': 'Wykład',
            'CWICZENIA': 'Ćwiczenia laboratoryjne',
            'LABORATORIUM': 'Laboratorium',
            'PROJEKT': 'Projekt zespołowy',
            'SEMINARIUM': 'Seminarium',
            'KONSULTACJE': 'Konsultacje'
        };
        
        this.loadSchedule();
    }
    
    // zaladowanie harmonogramu zajec z API
    async loadSchedule(){
        const loading = document.getElementById('loading');
        const grid = document.getElementById('scheduleGrid');
        
        loading.classList.add('active');
        grid.style.display = 'none';
        
        try{
            const response = await fetch(this.apiEndpoint);
            
            if(!response.ok){
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.scheduleData = await response.json();
            console.log('Załadowano harmonogram:', this.scheduleData);
            this.renderSchedule();
        } 
        catch(error){
            console.error('Błąd ładowania harmonogramu:', error);
            grid.innerHTML = `
                <div class="error-message">
                    <h3>Błąd ładowania harmonogramu zajęć</h3>
                    <p>${error.message}</p>
                </div>
            `;
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
                    <h3>Brak harmonogramu zajęć</h3>
                    <p>Nie znaleziono żadnych zajęć w systemie.</p>
                    <p style="font-size: 0.9rem; color: #6c757d; margin-top: 1rem;">
                        Możliwe przyczyny:<br>
                        • Nie jesteś przypisany do żadnej grupy studenckiej.<br>
                        • Administrator jeszcze nie dodał zajęć dla Twojej grupy.<br>
                        • Skontaktuj się z administratorem systemu.
                    </p>
                </div>
            `;
            grid.style.display = 'flex';
            return;
        }
        
        // naglowek godzin
        grid.innerHTML += '<div class="time-header">Godziny</div>';
        
        // naglowki dni
        const workDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        workDays.forEach(dayKey => {
            grid.innerHTML += `<div class="day-header">${this.dayNames[dayKey]}</div>`;
        });
        
        // grupowanie zajec wedlug dni
        const grouped = this.groupByDay();
        
        // pobranie posortowanych przedzialow czasowych
        const timeSlots = this.getTimeSlotsObjects();
        
        // dla kazdego przedzialu czasowego
        timeSlots.forEach(slotObj => {
            // kolumna z godzina
            grid.innerHTML += `<div class="time-slot">${slotObj.label}</div>`;
            
            // dla kazdego dnia
            workDays.forEach(dayKey => {
                const classes = this.getClassesForTimeSlot(dayKey, slotObj, grouped);
                const cell = document.createElement('div');
                cell.className = 'class-cell';
                
                if(classes.length > 0){
                    classes.forEach(c => {
                        const classTypeName = c.classType ? this.classTypeNames[c.classType] || c.classType : '';
                        const classItem = document.createElement('div');
                        const typeClass = c.classType ? `class-type-${c.classType.toLowerCase()}` : '';
                        classItem.className = `class-item ${typeClass}`;
                        classItem.innerHTML = `
                            <div class="class-title">${c.title}</div>
                            <div class="class-time">${this.formatTime(c.startTime)} - ${this.formatTime(c.endTime)}</div>
                            ${c.teacher ? `<div class="class-teacher">${c.teacher}</div>` : ''}
                            ${c.room ? `<div class="class-room">${c.room}</div>` : ''}
                            ${classTypeName ? `<div class="class-type">${classTypeName}</div>` : ''}
                            ${c.yearPlan ? `<div class="class-year-plan">${c.yearPlan}</div>` : ''}
                        `;
                        cell.appendChild(classItem);
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
    
    // konwersja czasu do liczby (godzina + minuty/60) dla sortowania
    timeToNumber(timeObj){
        if(typeof timeObj === 'string'){
            const parts = timeObj.split(':');
            return parseInt(parts[0]) + parseInt(parts[1]) / 60;
        }
        if(typeof timeObj === 'object' && timeObj.hour !== undefined){
            return timeObj.hour + timeObj.minute / 60;
        }
        return 0;
    }
    
    // pobranie wszystkich unikalnych przedzialow czasowych jako obiektow z numerycznym sortowaniem
    getTimeSlotsObjects(){
        const slotsMap = new Map();
        
        this.scheduleData.forEach(item => {
            const label = `${this.formatTime(item.startTime)} - ${this.formatTime(item.endTime)}`;
            const startTimeNum = this.timeToNumber(item.startTime);
            
            if(!slotsMap.has(label)){
                slotsMap.set(label, {
                    label: label,
                    startTime: startTimeNum,
                    startTimeFormatted: this.formatTime(item.startTime),
                    endTimeFormatted: this.formatTime(item.endTime)
                });
            }
        });
        
        // sortowanie po numerycznym czasie rozpoczecia
        return Array.from(slotsMap.values()).sort((a, b) => a.startTime - b.startTime);
    }
    
    // znalezienie zajec dla danego przedzialu czasowego
    getClassesForTimeSlot(day, slotObj, grouped){
        if(!grouped[day]) return [];
        
        return grouped[day].filter(item => {
            const itemStart = this.formatTime(item.startTime);
            const itemEnd = this.formatTime(item.endTime);
            return itemStart === slotObj.startTimeFormatted && itemEnd === slotObj.endTimeFormatted;
        });
    }
    
    // formatowanie czasu
    formatTime(timeObj) {
        if (!timeObj) return '';
        
        // obsluga formatu string (HH:MM:SS lub HH:MM)
        if(typeof timeObj === 'string'){
            const parts = timeObj.split(':');
            return `${parts[0]}:${parts[1]}`;
        }
        
        // obsluga formatu obiektowego {hour, minute, second}
        if(typeof timeObj === 'object' && timeObj.hour !== undefined){
            const h = String(timeObj.hour).padStart(2, '0');
            const m = String(timeObj.minute).padStart(2, '0');
            return `${h}:${m}`;
        }
        
        return '';
    }
}

// inicjalizacja
document.addEventListener('DOMContentLoaded', () => {
});

window.ScheduleCalendar = ScheduleCalendar;