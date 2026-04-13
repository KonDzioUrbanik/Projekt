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
        CREDIT_TYPES: {
            'ZALICZENIE': 'Zaliczenie',
            'ZALICZENIE_NA_OCENE': 'Zaliczenie na ocenę',
            'EGZAMIN': 'Egzamin',
            'INNE': 'Inna forma'
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
        
        loading?.classList.add('active');
        if (grid) grid.style.display = 'none';

        try {
            await Promise.all([
                this.loadAcademicConfig(),
                this.loadCalendarEvents(),
                this.loadSchedule()
            ]);
            
            this.populateWeekSelector(); // Generujemy listę wyboru dla nawigacji
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
            if (loading) loading?.classList.remove('active');
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
    
    // Pobranie konfiguracji roku akademickiego
    async loadAcademicConfig() {
        try {
            const response = await fetch('/api/academic-year/current');
            if(response.ok) {
                Utils.AcademicConfig = await response.json();
            } else {
                console.warn("Failed to load academic year config. Falling back to default iso numbering.");
            }
        } catch (e) {
            console.error("Error loading academic year config:", e);
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

        // Ograniczenia nawigacji (Bounds)
        const prevBtn = document.getElementById('prevWeekBtn');
        const nextBtn = document.getElementById('nextWeekBtn');
        if (Utils.AcademicConfig) {
            const winterStart = new Date(Utils.AcademicConfig.winterSemesterStart + 'T00:00:00');
            const summerEnd = new Date(Utils.AcademicConfig.summerSemesterEnd + 'T23:59:59');
            
            // Blokuj poprzedni tydzień, jeśli zeszliśmy przed start zimowego semestru
            const earlyBound = new Date(start); 
            earlyBound.setDate(earlyBound.getDate() - 7);
            if (earlyBound < winterStart && start <= winterStart) {
                if (prevBtn) { prevBtn.disabled = true; prevBtn.style.opacity = '0.3'; }
            } else {
                if (prevBtn) { prevBtn.disabled = false; prevBtn.style.opacity = '1'; }
            }

            // Blokuj następny tydzień, jeśli wyszliśmy już za koniec semestru letniego
            if (end > summerEnd) {
                if (nextBtn) { nextBtn.disabled = true; nextBtn.style.opacity = '0.3'; }
            } else {
                if (nextBtn) { nextBtn.disabled = false; nextBtn.style.opacity = '1'; }
            }
        }

        const weekSelector = document.getElementById('weekSelector');
        if (weekSelector) {
            const startStr = this.formatDateLocal(start);
            // Wybierz odpowiadającą option jeśli istnieje
            const opt = Array.from(weekSelector.options).find(o => o.value === startStr);
            if (opt) {
                weekSelector.value = startStr;
            } else {
                // Jeśli użytkownik zjechał zupełnie poza wygenerowaną listę, budujemy awaryjnie w locie powiadomienie
                const eduWeek = Utils.getEducationalWeekNumber ? Utils.getEducationalWeekNumber(start) : this.getWeekNumber(start);
                const weekTypeName = this.getWeekType(start) === 'WEEK_A' ? 'A (Nieparzysty)' : 'B (Parzysty)';
                
                let customOpt = weekSelector.querySelector(`option[value="${startStr}"]`);
                if (!customOpt) {
                     customOpt = document.createElement('option');
                     customOpt.value = startStr;
                     customOpt.textContent = `Poza zakresem (Tydzień ${eduWeek} › ${weekTypeName})`;
                     weekSelector.appendChild(customOpt);
                }
                weekSelector.value = startStr;
            }
        }
    }

    // Pobiera i wypełnia dropdown miesiącami
    populateWeekSelector() {
        const selector = document.getElementById('weekSelector');
        if (!selector || !Utils.AcademicConfig) return;
        
        selector.innerHTML = '';

        const winterStart = new Date(Utils.AcademicConfig.winterSemesterStart + 'T00:00:00');
        const summerStart = new Date(Utils.AcademicConfig.summerSemesterStart + 'T00:00:00');
        const summerEnd = new Date(Utils.AcademicConfig.summerSemesterEnd + 'T23:59:59');
        
        const optGroupWinter = document.createElement('optgroup');
        optGroupWinter.label = '❄️ Semestr Zimowy';
        
        const optGroupSummer = document.createElement('optgroup');
        optGroupSummer.label = '☀️ Semestr Letni';

        let curr = this.getStartOfWeek(winterStart);
        while (curr <= summerEnd) {
             const eduWeek = Utils.getEducationalWeekNumber(curr);
             const type = this.getWeekType(curr);
             const typeName = type === 'WEEK_A' ? 'A (Nieparzysty)' : 'B (Parzysty)';
             
             let label = `Tydzień ${eduWeek} › ${typeName}`;
             
             // Uproszczone oznaczanie sesji/przerw tylko poprzez flagę na samym spodzie opcji, nie banner
             const specialStart = this.getSpecialDayInfo(curr);
             const endOfWeek = new Date(curr); endOfWeek.setDate(endOfWeek.getDate() + 6);
             const specialEnd = this.getSpecialDayInfo(endOfWeek);
             if (specialStart && specialEnd && specialStart.type === specialEnd.type) {
                 if (specialStart.type === 'EXAM') label += ' [Sesja]';
                 else if (specialStart.type === 'BREAK' || specialStart.type === 'HOLIDAY') label += ' [Przerwa]';
             }
             
             const opt = document.createElement('option');
             opt.value = this.formatDateLocal(curr);
             opt.textContent = label;
             
             if (curr < summerStart) {
                 optGroupWinter.appendChild(opt);
             } else {
                 optGroupSummer.appendChild(opt);
             }
             
             curr.setDate(curr.getDate() + 7);
        }
        
        selector.appendChild(optGroupWinter);
        selector.appendChild(optGroupSummer);
        
        selector.addEventListener('change', (e) => {
            if (e.target.value) {
                this.currentWeekStart = new Date(e.target.value + 'T00:00:00');
                this.currentDate = new Date(this.currentWeekStart);
                this.renderSchedule();
                this.updateControls();
                this.updateRealTimeFeatures();
            }
        });
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

        // Filtrujemy zajęcia mające przynajmniej jedno wystąpienie w bieżącym tygodniu
        const weekStart = this.currentWeekStart;
        const weekEnd   = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
        const weekFilteredData = this.flattenOccurrencesForWeek(this.scheduleData, weekStart, weekEnd);

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
            const safeSpecialName = specialInfo ? Utils.escapeHtml(specialInfo.name) : '';
            const specialLabel = specialInfo ? `<span class="special-label">${safeSpecialName}</span>` : '';
            
            grid.innerHTML += `<div class="day-header ${isSpecialClass}" data-date="${this.formatDateLocal(dayDate)}">
                ${this.dayNames[dayKey]} <span class="header-date">${dateStr}</span>
                ${specialLabel}
            </div>`;
        });
        
        // grupowanie zajęć według dni (używamy sploszczonych danych)
        const grouped = this.groupByDay(weekFilteredData);

        // Obliczanie kolizji (nachodzacych na siebie zajec) dla każdego dnia
        const dayOverlaps = {};
        const dayMaxCols = {};
        
        workDays.forEach(dayKey => {
            const overlapResult = this.calculateOverlaps(grouped[dayKey] || [], dayKey);
            dayOverlaps[dayKey] = overlapResult.positions || {};
            dayMaxCols[dayKey] = overlapResult.maxCols || 1;
        });
        
        const isMobile = window.innerWidth < 768;
        const timeColSize = isMobile ? '70px' : '120px';
        const minDayWidth = isMobile ? 160 : 140;

        let gridTemplateCols = `${timeColSize} `; // Pierwsza kolumna na godziny
        workDays.forEach(dayKey => {
            const cols = dayMaxCols[dayKey];
            gridTemplateCols += `minmax(${minDayWidth * cols}px, ${cols}fr) `;
        });
        grid.style.gridTemplateColumns = gridTemplateCols.trim();

        // pobranie posortowanych przedzialow czasowych
        const timeSlots = this.getTimeSlotsObjects();
        
        // ustaw liczbe wierszy w gridzie (naglowek + wszystkie sloty)
        grid.style.gridTemplateRows = `auto repeat(${timeSlots.length}, auto)`;
        
        // mapa zajec ktore juz zostaly wyrenderowan (aby uniknac duplikatow)
        const renderedClasses = new Set();
        
        // dla kazdego przedzialu czasowego
        timeSlots.forEach((slotObj, slotIndex) => {
            const rowIndex = slotIndex + 2; // +2 bo pierwszy wiersz to naglowki
            
            // kolumna z godzina (wyswietlana tylko dla pelnych godzin)
            const timeSlotDiv = document.createElement('div');
            timeSlotDiv.className = 'time-slot';
            timeSlotDiv.textContent = slotObj.label;
            timeSlotDiv.style.gridRow = rowIndex;
            timeSlotDiv.style.gridColumn = 1;
            grid.appendChild(timeSlotDiv);
            
            // dla kazdego dnia
            workDays.forEach((dayKey, dayIndex) => {
                const columnIndex = dayIndex + 2; // +2 bo pierwsza kolumna to godziny
                
                // JESLI DZIEN JEST WOLNY -> Nie renderuj zajec
                if (specialDaysMap[dayKey]) {
                     const cell = document.createElement('div');
                     cell.className = 'class-cell special-day-cell';
                     cell.title = specialDaysMap[dayKey].name;
                     cell.style.gridRow = rowIndex;
                     cell.style.gridColumn = columnIndex;
                     cell.setAttribute('data-col', columnIndex);
                     grid.appendChild(cell);
                     return;
                }

                // Zawsze renderujemy pusta komorke tla
                const bgCell = document.createElement('div');
                bgCell.className = 'class-cell empty';
                bgCell.style.gridRow = rowIndex;
                bgCell.style.gridColumn = columnIndex;
                bgCell.setAttribute('data-col', columnIndex);
                grid.appendChild(bgCell);

                const classes = this.getClassesForTimeSlot(dayKey, slotObj, grouped);
                
                const startingClasses = classes.filter(c => {
                    const classId = `${dayKey}-${c.id || c.title}-${this.formatTimeFromDt(c._occStart)}`;
                    if(renderedClasses.has(classId)) return false;
                    const itemStartNum = this.timeToNumber(c._startTime);
                    const slotStartNum = slotObj.startTime;
                    return Math.abs(itemStartNum - slotStartNum) < 0.01;
                });
                
                if(startingClasses.length > 0){
                    startingClasses.forEach(c => {
                        const classId = `${dayKey}-${c.id || c.title}-${this.formatTimeFromDt(c._occStart)}`;
                        renderedClasses.add(classId);
                        
                        const duration = this.timeToNumber(c._endTime) - this.timeToNumber(c._startTime);
                        const rowSpan = Math.max(1, Math.round(duration / 0.25));
                        
                        const classTypeName = c.classType ? this.classTypeNames[c.classType] || c.classType : '';
                        const classItem = document.createElement('div');
                        const typeClass = c.classType ? `class-type-${c.classType.toLowerCase()}` : '';
                        classItem.className = `class-item ${typeClass}`;
                        classItem.style.gridRow = `${rowIndex} / span ${rowSpan}`;
                        classItem.style.gridColumn = columnIndex;
                        classItem.setAttribute('data-col', columnIndex);

                        const overlapInfo = dayOverlaps[dayKey][classId];
                        if (overlapInfo) {
                            classItem.style.width = `calc(${overlapInfo.width}% - 4px)`;
                            classItem.style.marginLeft = `calc(${overlapInfo.left}% + 2px)`;
                        }
                        
                        classItem.setAttribute('data-class-json', JSON.stringify(c));
                        classItem.onclick = () => this.openClassDetails(c);
                        
                        const safeTitle    = Utils.escapeHtml(c.title);
                        const teachersHtml = (c.teachers || []).map(t => `<span class="teacher-tag-mini">${Utils.escapeHtml(t)}</span>`).join('');
                        const safeRoom     = Utils.escapeHtml(c._room || '');
                        const safeLoc      = Utils.escapeHtml(c._location || '');
                        const safeBuilding = Utils.escapeHtml(c._buildingCode || '');
                        const safeClassType = Utils.escapeHtml(classTypeName);
                        const safeGroupNum = c.groupNumber ? `<div class="class-group-num-mini">Gr: ${Utils.escapeHtml(c.groupNumber)}</div>` : '';
                        const safeSpec = c.specialization ? `<div class="class-spec-mini" title="${Utils.escapeHtml(c.specialization)}">${Utils.escapeHtml(c.specialization)}</div>` : '';
                        const locationHtml = (safeBuilding || safeLoc)
                            ? `<div class="class-room" title="${safeLoc}">${safeBuilding || safeLoc}</div>` : '';
                        
                        classItem.innerHTML = `
                            <div class="class-title">${safeTitle}</div>
                            <div class="class-time">${this.formatTimeFromDt(c._occStart)} - ${this.formatTimeFromDt(c._occEnd)}</div>
                            ${teachersHtml ? `<div class="class-teachers-list">${teachersHtml}</div>` : ''}
                            <div class="class-room">
                                ${[safeRoom ? `${safeRoom}` : '', safeBuilding].filter(Boolean).join(', ')}
                            </div>
                            <div class="class-type-tag">${safeClassType}</div>
                            <div class="class-group-spec">
                                ${safeGroupNum}
                                ${safeSpec}
                            </div>
                        `;
                        grid.appendChild(classItem);
                    });
                }
            });
        });

        this.applyFilters();
    }
    
    /**
     * Dla każdego ScheduleEntry pobiera wystąpienia (occurrences) w danym tygodniu
     * i zwraca "spłaszczoną" listę obiektów w stylu oryginalnych itemów,
     * wzbogaconych o _startTime, _endTime, _occStart, _occEnd, _room, _buildingCode, _location.
     */
    flattenOccurrencesForWeek(entries, weekStart, weekEnd) {
        const result = [];
        const DAY_MAP = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        for (const entry of entries) {
            const occurrences = entry.occurrences || [];
            for (const occ of occurrences) {
                if (!occ.startDateTime) continue;
                const dt = new Date(occ.startDateTime);
                if (dt >= weekStart && dt < weekEnd) {
                    result.push({
                        ...entry,
                        dayOfWeek:     DAY_MAP[dt.getDay()],
                        _startTime:    `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`,
                        _endTime:      occ.endDateTime ? (() => { const d = new Date(occ.endDateTime); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })() : '',
                        _occStart:     occ.startDateTime,
                        _occEnd:       occ.endDateTime,
                        _room:         occ.room,
                        _buildingCode: occ.buildingCode,
                        _location:     occ.location
                    });
                }
            }
        }
        return result;
    }

    /** Formats an ISO datetime string to HH:MM */
    formatTimeFromDt(isoStr) {
        if (!isoStr) return '';
        const t = isoStr.includes('T') ? isoStr.split('T')[1] : isoStr;
        return t.substring(0, 5);
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
            const itemStartNum = this.timeToNumber(item._startTime || item.startTime);
            const itemEndNum = this.timeToNumber(item._endTime || item.endTime);
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
            const startA = this.timeToNumber(a._startTime || a.startTime);
            const startB = this.timeToNumber(b._startTime || b.startTime);
            if (startA !== startB) return startA - startB;
            return this.timeToNumber(b._endTime || b.endTime) - this.timeToNumber(a._endTime || a.endTime);
        });

        const positions = {}; // Map: classId -> { width, left }
        let currentCluster = [];
        let clusterEnd = 0;
        let absoluteMaxCols = 1; // Przechowuje max nakładających się zajęć w ciągu całego dnia

        const processCluster = (cluster) => {
            const columns = []; // przechowuje czas zakończenia ostatniego zajęcia w danej podkolumnie
            
            cluster.forEach(cls => {
                const start = this.timeToNumber(cls._startTime || cls.startTime);
                const end = this.timeToNumber(cls._endTime || cls.endTime);
                
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
                const classId = `${dayKey}-${cls.id || cls.title}-${this.formatTimeFromDt(cls._occStart) || this.formatTime(cls.startTime)}`;
                positions[classId] = {
                    width: 100 / numCols,
                    left: (100 / numCols) * cls._colIdx
                };
            });
        };

        sorted.forEach(cls => {
            const start = this.timeToNumber(cls._startTime || cls.startTime);
            const end = this.timeToNumber(cls._endTime || cls.endTime);

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
        document.getElementById('prevWeekBtn')?.addEventListener('click', () => this.changeWeek(-1));
        document.getElementById('nextWeekBtn')?.addEventListener('click', () => this.changeWeek(1));
        document.getElementById('todayBtn')?.addEventListener('click', () => this.resetToToday());

        // Obsługa akordeonu wystąpień
        const occToggle = document.getElementById('modalOccurrencesToggle');
        const occContent = document.getElementById('modalOccurrencesList');
        if (occToggle && occContent) {
            occToggle.addEventListener('click', () => {
                const isActive = occToggle.classList.toggle('active');
                occContent.classList.toggle('active');
            });
        }

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
            if (nextLabelEl) nextLabelEl.textContent = specialDay.name;
            if (nextClassTitleEl) nextClassTitleEl.textContent = this.getSpecialPeriodMessage(specialDay.type);
            if (nextClassDetailsEl) nextClassDetailsEl.textContent = 'Brak zajęć dydaktycznych';
            
            return;
        }

        if (this.scheduleData.length === 0) {
            widget.style.display = 'none';
            return;
        }

        const currentTimeNum = now.getHours() + now.getMinutes() / 60;

        let nextClass = null;
        let nextOcc = null;
        let minDiff = Infinity;

        // Iterate all occurrences for today
        for (const entry of this.scheduleData) {
            for (const occ of (entry.occurrences || [])) {
                if (!occ.startDateTime) continue;
                const dt = new Date(occ.startDateTime);
                const today = new Date();
                // Same date?
                if (dt.getFullYear() !== today.getFullYear() ||
                    dt.getMonth()    !== today.getMonth()    ||
                    dt.getDate()     !== today.getDate()) continue;

                const startNum = dt.getHours() + dt.getMinutes() / 60;
                if (startNum > currentTimeNum) {
                    const diff = startNum - currentTimeNum;
                    if (diff < minDiff) {
                        minDiff = diff; nextClass = entry; nextOcc = occ;
                    }
                }
            }
        }
          if (nextClass && nextOcc) {
            const occDt = new Date(nextOcc.startDateTime);
            const startNum = occDt.getHours() + occDt.getMinutes() / 60;
            const timeToStart = Math.round((startNum - currentTimeNum) * 60);
            
            if (timeToStart <= 120) {
                widget.style.display = 'flex';
                const timeToNextEl = document.getElementById('timeToNext');
                const nextLabelEl = document.querySelector('.next-label');
                if (timeToNextEl) { timeToNextEl.style.display = ''; timeToNextEl.textContent = timeToStart; }
                if (nextLabelEl) nextLabelEl.innerHTML = `Następne zajęcia (za <span id="timeToNext">${timeToStart}</span> min):`;
                document.getElementById('nextClassTitle').textContent = nextClass.title || '';
                const teachers = (nextClass.teachers || []).join(', ');
                const room = nextOcc.room ? `Sala ${nextOcc.room}` : '';
                const type = nextClass.classType ? (ScheduleCalendar.CONFIG.CLASS_TYPES[nextClass.classType] || nextClass.classType) : '';
                document.getElementById('nextClassDetails').textContent = [type, room, teachers].filter(Boolean).join(' • ');
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
        
        document.getElementById('modalClassTitle').textContent = classData.title || '';
        
        // Time from _occStart/_occEnd (flattened occurrence) or fallback
        const startStr = classData._occStart ? this.formatTimeFromDt(classData._occStart) : Utils.formatTime(classData.startTime);
        const endStr   = classData._occEnd    ? this.formatTimeFromDt(classData._occEnd)   : Utils.formatTime(classData.endTime);
        const dateStr  = classData._occStart ? (() => { 
            const d = new Date(classData._occStart); 
            const dayName = ScheduleCalendar.CONFIG.DAY_NAMES[classData.dayOfWeek] || '';
            const date = d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });
            return `${dayName}, ${date}`;
        })() : '';
        
        document.getElementById('modalClassDate').textContent = dateStr;
        document.getElementById('modalClassTime').textContent = `${startStr} – ${endStr}`;
        
        const teachersContainer = document.getElementById('modalClassTeacher');
        if (teachersContainer) {
            teachersContainer.innerHTML = (classData.teachers || []).map(t => `<span class="teacher-detail-tag">${Utils.escapeHtml(t)}</span>`).join('') || 'Brak danych';
        }

        const roomStr = classData._room || '';
        const shortCode = classData._buildingCode || '';
        const fullLocation = classData._location || '';
        
        document.getElementById('modalClassRoomMain').textContent = [roomStr ? `${roomStr}` : '', shortCode].filter(Boolean).join(', ') || 'Brak danych';
        document.getElementById('modalClassRoomSub').textContent = fullLocation || '';
        
        const groupContainer = document.getElementById('modalClassGroup');
        if (groupContainer) {
            if (classData.studentGroups && classData.studentGroups.length > 0) {
                groupContainer.innerHTML = classData.studentGroups.map(g => `<span class="group-detail-tag">${Utils.escapeHtml(g.name)}</span>`).join('');
            } else if (classData.yearPlan) {
                groupContainer.textContent = classData.yearPlan;
            } else {
                groupContainer.textContent = '-';
            }
        }

        const typeName = ScheduleCalendar.CONFIG.CLASS_TYPES[classData.classType] || classData.classType || 'Zajęcia';
        document.getElementById('modalClassType').textContent = typeName;

        const gnEl = document.getElementById('modalClassGroupNumber');
        const gnRow = document.getElementById('modalGroupNumberRow');
        if (gnEl && gnRow) {
            if (classData.groupNumber) { gnEl.textContent = classData.groupNumber; gnRow.style.display = ''; }
            else { gnRow.style.display = 'none'; }
        }

        const spEl = document.getElementById('modalClassSpecialization');
        const spRow = document.getElementById('modalSpecializationRow');
        if (spEl && spRow) {
            if (classData.specialization) { spEl.textContent = classData.specialization; spRow.style.display = ''; }
            else { spRow.style.display = 'none'; }
        }

        const ctEl = document.getElementById('modalClassCreditType');
        const ctRow = document.getElementById('modalCreditTypeRow');
        if (ctEl && ctRow) {
            const ctValue = classData.creditType;
            if (ctValue) {
                ctEl.textContent = ScheduleCalendar.CONFIG.CREDIT_TYPES[ctValue] || ctValue;
                ctRow.style.display = '';
            } else {
                ctRow.style.display = 'none';
            }
        }

        // Populate occurrences list
        const occList = document.getElementById('modalOccurrencesList');
        const occToggle = document.getElementById('modalOccurrencesToggle');
        if (occList && occToggle) {
            // Reset state
            occList.innerHTML = '';
            occList.classList.remove('active');
            occToggle.classList.remove('active');

            const occurrences = classData.occurrences || [];
            if (occurrences.length > 0) {
                // Sort by date
                const sortedOccs = [...occurrences].sort((a,b) => new Date(a.startDateTime) - new Date(b.startDateTime));
                
                sortedOccs.forEach(occ => {
                    const startDt = new Date(occ.startDateTime);
                    const endDt = occ.endDateTime ? new Date(occ.endDateTime) : null;
                    
                    const dateStr = startDt.toLocaleDateString('pl-PL', { 
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
                    });
                    const dayName = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
                    const timeStr = `${Utils.formatTime({hour: startDt.getHours(), minute: startDt.getMinutes()})} – ${endDt ? Utils.formatTime({hour: endDt.getHours(), minute: endDt.getMinutes()}) : ''}`;
                    
                    const occItem = document.createElement('div');
                    occItem.className = 'occurrence-item';
                    occItem.innerHTML = `
                        <div class="occ-date">${dayName}</div>
                        <div class="occ-time">${timeStr}</div>
                        ${occ.room || occ.buildingCode ? `<div class="occ-location">${[occ.room ? `Sala ${occ.room}` : '', occ.buildingCode].filter(Boolean).join(', ')}</div>` : ''}
                    `;
                    occList.appendChild(occItem);
                });
                document.querySelector('.occurrences-accordion').style.display = '';
            } else {
                document.querySelector('.occurrences-accordion').style.display = 'none';
            }
        }
        
        const colorClass = `class-type-${(classData.classType || '').toLowerCase()}`;
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

    // Przewija widok siatki do aktualnego czasu (pion) i dnia (poziom)
    scrollToCurrentTime() {
        const grid = document.getElementById('scheduleGrid');
        if (!grid) return;
        
        const todayStr = this.formatDateLocal(new Date());
        const todayHeader = document.querySelector(`.day-header[data-date="${todayStr}"]`);
        
        // 1. Oś X (Poziom) - Centrowanie dnia na telefonach
        if (todayHeader && window.innerWidth < 1024) {
            const gridRect = grid.getBoundingClientRect();
            const headerRect = todayHeader.getBoundingClientRect();
            
            // Obliczamy pozycję nagłówka wewnątrz scrollowalnego obszaru siatki
            const relativeLeft = headerRect.left - gridRect.left + grid.scrollLeft;
            const headerCenter = relativeLeft + (headerRect.width / 2);
            const containerWidth = grid.clientWidth;
            
            grid.scrollTo({
                left: Math.max(0, headerCenter - (containerWidth / 2)),
                behavior: 'smooth'
            });
        }

        // 2. Oś Y (Pion) - Wykrywanie właściwego kontenera przewijania (Window vs .navbar-middle)
        const timeLine = document.getElementById('currentTimeLine');
        let targetEl = null;

        if (timeLine) {
            targetEl = timeLine;
        } else if (todayHeader) {
            const todayClasses = document.querySelectorAll('.current-day-col.class-item');
            if (todayClasses.length > 0) {
                targetEl = todayClasses[0];
            } else {
                targetEl = todayHeader;
            }
        }

        if (targetEl) {
            const scrollContainer = document.querySelector('.navbar-middle') || document.documentElement;
            const styles = window.getComputedStyle(scrollContainer);
            
            // Na komórkach .navbar-middle ma zazwyczaj overflow: visible i scrollem jest okno (window)
            // lub w trybie mobilnym layout wymusza scroll na body/window
            const isWindowScroll = styles.overflowY === 'visible' || styles.overflowY === 'unset' || window.innerWidth <= 992;
            const targetScrollable = isWindowScroll ? window : scrollContainer;
            
            const containerRect = isWindowScroll ? { top: 0, height: window.innerHeight } : scrollContainer.getBoundingClientRect();
            const targetRect = targetEl.getBoundingClientRect();
            
            // Wyznaczamy absolutną pozycję Y docelową
            const currentScrollTop = isWindowScroll ? window.pageYOffset : scrollContainer.scrollTop;
            const absoluteTargetTop = targetRect.top - containerRect.top + currentScrollTop;
            const targetY = absoluteTargetTop - (containerRect.height / 2) + (targetRect.height / 2);

            targetScrollable.scrollTo({
                top: Math.max(0, targetY),
                behavior: 'smooth'
            });
        }
    }
}

// inicjalizacja
window.ScheduleCalendar = ScheduleCalendar;

document.addEventListener('DOMContentLoaded', () => {
    // Klasa jest inicjalizowana w HTML
});