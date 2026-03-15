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

    const statValues = document.querySelectorAll('.stat-value[data-count]');
    if (statValues.length > 0) {
        const formatNumber = (value) => new Intl.NumberFormat('pl-PL').format(value);

        const animateCounter = (element) => {
            const target = Number(element.dataset.count || 0);
            const duration = 1200;
            const startTime = performance.now();

            const step = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                const currentValue = Math.floor(target * eased);
                element.textContent = formatNumber(currentValue);

                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    element.textContent = formatNumber(target);
                }
            };

            requestAnimationFrame(step);
        };

        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }

                animateCounter(entry.target);
                obs.unobserve(entry.target);
            });
        }, { threshold: 0.4 });

        statValues.forEach((element) => observer.observe(element));
    }
});
