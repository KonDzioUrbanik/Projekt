const CONFIG = {
    API: {
        USER_ME: '/api/users/me'
    }
};

document.addEventListener('DOMContentLoaded', function(){
    const profileForm = document.getElementById('profileForm');
    const messageDiv = document.getElementById('profileMessage');
    const saveButton = document.getElementById('saveButton');
    const cancelButton = document.getElementById('cancelButton');
    const bioTextarea = document.getElementById('bio');
    const bioCounter = document.getElementById('bioCount');
    
    let messageTimeout = null;

    // Licznik znaków w bio
    function updateCharacterCount() {
        if (!bioTextarea || !bioCounter) return;
        const count = bioTextarea.value.length;
        bioCounter.textContent = count;
        
        if (count > 450) {
            bioCounter.style.color = '#ef4444';
        } else if (count > 400) {
            bioCounter.style.color = '#f59e0b';
        } else {
            bioCounter.style.color = '#3b82f6';
         }
    }

    if (bioTextarea && bioCounter) {
        updateCharacterCount();
        bioTextarea.addEventListener('input', updateCharacterCount);
        bioTextarea.addEventListener('keyup', updateCharacterCount);
    }

    // Podpowiedzi dla pól zablokowanych
    document.querySelectorAll('[readonly]').forEach(field => {
        field.addEventListener('click', function() {
            if (!this.dataset.tooltipShown) {
                const hint = this.nextElementSibling;
                if (hint && hint.classList.contains('form-hint')) {
                    hint.style.color = '#3b82f6';
                    setTimeout(() => {
                        hint.style.color = '';
                    }, 1500);
                }
                this.dataset.tooltipShown = 'true';
                setTimeout(() => delete this.dataset.tooltipShown, 2000);
            }
        });
    });

    // Inicjalizacja danych użytkownika
    async function initialize(){
        try{
            const response = await fetch(CONFIG.API.USER_ME, {
                method: 'GET',
                headers: {'Accept': 'application/json'},
                credentials: 'include'
            });
            
            if(response.ok){
                const userData = await response.json();
                
                if(userData.nickName) document.getElementById('nickName').value = userData.nickName;
                if(userData.phoneNumber) {
                    const phoneStr = userData.phoneNumber.replace(/\s/g, ''); // usuń ewentualne spacje z bazy
                    
                    if(phoneStr.length > 9) {
                        const number = phoneStr.slice(-9);
                        const prefix = phoneStr.slice(0, phoneStr.length - 9);
                        
                        // Ustaw numer (ostatnie 9 cyfr)
                        const phoneInput = document.getElementById('phone');
                        if(phoneInput) phoneInput.value = number;

                        // Spróbuj dopasować prefix w selectcie
                        const prefixSelect = document.getElementById('phonePrefix');
                        if(prefixSelect) {
                            // Sprawdź czy taki prefix istnieje w opcjach
                            const prefixOption = Array.from(prefixSelect.options).find(opt => opt.value === prefix);
                            if(prefixOption) {
                                prefixSelect.value = prefix;
                            } else {
                                console.warn('Nieznany prefix telefonu:', prefix);
                            }
                        }
                    } else {
                        // Krótki numer (bez prefixu lub błędny), wstawiamy cały do inputa
                        const phoneInput = document.getElementById('phone');
                        if(phoneInput) phoneInput.value = phoneStr;
                    }
                } else {
                    const phoneInput = document.getElementById('phone');
                    if(phoneInput) phoneInput.value = '';
                }
                
                const fieldOfStudySelect = document.getElementById('fieldOfStudy');
                const yearOfStudySelect = document.getElementById('yearOfStudy');
                const studyModeSelect = document.getElementById('studyMode');
                
                if(userData.fieldOfStudy){
                    fieldOfStudySelect.value = userData.fieldOfStudy;
                    fieldOfStudySelect.dataset.wasSet = 'true';
                }
                
                if(userData.yearOfStudy){
                    yearOfStudySelect.value = userData.yearOfStudy.toString();
                    yearOfStudySelect.dataset.wasSet = 'true';
                }
                
                if(userData.studyMode){
                    studyModeSelect.value = userData.studyMode;
                    studyModeSelect.dataset.wasSet = 'true';
                }
                
                if(userData.bio) {
                    document.getElementById('bio').value = userData.bio;
                    updateCharacterCount();
                }

                // Ładowanie awatara
                loadUserAvatar(userData.id);
            }
        } 
        catch(error){
            console.error('Błąd pobierania danych użytkownika:', error);
        }
    }

    function loadUserAvatar(userId) {
        const avatarPreview = document.getElementById('avatarPreview');
        const avatarPlaceholder = document.getElementById('avatarPlaceholder');
        const removeAvatarBtn = document.getElementById('removeAvatar');
        
        if(!avatarPreview) return;

        // Dodajemy timestamp aby uniknąć cache'owania po zmianie
        const avatarUrl = `/api/users/${userId}/avatar?t=${new Date().getTime()}`;
        
        const img = new Image();
        img.onload = function() {
            avatarPreview.src = avatarUrl;
            avatarPreview.style.display = 'block';
            avatarPlaceholder.style.display = 'none';
            if(removeAvatarBtn) removeAvatarBtn.style.display = 'inline-flex';
        };
        img.onerror = function() {
            // Brak awatara - placeholder + inicjały
            avatarPreview.style.display = 'none';
            avatarPlaceholder.style.display = 'flex';
            initializeAvatar(); 
            if(removeAvatarBtn) removeAvatarBtn.style.display = 'none';
        };
        img.src = avatarUrl;
    }

    initialize();

    // Obsługa przycisku Anuluj
    cancelButton.addEventListener('click', function(){
        if (confirm('Czy na pewno chcesz anulować? Wszystkie niezapisane dane zostaną trwale utracone.')){
            window.location.href = '/dashboard';
        }
    });



    // Wyświetlanie komunikatów w formularzu
    function showMessage(message, type){
        if(messageTimeout) {
            clearTimeout(messageTimeout);
            messageTimeout = null;
        }
        
        messageDiv.className = 'form-message ' + type;
        
        let icon = 'fa-info-circle';
        if(type === 'success') icon = 'fa-check-circle';
        if(type === 'error') icon = 'fa-exclamation-circle';
        
        messageDiv.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
        messageDiv.style.display = 'block';
        
        messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        messageTimeout = setTimeout(() => {
            messageDiv.style.display = 'none';
            messageDiv.className = 'form-message';
            messageDiv.innerHTML = '';
            messageTimeout = null;
        }, 5000);
    }

    // Generowanie awatara z inicjałów
    function initializeAvatar(){
        const firstName = document.getElementById('firstName').value || '';
        const lastName = document.getElementById('lastName').value || '';
        const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || 'PL';
        
        const avatarSpan = document.querySelector('.avatar span');
        if(avatarSpan && !document.querySelector('.avatar').style.backgroundImage){
            avatarSpan.textContent = initials;
        }
    }

    function initFeatures() {
        let autoSaveTimer = null;
        let avatarFile = null;

        // Obsługa wgrywania awatara
        const avatarUploadZone = document.getElementById('avatarUploadZone');
        const avatarInput = document.getElementById('avatarInput');
        const avatarPreview = document.getElementById('avatarPreview');
        const avatarPlaceholder = document.getElementById('avatarPlaceholder');
        const removeAvatarBtn = document.getElementById('removeAvatar');
        const uploadProgress = document.getElementById('uploadProgress');
        const uploadProgressBar = document.getElementById('uploadProgressBar');

        if (avatarUploadZone) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                avatarUploadZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, false);
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                avatarUploadZone.addEventListener(eventName, () => {
                    avatarUploadZone.classList.add('dragover');
                });
            });

            ['dragleave', 'drop'].forEach(eventName => {
                avatarUploadZone.addEventListener(eventName, () => {
                    avatarUploadZone.classList.remove('dragover');
                });
            });

            avatarUploadZone.addEventListener('drop', (e) => {
                const files = e.dataTransfer.files;
                if (files.length > 0) handleAvatarFile(files[0]);
            });
        }

        if (avatarInput) {
            avatarInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) handleAvatarFile(e.target.files[0]);
            });
        }

        let originalImageSrc = null;

        function handleAvatarFile(file) {
            if (!file.type.match('image.*')) {
                alert('Proszę wybrać plik obrazu (JPG, PNG, GIF)');
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                alert('Plik jest za duży. Maksymalny rozmiar to 5MB');
                return;
            }

            avatarFile = file;

            const reader = new FileReader();
            reader.onload = (e) => {
                originalImageSrc = e.target.result; // Zapamiętaj oryginał
                openCropModal(originalImageSrc);
            };
            reader.readAsDataURL(file);
        }

        // Kliknięcie w kółko wywołuje wybór pliku LUB edycję
        const avatarPreviewContainer = document.querySelector('.avatar-preview-container');
        if (avatarPreviewContainer && avatarInput) {
            avatarPreviewContainer.addEventListener('click', (e) => {
                if (originalImageSrc) {
                    // Edycja istniejącego zdjęcia z pamięci
                    openCropModal(originalImageSrc);
                } else {
                    // Wybór nowego pliku
                    avatarInput.click();
                }
            });
            avatarPreviewContainer.style.cursor = 'pointer';
        }

        function openCropModal(imageSrc) {
            const modal = document.getElementById('cropModal');
            const cropImage = document.getElementById('cropImage');
            const cropZoom = document.getElementById('cropZoom');
            
            if(!modal || !cropImage) return;

            modal.classList.add('visible');
            
            // Stałe konfiguracyjne
            const CROP_SIZE = 250; 
            
            // Zmienne stanu
            let scale = 1;
            let minScale = 1;
            let maxScale = 5;
            let posX = 0;
            let posY = 0;
            let isDragging = false;
            let startX, startY;
            
            // Obsługa załadowania obrazu
            cropImage.onload = function() {
                const w = this.naturalWidth;
                const h = this.naturalHeight;
                
                minScale = Math.max(CROP_SIZE / w, CROP_SIZE / h);
                if (minScale > maxScale) maxScale = minScale * 2;
                
                scale = Math.max(minScale, 1); 
                scale = minScale > 1 ? minScale : scale;

                posX = 0;
                posY = 0;
                
                if(cropZoom) {
                    cropZoom.min = minScale;
                    cropZoom.max = maxScale;
                    cropZoom.step = (maxScale - minScale) / 100;
                    cropZoom.value = scale;
                }
                updateCropTransform();
            };

            cropImage.src = imageSrc;
            
            // Obsługa suwaka przybliżenia
            if(cropZoom) {
                cropZoom.oninput = function() {
                    scale = parseFloat(this.value);
                    constrain();
                    updateCropTransform();
                }
            }

            // Obsługa myszy (kółko i przeciąganie)
            const container = document.getElementById('cropContainer');
            if(container) {
                container.onwheel = function(e) {
                    e.preventDefault();
                    const delta = (maxScale - minScale) * 0.1;
                    if(e.deltaY < 0) {
                        scale = Math.min(scale + delta, maxScale);
                    } else {
                        scale = Math.max(scale - delta, minScale);
                    }
                    if(cropZoom) cropZoom.value = scale;
                    constrain();
                    updateCropTransform();
                }
                
                container.onmousedown = function(e) {
                    isDragging = true;
                    startX = e.clientX - posX;
                    startY = e.clientY - posY;
                    container.style.cursor = 'grabbing';
                };
            }

            window.addEventListener('mouseup', function() {
                isDragging = false;
                if(container) container.style.cursor = 'grab';
            });

            window.addEventListener('mousemove', function(e) {
                if (!isDragging) return;
                e.preventDefault();
                posX = e.clientX - startX;
                posY = e.clientY - startY;
                constrain();
                updateCropTransform();
            });

            function constrain() {
                if (scale < minScale) scale = minScale;
                if (scale > maxScale) scale = maxScale;
                
                const currentW = cropImage.naturalWidth * scale;
                const currentH = cropImage.naturalHeight * scale;
                
                const maxX = (currentW - CROP_SIZE) / 2;
                const maxY = (currentH - CROP_SIZE) / 2;
                
                if (posX > maxX) posX = maxX;
                if (posX < -maxX) posX = -maxX;
                
                if (posY > maxY) posY = maxY;
                if (posY < -maxY) posY = -maxY;
            }

            function updateCropTransform() {
                cropImage.style.transform = `translate(calc(-50% + ${posX}px), calc(-50% + ${posY}px)) scale(${scale})`;
            }

            // Zapisywanie wykadrowanego zdjęcia
            const saveBtn = document.getElementById('saveCrop');
            // Usuwamy stare listenery (klonowanie elementu to prosty trick)
            const newSaveBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
            
            newSaveBtn.onclick = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 300;
                canvas.height = 300;

                const img = cropImage;
                const originalWidth = img.naturalWidth;
                const originalHeight = img.naturalHeight;
                
                const ratio = canvas.width / CROP_SIZE;

                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                ctx.translate(canvas.width/2, canvas.height/2);
                ctx.translate(posX * ratio, posY * ratio);
                ctx.scale(scale * ratio, scale * ratio);
                
                ctx.drawImage(img, -originalWidth/2, -originalHeight/2);
                
                avatarPreview.src = canvas.toDataURL('image/jpeg');
                avatarPreview.style.display = 'block';
                avatarPreview.style.transform = 'none';
                avatarPlaceholder.style.display = 'none';
                removeAvatarBtn.style.display = 'inline-flex';
                
                modal.classList.remove('visible');
                simulateUploadProgress();
            };

            const cancelBtn = document.getElementById('cancelCrop');
            // Reset obsługi przycisku Anuluj
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

            newCancelBtn.onclick = function() {
                modal.classList.remove('visible');
                // Jeśli anulujemy edycję, a nie było wczytania nowego pliku (tylko re-edycja), to ok.
                // Jeśli to był nowy plik, to czyścimy input?
                // Dla uproszczenia: jeśli anulujemy, to input clear.
                if (!avatarPreview.src || avatarPreview.src === '#' || avatarPreview.style.display === 'none') {
                     avatarInput.value = '';
                }
            };
        }

        function simulateUploadProgress() {
            uploadProgress.style.display = 'block';
            let progress = 0;
            const interval = setInterval(() => {
                progress += 10;
                uploadProgressBar.style.width = progress + '%';
                if (progress >= 100) {
                    clearInterval(interval);
                    setTimeout(() => {
                        uploadProgress.style.display = 'none';
                        uploadProgressBar.style.width = '0%';
                    }, 500);
                }
            }, 100);
        }

        let shouldDeleteAvatar = false;
        
        function handleAvatarFile(file) {
            // Walidacja rozszerzenia (po nazwie pliku)
            const allowedExtensions = /(\.jpg|\.jpeg|\.png|\.gif)$/i;
            if (!allowedExtensions.exec(file.name)) {
                showMessage('Niedozwolone rozszerzenie pliku. Dozwolone są tylko: JPG, JPEG, PNG, GIF.', 'error');
                avatarFile = null; // Reset
                if (avatarInput) avatarInput.value = ''; // Reset input
                return;
            }

            // Walidacja typu MIME (dodatkowe zabezpieczenie)
            if (!file.type.match('image.*')) {
                showMessage('Proszę wybrać plik obrazu (JPG, PNG, GIF).', 'error');
                avatarFile = null;
                if (avatarInput) avatarInput.value = '';
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                showMessage('Plik jest za duży. Maksymalny rozmiar to 5MB.', 'error');
                avatarFile = null;
                if (avatarInput) avatarInput.value = '';
                return;
            }

            avatarFile = file;
            shouldDeleteAvatar = false; // Reset flag

            const reader = new FileReader();
            reader.onload = (e) => {
                originalImageSrc = e.target.result;
                openCropModal(originalImageSrc);
            };
            reader.readAsDataURL(file);
        }

        if (removeAvatarBtn) {
            removeAvatarBtn.addEventListener('click', () => {
                avatarFile = null;
                shouldDeleteAvatar = true; // Set flag
                avatarPreview.src = '#'; // Clear src
                avatarPreview.style.display = 'none';
                avatarPlaceholder.style.display = 'flex';
                removeAvatarBtn.style.display = 'none';
                avatarInput.value = '';
                
                const zoomControl = document.getElementById('avatarZoomControl');
                if(zoomControl) zoomControl.classList.remove('visible');
            });
        }

        // Walidacja w czasie rzeczywistym
        const nickNameInput = document.getElementById('nickName');
        const phoneInput = document.getElementById('phone');

        function validateField(input, rules) {
            if (!input) return true;
            
            const value = input.value.trim();
            const group = input.closest('.form-group');
            const message = group?.querySelector('.validation-message');

            let isValid = true;
            let errorMsg = '';

            if (rules.required && !value) {
                isValid = false;
                errorMsg = 'To pole jest wymagane';
            } else if (value && rules.minLength && value.length < rules.minLength) {
                isValid = false;
                errorMsg = `Minimum ${rules.minLength} znaków`;
            } else if (value && rules.maxLength && value.length > rules.maxLength) {
                isValid = false;
                errorMsg = `Maksimum ${rules.maxLength} znaków`;
            } else if (value && rules.pattern && !rules.pattern.test(value)) {
                isValid = false;
                errorMsg = rules.patternMessage || 'Nieprawidłowy format';
            }

            input.classList.remove('valid', 'invalid');
            group?.classList.remove('valid', 'invalid');

            if (value) {
                if (isValid) {
                    input.classList.add('valid');
                    group?.classList.add('valid');
                    if (message) message.textContent = '';
                } else {
                    input.classList.add('invalid');
                    group?.classList.add('invalid');
                    if (message) message.textContent = errorMsg;
                }
            }

            return isValid;
        }

        // Listener dla telefonu - tylko cyfry (bez formatowania)
        if (phoneInput) {
            phoneInput.addEventListener('input', (e) => {
                // Pozwól wpisywać tylko cyfry
                e.target.value = e.target.value.replace(/\D/g, '').substring(0, 9);
            });
        }

        // Walidacja przed wysłaniem formularza
        const settingsForm = document.querySelector('form');
        const fieldOfStudySelect = document.getElementById('fieldOfStudy');
        const yearOfStudySelect = document.getElementById('yearOfStudy');
        const studyModeSelect = document.getElementById('studyMode');

        // Ustaw flagę, jeśli pole było ustawione przy załadowaniu
        [fieldOfStudySelect, yearOfStudySelect, studyModeSelect].forEach(sel => {
            if(sel && sel.value && sel.value.trim() !== '') {
                sel.dataset.wasSet = 'true';
            }
        });

        function showMessage(text, type) {
            const msgBox = document.getElementById('profileMessage');
            if (msgBox) {
                msgBox.textContent = text;
                msgBox.className = 'form-message ' + (type === 'error' ? 'error' : 'success');
                msgBox.style.display = 'block';
                msgBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                if (type === 'error') {
                    setTimeout(() => {
                        if (msgBox.className.includes('error')) msgBox.style.display = 'none';
                    }, 5000);
                }
            }
        }

        function validateForm() {
            const bio = bioTextarea ? bioTextarea.value.trim() : '';
            const phoneNumber = phoneInput ? phoneInput.value.trim() : '';
            
            // Walidacja selectów (tylko jeśli były wcześniej ustawione)
            if (fieldOfStudySelect && fieldOfStudySelect.dataset.wasSet === 'true' && fieldOfStudySelect.value === '') {
                 showMessage('Musisz wybrać kierunek studiów.', 'error');
                 return false;
            }

            if (yearOfStudySelect && yearOfStudySelect.dataset.wasSet === 'true' && yearOfStudySelect.value === '') {
                 showMessage('Musisz wybrać rok studiów.', 'error');
                 return false;
            }

            if (studyModeSelect && studyModeSelect.dataset.wasSet === 'true' && studyModeSelect.value === '') {
                 showMessage('Musisz wybrać tryb studiów.', 'error');
                 return false;
            }

            // Walidacja bio
            if(bio && bio.length > 500){
                showMessage('Opis "O mnie" może mieć maksymalnie 500 znaków', 'error');
                return false;
            }

            // Walidacja telefonu (proste 9 cyfr)
            if(phoneNumber && phoneNumber.length > 0) {
                 if (!/^\d{9}$/.test(phoneNumber)) {
                     showMessage('Numer telefonu musi składać się z 9 cyfr', 'error');
                     return false;
                }
            }
            
            return true;
        }

        // Listener dla telefonu - tylko cyfry (bez formatowania)
        if (phoneInput) {
            phoneInput.addEventListener('input', (e) => {
                // Pozwól wpisywać tylko cyfry
                e.target.value = e.target.value.replace(/\D/g, '').substring(0, 9);
            });
            // Usuń stary blur handler jeśli istniał
        }

        if (settingsForm) {
            settingsForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                if (!validateForm()) {
                    return; // Walidacja nie przeszła - stop
                }

                // Walidacja OK - wysyłamy dane AJAXem
                const firstName = document.getElementById('firstName').value.trim();
                const lastName = document.getElementById('lastName').value.trim();
                const nickName = document.getElementById('nickName').value.trim();
                const phoneNumber = phoneInput ? phoneInput.value.trim() : '';
                const bio = bioTextarea ? bioTextarea.value.trim() : '';
                
                const fieldOfStudy = fieldOfStudySelect.value;
                const yearOfStudy = yearOfStudySelect.value;
                const studyMode = studyModeSelect.value;

                if(!firstName || !lastName){
                    showMessage('Imię i nazwisko są wymagane', 'error');
                    return;
                }

                const phonePrefix = document.getElementById('phonePrefix') ? document.getElementById('phonePrefix').value : '+48';
                
                // Połącz prefix i numer telefonu
                let fullPhoneNumber = null;
                if(phoneNumber && phoneNumber.length > 0) {
                    fullPhoneNumber = phonePrefix + phoneNumber;
                }

                const profileData = {
                    firstName: firstName,
                    lastName: lastName,
                    nickName: nickName.length > 0 ? nickName : null,
                    phoneNumber: fullPhoneNumber,
                    fieldOfStudy: fieldOfStudy.length > 0 ? fieldOfStudy : null,
                    studyMode: studyMode.length > 0 ? studyMode : null,
                    bio: bio.length > 0 ? bio : null
                };

                if(yearOfStudy && yearOfStudy.length > 0) {
                    profileData.yearOfStudy = yearOfStudy;
                }
                
                try{
                    // Używamy zmiennej saveButton z górnego scope'u lub pobieramy
                    const btn = document.getElementById('saveButton');
                    if(btn) {
                        btn.disabled = true;
                        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Zapisywanie...</span>';
                    }
                    
                    const response = await fetch('/api/users/me', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        credentials: 'include',
                        body: JSON.stringify(profileData)
                    });

                    if(response.ok){
                        // Obsługa Awatara (Upload / Delete)
                        try {
                            if (shouldDeleteAvatar) {
                                await fetch('/api/users/me/avatar', {
                                    method: 'DELETE',
                                    credentials: 'include'
                                });
                            } else if (avatarFile) {
                                const formData = new FormData();
                                formData.append('file', avatarFile);
                                await fetch('/api/users/me/avatar', {
                                    method: 'POST',
                                    credentials: 'include',
                                    body: formData
                                });
                            }
                        } catch (avatarError) {
                            console.error("Błąd podczas aktualizacji awatara:", avatarError);
                        }

                        const updatedUser = await response.json();
                        
                        // Sukces - animacja
                        if (typeof showSuccessAnimation === 'function') {
                            showSuccessAnimation();
                        }
                        
                        // Aktualizuj flagi wasSet dla pól, które mają wartość
                        [fieldOfStudySelect, yearOfStudySelect, studyModeSelect].forEach(sel => {
                            if(sel && sel.value) sel.dataset.wasSet = 'true';
                        });
                        
                        // Ukryj komunikat błędu jeśli był
                         const msgBox = document.getElementById('profileMessage');
                         if(msgBox && msgBox.className.includes('error')) msgBox.style.display = 'none';

                    } else {
                        let errorMessage = 'Wystąpił błąd podczas aktualizacji profilu.';
                        try{
                            const errorData = await response.json();
                            errorMessage = errorData.message || errorData.error || errorMessage;
                        } catch(e) { 
                             const textError = await response.text();
                             if(textError) errorMessage = textError;
                        }
                        
                        // Jeśli error validation backendu
                        showMessage(errorMessage, 'error');
                    }
                } catch(error){
                    console.error('Błąd:', error);
                    showMessage(error.message || 'Wystąpił błąd połączenia.', 'error');  
                } finally{
                    const btn = document.getElementById('saveButton');
                    if(btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-save"></i> <span>Zapisz zmiany</span>';
                    }
                }
            });
        }

        // Animacja sukcesu
        window.showSuccessAnimation = function() {
            const overlay = document.createElement('div');
            overlay.className = 'success-overlay';
            overlay.innerHTML = `
                <div class="success-checkmark">
                    <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                        <circle class="checkmark-circle" cx="26" cy="26" r="25"/>
                        <path class="checkmark-check" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                    </svg>
                    <h3>Profil zaktualizowany!</h3>
                    <p>Zmiany zostały zapisane pomyślnie</p>
                </div>
            `;

            document.body.appendChild(overlay);

            setTimeout(() => overlay.classList.add('show'), 10);

            setTimeout(() => {
                overlay.classList.remove('show');
                setTimeout(() => overlay.remove(), 300);
            }, 2500);

            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 2500);
        };
    }

    // WYWOŁANIE WSZYSTKICH FUNKCJI
    initializeAvatar();
    initFeatures();
});