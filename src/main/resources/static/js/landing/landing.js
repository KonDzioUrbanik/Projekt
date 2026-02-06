document.addEventListener('DOMContentLoaded', () => {
    // Typewriter Effect
    const textElement = document.querySelector('.typewriter-text');
    if (textElement) {
        const phrases = [
            "Organizacji studiów.",
            "Zarządzania czasem.",
            "Komunikacji i wymiany informacji.",
            "Wygodnego planowania.",
            "Trzymania wszystkiego pod ręką."
        ];
        
        let phraseIndex = 0;
        let charIndex = 0;
        let isDeleting = false;
        let typeSpeed = 100;

        function type() {
            const currentPhrase = phrases[phraseIndex];
            
            if (isDeleting) {
                textElement.textContent = currentPhrase.substring(0, charIndex - 1);
                charIndex--;
                typeSpeed = 50; // Szybsze usuwanie
            } else {
                textElement.textContent = currentPhrase.substring(0, charIndex + 1);
                charIndex++;
                typeSpeed = 100; // Normalne pisanie
            }

            if (!isDeleting && charIndex === currentPhrase.length) {
                isDeleting = true;
                typeSpeed = 2000; // Pauza po napisaniu całego tekstu
            } else if (isDeleting && charIndex === 0) {
                isDeleting = false;
                phraseIndex = (phraseIndex + 1) % phrases.length;
                typeSpeed = 500; // Pauza przed pisaniem nowego
            }

            setTimeout(type, typeSpeed);
        }

        // Start animation
        setTimeout(type, 1000);
    }
});
