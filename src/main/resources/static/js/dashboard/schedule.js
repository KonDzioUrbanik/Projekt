'use strict';

class ScheduleCalendar{
    static CONFIG = {
        API_ENDPOINT: '/api/schedule',
        CALENDAR_ENDPOINT: '/api/calendar',
        DAY_NAMES: {
            'Monday': 'Poniedziałek', 'Tuesday': 'Wtorek', 'Wednesday': 'Środa',
            'Thursday': 'Czwartek', 'Friday': 'Piątek', 'Saturday': 'Sobota', 'Sunday': 'Niedziela'
        },
        CLASS_TYPES: {
            'WYKLAD': 'Wykład', 'CWICZENIA': 'Ćwiczenia laboratoryjne', 'LABORATORIUM': 'Laboratorium',
            'PROJEKT': 'Projekt zespołowy', 'SEMINARIUM': 'Seminarium', 'KONSULTACJE': 'Konsultacje'
        },
        WORK_DAYS: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    };
    
    constructor(){
        this.scheduleData = [];
        this.calendarEvents = []; // Dane z kalendarza akademickiego
        this.apiEndpoint = ScheduleCalendar.CONFIG.API_ENDPOINT;
        
        this.dayNames = ScheduleCalendar.CONFIG.DAY_NAMES;
        this.classTypeNames = ScheduleCalendar.CONFIG.CLASS_TYPES;
        this.activeFilters = new Set(); // Przechowuje aktualnie wybrane filtry typów zajęć
        
        // Stan kalendarza
        this.currentDate = new Date();
        this.currentWeekStart = this.getStartOfWeek(this.currentDate);
        
        this.initializeUI();
        this.loadData();
    }
    
    async loadData() {
        // Pokaż ładowanie dla całej paczki danych
        const loading = document.getElementById('loading');
        const grid = document.getElementById('scheduleGrid');
        
        if (loading) loading.classList.add('active');
        if (grid) grid.style.display = 'none';

        try {
            await Promise.all([
                this.loadCalendarEvents(),
                this.loadSchedule()
            ]);
            
            this.renderFilters(); // Wygenerowanie przycisków filtrujących
            this.renderSchedule();
            this.updateControls(); // Aktualizacja etykiet daty
            this.updateRealTimeFeatures(); // Dodaje DZIŚ pod nagłówkami
        } catch(error) {
            console.error('Błąd inicjalizacji harmonogramu:', error);
            if (grid) {
                grid.innerHTML = `
                    <div class="error-message">
                        <h3>Błąd inicjalizacji harmonogramu</h3>
                        <p>${Utils.escapeHtml(error.message)}</p>
                    </div>
                `;
                grid.style.display = 'block';
            }
        } finally {
            if (loading) loading.classList.remove('active');
            if (grid && grid.style.display === 'none') {
                 grid.style.display = 'grid';
            }
            // Add a small delay for DOM layout calc before scrolling
            setTimeout(() => this.scrollToCurrentTime(), 150);
        }
    }

    // Pobranie wydarzeń z kalendarza akademickiego
    async loadCalendarEvents() {
        try {
            const response = await fetch(ScheduleCalendar.CONFIG.CALENDAR_ENDPOINT);
            if(response.ok) {
                this.calendarEvents = await response.json();
            } else {
                console.error("Failed to load calendar events");
            }
        } catch (e) {
            console.error("Error loading calendar events:", e);
        }
    }
    
    // Pomocnicza metoda do formatowania daty lokalnie do YYYY-MM-DD
    formatDateLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Sprawdza czy dany dzień jest dniem wolnym (BREAK, HOLIDAY, EXAM)
    getSpecialDayInfo(date) {
        if (!this.calendarEvents || this.calendarEvents.length === 0) return null;

        const checkDateStr = this.formatDateLocal(date);
        const checkTime = date.getTime();
        
        // Typy wydarzeń które blokują zajęcia
        const blockingTypes = ['BREAK', 'HOLIDAY', 'EXAM'];

        // Szukamy wydarzenia blokującego
        const special = this.calendarEvents.find(event => {
            if (!blockingTypes.includes(event.type)) return false;

            // Porównujemy stringi dat YYYY-MM-DD (bezpieczniejsze dla stref czasowych)
            return checkDateStr >= event.dateFrom && checkDateStr <= event.dateTo;
        });
        
        if (special) {
            return {
                name: special.title,
                type: special.type
            };
        }
        
        return null;
    }
    
