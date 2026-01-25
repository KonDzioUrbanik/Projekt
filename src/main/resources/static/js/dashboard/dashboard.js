// Moduł strony głównej dashboardu
class DashboardHome {

    // Stałe konfiguracyjne
    static CONFIG = {
        API: {
            SCHEDULE: '/api/schedule',
            SCHEDULE_ALL: '/api/schedule/all',
            USERS: '/api/users',
            GROUPS: '/api/groups'
        },
        ANIMATION_DURATION: 1000,
        ANIMATION_FPS: 60,
        MILLIS_PER_DAY: 24 * 60 * 60 * 1000,
        GREETING_TIMES: {
            NIGHT_END: 6,
            MORNING_END: 12,
            AFTERNOON_END: 18,
            EVENING_END: 22
        },
        ROLES: {
            STUDENT: 'STUDENT',
            STAROSTA: 'STAROSTA',
            ADMIN: 'ADMIN'
        },
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
            'CWICZENIA': 'Ćwiczenia laborytoryjne',
            'LABORATORIUM': 'Laboratorium',
            'PROJEKT': 'Projekt zespołowy',
            'SEMINARIUM': 'Seminarium',
            'KONSULTACJE': 'Konsultacje'
        }
    };

    constructor() {
        // Dane zajęć
        this.scheduleData = [];
        
        // Inicjalizacja
        this.init();
    }
    
    // Inicjalizacja modułu
    init() {
        this.setGreeting();
        this.displayCurrentDate();
        this.loadUpcomingClasses();
        
        // Inicjalizacja panelu admina (jeśli istnieje)
        const adminDashboard = document.querySelector('.admin-dashboard');
        if (adminDashboard) {
            this.initAdminPanel();
        }
    }
    
    // Ustawienie powitania w zależności od pory dnia
    setGreeting() {
        const greetingElement = document.getElementById('greetingText');
        if (!greetingElement) return;
        
        const hour = new Date().getHours();
        const { NIGHT_END, MORNING_END, AFTERNOON_END, EVENING_END } = DashboardHome.CONFIG.GREETING_TIMES;
        
        let greeting;
        if (hour < NIGHT_END) {
            greeting = 'Dobranoc';
        } else if (hour < MORNING_END) {
            greeting = 'Dzień dobry';
        } else if (hour < AFTERNOON_END) {
            greeting = 'Dzień dobry';
        } else if (hour < EVENING_END) {
            greeting = 'Dobry wieczór';
        } else {
            greeting = 'Dobranoc';
        }
        
        greetingElement.textContent = greeting;
    }
    
    // Wyświetlenie aktualnej daty w nagłówku
    displayCurrentDate() {
        const dateElement = document.getElementById('currentDate');
        if (!dateElement) return;
        
        const now = new Date();
        const options = { 
            day: 'numeric', 
            month: 'long',
            year: 'numeric'
        };
        
        dateElement.textContent = now.toLocaleDateString('pl-PL', options);
    }
    
    // Pobranie najbliższych zajęć z API
    async loadUpcomingClasses() {
        const loader = document.getElementById('classesLoader');
        const errorDiv = document.getElementById('classesError');
        
        // Pokaż loader
        if (loader) loader.style.display = 'flex';
        if (errorDiv) errorDiv.style.display = 'none';
        
        try {
            const response = await fetch(DashboardHome.CONFIG.API.SCHEDULE);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.scheduleData = await response.json();
            
            // Przefiltruj i wyświetl zajęcia
            this.displayUpcomingClasses();
            
        } catch (error) {
            console.error('Błąd ładowania harmonogramu:', error);
            
            // Ukryj loader i pokaż błąd
            if (loader) loader.style.display = 'none';
            if (errorDiv) {
                errorDiv.style.display = 'flex';
                errorDiv.innerHTML = `
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Nie udało się załadować harmonogramu zajęć. Sprawdź połączenie internetowe i odśwież stronę.</p>
                `;
            }
        } finally {
            // Ukryj loader
            if (loader) loader.style.display = 'none';
        }
    }
    
    // Filtrowanie i wyświetlanie najbliższych zajęć
    displayUpcomingClasses() {
        const now = new Date();
        const today = this.getDayOfWeek(now);
        const tomorrowDate = new Date(now.getTime() + DashboardHome.CONFIG.MILLIS_PER_DAY);
        const tomorrow = this.getDayOfWeek(tomorrowDate);
        
        // Filtrowanie zajęć na dzisiaj i jutro
        const todayClasses = this.getClassesForDay(today, now);
        const tomorrowClasses = this.getClassesForDay(tomorrow, tomorrowDate);
        
        // Filtrowanie aktualnych zajęć (trwających teraz)
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const currentClasses = todayClasses.filter(classItem => {
            const startMinutes = this.timeToMinutes(classItem.startTime);
            const endMinutes = this.timeToMinutes(classItem.endTime);
            return nowMinutes >= startMinutes && nowMinutes < endMinutes;
        });
        
        // Zajęcia dzisiejsze (nadchodzące - jeszcze się nie rozpoczęły)
        const todayUpcomingClasses = todayClasses.filter(classItem => {
            const startMinutes = this.timeToMinutes(classItem.startTime);
            return nowMinutes < startMinutes;
        });
        
        // Pokaż/ukryj kontenery
        const currentContainer = document.getElementById('currentClasses');
        const todayContainer = document.getElementById('todayClasses');
        const tomorrowContainer = document.getElementById('tomorrowClasses');
        const noClassesDiv = document.getElementById('noClasses');
        
        // Ukryj wszystkie kontenery na początku
        currentContainer.style.display = 'none';
        todayContainer.style.display = 'none';
        tomorrowContainer.style.display = 'none';
        noClassesDiv.style.display = 'none';
        
        // Wyświetlenie aktualnych zajęć
        if (currentClasses.length > 0) {
            currentContainer.style.display = 'block';
            this.renderClasses('currentClassesList', currentClasses, now, true);
        }
        
        // Wyświetlenie zajęć dzisiaj (nadchodzące)
        if (todayUpcomingClasses.length > 0) {
            todayContainer.style.display = 'block';
            this.renderClasses('todayClassesList', todayUpcomingClasses, now);
        }
        
        // Wyświetlenie zajęć jutro - tylko jeśli nie ma już dzisiejszych zajęć
        // lub jeśli jest bardzo późno (po 22:00) i dzisiejsze zajęcia się skończyły
        const showTomorrow = todayUpcomingClasses.length === 0 && currentClasses.length === 0;
        if (showTomorrow && tomorrowClasses.length > 0) {
            tomorrowContainer.style.display = 'block';
            const tomorrowDate = new Date(now.getTime() + DashboardHome.CONFIG.MILLIS_PER_DAY);
            this.renderClasses('tomorrowClassesList', tomorrowClasses, tomorrowDate);
        }
        
        // Pokaż komunikat jeśli brak zajęć
        if (currentClasses.length === 0 && todayUpcomingClasses.length === 0 && (!showTomorrow || tomorrowClasses.length === 0)) {
            noClassesDiv.style.display = 'flex';
        }
    }
    
    // Pobranie dnia tygodnia dla daty
    getDayOfWeek(date) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[date.getDay()];
    }
    
    // Filtrowanie zajęć dla danego dnia
    getClassesForDay(dayName, date) {
        const dayClasses = this.scheduleData.filter(c => c.dayOfWeek === dayName);
        
        // Sortowanie po czasie rozpoczęcia
        return dayClasses.sort((a, b) => {
            return this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime);
        });
    }
    
    // Konwersja czasu do minut dla sortowania
    timeToMinutes(timeObj) {
        if (!timeObj) {
            return 0;
        }
        
        // Obsługa formatu string "HH:MM:SS"
        if (typeof timeObj === 'string') {
            const parts = timeObj.split(':');
            const hour = parseInt(parts[0], 10) || 0;
            const minute = parseInt(parts[1], 10) || 0;
            return hour * 60 + minute;
        }
        
        // Obsługa formatu obiektu {hour, minute}
        const hour = timeObj.hour !== undefined ? timeObj.hour : 0;
        const minute = timeObj.minute !== undefined ? timeObj.minute : 0;
        
        return hour * 60 + minute;
    }
    
    // Walidacja danych zajęć
    validateClassItem(classItem) {
        if (!classItem) return false;
        
        const requiredFields = ['title', 'dayOfWeek', 'startTime', 'endTime', 'classType'];
        return requiredFields.every(field => classItem[field] !== undefined && classItem[field] !== null);
    }
    
    // Pomocnicza metoda do wyświetlania błędów
    displayError(containerId, message) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="error-state" role="alert">
                    <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
                    <h3>Wystąpił błąd podczas wczytywania danych</h3>
                    <p>${message}</p>
                </div>
            `;
        }
    }
    
    // Renderowanie listy zajęć w kontenerze
    renderClasses(containerId, classes, date, forceCurrent = false) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        if (classes.length === 0) {
            container.innerHTML = `
                <div class="no-classes-message">
                    <i class="fas fa-calendar-times"></i>
                    <p>Brak zajęć w tym dniu</p>
                </div>
            `;
            return;
        }
        
        const now = new Date();
        const isToday = this.getDayOfWeek(date) === this.getDayOfWeek(now);
        
        classes.forEach(classItem => {
            const startMinutes = this.timeToMinutes(classItem.startTime);
            const endMinutes = this.timeToMinutes(classItem.endTime);
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            
            // Określenie statusu zajęć (przeszłe/aktualnie/przyszłe)
            let status = 'upcoming';
            if (forceCurrent) {
                // Jeśli renderujemy w sekcji "Trwają teraz", wymuszamy status current
                status = 'current';
            } else if (isToday) {
                if (nowMinutes >= endMinutes) {
                    status = 'past';
                } else if (nowMinutes >= startMinutes && nowMinutes < endMinutes) {
                    status = 'current';
                }
            }
            
            const classCard = this.createClassCard(classItem, status, isToday);
            container.appendChild(classCard);
        });
    }
    
    // Tworzenie karty zajęć
    createClassCard(classItem, status, isToday = true) {
        const card = document.createElement('div');
        card.className = `home-class-card ${status}`;
        
        // Określenie ikony na podstawie typu zajęć
        const icon = this.getIconForClassType(classItem.classType);
        
        // Typ zajęć w formacie czytelnym
        const classTypeName = DashboardHome.CONFIG.CLASS_TYPES[classItem.classType] || classItem.classType;
        
        // Obliczenie czasu do/od zajęć (tylko dla dzisiejszych zajęć)
        const timeInfo = isToday ? this.calculateTimeInfo(classItem, status) : null;
        
        card.innerHTML = `
            <div class="home-class-time-badge">
                <i class="fas fa-clock"></i>
                <span>${this.formatTime(classItem.startTime)} - ${this.formatTime(classItem.endTime)}</span>
                ${timeInfo ? `<span style="margin-left: 0.5rem; color: var(--text-light); font-weight: 500;">${timeInfo}</span>` : ''}
            </div>
            
            <div class="home-class-content">
                <div class="home-class-main-info">
                    <div class="home-class-icon">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="home-class-details">
                        <h4 class="home-class-title">${classItem.title}</h4>
                        <p class="home-class-type">${classTypeName}</p>
                    </div>
                </div>
                
                <div class="home-class-meta">
                    ${classItem.room ? `
                        <div class="home-meta-item">
                            <i class="fas fa-door-open"></i>
                            <span>Sala ${classItem.room}</span>
                        </div>
                    ` : ''}
                    
                    ${classItem.teacher ? `
                        <div class="home-meta-item">
                            <i class="fas fa-chalkboard-teacher"></i>
                            <span>${classItem.teacher}</span>
                        </div>
                    ` : ''}
                </div>
                
                ${status === 'current' ? `
                    <div class="home-current-indicator">
                        <span class="home-pulse-dot"></span>
                        <span>Zajęcia w trakcie</span>
                    </div>
                ` : ''}
            </div>
        `;
        
        return card;
    }
    
    // Ikona dla typu zajęć
    getIconForClassType(classType) {
        const icons = {
            'WYKLAD': 'fa-chalkboard',
            'CWICZENIA': 'fa-pencil-alt',
            'LABORATORIUM': 'fa-flask',
            'PROJEKT': 'fa-project-diagram',
            'SEMINARIUM': 'fa-users',
            'KONSULTACJE': 'fa-user-graduate'
        };
        
        return icons[classType] || 'fa-book';
    }
    
    // Formatowanie czasu
    formatTime(timeObj) {
        if (!timeObj) {
            return '--:--';
        }
        
        if (typeof timeObj === 'string') {
            return timeObj;
        }
        
        // Obsługa obiektu LocalTime z backendu
        const hour = timeObj.hour !== undefined ? String(timeObj.hour).padStart(2, '0') : '00';
        const minute = timeObj.minute !== undefined ? String(timeObj.minute).padStart(2, '0') : '00';
        
        return `${hour}:${minute}`;
    }
    
    // Obliczenie informacji o czasie do/od zajęć
    calculateTimeInfo(classItem, status) {
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const startMinutes = this.timeToMinutes(classItem.startTime);
        const endMinutes = this.timeToMinutes(classItem.endTime);
        
        if (status === 'current') {
            // Zajęcia trwają - oblicz czas do końca
            const minutesLeft = endMinutes - nowMinutes;
            return this.formatTimeRemaining(minutesLeft, 'Kończy się za');
        } else if (status === 'upcoming') {
            // Zajęcia nadchodzące - oblicz czas do rozpoczęcia
            const minutesUntil = startMinutes - nowMinutes;
            return this.formatTimeRemaining(minutesUntil, 'Zaczyna się za');
        }
        
        return null; // Dla zajęć przeszłych nie pokazujemy licznika
    }
    
    // Formatowanie pozostałego czasu
    formatTimeRemaining(minutes, prefix) {
        if (minutes < 0) return null;
        
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        if (hours > 0) {
            if (mins > 0) {
                return `${prefix} ${hours}h ${mins}min`;
            } else {
                return `${prefix} ${hours}h`;
            }
        } else {
            return `${prefix} ${mins}min`;
        }
    }

    // PANEL ADMINISTRATORA

    // Inicjalizacja panelu administratora
    initAdminPanel() {
        this.loadAdminStats();
        this.loadRecentActivity();
        this.loadAdminClasses();
    }

    // Załadowanie statystyk dla administratora
    async loadAdminStats() {
        try {
            // Pobieranie prawdziwych danych z API
            const [usersResponse, groupsResponse, scheduleResponse] = await Promise.all([
                fetch(DashboardHome.CONFIG.API.USERS).catch(() => null),
                fetch(DashboardHome.CONFIG.API.GROUPS).catch(() => null),
                fetch(DashboardHome.CONFIG.API.SCHEDULE_ALL).catch(() => null)
            ]);
            
            let totalUsers = '-';
            let totalStudents = '-';
            let totalGroups = '-';
            let totalClassesToday = '-';
            
            // Liczba użytkowników i studentów
            if (usersResponse && usersResponse.ok) {
                const users = await usersResponse.json();
                totalUsers = users.length;
                
                // Liczba AKTYWNYCH studentów (z aktywowanym kontem i rolą STUDENT lub STAROSTA)
                const { STUDENT, STAROSTA } = DashboardHome.CONFIG.ROLES;
                const activeStudents = users.filter(user => 
                    user.isActivated === true && 
                    user.role && (user.role === STUDENT || user.role === STAROSTA)
                );
                totalStudents = activeStudents.length;
            }
            
            // Liczba kierunków
            if (groupsResponse && groupsResponse.ok) {
                const groups = await groupsResponse.json();
                totalGroups = groups.length;
            }
            
            // Liczba zajęć dzisiaj
            if (scheduleResponse && scheduleResponse.ok) {
                const allSchedule = await scheduleResponse.json();
                const today = this.getDayOfWeek(new Date());
                const todayClasses = allSchedule.filter(c => c.dayOfWeek === today);
                totalClassesToday = todayClasses.length;
            }
            
            // Aktualizacja wartości statystyk
            this.updateStatValue('totalUsers', totalUsers);
            this.updateStatValue('totalStudents', totalStudents);
            this.updateStatValue('totalClassesToday', totalClassesToday);
            this.updateStatValue('totalGroups', totalGroups);
            
        } catch (error) {
            console.error('Błąd podczas ładowania statystyk:', error);
            // W przypadku błędu ustaw wartości domyślne
            this.updateStatValue('totalUsers', '-', false);
            this.updateStatValue('totalStudents', '-', false);
            this.updateStatValue('totalClassesToday', '-', false);
            this.updateStatValue('totalGroups', '-', false);
        }
    }

    // Pomocnicza metoda do aktualizacji wartości statystyk
    updateStatValue(elementId, value, animate = true) {
        const element = document.getElementById(elementId);
        if (element) {
            if (typeof value === 'number' && animate) {
                // Animacja liczenia dla wartości numerycznych
                this.animateValue(element, 0, value, DashboardHome.CONFIG.ANIMATION_DURATION);
            } else {
                // Bezpośrednie ustawienie dla "-" lub innych wartości
                element.textContent = value;
            }
        }
    }

    // Animacja liczenia wartości
    animateValue(element, start, end, duration) {
        const frameTime = 1000 / DashboardHome.CONFIG.ANIMATION_FPS;
        const range = end - start;
        const increment = range / (duration / frameTime);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
                element.textContent = end;
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current);
            }
        }, frameTime);
    }

    // Załadowanie ostatniej aktywności w systemie
    async loadRecentActivity() {
        const activityList = document.getElementById('activityList');
        if (!activityList) return;
        
        try {
            // Endpoint dla aktywności 
            
            activityList.innerHTML = `
                <div class="coming-soon" style="padding: 2rem 1rem;">
                    <div class="coming-icon">
                        <i class="fas fa-clock"></i>
                    </div>
                    <h3>Funkcja w budowie</h3>
                    <p>Historia aktywności będzie dostępna wkrótce.</p>
                </div>
            `;      
        } 
        catch (error){
            console.error('Błąd podczas ładowania aktywności:', error);
            activityList.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Nie udało się załadować aktywności</h3>
                    <p>Spróbuj odświeżyć stronę</p>
                </div>
            `;
        }
    }

    // Załadowanie zajęć dla widoku administratora
    async loadAdminClasses() {
        const classList = document.getElementById('adminClassesList');
        if (!classList) return;
        
        try {
            // Pobieranie wszystkich zajęć z API
            const response = await fetch(DashboardHome.CONFIG.API.SCHEDULE_ALL);
            
            if (!response.ok) {
                throw new Error('Nie udało się pobrać harmonogramu');
            }
            
            const allSchedule = await response.json();
            
            // Filtrowanie zajęć na dzisiaj
            const today = this.getDayOfWeek(new Date());
            const todayClasses = allSchedule.filter(c => c.dayOfWeek === today);
            
            // Sortowanie po czasie rozpoczęcia
            todayClasses.sort((a, b) => {
                return this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime);
            });
            
            if (todayClasses.length === 0) {
                classList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">
                            <i class="fas fa-calendar-times"></i>
                        </div>
                        <h3>Brak zajęć dzisiaj</h3>
                        <p>Nie zaplanowano żadnych zajęć na dzisiejszy dzień</p>
                    </div>
                `;
                return;
            }
            
            // Renderowanie listy zajęć
            classList.innerHTML = todayClasses.map(classItem => {
                const classTypeName = DashboardHome.CONFIG.CLASS_TYPES[classItem.classType] || classItem.classType;
                const groupNames = classItem.studentGroups 
                    ? classItem.studentGroups.map(g => g.groupName).join(', ') 
                    : 'Brak grupy';
                
                return `
                    <div class="admin-class-item">
                        <div class="admin-class-info">
                            <h4>${classItem.title}</h4>
                            <div class="admin-class-details">
                                <span>
                                    <i class="fas fa-graduation-cap"></i>
                                    ${classTypeName}
                                </span>
                                <span>
                                    <i class="fas fa-chalkboard-teacher"></i>
                                    ${classItem.teacher || 'Brak wykładowcy'}
                                </span>
                                <span>
                                    <i class="fas fa-door-open"></i>
                                    ${classItem.room || 'Brak sali'}
                                </span>
                                <span>
                                    <i class="fas fa-users"></i>
                                    ${groupNames}
                                </span>
                            </div>
                        </div>
                        <div class="admin-class-time">
                            ${this.formatTime(classItem.startTime)} - ${this.formatTime(classItem.endTime)}
                        </div>
                    </div>
                `;
            }).join('');
            
        } catch (error) {
            console.error('Błąd podczas ładowania zajęć:', error);
            classList.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Nie udało się załadować zajęć</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }
}

// Inicjalizacja po załadowaniu DOM
document.addEventListener('DOMContentLoaded', () => {
    new DashboardHome();

    const days = [
        "Niedziela",
        "Poniedziałek",
        "Wtorek",
        "Środa",
        "Czwartek",
        "Piątek",
        "Sobota"
    ];

    const element = document.getElementById("dayName");
    if(element){
        element.textContent = days[new Date().getDay()];
    }
});
