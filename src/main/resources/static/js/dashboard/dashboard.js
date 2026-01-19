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
        
        // Inicjalizacja panelu admina (jeśli istnieje)
        if (document.querySelector('.admin-dashboard')) {
            this.initAdminPanel();
        }
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
        if (!timeObj) {
            return 0;
        }
        
        const hour = timeObj.hour !== undefined ? timeObj.hour : 0;
        const minute = timeObj.minute !== undefined ? timeObj.minute : 0;
        
        return hour * 60 + minute;
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
            // W przyszłości będą pobierane dane z API
            // const response = await fetch('/api/admin/stats');
            // const stats = await response.json();
            
            // Mock data - przykładowe statystyki
            const stats = {
                totalUsers: 245,
                totalStudents: 228,
                totalClassesToday: 32,
                totalGroups: 8
            };
            
            // Aktualizacja wartości statystyk
            this.updateStatValue('totalUsers', stats.totalUsers);
            this.updateStatValue('totalStudents', stats.totalStudents);
            this.updateStatValue('totalClassesToday', stats.totalClassesToday);
            this.updateStatValue('totalGroups', stats.totalGroups);
            
        } catch (error) {
            console.error('Błąd podczas ładowania statystyk:', error);
        }
    }

    // Pomocnicza metoda do aktualizacji wartości statystyk
    updateStatValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            // Animacja liczenia
            this.animateValue(element, 0, value, 1000);
        }
    }

    // Animacja liczenia wartości
    animateValue(element, start, end, duration) {
        const range = end - start;
        const increment = range / (duration / 16); // 60 FPS
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
                element.textContent = end;
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current);
            }
        }, 16);
    }

    // Załadowanie ostatniej aktywności w systemie
    async loadRecentActivity() {
        const activityList = document.getElementById('activityList');
        if (!activityList) return;
        
        try {
            // W przyszłości będziemy pobierać dane z API
            // const response = await fetch('/api/admin/activity');
            // const activities = await response.json();
            
            // Mock data - przykładowa aktywność
            const activities = [
                {
                    icon: 'fa-user-plus',
                    title: 'Nowy użytkownik zarejestrowany',
                    description: 'Jan Kowalski dołączył do systemu',
                    time: '5 minut temu',
                    type: 'info'
                },
                {
                    icon: 'fa-edit',
                    title: 'Aktualizacja harmonogramu',
                    description: 'Zmieniono godziny zajęć z Algorytmiki',
                    time: '23 minuty temu',
                    type: 'warning'
                },
                {
                    icon: 'fa-bullhorn',
                    title: 'Nowe ogłoszenie',
                    description: 'Opublikowano informację o egzaminach',
                    time: '1 godzinę temu',
                    type: 'success'
                },
                {
                    icon: 'fa-comment',
                    title: 'Nowy post na forum',
                    description: 'Pytanie dotyczące projektu zespołowego',
                    time: '2 godziny temu',
                    type: 'info'
                },
                {
                    icon: 'fa-calendar-check',
                    title: 'Zajęcia zakończone',
                    description: 'Wykład z Baz Danych został przeprowadzony',
                    time: '3 godziny temu',
                    type: 'success'
                }
            ];
            
            // Renderowanie aktywności
            activityList.innerHTML = activities.map(activity => `
                <div class="activity-item">
                    <div class="activity-item-icon">
                        <i class="fas ${activity.icon}"></i>
                    </div>
                    <div class="activity-item-content">
                        <h4>${activity.title}</h4>
                        <p>${activity.description}</p>
                        <span class="activity-item-time">
                            <i class="fas fa-clock"></i> ${activity.time}
                        </span>
                    </div>
                </div>
            `).join('');
            
        } catch (error) {
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
            // W przyszłości będziemy pobierać dane z API
            // const response = await fetch('/api/admin/classes/today');
            // const classes = await response.json();
            
            // Mock data - przykładowe zajęcia na dzisiaj
            const classes = [
                {
                    subject: 'Bazy Danych',
                    type: 'Wykład',
                    lecturer: 'dr inż. Anna Nowak',
                    room: 'Sala A101',
                    group: 'INF-3A',
                    time: '08:00 - 09:30'
                },
                {
                    subject: 'Algorytmika',
                    type: 'Ćwiczenia',
                    lecturer: 'mgr Piotr Wiśniewski',
                    room: 'Lab 204',
                    group: 'INF-3B',
                    time: '10:00 - 11:30'
                },
                {
                    subject: 'Inżynieria Oprogramowania',
                    type: 'Laboratorium',
                    lecturer: 'dr Katarzyna Lewandowska',
                    room: 'Lab 301',
                    group: 'INF-3A',
                    time: '12:00 - 13:30'
                },
                {
                    subject: 'Sieci Komputerowe',
                    type: 'Wykład',
                    lecturer: 'prof. dr hab. Jan Kowalski',
                    room: 'Aula Magna',
                    group: 'INF-3A, INF-3B',
                    time: '14:00 - 15:30'
                },
                {
                    subject: 'Projekt Zespołowy',
                    type: 'Projekt',
                    lecturer: 'dr inż. Marek Dąbrowski',
                    room: 'Sala B202',
                    group: 'INF-3A',
                    time: '16:00 - 17:30'
                }
            ];
            
            // Renderowanie listy zajęć
            classList.innerHTML = classes.map(classItem => `
                <div class="admin-class-item">
                    <div class="admin-class-info">
                        <h4>${classItem.subject}</h4>
                        <div class="admin-class-details">
                            <span>
                                <i class="fas fa-graduation-cap"></i>
                                ${classItem.type}
                            </span>
                            <span>
                                <i class="fas fa-chalkboard-teacher"></i>
                                ${classItem.lecturer}
                            </span>
                            <span>
                                <i class="fas fa-door-open"></i>
                                ${classItem.room}
                            </span>
                            <span>
                                <i class="fas fa-users"></i>
                                ${classItem.group}
                            </span>
                        </div>
                    </div>
                    <div class="admin-class-time">
                        ${classItem.time}
                    </div>
                </div>
            `).join('');
            
        } catch (error) {
            console.error('Błąd podczas ładowania zajęć:', error);
            classList.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Nie udało się załadować zajęć</h3>
                    <p>Spróbuj odświeżyć stronę</p>
                </div>
            `;
        }
    }
}

// Inicjalizacja po załadowaniu DOM
document.addEventListener('DOMContentLoaded', () => {
    new DashboardHome();
});
