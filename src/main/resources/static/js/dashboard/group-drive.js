document.addEventListener('DOMContentLoaded', () => {
    
    // UI Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const browseLink = document.getElementById('browseFilesBtn');
    
    const userQuotaText = document.getElementById('userQuotaText');
    const userQuotaFill = document.getElementById('userQuotaFill');
    const groupQuotaText = document.getElementById('groupQuotaText');
    const quotaUsedText = document.getElementById('quotaUsedText');
    const quotaPercentText = document.getElementById('quotaPercentText');
    const quotaBar = document.getElementById('quotaBar');
    const uploadInput = document.getElementById('groupDriveUploadInput');
    const uploadZone = document.getElementById('groupDriveUploadZone');
    const fileListBody = document.getElementById('filesTableBody');
    const searchInput = document.getElementById('driveSearch');
    const categoryFilter = document.getElementById('driveCategoryFilter');
    const uploadQueueContainer = document.getElementById('uploadQueueContainer');
    const queueGlobalActions = document.getElementById('queueGlobalActions');
    const uploadQueueList = document.getElementById('uploadQueueList');
    const groupNameText = document.getElementById('groupDriveName');
    
    const startUploadsBtn = document.getElementById('startUploadsBtn');
    const clearQueueBtn = document.getElementById('clearQueueBtn');
    const deleteModal = document.getElementById('deleteModal');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

    const paginationContainer = document.getElementById('paginationContainer');
    const noGroupOverlay = document.getElementById('noGroupOverlay');
    const driveWorkspace = document.getElementById('driveWorkspace');
    const uploadCategorySelect = document.getElementById('uploadCategorySelect');
    
    // Drawer UI
    const fileDetailsDrawer = document.getElementById('fileDetailsDrawer');
    const drawerOverlay = document.getElementById('drawerOverlay');
    const drawerPreviewArea = document.getElementById('drawerPreviewArea');
    const drawerDownloadBtn = document.getElementById('drawerDownloadBtn');
    const drawerDeleteBtn = document.getElementById('drawerDeleteBtn');
    const closeDrawerBtn = document.getElementById('closeDrawerBtn');

    // State
    const filesMap = new Map();
    let currentCategory = '';
    let currentSearch = '';
    let currentPage = 0;
    let currentSortField = 'uploadDate';
    let currentSortDir = 'desc';
    let categoryMap = {};
    let isUploading = false;
    let pendingFiles = [];
    let isQuotaLocked = false;
    
    let fileToDelete = null;
    let queueHideTimeout = null;
    let groupStoragePercentage = 0;
    let globalGroupStorageLimit = 2 * 1024 * 1024 * 1024; // 2GB fallback
    let activeUploads = 0;
    const MAX_CONCURRENT_UPLOADS = 3;

    // --- INIT ---
    init();

    async function init() {
        try {
            await loadCategories();
            await loadQuota();
            await loadFiles();
            setupEventListeners();
            setupFilters();
            if (typeof setupDrawer === 'function') setupDrawer();
            if (deleteModal) setupModals();
        } catch (err) {
            // Error handled in sub-calls
        }
    }

    function loadCategories() {
        return fetch('/api/drive/categories')
            .then(handleFetchResponse)
            .then(res => res.json())
            .then(data => {
                categoryMap = data;
                if (categoryFilter) {
                    const currentVal = categoryFilter.value;
                    categoryFilter.innerHTML = '<option value="">Wszystkie kategorie</option>';
                    Object.entries(categoryMap).forEach(([key, value]) => {
                        const option = document.createElement('option');
                        option.value = key;
                        option.textContent = value;
                        categoryFilter.appendChild(option);
                    });
                    categoryFilter.value = currentVal;
                }
            })
            .catch(err => {
                categoryMap = {
                    'NOTES': 'Notatki',
                    'EXAMS': 'Kolokwia i egzaminy',
                    'PROJECTS': 'Projekty',
                    'SLIDES': 'Prezentacje',
                    'OTHER': 'Inne'
                };
            });
    }
    
    // --- AUTH INTERCEPTOR ---
    function handleFetchResponse(res) {
        if (res.status === 401) {
            window.location.href = '/login';
            throw new Error("Brak autoryzacji");
        }
        if (!res.ok && res.status !== 403) {
            throw new Error("Błąd sieci API");
        }
        return res;
    }

    // --- API & DATA FETCHING ---
    function loadQuota() {
        return fetch('/api/drive/quota')
            .then(handleFetchResponse)
            .then(res => res.json())
            .then(data => {
                if (data.hasGroup === false) {
                    if (noGroupOverlay) noGroupOverlay.style.display = 'block';
                    if (driveWorkspace) driveWorkspace.style.display = 'none';
                    if (groupNameText) groupNameText.textContent = 'Brak przypisanego kierunku';
                    return;
                }

                if (noGroupOverlay) noGroupOverlay.style.display = 'none';
                if (driveWorkspace) driveWorkspace.style.display = 'block';

                const limitUser = data.userStorageLimit || 524288000;
                const usedUser = data.userUsedStorage || 0;
                globalGroupStorageLimit = data.groupStorageLimit || globalGroupStorageLimit;
                const usedGroup = data.groupUsedStorage || 0;

                const userPercent = Math.max(0, (usedUser / limitUser) * 100);
                const groupPercent = Math.max(0, (usedGroup / globalGroupStorageLimit) * 100);
                
                isQuotaLocked = groupPercent >= 100 || userPercent >= 100;
                
                // Update User Quota
                const userQuotaTextEl = document.getElementById('userQuotaText');
                const userQuotaPercentEl = document.getElementById('userQuotaPercent');
                const userQuotaBarEl = document.getElementById('userQuotaBar');
                
                if (userQuotaTextEl) userQuotaTextEl.textContent = `${bytesToSize(usedUser)} / ${bytesToSize(limitUser)}`;
                if (userQuotaPercentEl) userQuotaPercentEl.textContent = `${userPercent.toFixed(1)}%`;
                if (userQuotaBarEl) updateProgressBar(userQuotaBarEl, userPercent);

                // Update Group Quota
                if (quotaUsedText) quotaUsedText.textContent = `${bytesToSize(usedGroup)} / ${bytesToSize(globalGroupStorageLimit)}`;
                if (quotaPercentText) quotaPercentText.textContent = `${groupPercent.toFixed(1)}%`;
                updateProgressBar(quotaBar, groupPercent);
                
                if(groupNameText) {
                    groupNameText.textContent = data.groupName || 'Kierunek';
                }
            })
            .catch(err => {
                // Silently fail, use defaults
            });
    }

    let searchController = null;
    function loadFiles() {
        if (searchController) {
            searchController.abort();
        }
        searchController = new AbortController();

        const url = new URL(window.location.origin + '/api/drive/files');
        url.searchParams.append('page', currentPage);
        url.searchParams.append('size', 15);
        url.searchParams.append('sortField', currentSortField);
        url.searchParams.append('sortDirection', currentSortDir);
        if (currentCategory) url.searchParams.append('category', currentCategory);
        if (currentSearch) url.searchParams.append('search', currentSearch);
        
        if (filesMap.size === 0) {
            fileListBody.innerHTML = '<tr><td colspan="7" class="loading-cell" style="text-align:center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin" style="margin-right:8px;"></i> Ładowanie plików...</td></tr>';
        } else {
            fileListBody.style.opacity = '0.5';
        }

        fetch(url, { signal: searchController.signal })
            .then(handleFetchResponse)
            .then(res => res.json())
            .then(pageData => {
                filesMap.clear();
                pageData.content.forEach(f => filesMap.set(f.id, f));
                fileListBody.style.opacity = '1';
                renderFiles(pageData.content);
                renderPagination(pageData);
                updateSortHeaders();
            })
            .catch(err => {
                if(err.name === 'AbortError') return;
                fileListBody.style.opacity = '1';
                fileListBody.innerHTML = `<tr><td colspan="7" class="empty-cell" style="color:var(--danger-color)">Błąd ładowania danych plików lub brak uprawnień.</td></tr>`;
            });
    }

    function renderFiles(files) {
        if (files.length === 0) {
            fileListBody.innerHTML = `<tr><td colspan="7" class="empty-cell">Brak wyników wyszukiwania.</td></tr>`;
            return;
        }

        fileListBody.innerHTML = '';
        
        files.forEach(file => {
            const tr = document.createElement('tr');
            tr.dataset.id = file.id;
            tr.className = 'file-row';
            
            const iconData = getFileIcon(file.mimeType, file.fileName);
            const size = bytesToSize(file.fileSize);
            const date = new Date(file.uploadDate).toLocaleDateString('pl-PL', {
                year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
            });

            tr.innerHTML = `
                <td class="file-icon-cell"><i class="${iconData.icon}" style="color:${iconData.color || 'var(--primary-color)'}"></i></td>
                <td class="file-name-cell"></td>
                <td class="file-category-cell">${file.categoryName || categoryMap[file.categoryValue] || '-'}</td>
                <td class="file-size-cell">${size}</td>
                <td class="file-uploader-cell"></td>
                <td class="file-date-cell">${date}</td>
                <td class="file-actions-cell">
                    <button class="btn-icon-sm" title="Podgląd" onclick="event.stopPropagation(); if(typeof Utils !== 'undefined') Utils.showToast('Podgląd wkrótce dostępny', 'Podgląd wkrótce dostępny', 'info'); else alert('Podgląd wkrótce dostępny');"><i class="fa-solid fa-eye"></i></button>
                    <!-- Pobierz -->
                    <button class="btn-icon-sm" title="Pobierz"><i class="fa-solid fa-download"></i></button>
                </td>
            `;

            tr.querySelector('.file-name-cell').textContent = file.fileName;
            tr.querySelector('.file-uploader-cell').textContent = file.uploaderName || '-';
            
            fileListBody.appendChild(tr);
        });
    }

    // --- UPLOAD LOGIC ---
    function setupEventListeners() {
        fileListBody.addEventListener('click', (e) => {
            const target = e.target;
            const tr = target.closest('tr');
            if (!tr) return;

            const fileId = tr.dataset.id;
            if (target.closest('.btn-icon-sm') || target.closest('.file-actions-cell')) {
                e.stopPropagation();
                if (target.closest('.btn-icon-sm')) {
                    window.location.href = `/api/drive/download/${fileId}`;
                }
                return;
            }

            // Only open drawer when clicking on name or icon to allow selecting text in other columns
            if (target.closest('.file-name-cell') || target.closest('.file-icon-cell')) {
                openFileDrawerById(Number(fileId));
            }
        });

        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', () => {
                const sortField = header.dataset.sort;
                setSort(sortField);
            });
        });

        if (uploadZone) {
            uploadZone.addEventListener('click', () => !isQuotaLocked && uploadInput.click());
            uploadZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!isQuotaLocked) uploadZone.classList.add('dragover');
            });
            uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
            uploadZone.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadZone.classList.remove('dragover');
                if (isQuotaLocked) return;
                const files = e.dataTransfer.files;
                if (files.length > 0) handleFiles(files);
            });
        }

        if (uploadInput) {
            uploadInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) handleFiles(e.target.files);
            });
        }

        if (startUploadsBtn) {
            startUploadsBtn.addEventListener('click', () => {
                if (pendingFiles.length > 0) processUploadQueue();
            });
        }

        if (clearQueueBtn) {
            clearQueueBtn.addEventListener('click', () => {
                if (isUploading) return;
                pendingFiles = [];
                uploadQueueList.innerHTML = '';
                if (queueGlobalActions) queueGlobalActions.classList.add('hidden');
            });
        }
    }

    function setSort(field) {
        if (currentSortField === field) {
            currentSortDir = currentSortDir === 'desc' ? 'asc' : 'desc';
        } else {
            currentSortField = field;
            currentSortDir = 'desc';
        }
        currentPage = 0; // Reset to first page on sort change
        loadFiles();
    }

    function updateSortHeaders() {
        document.querySelectorAll('.sortable').forEach(header => {
            const field = header.dataset.sort;
            header.classList.remove('active', 'active-sort-asc', 'active-sort-desc');
            if (field === currentSortField) {
                header.classList.add('active');
                header.classList.add(currentSortDir === 'asc' ? 'active-sort-asc' : 'active-sort-desc');
            }
        });
    }

    function handleFiles(files) {
        if (isQuotaLocked) return;
        
        let validFiles = [];
        const maxSizeBytes = 50 * 1024 * 1024; // 50MB limit
        
        let hasAlertedLimit = false;
        Array.from(files).forEach(file => {
            if (file.size > maxSizeBytes) {
                if (typeof Utils !== 'undefined' && Utils.showToast) {
                    Utils.showToast("Przekroczono limit wielkości", `Plik ${file.name} jest za duży. Maksymalny rozmiar to 50MB.`, "error");
                }
                return;
            }
            if(validFiles.length + pendingFiles.length >= 20) {
                if (!hasAlertedLimit) {
                    if (typeof Utils !== 'undefined' && Utils.showToast) {
                        Utils.showToast("Limit plików", "Kolejka mieści max 20 plików naraz. Pozostałe pliki zostały pominięte.", "warning");
                    }
                    hasAlertedLimit = true;
                }
                return;
            }
            validFiles.push(file);
        });

        if (validFiles.length === 0) {
            uploadInput.value = '';
            return;
        }

        // Clear any pending cleanup timeout
        if (queueHideTimeout) {
            clearTimeout(queueHideTimeout);
            queueHideTimeout = null;
        }

        if (uploadQueueContainer) uploadQueueContainer.classList.remove('hidden');
        if (queueGlobalActions) queueGlobalActions.classList.remove('hidden');
        validFiles.forEach(file => addToPendingQueue(file));
        uploadInput.value = '';
    }

    function addToPendingQueue(file) {
        const queueId = 'queue_' + Math.random().toString(36).substr(2, 9);
        
        const task = {
            id: queueId,
            file: file,
            category: 'OTHER',
            state: 'pending'
        };
        
        pendingFiles.push(task);
        
        const item = document.createElement('div');
        item.className = 'upload-queue-item';
        item.id = queueId;
        
        const categoryOptions = `
            <select class="queue-item-category-select" id="${queueId}_category">
                <option value="NOTES">Notatki</option>
                <option value="EXAMS">Kolokwia i egzaminy</option>
                <option value="PROJECTS">Projekty</option>
                <option value="SLIDES">Prezentacje</option>
                <option value="OTHER" selected>Inne</option>
            </select>
        `;

        const sanitizedName = file.name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        item.innerHTML = `
            <div class="queue-index" style="color:var(--text-muted); font-weight:bold; margin-right:8px; min-width: 25px;"></div>
            <div class="status-icon"><i class="fa-solid fa-clock-rotate-left"></i></div>
            <div class="queue-filename">
                ${sanitizedName}
            </div>
            ${categoryOptions}
            <div class="queue-progress hidden" id="${queueId}_progress">
                <div class="progress-bar-fill" id="${queueId}_fill"></div>
            </div>
            <div class="queue-item-actions">
                <button class="btn-remove-queue cancel-btn hidden" onclick="window.abortUpload('${queueId}')" title="Anuluj" style="color:var(--text-secondary)"><i class="fas fa-times"></i></button>
                <button class="btn-remove-queue remove-btn" onclick="window.removeFromUploadQueue('${queueId}')" title="Usuń z listy"><i class="fas fa-times"></i></button>
                <button class="btn-remove-queue retry-btn hidden" onclick="window.retryUpload('${queueId}')" title="Spróbuj ponownie" style="display:none; color:var(--primary)"><i class="fas fa-redo"></i></button>
            </div>
        `;
        uploadQueueList.appendChild(item);
        window.reindexQueue();
    }
    
    window.reindexQueue = function() {
        const items = uploadQueueList.querySelectorAll('.upload-queue-item');
        items.forEach((item, index) => {
            const indexEl = item.querySelector('.queue-index');
            if (indexEl) {
                indexEl.textContent = (index + 1) + '.';
            }
        });
    };

    window.removeFromUploadQueue = function(id) {
        if (isUploading) return;
        
        pendingFiles = pendingFiles.filter(t => t.id !== id);
        const el = document.getElementById(id);
        if (el) el.remove();
        
        if (pendingFiles.length === 0) {
            if (queueGlobalActions) queueGlobalActions.classList.add('hidden');
        }
        window.reindexQueue();
    }

    async function processUploadQueue() {
        if (isUploading && activeUploads >= MAX_CONCURRENT_UPLOADS) return;
        isUploading = true;
        
        if (startUploadsBtn) startUploadsBtn.disabled = true;
        if (clearQueueBtn) clearQueueBtn.disabled = true;
        
        startNextUploads();
    }

    function startNextUploads() {
        const tasksToRun = pendingFiles.filter(t => t.state === 'pending');
        
        while (activeUploads < MAX_CONCURRENT_UPLOADS && tasksToRun.length > 0) {
            const task = tasksToRun.shift();
            
            // Read target category from the row's select dropdown
            const selectEl = document.getElementById(task.id + '_category');
            if (selectEl) {
                task.category = selectEl.value;
                selectEl.disabled = true; // Block changes during upload
            }
            
            task.state = 'uploading';
            activeUploads++;
            executeUploadTask(task);
        }
        
        if (activeUploads === 0 && pendingFiles.filter(t => t.state === 'pending').length === 0) {
            isUploading = false;
            if (startUploadsBtn) startUploadsBtn.disabled = false;
            if (clearQueueBtn) clearQueueBtn.disabled = false;
            if (pendingFiles.length === 0) {
                if (queueHideTimeout) clearTimeout(queueHideTimeout);
                queueHideTimeout = setTimeout(() => {
                    uploadQueueContainer.classList.add('hidden');
                    queueHideTimeout = null;
                }, 2000);
            }
        }
    }

    function executeUploadTask(task) {
        const queueId = task.id;
        const file = task.file;
        const category = task.category;
        
        const item = document.getElementById(queueId);
        const progressContainer = document.getElementById(`${queueId}_progress`);
        const progressFill = document.getElementById(`${queueId}_fill`);
        const statusIcon = item.querySelector('.status-icon');
        const removeBtn = item.querySelector('.btn-remove-queue');

        if (progressContainer) progressContainer.classList.remove('hidden');
        if (statusIcon) statusIcon.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        updateFileStatus(queueId, 'uploading');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category);

        const xhr = new XMLHttpRequest();
        task.xhr = xhr;
        xhr.open('POST', '/api/drive/upload', true);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = (e.loaded / e.total) * 100;
                progressFill.style.width = percent + '%';
            }
        };

        xhr.onload = () => {
            task.xhr = null;
            if (xhr.status >= 200 && xhr.status < 300) {
                updateFileStatus(queueId, 'success');
                loadQuota();
                loadFiles();
                // Remove from pending
                const idx = pendingFiles.findIndex(t => t.id === queueId);
                if (idx > -1) pendingFiles.splice(idx, 1);
                activeUploads--;
                startNextUploads();
            } else {
                updateFileStatus(queueId, 'error', 'Błąd serwera');
                task.state = 'error';
                activeUploads--;
                startNextUploads();
            }
        };

        xhr.onerror = () => {
            task.xhr = null;
            updateFileStatus(queueId, 'error', 'Błąd sieci');
            task.state = 'error';
            activeUploads--;
            startNextUploads();
        };
        xhr.send(formData);
    }
    
    window.abortUpload = function(id) {
        const task = pendingFiles.find(t => t.id === id);
        if (task && task.xhr && task.state === 'uploading') {
            task.xhr.abort();
            task.state = 'error';
            updateFileStatus(id, 'error', 'Anulowano');
            activeUploads--;
            startNextUploads();
        }
    };
    
    function updateFileStatus(id, status, message = '') {
        const item = document.getElementById(id);
        if (!item) return;

        const progressContainer = item.querySelector('.queue-progress');
        const statusIcon = item.querySelector('.status-icon');
        const fileNameEl = item.querySelector('.queue-filename');

        if (status === 'success') {
            if (progressContainer) progressContainer.style.display = 'none';
            if (statusIcon) {
                statusIcon.innerHTML = '<i class="fa-solid fa-circle-check" style="color:var(--success-color)"></i>';
            }
            setTimeout(() => {
                item.style.opacity = '0';
                setTimeout(() => {
                    item.remove();
                    window.reindexQueue();
                    // Only hide if the list is truly empty and no new files were added
                    if (uploadQueueList.children.length === 0 && pendingFiles.length === 0) {
                        uploadQueueContainer.classList.add('hidden');
                    }
                }, 300);
            }, 2000);
        } else if (status === 'error') {
            if (progressContainer) progressContainer.style.display = 'none';
            if (statusIcon) {
                statusIcon.innerHTML = `<i class="fa-solid fa-circle-xmark" style="color:var(--danger-color)" title="${message}"></i>`;
            }
            if (fileNameEl) {
                const name = fileNameEl.textContent;
                fileNameEl.innerHTML = `${name} <span class="error-msg">(${message})</span>`;
            }
        }
    }

    // --- DRAWER LOGIC ---
    function closeDrawer() {
        if (fileDetailsDrawer) fileDetailsDrawer.classList.remove('open');
        if (drawerOverlay) drawerOverlay.classList.remove('open');
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && fileDetailsDrawer && fileDetailsDrawer.classList.contains('open')) {
            closeDrawer();
        }
    });

    function setupDrawer() {
        closeDrawerBtn.addEventListener('click', closeDrawer);
        drawerOverlay.addEventListener('click', closeDrawer);
    }

    window.openFileDrawerById = function(id) {
        const file = filesMap.get(id);
        if(!file) return;
        
        document.getElementById('drawerFileName').textContent = file.fileName;
        document.getElementById('drawerFileSize').textContent = bytesToSize(file.fileSize);
        document.getElementById('drawerFileDate').textContent = new Date(file.uploadDate).toLocaleDateString('pl-PL');
        document.getElementById('drawerFileAuthor').textContent = file.uploaderName || '-';
        document.getElementById('drawerFileCategory').textContent = file.categoryName || categoryMap[file.categoryValue] || '-';
        
        // Reset Drawer Preview/Icon icons
        const iconData = getFileIcon(file.mimeType, file.fileName);
        const drawerFileIcon = document.getElementById('drawerFileIcon');
        if (drawerFileIcon) {
            drawerFileIcon.innerHTML = `<i class="${iconData.icon}" style="color:${iconData.color || 'var(--primary-color)'}"></i>`;
        }
        
        drawerDownloadBtn.href = `/api/drive/download/${file.id}`;
        
        if (file.canDelete) {
            drawerDeleteBtn.style.display = 'block';
            drawerDeleteBtn.onclick = () => {
                closeDrawer();
                window.openDeleteDialog(file.id, file.fileName);
            };
        } else {
            drawerDeleteBtn.style.display = 'none';
        }
        
        fileDetailsDrawer.classList.add('open');
        drawerOverlay.classList.add('open');
    }

    // --- FILTERS ---
    function setupFilters() {
        let searchDebounce;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => {
                currentSearch = e.target.value;
                currentPage = 0;
                loadFiles();
            }, 300);
        });

        categoryFilter.addEventListener('change', (e) => {
            currentCategory = e.target.value;
            currentPage = 0;
            loadFiles();
        });
    }

    // --- DELETION ---
    window.openDeleteDialog = function(id, name) {
        fileToDelete = id;
        const deleteFileName = document.getElementById('deleteFileName');
        if (deleteFileName) deleteFileName.textContent = name;
        if (deleteModal) deleteModal.classList.add('active');
    }

    function setupModals() {
        const closeModals = document.querySelectorAll('.close-modal, .cancel-delete');
        closeModals.forEach(btn => {
            btn.addEventListener('click', () => {
                deleteModal.classList.remove('active');
                fileToDelete = null;
            });
        });

        // Close on overlay click
        if (deleteModal) {
            deleteModal.addEventListener('click', (e) => {
                if (e.target === deleteModal) {
                    deleteModal.classList.remove('active');
                    fileToDelete = null;
                }
            });
        }

        confirmDeleteBtn.addEventListener('click', () => {
            if (!fileToDelete) return;
            fetch(`/api/drive/${fileToDelete}`, { method: 'DELETE' })
            .then(handleFetchResponse)
            .then(() => {
                deleteModal.classList.remove('active');
                if (typeof Utils !== 'undefined' && Utils.showToast) {
                    Utils.showToast("Plik został pomyślnie usunięty", "success");
                }
                loadQuota().then(loadFiles);
            })
            .catch(err => {
                deleteModal.classList.remove('active');
                if (typeof Utils !== 'undefined' && Utils.showToast) {
                    Utils.showToast("Błąd podczas usuwania pliku", "error");
                }
            });
        });
    }

    // --- PAGINATION RENDER ---
    function renderPagination(data) {
        if (!paginationContainer) return;
        
        // Support both old Spring format and Spring Boot 3.3+ format where page details are nested
        const totalPages = data.page?.totalPages ?? data.totalPages ?? 0;
        const number = data.page?.number ?? data.number ?? 0;
        const isFirst = data.first ?? (number === 0);
        const isLast = data.last ?? (number >= Math.max(0, totalPages - 1));

        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let html = '';
        
        // Prev btn
        html += `<button class="page-btn" ${isFirst ? 'disabled' : ''} onclick="window.changePage(${currentPage - 1})"><i class="fas fa-chevron-left"></i></button>`;

        // Pages
        const maxVisible = 5;
        let start = Math.max(0, number - 2);
        let end = Math.min(totalPages - 1, start + maxVisible - 1);
        
        if (end - start < maxVisible - 1) {
            start = Math.max(0, end - maxVisible + 1);
        }

        for (let i = start; i <= end; i++) {
            html += `<button class="page-btn ${i === number ? 'active' : ''}" onclick="window.changePage(${i})">${i + 1}</button>`;
        }

        // Next btn
        html += `<button class="page-btn" ${isLast ? 'disabled' : ''} onclick="window.changePage(${currentPage + 1})"><i class="fas fa-chevron-right"></i></button>`;

        paginationContainer.innerHTML = html;
    }

    window.changePage = function(page) {
        if (page === currentPage || page < 0) return;
        currentPage = page;
        loadFiles();
        // window.scrollTo({ top: 0, behavior: 'smooth' }); // Removed to prevent annoying page jumps
    }

    // --- UTILS ---
    function bytesToSize(bytes) {
        if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
    }

    function updateProgressBar(element, percentage) {
        if (percentage > 100) percentage = 100;
        element.style.width = percentage + '%';
        element.classList.remove('warning', 'danger');
        if (percentage > 90) {
            element.classList.add('danger');
        } else if (percentage > 70) {
            element.classList.add('warning');
        }
    }

    function getFileIcon(mime, name) {
        let ext = name ? name.split('.').pop().toLowerCase() : '';
        const safeMime = mime || '';
        if (ext === name.toLowerCase()) ext = '___';

        if (safeMime.includes('pdf') || ext === 'pdf') {
            return { icon: 'far fa-file-pdf', class: 'pdf', ext: '', color: '#ff4d4f' };
        } else if (safeMime.includes('word') || ext === 'doc' || ext === 'docx') {
            return { icon: 'far fa-file-word', class: 'doc', ext: '', color: '#1677ff' };
        } else if (safeMime.includes('powerpoint') || safeMime.includes('presentation') || ext === 'ppt' || ext === 'pptx') {
            return { icon: 'far fa-file-powerpoint', class: 'ppt', ext: '', color: '#fa8c16' };
        } else if (safeMime.includes('image') || ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
            return { icon: 'far fa-file-image', class: 'img', ext: '', color: '#52c41a' };
        }
        
        return { icon: 'fas fa-file-alt', class: 'unknown', ext: ext.substring(0, 4), color: 'var(--text-muted)' };
    }

    function getCategoryClass(val) {
        switch(val) {
            case 'NOTES': return 'cat-notes';
            case 'EXAMS': return 'cat-exams';
            case 'PROJECTS': return 'cat-projects';
            case 'SLIDES': return 'cat-slides';
            default: return 'cat-other';
        }
    }
});
