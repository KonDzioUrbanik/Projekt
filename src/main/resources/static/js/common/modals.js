export function confirmModal({ 
    title = 'Potwierdzenie', 
    message = 'Czy na pewno chcesz wykonać tę akcję?', 
    confirmText = 'Potwierdź', 
    cancelText = 'Anuluj', 
    type = 'danger' // danger, primary, warning
}) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        const iconClasses = {
            danger: 'fa-trash-alt',
            primary: 'fa-info-circle',
            warning: 'fa-exclamation-triangle'
        };

        const iconType = type || 'primary';
        const buttonClass = (iconType === 'danger') ? 'btn-danger-block' : 'btn-primary-block';

        overlay.innerHTML = `
            <div class="modal-card modal-sm">
                <div class="modal-body-centered">
                    <div class="modal-icon-wrapper ${iconType}">
                        <i class="fas ${iconClasses[iconType] || 'fa-question-circle'}"></i>
                    </div>
                    <h3>${title}</h3>
                    <p class="text-muted">
                        ${message}
                    </p>
                </div>
                <div class="modal-footer-centered">
                    <button class="btn-text-gray" id="modalCancel">${cancelText}</button>
                    <button class="${buttonClass}" id="modalConfirm">${confirmText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        
        // Use requestAnimationFrame for smooth entry
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });

        const close = (result) => {
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.remove();
                resolve(result);
            }, 300);
        };

        overlay.querySelector('#modalCancel').onclick = () => close(false);
        overlay.querySelector('#modalConfirm').onclick = () => close(true);
        
        // Close on overlay click
        overlay.onclick = (e) => {
            if (e.target === overlay) close(false);
        };

        // Accessibility: ESC key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', escHandler);
                close(false);
            }
        };
        document.addEventListener('keydown', escHandler);
    });
}
