class ScheduleCalendar{
    static CONFIG = {
        API_ENDPOINT: '/api/schedule',
        DAY_NAMES: {
            'Monday': 'Poniedziałek',
            'Tuesday': 'Wtorek',
            'Wednesday': 'Środa',
            'Thursday': 'Czwartek',
            'Friday': 'Piątek',
            'Saturday': 'Sobota',
            'Sunday': 'Niedziela'
        },
        CLASS_TYPES: {
            'WYKLAD': 'Wykład',
            'CWICZENIA': 'Ćwiczenia laboratoryjne',
            'LABORATORIUM': 'Laboratorium',
            'PROJEKT': 'Projekt zespołowy',
            'SEMINARIUM': 'Seminarium',
            'KONSULTACJE': 'Konsultacje'
        },
        WORK_DAYS: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    };
    
    constructor(){
        this.scheduleData = [];
        this.apiEndpoint = ScheduleCalendar.CONFIG.API_ENDPOINT;
        
        this.dayNames = ScheduleCalendar.CONFIG.DAY_NAMES;
        this.classTypeNames = ScheduleCalendar.CONFIG.CLASS_TYPES;
        
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
                        • Nie jesteś przypisany do żadnego kierunku.<br>
                        • Administrator jeszcze nie dodał zajęć dla Twojego kierunku.<br>
                        <br>Skontaktuj się z administratorem systemu.
                    </p>
                </div>
            `;
            grid.style.display = 'flex';
            return;
        }
        
        // naglowek godzin
        grid.innerHTML += '<div class="time-header">Godziny</div>';
        
        // naglowki dni
        const workDays = ScheduleCalendar.CONFIG.WORK_DAYS;
        workDays.forEach(dayKey => {
            grid.innerHTML += `<div class="day-header">${this.dayNames[dayKey]}</div>`;
        });
        
        // grupowanie zajec wedlug dni
        const grouped = this.groupByDay();
        
        // pobranie posortowanych przedzialow czasowych
        const timeSlots = this.getTimeSlotsObjects();
        
        // ustaw liczbę wierszy w gridzie (nagłówek + wszystkie sloty)
        grid.style.gridTemplateRows = `auto repeat(${timeSlots.length}, auto)`;
        
        // mapa zajęć które już zostały wyrenderowane (aby uniknąć duplikatów)
        const renderedClasses = new Set();
        
        // dla kazdego przedzialu czasowego
        timeSlots.forEach((slotObj, slotIndex) => {
            const rowIndex = slotIndex + 2; // +2 bo pierwszy wiersz to nagłówki
            
            // kolumna z godzina (wyświetlana tylko dla pełnych godzin)
            const timeSlotDiv = document.createElement('div');
            timeSlotDiv.className = 'time-slot';
            timeSlotDiv.textContent = slotObj.label;
            timeSlotDiv.style.gridRow = rowIndex;
            timeSlotDiv.style.gridColumn = 1;
            grid.appendChild(timeSlotDiv);
            
            // dla kazdego dnia
            workDays.forEach((dayKey, dayIndex) => {
                const columnIndex = dayIndex + 2; // +2 bo pierwsza kolumna to godziny
                const classes = this.getClassesForTimeSlot(dayKey, slotObj, grouped);
                
                // sprawdź czy w tym slotcie rozpoczynają się jakieś zajęcia
                const startingClasses = classes.filter(c => {
                    const classId = `${dayKey}-${c.id || c.title}-${this.formatTime(c.startTime)}`;
                    if(renderedClasses.has(classId)) return false;
                    
                    const itemStartNum = this.timeToNumber(c.startTime);
                    const slotStartNum = slotObj.startTime;
                    // zajęcia rozpoczynają się w tym przedziale
                    return Math.abs(itemStartNum - slotStartNum) < 0.01;
                });
                
                if(startingClasses.length > 0){
                    startingClasses.forEach(c => {
                        const classId = `${dayKey}-${c.id || c.title}-${this.formatTime(c.startTime)}`;
                        renderedClasses.add(classId);
                        
                        // oblicz ile przedziałów 15-minutowych zajmują zajęcia
                        const duration = this.timeToNumber(c.endTime) - this.timeToNumber(c.startTime);
                        const rowSpan = Math.max(1, Math.round(duration / 0.25)); // 0.25 = 15 minut
                        
                        const classTypeName = c.classType ? this.classTypeNames[c.classType] || c.classType : '';
                        const classItem = document.createElement('div');
                        const typeClass = c.classType ? `class-type-${c.classType.toLowerCase()}` : '';
                        classItem.className = `class-item ${typeClass}`;
                        classItem.style.gridRow = `${rowIndex} / span ${rowSpan}`;
                        classItem.style.gridColumn = columnIndex;
                        classItem.innerHTML = `
                            <div class="class-title">${c.title}</div>
                            <div class="class-time">${this.formatTime(c.startTime)} - ${this.formatTime(c.endTime)}</div>
                            ${c.teacher ? `<div class="class-teacher">${c.teacher}</div>` : ''}
                            ${c.room ? `<div class="class-room">${c.room}</div>` : ''}
                            ${classTypeName ? `<div class="class-type">${classTypeName}</div>` : ''}
                            ${c.yearPlan ? `<div class="class-year-plan">${c.yearPlan}</div>` : ''}
                        `;
                        grid.appendChild(classItem);
                    });
                } else {
                    // sprawdź czy w tym slotcie trwają jakieś zajęcia (ale nie rozpoczynają się)
                    const ongoingClasses = classes.filter(c => {
                        const classId = `${dayKey}-${c.id || c.title}-${this.formatTime(c.startTime)}`;
                        return renderedClasses.has(classId);
                    });
                    
                    // dodaj pustą komórkę tylko jeśli nie ma trwających zajęć
                    if(ongoingClasses.length === 0){
                        const cell = document.createElement('div');
                        cell.className = 'class-cell empty';
                        cell.style.gridRow = rowIndex;
                        cell.style.gridColumn = columnIndex;
                        grid.appendChild(cell);
                    }
                }
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
    
    // generowanie przedziałów czasowych co 15 minut
    getTimeSlotsObjects(){
        const slots = [];
        const startHour = 7;
        const endHour = 21;
        
        for(let hour = startHour; hour < endHour; hour++){
            for(let minute = 0; minute < 60; minute += 15){
                const timeNum = hour + minute / 60;
                const nextMinute = minute + 15;
                const nextHour = nextMinute >= 60 ? hour + 1 : hour;
                const adjustedMinute = nextMinute >= 60 ? 0 : nextMinute;
                
                const startFormatted = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                const endFormatted = `${String(nextHour).padStart(2, '0')}:${String(adjustedMinute).padStart(2, '0')}`;
                
                // wyświetlaj tylko pełne godziny jako etykiety
                const label = minute === 0 ? `${String(hour).padStart(2, '0')}:00` : '';
                
                slots.push({
                    label: label,
                    startTime: timeNum,
                    startTimeFormatted: startFormatted,
                    endTimeFormatted: endFormatted
                });
            }
        }
        
        return slots;
    }
    
    // znalezienie zajec dla danego przedzialu czasowego
    getClassesForTimeSlot(day, slotObj, grouped){
        if(!grouped[day]) return [];
        
        return grouped[day].filter(item => {
            const itemStartNum = this.timeToNumber(item.startTime);
            const itemEndNum = this.timeToNumber(item.endTime);
            const slotStartNum = slotObj.startTime;
            const slotEndNum = slotStartNum + 0.25; // 15 minut = 0.25 godziny
            
            // sprawdź czy zajęcia rozpoczynają się w tym przedziale lub go obejmują
            return (itemStartNum >= slotStartNum && itemStartNum < slotEndNum) ||
                   (itemStartNum <= slotStartNum && itemEndNum > slotStartNum);
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