    // zaladowanie harmonogramu zajec z API (tylko pobranie danych)
    async loadSchedule(){
        const response = await fetch(this.apiEndpoint);
        
        if(!response.ok){
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        this.scheduleData = await response.json();
    }
    
    // Obliczanie początku tygodnia (Poniedziałek)
    getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    // Zmiana tygodnia
    changeWeek(offset) {
        this.currentDate.setDate(this.currentDate.getDate() + (offset * 7));
        this.currentWeekStart = this.getStartOfWeek(this.currentDate);
        this.renderSchedule();
        this.updateControls();
        this.updateRealTimeFeatures();
    }

    // Ustawienie na dzisiaj
    resetToToday() {
        this.currentDate = new Date();
        this.currentWeekStart = this.getStartOfWeek(this.currentDate);
        this.renderSchedule();
        this.updateControls();
        this.updateRealTimeFeatures();
        setTimeout(() => this.scrollToCurrentTime(), 150);
    }

    // Aktualizacja kontrolek (daty, typ tygodnia)
    updateControls() {
        const start = new Date(this.currentWeekStart);
        const end = new Date(this.currentWeekStart);
        end.setDate(end.getDate() + 6);
        
        const options = { day: 'numeric', month: '2-digit' };
        const rangeText = `${start.toLocaleDateString('pl-PL', options)} - ${end.toLocaleDateString('pl-PL', options)}`;
        document.getElementById('dateRangeLabel').textContent = rangeText;

        const weekType = this.getWeekType(start);
        const weekName = weekType === 'WEEK_A' ? 'Tydzień A (Nieparzysty)' : 'Tydzień B (Parzysty)';
        document.getElementById('weekTypeLabel').textContent = weekName;
    }

    // Obliczanie numeru tygodnia - używa Utils
    getWeekNumber(d) {
        return Utils.getWeekNumber(d);
    }

    // Typ tygodnia - używa Utils
    getWeekType(date) {
        return Utils.getWeekType(date);
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
                     <p style="font-size: 0.9rem; color: #6c757d; margin-top: 1rem;">Skontaktuj się z administratorem.</p>
                </div>
            `;
            grid.style.display = 'flex';
            this.updateNextClassWidget(); 
            return;
        }

        // Filtrujemy zajęcia dla aktualnego tygodnia (ALL lub pasujący typ)
        const weekFilteredData = this.scheduleData.filter(item => Utils.matchesScheduleRecurrence(item, this.currentWeekStart));

        // naglowek godzin
        grid.innerHTML += '<div class="time-header">Godziny</div>';
        
        // naglowki dni (z datami)
        const workDays = ScheduleCalendar.CONFIG.WORK_DAYS;
        const specialDaysMap = {}; // Cache dla dni wolnych w tym tygodniu

        workDays.forEach((dayKey, index) => {
            const dayDate = new Date(this.currentWeekStart);
            dayDate.setDate(dayDate.getDate() + index);
            const dateStr = dayDate.toLocaleDateString('pl-PL', { day: 'numeric', month: 'numeric'});
            
            const specialInfo = this.getSpecialDayInfo(dayDate);
            if(specialInfo) {
                specialDaysMap[dayKey] = specialInfo;
            }

            const isSpecialClass = specialInfo ? 'special-day-header' : '';
            const specialLabel = specialInfo ? `<span class="special-label">${specialInfo.name}</span>` : '';
            
            grid.innerHTML += `<div class="day-header ${isSpecialClass}" data-date="${this.formatDateLocal(dayDate)}">
                ${this.dayNames[dayKey]} <span class="header-date">${dateStr}</span>
                ${specialLabel}
            </div>`;
        });
        
        // grupowanie zajec wedlug dni (używamy przefiltrowanych danych)
        const grouped = this.groupByDay(weekFilteredData);

        // Obliczanie kolizji (nachodzących na siebie zajęć) dla każdego dnia
        const dayOverlaps = {};
        const dayMaxCols = {};
        
        workDays.forEach(dayKey => {
            const overlapResult = this.calculateOverlaps(grouped[dayKey] || [], dayKey);
            dayOverlaps[dayKey] = overlapResult.positions || {};
            dayMaxCols[dayKey] = overlapResult.maxCols || 1;
        });
        
        let gridTemplateCols = '120px '; // Pierwsza kolumna na godziny
        workDays.forEach(dayKey => {
            const cols = dayMaxCols[dayKey];
            gridTemplateCols += `minmax(${140 * cols}px, ${cols}fr) `;
        });
        grid.style.gridTemplateColumns = gridTemplateCols.trim();

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
                
                // JEŚLI DZIEŃ JEST WOLNY -> Nie renderuj zajęć, ewentualnie wyszarz komórki
                if (specialDaysMap[dayKey]) {
                     const cell = document.createElement('div');
                     cell.className = 'class-cell special-day-cell';
                     cell.title = specialDaysMap[dayKey].name;
                     cell.style.gridRow = rowIndex;
                     cell.style.gridColumn = columnIndex;
                     cell.setAttribute('data-col', columnIndex);
                     grid.appendChild(cell);
                     return; // SKIP rendering classes
                }

                // Zawsze renderujemy pustą komórkę tła, by zachować ułożenie kratek siatki i uniknąć szarego tła pod zajęciami
                const bgCell = document.createElement('div');
                bgCell.className = 'class-cell empty';
                bgCell.style.gridRow = rowIndex;
                bgCell.style.gridColumn = columnIndex;
                bgCell.setAttribute('data-col', columnIndex);
                grid.appendChild(bgCell);

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
                        classItem.setAttribute('data-col', columnIndex);

                        // Aplikowanie logiki kolizji zajęć
                        const overlapInfo = dayOverlaps[dayKey][classId];
                        if (overlapInfo) {
                            classItem.style.width = `calc(${overlapInfo.width}% - 4px)`;
                            classItem.style.marginLeft = `calc(${overlapInfo.left}% + 2px)`; // +2px overrides default margin
                        }
                        
                        // Store data for modal
                        classItem.setAttribute('data-class-json', JSON.stringify(c));
                        classItem.onclick = () => this.openClassDetails(c);
                        
                        // Escapowanie danych (XSS prevention)
                        const safeTitle = Utils.escapeHtml(c.title);
                        const safeTeacher = Utils.escapeHtml(c.teacher);
                        const safeRoom = Utils.escapeHtml(c.room);
                        const safeClassType = Utils.escapeHtml(classTypeName);
                        const safeYearPlan = Utils.escapeHtml(c.yearPlan);
                        
                        classItem.innerHTML = `
                            <div class="class-title">${safeTitle}</div>
                            <div class="class-time">${Utils.formatTime(c.startTime)} - ${Utils.formatTime(c.endTime)}</div>
                            ${c.teacher ? `<div class="class-teacher">${safeTeacher}</div>` : ''}
                            ${c.room ? `<div class="class-room">${safeRoom}</div>` : ''}
                            ${classTypeName ? `<div class="class-type">${safeClassType}</div>` : ''}
                            ${c.yearPlan ? `<div class="class-year-plan">${safeYearPlan}</div>` : ''}
                        `;
                        grid.appendChild(classItem);
                    });
                }
            });
        });

        // Po wyrenderowaniu wszystkich zajęć, upewniamy się, że zastosowane są aktywne filtry
        this.applyFilters();
    }
    
    // grupowanie zajec wedlug dni
    groupByDay(data = this.scheduleData){
        const grouped = {};
        data.forEach(item => {
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

    // Obliczanie kolizji dla nałożonych na siebie zajęć
    calculateOverlaps(classesForDay, dayKey) {
        if (!classesForDay || classesForDay.length === 0) return { positions: {}, maxCols: 1 };

        // Sortujemy po czasie rozpoczęcia, potem po czasie zakończenia
        const sorted = [...classesForDay].sort((a,b) => {
            const startA = this.timeToNumber(a.startTime);
            const startB = this.timeToNumber(b.startTime);
            if (startA !== startB) return startA - startB;
            return this.timeToNumber(b.endTime) - this.timeToNumber(a.endTime);
        });

        const positions = {}; // Map: classId -> { width, left }
        let currentCluster = [];
        let clusterEnd = 0;
        let absoluteMaxCols = 1; // Przechowuje max nakładających się zajęć w ciągu całego dnia

        const processCluster = (cluster) => {
            const columns = []; // przechowuje czas zakończenia ostatniego zajęcia w danej podkolumnie
            
            cluster.forEach(cls => {
                const start = this.timeToNumber(cls.startTime);
                const end = this.timeToNumber(cls.endTime);
                
                let placed = false;
                for (let i = 0; i < columns.length; i++) {
                    if (columns[i] <= start) {
                        columns[i] = end;
                        cls._colIdx = i;
                        placed = true;
                        break;
                    }
                }
                
                if (!placed) {
                    columns.push(end);
                    cls._colIdx = columns.length - 1;
                }
            });

            const numCols = columns.length;
            if (numCols > absoluteMaxCols) absoluteMaxCols = numCols; // Aktualizuj max kolumn dla całego dnia
            
            cluster.forEach(cls => {
                const classId = `${dayKey}-${cls.id || cls.title}-${this.formatTime(cls.startTime)}`;
                positions[classId] = {
                    width: 100 / numCols,
                    left: (100 / numCols) * cls._colIdx
                };
            });
        };

        sorted.forEach(cls => {
            const start = this.timeToNumber(cls.startTime);
            const end = this.timeToNumber(cls.endTime);

            if (currentCluster.length > 0 && start >= clusterEnd) {
                // Koniec klastra, przetwarzamy
                processCluster(currentCluster);
                currentCluster = [];
                clusterEnd = 0;
            }

            currentCluster.push(cls);
            if (end > clusterEnd) clusterEnd = end;
        });

        if (currentCluster.length > 0) {
            processCluster(currentCluster);
        }

        return { positions, maxCols: absoluteMaxCols };
    }
    
    // formatowanie czasu - używa Utils
    formatTime(timeObj) {
        return Utils.formatTime(timeObj);
    }

    initializeUI() {
        // Obsługa zamykania modala
        const modal = document.getElementById('classDetailsModal');
        const closeBtn = document.querySelector('.close-modal');
        
        if(closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('active');
            });
        }

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
        
        // Nawigacja
        document.getElementById('prevWeekBtn').addEventListener('click', () => this.changeWeek(-1));
        document.getElementById('nextWeekBtn').addEventListener('click', () => this.changeWeek(1));
        document.getElementById('todayBtn').addEventListener('click', () => this.resetToToday());

        // Uruchomienie timera do aktualizacji "Next Class" i linii czasu
        this.updateRealTimeFeatures();
        setInterval(() => this.updateRealTimeFeatures(), 60000); // Co minutę
    }

    updateRealTimeFeatures() {
        this.highlightCurrentDay();
        this.updateTimeLine();
        this.updateNextClassWidget();
    }

    highlightCurrentDay() {
        const todayStr = this.formatDateLocal(new Date());

        // Reset highlight
        document.querySelectorAll('.day-header').forEach(el => el.classList.remove('current-day'));
        document.querySelectorAll('.current-day-col').forEach(el => el.classList.remove('current-day-col'));

        // Znajdź nagłówek z dzisiejszą datą
        const todayHeader = document.querySelector(`.day-header[data-date="${todayStr}"]`);
        
        if (todayHeader) {
            todayHeader.classList.add('current-day');
            
            // Podświetlenie całej kolumny
            // Musimy sprawdzić który to numer kolumny
            const headers = Array.from(document.querySelectorAll('.day-header'));
            const colIndex = headers.indexOf(todayHeader);
            
            if (colIndex !== -1) {
                const columnIndex = colIndex + 2; // +2 bo pierwsza kolumna to godziny
                // Szukamy tylko komórek siatki (class-cell), omijając bloki zajęć (class-item)
                document.querySelectorAll(`.class-cell[data-col="${columnIndex}"]`).forEach(cell => {
                    cell.classList.add('current-day-col');
                });
            }
        }
    }

    updateTimeLine() {
        // Usunięcie starej linii
        const oldLine = document.getElementById('currentTimeLine');
        if(oldLine) oldLine.remove();

        // Jeśli nie ma podświetlonego dnia (tzn. nie jesteśmy w aktualnym tygodniu), nie pokazujemy linii czasu
        if (!document.querySelector('.day-header.current-day')) return;

        const now = new Date();
        const currentHour = now.getHours() + now.getMinutes() / 60;
        
        // Zakres 8:00 - 20:00 (zgodnie z renderowaniem)
        // W renderSchedule: startHour = 7, endHour = 21
        const startHour = 7;
        const endHour = 21;

        if (currentHour < startHour || currentHour > endHour) return;

        // Znajdź odpowiedni slot
        const slots = this.getTimeSlotsObjects();
        let closestSlotIndex = -1;
        let minuteOffset = 0;
        
        for(let i=0; i<slots.length; i++) {
            if (currentHour >= slots[i].startTime && currentHour < (slots[i].startTime + 0.25)) {
                closestSlotIndex = i;
                const diffHours = currentHour - slots[i].startTime;
                minuteOffset = (diffHours / 0.25) * 100; // % wysokości slotu
                break;
            }
        }

        if (closestSlotIndex !== -1) {
            const rowIndex = closestSlotIndex + 2; // +1 header
            const grid = document.getElementById('scheduleGrid');
            
            const line = document.createElement('div');
            line.id = 'currentTimeLine';
            line.className = 'current-time-line';
            line.style.gridRow = rowIndex;
            line.style.gridColumn = "1 / -1"; 
            
            const offsetPx = Math.round((minuteOffset / 100) * 28); 
            line.style.transform = `translateY(${offsetPx}px)`;
            
            grid.appendChild(line);
        }
    }

    updateNextClassWidget() {
        const widget = document.getElementById('nextClassWidget');
        if (!widget) return;

        const now = new Date();
        
        // Sprawdź czy dzisiaj jest dzień specjalny (sesja, przerwa, święto)
        const specialDay = this.getSpecialDayInfo(now);
        if (specialDay) {
            widget.style.display = 'flex';
            
            // Ukryj elementy czasu i pokaż info o specjalnym okresie
            const timeToNextEl = document.getElementById('timeToNext');
            const nextLabelEl = document.querySelector('.next-label');
            const nextClassTitleEl = document.getElementById('nextClassTitle');
            const nextClassDetailsEl = document.getElementById('nextClassDetails');
            
            if (timeToNextEl) timeToNextEl.style.display = 'none';
            if (nextLabelEl) nextLabelEl.innerHTML = specialDay.name;
            if (nextClassTitleEl) nextClassTitleEl.textContent = this.getSpecialPeriodMessage(specialDay.type);
            if (nextClassDetailsEl) nextClassDetailsEl.textContent = 'Brak zajęć dydaktycznych';
            
            return;
        }

        if (this.scheduleData.length === 0) {
            widget.style.display = 'none';
            return;
        }

        const currentDayIndex = now.getDay();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDayName = days[currentDayIndex];
        const currentTimeNum = now.getHours() + now.getMinutes() / 60;
        
        let nextClass = null;
        let minDiff = Infinity;
        let isToday = false;

        // Sprawdź dzisiejsze zajęcia - filtruj też według typu tygodnia
        const todaysClasses = this.scheduleData.filter(c => {
            const matchesDay = c.dayOfWeek === currentDayName;
            const matchesWeek = Utils.matchesScheduleRecurrence(c, now);
            return matchesDay && matchesWeek;
        });
        todaysClasses.forEach(c => {
            const startNum = this.timeToNumber(c.startTime);
            if (startNum > currentTimeNum) {
                const diff = startNum - currentTimeNum;
                if (diff < minDiff) {
                    minDiff = diff;
                    nextClass = c;
                    isToday = true;
                }
            }
        });

        if (nextClass && isToday) {
            const timeToStart = Math.round((this.timeToNumber(nextClass.startTime) - currentTimeNum) * 60);
            
            if (timeToStart <= 120) { // Pokazuj tylko jeśli mniej niż 2h
                widget.style.display = 'flex';
                
                // Przywróć widoczność elementów
                const timeToNextEl = document.getElementById('timeToNext');
                const nextLabelEl = document.querySelector('.next-label');
                
                if (timeToNextEl) {
                    timeToNextEl.style.display = '';
                    timeToNextEl.textContent = timeToStart;
                }
                // Przywróć oryginalny format napisu
                if (nextLabelEl) nextLabelEl.innerHTML = `Następne zajęcia (za <span id="timeToNext">${timeToStart}</span> min):`;
                
                // Escapowanie dla bezpieczeństwa
                document.getElementById('nextClassTitle').textContent = nextClass.title || '';
                
                const room = nextClass.room ? `Sala ${nextClass.room}` : '';
                const type = nextClass.classType ? (ScheduleCalendar.CONFIG.CLASS_TYPES[nextClass.classType] || nextClass.classType) : '';
                document.getElementById('nextClassDetails').textContent = `${type} • ${room}`;
            } else {
                 widget.style.display = 'none';
            }
        } else {
            widget.style.display = 'none';
        }
    }

    // Zwraca komunikat dla typu specjalnego okresu
    getSpecialPeriodMessage(type) {
        switch (type) {
            case 'EXAM':
                return 'Powodzenia na egzaminach!';
            case 'BREAK':
                return 'Odpoczynek od zajęć!';
            case 'HOLIDAY':
                return 'Dzień wolny od zajęć';
            default:
                return 'Brak zajęć';
        }
    }

    openClassDetails(classData) {
        const modal = document.getElementById('classDetailsModal');
        
        // Używamy textContent zamiast innerHTML - automatycznie escapuje HTML
        document.getElementById('modalClassTitle').textContent = classData.title || '';
        document.getElementById('modalClassTime').textContent = `${Utils.formatTime(classData.startTime)} - ${Utils.formatTime(classData.endTime)}`;
        document.getElementById('modalClassTeacher').textContent = classData.teacher || 'Brak danych';
        document.getElementById('modalClassRoom').textContent = classData.room || 'Brak danych';
        
        // Wyświetlanie grup zamiast rocznika
        let groupText = '-';
        if (classData.studentGroups && classData.studentGroups.length > 0) {
            groupText = classData.studentGroups.map(g => g.name).join(', ');
        } else if (classData.yearPlan) {
            groupText = classData.yearPlan;
        }
        document.getElementById('modalClassGroup').textContent = groupText;

        const typeName = ScheduleCalendar.CONFIG.CLASS_TYPES[classData.classType] || classData.classType || 'Zajęcia';
        document.getElementById('modalClassType').textContent = typeName;
        
        // Kolory
        const colorClass = `class-type-${(classData.classType || '').toLowerCase()}`;
        // Reset old classes
        const strip = document.getElementById('modalColorStrip');
        strip.className = 'modal-header-strip ' + colorClass;

        modal.classList.add('active');
    }

    // --- LOGIKA FILTRÓW TYPÓW ZAJĘĆ ---
    
    renderFilters() {
        const filtersContainer = document.getElementById('classFilters');
        if (!filtersContainer) return;
        
        filtersContainer.innerHTML = '';
        
        // Zbieramy unikalne typy zajęć z danych
        const types = new Set();
        this.scheduleData.forEach(item => {
            if (item.classType) types.add(item.classType);
        });

        if (types.size === 0) return;

        types.forEach(type => {
            const btn = document.createElement('button');
            btn.className = 'class-type-filter-btn';
            btn.dataset.type = type;
            
            // Kolorowy znacznik zapożyczający kolor z klasy
            const typeClass = `class-type-${type.toLowerCase()}`;
            const dot = document.createElement('span');
            dot.style.display = 'inline-block';
            dot.style.width = '10px';
            dot.style.height = '10px';
            dot.style.borderRadius = '50%';
            dot.classList.add(typeClass); 
            
            const text = document.createTextNode(` ${this.classTypeNames[type] || type}`);
            
            btn.appendChild(dot);
            btn.appendChild(text);
            
            btn.addEventListener('click', () => this.toggleFilter(type, btn));
            filtersContainer.appendChild(btn);
        });
    }

    toggleFilter(type, btn) {
        if (this.activeFilters.has(type)) {
            this.activeFilters.delete(type);
            btn.classList.remove('active');
        } else {
            this.activeFilters.add(type);
            btn.classList.add('active');
        }
        this.applyFilters();
    }

    applyFilters() {
        const items = document.querySelectorAll('.class-item');
        
        if (this.activeFilters.size === 0) {
            // Brak wyfiltrowanych elementów -> pokazujemy wszystko
            items.forEach(item => item.classList.remove('dimmed-class'));
            return;
        }

        items.forEach(item => {
            const dataStr = item.getAttribute('data-class-json');
            if (!dataStr) return;
            try {
                const classData = JSON.parse(dataStr);
                const type = classData.classType;
                
                if (this.activeFilters.has(type)) {
                    item.classList.remove('dimmed-class');
                } else {
                    item.classList.add('dimmed-class');
                }
            } catch (e) {
                console.error("Błąd parsowania danych dla filtru", e);
            }
        });
    }

    // Auto-Scroll do aktualnej godziny (Płynne przewijanie)
    scrollToCurrentTime() {
        const timeLine = document.getElementById('currentTimeLine');
        if (timeLine) {
            timeLine.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        } else {
            // Jeśli nie ma linii (np. poza godzinami 8-20 dzisiaj), znajdź najwcześniejsze dzisiejsze zajęcia
            const todayClasses = document.querySelectorAll('.current-day-col.class-item');
            if (todayClasses.length > 0) {
                todayClasses[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            } else {
                // Jeśli w ogóle nie ma dzisiaj zajęć, zjedź chociaż do nagłówka
                const todayHeader = document.querySelector('.day-header.current-day');
                if (todayHeader) {
                    todayHeader.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'center' });
                }
            }
        }
    }
}

// inicjalizacja
window.ScheduleCalendar = ScheduleCalendar;

document.addEventListener('DOMContentLoaded', () => {
    // Klasa jest inicjalizowana w HTML
});