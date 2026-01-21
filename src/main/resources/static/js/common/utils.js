/* WSPÓLNE NARZĘDZIA POMOCNICZE */

const Utils = {
    /* Formatuje datę na format relatywny (np. "przed chwilą", "5 min temu", "wczoraj") */
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'przed chwilą';
        
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `${diffInMinutes} min temu`;

        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) {
            if (diffInHours === 1) return 'godzinę temu';
            if (diffInHours > 1 && diffInHours < 5) return `${diffInHours} godz. temu`;
            return `${diffInHours} godz. temu`;
        }

        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays === 1) return 'wczoraj';

        return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
    },

    /* Escapuje znaki HTML w tekście */
    escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    /* Usuwa tagi HTML z tekstu */
    stripHtml(html) {
        if (!html) return '';
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    }
};

// Eksport dla kompatybilności
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
