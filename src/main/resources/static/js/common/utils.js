'use strict';

/* WSPÓLNE NARZĘDZIA POMOCNICZE */

const Utils = {
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
        
        // Granica semestrów: 23 luty 2026 zaczyna się semestr letni
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);
        const semesterSwitch = new Date(2026, 1, 23); // luty (index 1)

        if (checkDate < semesterSwitch) {
            // SEMESTR ZIMOWY
            return weekNumber % 2 === 0 ? 'WEEK_A' : 'WEEK_B';
        } else {
            // SEMESTR LETNI
            return weekNumber % 2 !== 0 ? 'WEEK_A' : 'WEEK_B';
        }
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
    }
};

// Eksport dla kompatybilności (jeśli używasz modułów lub testów)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}