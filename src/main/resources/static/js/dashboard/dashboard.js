// Moduł strony głównej dashboardu
class DashboardHome {
    constructor() {
        // Endpoint API dla harmonogramu zajęć
        this.apiEndpoint = '/api/schedule';
        
        // Dane zajęć
        this.scheduleData = [];
        
        // Mapowanie nazw dni tygodnia
        this.dayNames = {
            'Monday': 'Poniedziałek',
            'Tuesday': 'Wtorek',
            'Wednesday': 'Środa',
            'Thursday': 'Czwartek',
            'Friday': 'Piątek',
            'Saturday': 'Sobota',
            'Sunday': 'Niedziela'
        };
        
        // Mapowanie typów zajęć
        this.classTypeNames = {
            'WYKLAD': 'Wykład',
            'CWICZENIA': 'Ćwiczenia laborytoryjne',
            'LABORATORIUM': 'Laboratorium',
            'PROJEKT': 'Projekt zespołowy',
            'SEMINARIUM': 'Seminarium',
            'KONSULTACJE': 'Konsultacje'
        };
        
        // Inicjalizacja
        this.init();
    }
    
    // Inicjalizacja modułu
    init() {
        this.setGreeting();
        this.displayCurrentDate();
        this.loadUpcomingClasses();
    }
    
    // Ustawienie powitania w zależności od pory dnia
    setGreeting() {
        const greetingElement = document.getElementById('greetingText');
        if (!greetingElement) return;
        
        const hour = new Date().getHours();
        let greeting;
        
        if (hour < 6) {
            greeting = 'Dobranoc';
        } else if (hour < 12) {
            greeting = 'Dzień dobry';
        } else if (hour < 18) {
            greeting = 'Dzień dobry';
        } else if (hour < 22) {
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
            const response = await fetch(this.apiEndpoint);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.scheduleData = await response.json();
            
            console.log('Załadowano harmonogram:', this.scheduleData);
            
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
                    <p>Nie udało się załadować zajęć: ${error.message}</p>
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
        const tomorrow = this.getDayOfWeek(new Date(now.getTime() + 24 * 60 * 60 * 1000));
        
        // Filtrowanie zajęć na dzisiaj i jutro
        const todayClasses = this.getClassesForDay(today, now);
        const tomorrowClasses = this.getClassesForDay(tomorrow, new Date(now.getTime() + 24 * 60 * 60 * 1000));
        
        // Filtrowanie aktualnych zajęć (trwających teraz)
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const currentClasses = todayClasses.filter(classItem => {
            const startMinutes = this.timeToMinutes(classItem.startTime);
            const endMinutes = this.timeToMinutes(classItem.endTime);
            return nowMinutes >= startMinutes && nowMinutes < endMinutes;
        });
        
        // Zajęcia dzisiejsze (bez aktualnych)
        const todayUpcomingClasses = todayClasses.filter(classItem => {
            const startMinutes = this.timeToMinutes(classItem.startTime);
            return nowMinutes < startMinutes;
        });
        
        console.log('Zajęcia aktualne:', currentClasses);
        console.log('Zajęcia dzisiaj:', todayUpcomingClasses);
        console.log('Zajęcia jutro:', tomorrowClasses);
        
        // Pokaż/ukryj kontenery
        const currentContainer = document.getElementById('currentClasses');
        const todayContainer = document.getElementById('todayClasses');
        const tomorrowContainer = document.getElementById('tomorrowClasses');
        const noClassesDiv = document.getElementById('noClasses');
        
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
        
        // Wyświetlenie zajęć jutro
        if (tomorrowClasses.length > 0) {
            tomorrowContainer.style.display = 'block';
            this.renderClasses('tomorrowClassesList', tomorrowClasses, new Date(now.getTime() + 24 * 60 * 60 * 1000));
        }
        
        // Pokaż komunikat jeśli brak zajęć
        if (currentClasses.length === 0 && todayUpcomingClasses.length === 0 && tomorrowClasses.length === 0) {
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
        return timeObj.hour * 60 + timeObj.minute;
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
        const classTypeName = this.classTypeNames[classItem.classType] || classItem.classType;
        
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
        const hour = String(timeObj.hour).padStart(2, '0');
        const minute = String(timeObj.minute).padStart(2, '0');
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
}

// Inicjalizacja po załadowaniu DOM
document.addEventListener('DOMContentLoaded', () => {
    new DashboardHome();
});
