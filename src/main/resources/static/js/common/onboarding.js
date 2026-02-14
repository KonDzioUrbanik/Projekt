(function() {
    'use strict';
    


    class OnboardingTour {
        constructor(config) {
            this.steps = config.steps || [];
            this.storageKey = config.storageKey || 'onboarding_completed';
            this.currentStepIndex = 0;
            this.overlay = null;
            this.popover = null;
            this.isActive = false;
        }

        // Sprawdza czy użytkownik już widział samouczek
        shouldRun() {
            return !localStorage.getItem(this.storageKey);
        }

        // Uruchamia samouczek
        start() {
            if (this.steps.length === 0) return;
            
            this.isActive = true;
            this.createOverlay();
            this.createPopover();
            this.showStep(0);
            
            // Dodaj klasę do body aby zablokować scrollowanie tła
            document.body.classList.add('onboarding-active');
        }

        // Kończy samouczek
        finish(save = true) {
            this.isActive = false;
            if (this.overlay) this.overlay.remove();
            if (this.popover) this.popover.remove();
            
            // Usuń highlight z ostatniego elementu
            const highlighted = document.querySelector('.onboarding-highlight');
            if (highlighted) {
                highlighted.classList.remove('onboarding-highlight');
                if (highlighted.dataset.onboardingStatic) {
                    highlighted.style.position = '';
                    delete highlighted.dataset.onboardingStatic;
                }
            }
            
            // Remove elevated parents
            document.querySelectorAll('.onboarding-elevate-parent').forEach(el => {
                el.classList.remove('onboarding-elevate-parent');
                delete el.dataset.onboardingElevated;
            });

            document.body.classList.remove('onboarding-active');

            if (save) {
                localStorage.setItem(this.storageKey, 'true');
            }
        }

        createOverlay() {
            this.overlay = document.createElement('div');
            this.overlay.className = 'onboarding-overlay';
            this.overlay.addEventListener('click', () => {
            });
            document.body.appendChild(this.overlay);
        }

        createPopover() {
            this.popover = document.createElement('div');
            this.popover.className = 'onboarding-popover';
            this.popover.innerHTML = `
                <div class="onboarding-header">
                    <span class="onboarding-step-count"></span>
                    <button class="onboarding-close-btn">&times;</button>
                </div>
                <div class="onboarding-content">
                    <h3 class="onboarding-title"></h3>
                    <p class="onboarding-description"></p>
                </div>
                <div class="onboarding-footer">
                    <button class="btn btn-text onboarding-skip-btn">Pomiń</button>
                    <button class="btn btn-primary onboarding-next-btn">Dalej</button>
                </div>
            `;

            // Listeners
            this.popover.querySelector('.onboarding-close-btn').addEventListener('click', () => this.finish());
            this.popover.querySelector('.onboarding-skip-btn').addEventListener('click', () => this.finish());
            this.popover.querySelector('.onboarding-next-btn').addEventListener('click', () => this.nextStep());

            document.body.appendChild(this.popover);
        }

        showStep(index) {
            if (index >= this.steps.length) {
                this.finish();
                return;
            }

            this.currentStepIndex = index;
            const step = this.steps[index];
            const targetElement = document.querySelector(step.target);

            // Jeśli element nie istnieje, pomiń krok
            if (!targetElement) {
                console.warn(`Onboarding: Element ${step.target} not found, skipping step.`);
                this.nextStep();
                return;
            }

            // Update UI
            const isLastStep = index === this.steps.length - 1;
            this.popover.querySelector('.onboarding-step-count').textContent = `Krok ${index + 1} z ${this.steps.length}`;
            this.popover.querySelector('.onboarding-title').textContent = step.title;
            this.popover.querySelector('.onboarding-description').textContent = step.description;
            
            const nextBtn = this.popover.querySelector('.onboarding-next-btn');
            nextBtn.textContent = isLastStep ? 'Zakończ' : 'Dalej';

            const parentHeader = targetElement.closest('.header');
            if (parentHeader) {
                parentHeader.classList.add('onboarding-elevate-parent');
                parentHeader.dataset.onboardingElevated = 'true';
            }

            document.querySelectorAll('.onboarding-highlight').forEach(el => {
                el.classList.remove('onboarding-highlight');
                if (el.dataset.onboardingStatic) {
                    el.style.position = '';
                    delete el.dataset.onboardingStatic;
                }
            });
            
            document.querySelectorAll('.onboarding-elevate-parent').forEach(el => {
                if (el !== parentHeader) {
                    el.classList.remove('onboarding-elevate-parent');
                    delete el.dataset.onboardingElevated;
                }
            });

            targetElement.classList.add('onboarding-highlight');
            
            const style = window.getComputedStyle(targetElement);
            if (style.position === 'static') {
                targetElement.style.position = 'relative';
                targetElement.dataset.onboardingStatic = 'true';
            }

            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

            const placement = step.placement || 'bottom';
            this.positionPopover(targetElement, placement);
        }

        nextStep() {
            this.showStep(this.currentStepIndex + 1);
        }

        positionPopover(target, placement = 'bottom') {
            const viewportWidth = window.innerWidth;
            const isMobile = viewportWidth <= 640;

            // Na mobilnych (<= 640px) pozycjonowanie jest w całości obsługiwane przez CSS (position: fixed)
            // więc nie musimy (i nie powinniśmy) ustawiać top/left w JS.
            if (isMobile) {
                this.popover.style.top = '';
                this.popover.style.left = '';
                
                // Animacja wejścia
                this.popover.classList.remove('fade-in');
                void this.popover.offsetWidth;
                this.popover.classList.add('fade-in');
                return;
            }

            const rect = target.getBoundingClientRect();
            const popoverRect = this.popover.getBoundingClientRect();
            const margin = 15;
            const viewportHeight = window.innerHeight;

            let top, left;

            // Standardowa logika dla desktopu (> 640px)
            switch (placement) {
                case 'right':
                    top = rect.top + (rect.height / 2) - (popoverRect.height / 2);
                    left = rect.right + margin;
                    break;
                case 'left':
                    top = rect.top + (rect.height / 2) - (popoverRect.height / 2);
                    left = rect.left - popoverRect.width - margin;
                    break;
                case 'top':
                    top = rect.top - popoverRect.height - margin;
                    left = rect.left + (rect.width / 2) - (popoverRect.width / 2);
                    break;
                case 'bottom':
                default:
                    top = rect.bottom + margin;
                    left = rect.left + (rect.width / 2) - (popoverRect.width / 2);
                    break;
            }

            top += window.scrollY;
            left += window.scrollX;
            
            // Korekty, żeby nie wychodziło poza ekran

            // Pozioma korekta
            if (left < 10) left = 10;
            if (left + popoverRect.width > viewportWidth - 10) {
                left = viewportWidth - popoverRect.width - 10;
            }

            // Pionowa korekta
            if (top + popoverRect.height > window.scrollY + viewportHeight - 10) {
                if (placement === 'bottom') {
                    const altTop = rect.top + window.scrollY - popoverRect.height - margin;
                    // Sprawdź czy zmieści się u góry
                    if (altTop > window.scrollY + 10) {
                        top = altTop;
                    } else {
                        // Jeśli nie ma miejsca ani na dole ani na górze, przypnij do dołu ekranu
                        top = window.scrollY + viewportHeight - popoverRect.height - 10;
                    }
                } else if (placement === 'right' || placement === 'left') {
                     // Dla bocznych, przesuń w górę
                     top = window.scrollY + viewportHeight - popoverRect.height - 10;
                }
            }
            
            // Górna korekta (nie wychodź poza górną krawędź)
            if (top < window.scrollY + 10) top = window.scrollY + 10;

            this.popover.style.top = `${top}px`;
            this.popover.style.left = `${left}px`;
            
            // Animacja wejścia
            this.popover.classList.remove('fade-in');
            void this.popover.offsetWidth;
            this.popover.classList.add('fade-in');
        }
    }

    window.OnboardingTour = OnboardingTour;

})();
