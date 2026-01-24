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
        if (!text) return '';
        return text
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
    }
};

// Eksport dla kompatybilności (jeśli używasz modułów lub testów)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}