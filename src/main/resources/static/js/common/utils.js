'use strict';

/* WSPÓLNE NARZĘDZIA POMOCNICZE */

const Utils = {
    AcademicConfig: null, // Przechowuje aktualną konfigurację roku akademickiego

    async initAcademicConfig() {
        if (this.AcademicConfig) return this.AcademicConfig;
        try {
            const res = await fetch('/api/academic-year/current');
            if (res.ok) {
                this.AcademicConfig = await res.json();
            }
        } catch (e) {
            console.error('Błąd inicjalizacji konfiguracji roku akademickiego:', e);
        }
        return this.AcademicConfig;
    },

    /* Formatuje datę na format relatywny (np. "przed chwilą", "5 min temu", "wczoraj") */
    formatDate(dateString) {
        if (!dateString) return '';
        
        // Parsowanie daty - Date() w JS radzi sobie dobrze z ISO 8601
        const date = new Date(dateString);
        
        // Sprawdzenie, czy data jest prawidłowa
        if (isNaN(date.getTime())) return '';
        
        const now = new Date();
        // Różnica w sekundach
        const diffInSeconds = Math.floor((now - date) / 1000);

        // Obsługa przyszłości (gdy zegary są lekko niezsynchronizowane)
        // Jeśli data jest z przyszłości o więcej niż 5 sekund, uznajemy to za "teraz"
        if (diffInSeconds < -5) {
            return 'przed chwilą'; 
        }

        // 2. Mniej niż minuta
        if (diffInSeconds < 60) return 'przed chwilą';
        
        // 3. Minuty
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `${diffInMinutes} min temu`;

        // 4. Godziny
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) {
            if (diffInHours === 1) return 'godzinę temu';
            if (diffInHours > 1 && diffInHours < 5) return `${diffInHours} godz. temu`;
            return `${diffInHours} godz. temu`;
        }

        // 5. Dni
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays === 1) return 'wczoraj';
        if (diffInDays === 2) return 'przedwczoraj';

        // 6. Data kalendarzowa (dla starszych niż 2 dni)
        return date.toLocaleDateString('pl-PL', { 
            day: 'numeric', 
            month: 'short',
            hour: '2-digit', 
            minute: '2-digit' 
        });
    },

    /* Formatuje datę na pełny format (np. "17 marca 2026, 11:56:00") */
    formatFullDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleString('pl-PL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    },

    /* Escapuje znaki HTML w tekście (ZAPOBIEGA XSS) */
    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    /* Usuwa tagi HTML z tekstu (np. do podglądu) */
    stripHtml(html) {
        if (!html) return '';
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    },

    /* Usuwa znaczniki Markdown z tekstu (np. do czystego podglądu) */
    stripMarkdown(text) {
        if (!text) return '';
        return String(text)
            // Usuń nagłówki (#)
            .replace(/^#{1,6}\s+/gm, '')
            // Usuń pogrubienia i pochylenia (*, **, _, __)
            .replace(/(\*\*|__)(.*?)\1/g, '$2')
            .replace(/(\*|_)(.*?)\1/g, '$2')
            // Usuń przekreślenia (~~)
            .replace(/~~(.*?)~~/g, '$1')
            // Usuń kody inline (`) oraz bloki kodu (```)
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`([^`]+)`/g, '$1')
            // Usuń linki [text](url) -> text
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            // Usuń obrazki ![alt](url) -> alt
            .replace(/!\[(.*?)\]\([^)]+\)/g, '$1')
            // Usuń listy punktowane i numerowane
            .replace(/^[\s]*[-+*]\s+/gm, '')
            .replace(/^[\s]*\d+\.\s+/gm, '')
            // Usuń cytaty (>)
            .replace(/^>\s+/gm, '')
            // Usuń linie poziome (---, ***, ___)
            .replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '')
            // Pozbądź się nadmiaru białych znaków
            .replace(/\n+/g, ' ')
            .trim();
    },

    /* Konwersja czasu do minut (wspólna funkcja) */
    timeToMinutes(timeObj) {
        if (!timeObj) return 0;
        
        // Obsługa formatu string "HH:MM:SS" lub "HH:MM"
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
    },

    /* Formatowanie czasu do stringa HH:MM */
    formatTime(timeObj) {
        if (!timeObj) return '--:--';
        
        if (typeof timeObj === 'string') {
            const parts = timeObj.split(':');
            return `${parts[0]}:${parts[1]}`;
        }
        
        // Obsługa obiektu LocalTime z backendu
        const hour = timeObj.hour !== undefined ? String(timeObj.hour).padStart(2, '0') : '00';
        const minute = timeObj.minute !== undefined ? String(timeObj.minute).padStart(2, '0') : '00';
        
        return `${hour}:${minute}`;
    },

    /* Obliczanie numeru tygodnia (ISO 8601) */
    getWeekNumber(d) {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
        return weekNo;
    },

    /* Typ tygodnia: A (nieparzysty), B (parzysty) - z uwzględnieniem semestrów */
    getWeekType(date) {
        const weekNumber = this.getWeekNumber(date);
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);

        if (!this.AcademicConfig) {
            // Fallback (awaryjnie, gdy brak połączenia API)
            const fallbackSummerStart = new Date(2026, 1, 23); // 23 lut 2026
            if (checkDate < fallbackSummerStart) {
                return weekNumber % 2 === 0 ? 'WEEK_A' : 'WEEK_B';
            } else {
                return weekNumber % 2 !== 0 ? 'WEEK_A' : 'WEEK_B';
            }
        }

        const summerStart = new Date(this.AcademicConfig.summerSemesterStart + 'T00:00:00');
        if (checkDate < summerStart) {
            // Semestr Zimowy: ISO parzysty = A 
            return weekNumber % 2 === 0 ? 'WEEK_A' : 'WEEK_B';
        } else {
            // Semestr Letni: ISO nieparzysty = A
            return weekNumber % 2 !== 0 ? 'WEEK_A' : 'WEEK_B';
        }
    },

    /* Obliczanie numeru tygodnia edukacyjnego (od 1 dla każdego semestru oddzielnie) */
    getEducationalWeekNumber(date) {
        if (!this.AcademicConfig) {
            return this.getWeekNumber(date); // Fallback: po prostu numer ISO
        }

        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);

        const winterStart = new Date(this.AcademicConfig.winterSemesterStart + 'T00:00:00');
        const summerStart = new Date(this.AcademicConfig.summerSemesterStart + 'T00:00:00');
        
        let semesterStart;
        if (checkDate < summerStart) {
            semesterStart = winterStart;
        } else {
            semesterStart = summerStart;
        }

        const isoCurrent = this.getWeekNumber(checkDate);
        const isoStart = this.getWeekNumber(semesterStart);

        let diff = isoCurrent - isoStart;
        if (diff < 0) {
            // Przejście przez przełom roku kalendarzowego dla tygodni ISO (52 -> 1)
            const d = new Date(semesterStart.getFullYear(), 11, 31);
            let week = this.getWeekNumber(d);
            const weeksInYear = (week === 1) ? this.getWeekNumber(new Date(semesterStart.getFullYear(), 11, 24)) : week;
            diff = (isoCurrent + weeksInYear) - isoStart;
        }

        return diff + 1;
    },

    parseCustomWeeks(customWeeks) {
        if (!customWeeks || typeof customWeeks !== 'string') return [];
        return customWeeks
            .split(',')
            .map(t => t.trim())
            .filter(Boolean)
            .map(t => parseInt(t, 10))
            .filter(n => Number.isInteger(n) && n >= 1 && n <= 53);
    },

    matchesScheduleRecurrence(item, date) {
        if (!item || item.archived) return false;

        const weekType = this.getWeekType(date);
        if (!item.weekType || item.weekType === 'ALL') return true;
        if (item.weekType === 'WEEK_A' || item.weekType === 'WEEK_B') return item.weekType === weekType;
        if (item.weekType === 'CUSTOM') {
            const eduWeek = this.getEducationalWeekNumber(date);
            const parsed = this.parseCustomWeeks(item.customWeeks);
            if (parsed.includes(eduWeek)) return true;
            
            if (!this.AcademicConfig || parsed.some(n => n > 20)) {
                const isoWeek = this.getWeekNumber(date);
                if (parsed.includes(isoWeek)) return true;
            }
        }

        return false;
    },

    /* Debounce - opóźnia wykonanie funkcji */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /* Bezpieczne parsowanie JSON z fallbackiem */
    safeJsonParse(jsonString, fallback = null) {
        try {
            return JSON.parse(jsonString);
        } catch (e) {
            console.warn('Utils.safeJsonParse: Invalid JSON', e);
            return fallback;
        }
    },
    
    /* Uniwersalna funkcja wyświetlania powiadomień Toast */
    showToast(message, type = 'success', options = {}) {
        const {
            actionHtml = '',
            duration = 4000,
            closable = false,
            containerId = 'toastContainer',
            isHtml = false
        } = options;

        const container = document.getElementById(containerId);
        if (!container) return null;

        const finalMessage = isHtml ? message : Utils.escapeHtml(message);

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        /* Mapowanie ikon */
        const iconMap = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        const icon = iconMap[type] || 'info-circle';

        /* Budowa HTML */
        const closeBtnHtml = closable
            ? `<button class="toast-close" onclick="this.parentElement.classList.add('fade-out'); setTimeout(() => this.parentElement.remove(), 300);">&times;</button>`
            : '';

        const actionBlock = actionHtml
            ? `<div class="toast-actions">${actionHtml}</div>`
            : '';

        toast.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span style="flex:1;">${finalMessage}</span>
            ${actionBlock}
            ${closeBtnHtml}
        `;

        container.appendChild(toast);

        /* Auto-ukrywanie (wyłączone gdy duration=0 lub jest przycisk akcji) */
        if (duration > 0 && !actionHtml) {
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.classList.add('fade-out');
                    setTimeout(() => {
                        if (toast.parentElement) toast.remove();
                    }, 300);
                }
            }, duration);
        }

        return toast;
    },

    /* Inicjalizacja pływającego przycisku Go-To-Top (Płynny Przewijak) */
    initGoToTop() {
        const btn = document.getElementById('goToTopBtn');
        if (!btn) return;

        // Na dużych ekranach przewija się .navbar-middle, na komórkach zazwyczaj window.
        const navbarMiddle = document.querySelector('.navbar-middle');
        
        // Funkcja sprawdzająca scroll niezależnie od tego kto scrolluje
        const checkScroll = Utils.debounce(() => {
            const scrollTop = (navbarMiddle && navbarMiddle.scrollTop) || window.scrollY || document.documentElement.scrollTop;
            
            if (scrollTop > 300) {
                btn.classList.add('visible');
            } else {
                btn.classList.remove('visible');
            }
        }, 100);

        // Nasłuchujemy na oba potencjalne "przewijaki"
        window.addEventListener('scroll', checkScroll);
        if (navbarMiddle) {
            navbarMiddle.addEventListener('scroll', checkScroll);
        }
        
        btn.addEventListener('click', () => {
            // Skrolujemy płynnie oba
            window.scrollTo({ top: 0, behavior: 'smooth' });
            if (navbarMiddle) {
                if (typeof navbarMiddle.scrollTo === 'function') {
                    navbarMiddle.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    navbarMiddle.scrollTop = 0;
                }
            }
        });
    },

    /* Przenosi modale (.modal-overlay) z wnętrza .navbar-middle na document.body, żeby nie były przycinane przez overflow: hidden na .dashboard-container */
    portalModals() {
        const SELECTOR = '.navbar-middle .modal-overlay, .navbar-middle .modal';

        const moveModals = () => {
            document.querySelectorAll(SELECTOR).forEach(overlay => {
                document.body.appendChild(overlay);
            });
        };

        // Przenieś istniejące modale
        moveModals();

        // Obserwuj dynamicznie dodawane modale (np. z JS modułów)
        const container = document.querySelector('.navbar-middle');
        if (container) {
            const observer = new MutationObserver(mutations => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1 && node.classList &&
                            (node.classList.contains('modal-overlay') || node.classList.contains('modal'))) {
                            document.body.appendChild(node);
                        }
                    }
                }
            });
            observer.observe(container, { childList: true, subtree: true });
        }
    }
};

// Automatyczne odpalenie przyjaznych globalnych skryptów interfejsu
document.addEventListener('DOMContentLoaded', () => {
    Utils.initGoToTop();
    Utils.portalModals();
});

// Eksport dla kompatybilności (jeśli używasz modułów lub testów)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}