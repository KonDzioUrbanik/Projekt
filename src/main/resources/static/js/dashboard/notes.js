/* MODUŁ NOTATKI */

const CONFIG = {
    API: {
        BASE: '/api/notes',
        MY_NOTES: '/api/notes/my-notes',
        NOTE_BY_ID: (id) => `/api/notes/${id}`,
        SHARE: (id) => `/api/notes/${id}/share`,
        SHARED_WITH_ME: '/api/notes/shared-with-me',
        GROUP_NOTES: '/api/notes/group',
        PUBLIC_NOTES: '/api/notes/public',
        ACCESSIBLE: '/api/notes/accessible',
        FAVORITE: (id) => `/api/notes/${id}/favorite`,
        FAVORITES: '/api/notes/favorites',
        COPY: (id) => `/api/notes/${id}/copy`,
        TAGS: (id) => `/api/notes/${id}/tags`,
        SEARCH_TAG: '/api/notes/search/tag',
        SEARCH_USERS: '/api/users/search',
        SHARED_USERS: (id) => `/api/notes/${id}/shared-users`
    },
    LIMITS: {
        TITLE_MAX: 150,
        CONTENT_MAX: 4000
    },
    TIMING: {
        DEBOUNCE_DELAY: 300,
        TOAST_DURATION: 3000,
        MODAL_TRANSITION: 100,
        USER_SEARCH_DEBOUNCE: 500
    }
};

const AppState = {
    notes: [],
    filteredNotes: [],
    selectedNote: null,
    currentFilter: 'all',
    searchQuery: '',
    isEditMode: false,
    editingNoteId: null,
    selectedUsers: [],
    currentVisibility: 'PRIVATE',
    searchTimeout: null,
    quill: null
};

const DOM = {
    // Pasek boczny
    notesList: document.getElementById('notesList'),
    searchInput: document.getElementById('searchInput'),
    filterChips: document.querySelectorAll('.filter-chip'),
    btnNewNote: document.getElementById('btnNewNote'),
    btnToggleSidebar: document.getElementById('btnToggleSidebar'),
    notesSidebar: document.querySelector('.notes-sidebar'),
    
    // Widok notatki
    emptyState: document.getElementById('emptyState'),
    noteView: document.getElementById('noteView'),
    noteTitle: document.getElementById('noteTitle'),
    noteContent: document.getElementById('noteContent'),
    noteAuthor: document.getElementById('noteAuthor'),
    noteCreatedAt: document.getElementById('noteCreatedAt'),
    noteEditedMeta: document.getElementById('noteEditedMeta'),
    noteVisibilityBadge: document.getElementById('noteVisibilityBadge'),
    noteViewCount: document.getElementById('viewCountValue'),
    noteFavoriteCount: document.getElementById('favoriteCountValue'),
    noteTags: document.getElementById('noteTags'),
    btnEdit: document.getElementById('btnEdit'),
    btnDelete: document.getElementById('btnDelete'),
    btnFavorite: document.getElementById('btnFavorite'),
    btnShare: document.getElementById('btnShare'),
    btnCopy: document.getElementById('btnCopy'),
    
    // Modal (formularz)
    noteFormOverlay: document.getElementById('noteFormOverlay'),
    formTitle: document.getElementById('formTitle'),
    formNoteTitle: document.getElementById('formNoteTitle'),
    formNoteContent: document.getElementById('formNoteContent'),
    formNoteTags: document.getElementById('formNoteTags'),
    formNoteVisibility: document.getElementById('formNoteVisibility'),
    visibilityHelp: document.getElementById('visibilityHelp'),
    shareWithUsersSection: document.getElementById('shareWithUsersSection'),
    userSearchInput: document.getElementById('userSearchInput'),
    userSearchResults: document.getElementById('userSearchResults'),
    selectedUsersList: document.getElementById('selectedUsersList'),
    
    // Liczniki znaków
    titleCharCount: document.getElementById('titleCharCount'),
    contentCharCount: document.getElementById('contentCharCount'),

    btnCloseModal: document.getElementById('btnCloseModal'),
    btnCancelForm: document.getElementById('btnCancelForm'),
    btnSubmitForm: document.getElementById('btnSubmitForm'),
    submitBtnText: document.getElementById('submitBtnText'),
    
    deleteConfirmOverlay: document.getElementById('deleteConfirmOverlay'),
    btnCancelDelete: document.getElementById('btnCancelDelete'),
    btnConfirmDelete: document.getElementById('btnConfirmDelete'),

    // Kontener powiadomień
    toastContainer: document.getElementById('toastContainer'),

    // Nowe przyciski (Eksport/Resize)
    btnTextInc: document.getElementById('btnTextInc'),
    btnTextDec: document.getElementById('btnTextDec'),
    btnExportPdf: document.getElementById('btnExportPdf'),
    btnExportDocx: document.getElementById('btnExportDocx'),
    btnToggleFullscreen: document.getElementById('btnToggleFullscreen'),

    // Masonry Grid
    notesMasonryGrid: document.getElementById('notesMasonryGrid')
};

// INICJALIZACJA

document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    initQuillEditor();
    setupEventListeners();
    loadNotes();
}

function initQuillEditor() {
    const editorContainer = document.getElementById('quillEditor');
    if (!editorContainer) return;

    AppState.quill = new Quill('#quillEditor', {
        theme: 'snow',
        placeholder: 'Wprowadź treść notatki...',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['blockquote', 'code-block'],
                ['link'],
                ['clean']
            ]
        }
    });

    // Aktualizacja licznika znaków przy zmianie tekstu
    AppState.quill.on('text-change', () => {
        const length = AppState.quill.getLength() - 1; // Quill liczy końcowy newline
        if (DOM.contentCharCount) {
            DOM.contentCharCount.textContent = `${length}`;
            DOM.contentCharCount.classList.remove('warning', 'danger');
        }
    });

    // Polskie tooltipy dla przycisków toolbara
    setQuillTooltips();
}

function setQuillTooltips() {
    const toolbar = document.querySelector('.ql-toolbar');
    if (!toolbar) return;

    const tooltips = {
        '.ql-bold': 'Pogrubienie',
        '.ql-italic': 'Pochylenie',
        '.ql-underline': 'Podkreślenie',
        '.ql-strike': 'Przekreślenie',
        '.ql-link': 'Wstaw link',
        '.ql-blockquote': 'Cytat',
        '.ql-code-block': 'Blok kodu',
        '.ql-clean': 'Wyczyść formatowanie',
        '.ql-list[value="ordered"]': 'Lista numerowana',
        '.ql-list[value="bullet"]': 'Lista punktowana'
    };

    for (const [selector, title] of Object.entries(tooltips)) {
        const btn = toolbar.querySelector(selector);
        if (btn) btn.setAttribute('title', title);
    }

    // Pickery (header, color, background)
    const headerPicker = toolbar.querySelector('.ql-header .ql-picker-label');
    if (headerPicker) headerPicker.setAttribute('title', 'Nagłówek');

    const colorPicker = toolbar.querySelector('.ql-color .ql-picker-label');
    if (colorPicker) colorPicker.setAttribute('title', 'Kolor tekstu');

    const bgPicker = toolbar.querySelector('.ql-background .ql-picker-label');
    if (bgPicker) bgPicker.setAttribute('title', 'Kolor tła');
}

function setupEventListeners() {
    // Szukanie
    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('input', Utils.debounce((e) => {
            AppState.searchQuery = e.target.value.trim();
            applyCurrentFilter();
            renderNotesList();
        }, CONFIG.TIMING.DEBOUNCE_DELAY));
    }

    // Filtry
    if (DOM.filterChips) {
        DOM.filterChips.forEach(chip => {
            chip.addEventListener('click', () => {
                DOM.filterChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                handleFilterChange(chip.dataset.filter);
            });
        });
    }

    // Przyciski bocznego panelu
    if (DOM.btnNewNote) DOM.btnNewNote.addEventListener('click', openCreateModal);
    if (DOM.btnToggleFullscreen) DOM.btnToggleFullscreen.addEventListener('click', toggleFullscreenModal);
    if (DOM.btnToggleSidebar) DOM.btnToggleSidebar.addEventListener('click', toggleNotesSidebar);

    // Akcje notatki
    if (DOM.btnEdit) DOM.btnEdit.addEventListener('click', openEditModal);
    if (DOM.btnDelete) DOM.btnDelete.addEventListener('click', openDeleteConfirmation);
    if (DOM.btnFavorite) DOM.btnFavorite.addEventListener('click', handleToggleFavorite);
    if (DOM.btnShare) DOM.btnShare.addEventListener('click', openShareModal);
    if (DOM.btnCopy) DOM.btnCopy.addEventListener('click', handleCopyNote);

    // Eksport i Resize
    const btnTextInc = document.getElementById('btnTextInc');
    const btnTextDec = document.getElementById('btnTextDec');
    
    if (DOM.btnExportPdf) DOM.btnExportPdf.addEventListener('click', exportToPdf);
    if (DOM.btnExportDocx) DOM.btnExportDocx.addEventListener('click', exportToDocx);
    if (btnTextInc) btnTextInc.addEventListener('click', () => changeFontSize(2, 'noteContent'));
    if (btnTextDec) btnTextDec.addEventListener('click', () => changeFontSize(-2, 'noteContent'));



    // Akcje formularza
    if (DOM.btnCloseModal) DOM.btnCloseModal.addEventListener('click', closeFormModal);
    if (DOM.btnCancelForm) DOM.btnCancelForm.addEventListener('click', closeFormModal);
    if (DOM.btnSubmitForm) DOM.btnSubmitForm.addEventListener('click', handleFormSubmit);

    // Zmiana widoczności
    if (DOM.formNoteVisibility) {
        DOM.formNoteVisibility.addEventListener('change', handleVisibilityChange);
    }

    // Wyszukiwanie użytkowników do udostępnienia
    if (DOM.userSearchInput) {
        DOM.userSearchInput.addEventListener('input', Utils.debounce(handleUserSearch, CONFIG.TIMING.USER_SEARCH_DEBOUNCE));
    }


    // Liczniki
    if (DOM.formNoteTitle) {
        DOM.formNoteTitle.addEventListener('input', () => updateCharCounter(DOM.formNoteTitle, DOM.titleCharCount, 150));
    }
    // Licznik treści obsługiwany jest przez event 'text-change' Quill w initQuillEditor()

    // Akcje usuwania
    if (DOM.btnCancelDelete) DOM.btnCancelDelete.addEventListener('click', closeDeleteConfirmation);
    if (DOM.btnConfirmDelete) DOM.btnConfirmDelete.addEventListener('click', handleDeleteConfirm);

    // Skróty klawiszowe
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeFormModal();
            closeDeleteConfirmation();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'e' && AppState.selectedNote) {
            e.preventDefault();
            openEditModal();
        }
    });

    // Obsługa przycisku "Wstecz" w przeglądarce
    window.addEventListener('popstate', () => {
        const urlParams = new URLSearchParams(window.location.search);
        const noteIdParam = urlParams.get('id');
        
        if (noteIdParam) {
            const targetNote = AppState.notes.find(n => n.id == noteIdParam);
            if (targetNote) selectNote(targetNote.id);
        } else {
            // Jeśli wróciliśmy do czystego /student/notes (bez ID), zamykamy podgląd
            AppState.selectedNote = null;
            if (DOM.emptyState) DOM.emptyState.style.display = 'flex';
            if (DOM.noteView) DOM.noteView.style.display = 'none';
            renderNotesList();
        }
    });
}

// LOGIKA: CZAS I LICZNIKI

/**
 * Formatuje datę jako czas relatywny ("przed chwilą", "5 min temu" itp.)
 * Deleguje do Utils.formatDate (utils.js) - unikamy duplikacji logiki.
 */

function updateCharCounter(inputElement, counterElement, limit) {
    if (!inputElement || !counterElement) return;
    const length = inputElement.value.length;
    
    if (limit) {
        counterElement.textContent = `${length}/${limit}`;
        counterElement.classList.remove('warning', 'danger');
        if (length >= limit) counterElement.classList.add('danger');
        else if (length >= limit * 0.9) counterElement.classList.add('warning');
    } else {
        counterElement.textContent = `${length}`;
        counterElement.classList.remove('warning', 'danger');
    }
}

// ZAPYTANIA API

async function loadNotes() {
    DOM.notesList.innerHTML = '<div class="loading-spinner" style="margin: 20px auto;"></div>';
    
    try {
        let endpoint;
        
        // Wybór endpointu na podstawie aktywnego filtra
        switch (AppState.currentFilter) {
            case 'my':
                endpoint = CONFIG.API.MY_NOTES;
                break;
            case 'shared':
                endpoint = CONFIG.API.SHARED_WITH_ME;
                break;
            case 'group':
                endpoint = CONFIG.API.GROUP_NOTES;
                break;
            case 'public':
                endpoint = CONFIG.API.PUBLIC_NOTES;
                break;
            case 'favorites':
                endpoint = CONFIG.API.FAVORITES;
                break;
            case 'all':
                endpoint = CONFIG.API.ACCESSIBLE;
                break;
            default:
                endpoint = CONFIG.API.MY_NOTES;
        }
        
        const response = await fetch(endpoint);
        
        if (response.redirected && response.url.includes('/login')) {
            window.location.href = '/login';
            return;
        }
        
        if (!response.ok) {
            throw new Error(`Błąd HTTP: ${response.status}`);
        }

        const data = await response.json();
        
        // Zabezpieczenie przed nullem
        AppState.notes = Array.isArray(data) ? data : [];

        // Najpierw renderujemy domyślną listę
        applyCurrentFilter(); 
        renderNotesList();

        // Link z profilu
        const urlParams = new URLSearchParams(window.location.search);
        const noteIdParam = urlParams.get('id');

        if (noteIdParam) {
            let targetNote = AppState.notes.find(n => n.id == noteIdParam);
            
            const finalizeDeepLink = (note) => {
                selectNote(note.id);
                setTimeout(() => {
                    const activeCard = document.querySelector(`.note-card[data-note-id="${note.id}"]`);
                    if (activeCard) {
                        activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);
            };

            if (targetNote) {
                finalizeDeepLink(targetNote);
            } else {
                // Fallback: spróbuj pobrać notatkę bezpośrednio jeśli nie ma jej na liście (może być poza aktualnym filtrem)
                try {
                    const resp = await fetch(CONFIG.API.NOTE_BY_ID(noteIdParam));
                    if (resp.ok) {
                        const fetchedNote = await resp.json();
                        // Dodaj na początek listy
                        AppState.notes.unshift(fetchedNote);
                        applyCurrentFilter(); // Zaktualizuj filtrowaną listę
                        
                        // Jeśli filtr by ją ukrył, dodaj wymuszenie do filteredNotes
                        if (!AppState.filteredNotes.find(n => n.id === fetchedNote.id)) {
                            AppState.filteredNotes.unshift(fetchedNote);
                        }
                        
                        renderNotesList();
                        finalizeDeepLink(fetchedNote);
                    }
                } catch (err) {
                    console.error('Deep link fetch failed:', err);
                }
            }
        }
    } catch (error) {
        console.error('Błąd ładowania:', error);
        Utils.showToast('Nie udało się nawiązać połączenia z serwerem. Sprawdź swoje połączenie internetowe.', 'error');
        
        DOM.notesList.innerHTML = `
            <div style="text-align:center; padding:30px; color:var(--danger);">
                <i class="fas fa-wifi" style="margin-bottom:10px; font-size: 1.5rem"></i>
                <p>Błąd połączenia z bazą danych.</p>
                <button class="btn-text" onclick="loadNotes()" style="margin-top:10px; text-decoration:underline;">Spróbuj ponownie</button>
            </div>
        `;
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const title = DOM.formNoteTitle.value.trim();
    
    // Pobranie treści z Quill (HTML)
    let content = '';
    if (AppState.quill) {
        const quillText = AppState.quill.getText().trim();
        content = quillText.length > 0 ? AppState.quill.root.innerHTML : '';
    } else {
        content = DOM.formNoteContent.value.trim();
    }
    const tags = DOM.formNoteTags ? DOM.formNoteTags.value.trim() : '';
    const visibility = DOM.formNoteVisibility ? DOM.formNoteVisibility.value : 'PRIVATE';

    if (!title) { Utils.showToast('Wpisz tytuł notatki', 'error'); return; }
    if (!content) { Utils.showToast('Wpisz treść notatki', 'error'); return; }
    
    if (visibility === 'SHARED_WITH_USERS' && AppState.selectedUsers.length === 0) {
        Utils.showToast('Wybierz użytkowników, którym chcesz udostępnić notatkę', 'error');
        return;
    }

    DOM.btnSubmitForm.disabled = true;
    DOM.submitBtnText.textContent = 'Zapisywanie...';

    try {
        const noteData = { title, content };
        let resultNote;

        const handleResponse = async (response) => {
            if (response.redirected && response.url.includes('/login')) {
                window.location.href = '/login';
                throw new Error('Sesja wygasła. Przekierowywanie...');
            }
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                const errorMessage = errorBody.message || `Błąd serwera: ${response.status}`;
                throw new Error(errorMessage);
            }
            return response.json();
        };

        if (AppState.isEditMode) {
            const isShareOnlyMode = DOM.formNoteTitle.disabled;

            if (isShareOnlyMode) {
                resultNote = await shareNoteData(AppState.editingNoteId, visibility);
                Utils.showToast('Ustawienia udostępniania zostały zaktualizowane.', 'success');
            } else {
                // Tryb pełnej edycji - najpierw aktualizujemy treść
                const response = await fetch(CONFIG.API.NOTE_BY_ID(AppState.editingNoteId), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, content })
                });
                resultNote = await handleResponse(response);

            // Aktualizacja tagów jeśli zmienione
            if (tags !== (resultNote.tags || '')) {
                await fetch(CONFIG.API.TAGS(resultNote.id), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(tags)
                });
            }

            // Udostępnienie/zmiana widoczności jeśli potrzeba
            if (visibility !== resultNote.visibility || AppState.selectedUsers.length > 0) {
                resultNote = await shareNoteData(resultNote.id, visibility);
            }
            
            Utils.showToast('Notatka została pomyślnie zaktualizowana.', 'success');
            } // Koniec bloku else

            const idx = AppState.notes.findIndex(n => n.id === resultNote.id);
            if (idx !== -1) AppState.notes[idx] = resultNote;
            
            if (AppState.selectedNote?.id === resultNote.id) {
                AppState.selectedNote = resultNote;
                renderNoteView(resultNote);
            }
        } else {
            const response = await fetch(CONFIG.API.BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content, tags })
            });
            resultNote = await handleResponse(response);

            // Udostępnienie jeśli potrzeba
            if (visibility !== 'PRIVATE' || AppState.selectedUsers.length > 0) {
                resultNote = await shareNoteData(resultNote.id, visibility);
            }

            AppState.notes.unshift(resultNote);
            selectNote(resultNote.id);
            
            // Aktualizacja URL po utworzeniu nowej notatki
            updateUrl(resultNote.id);
            
            Utils.showToast('Notatka została pomyślnie utworzona.', 'success');
        }

        if (['my', 'shared', 'group', 'public', 'favorites'].includes(AppState.currentFilter)) {
            await loadNotes();
        } else {
            applyCurrentFilter();
            renderNotesList();
        }
        closeFormModal();

    } catch (error) {
        console.error(error);
        Utils.showToast(error.message || 'Wystąpił nieoczekiwany błąd.', 'error');
    } finally {
        DOM.btnSubmitForm.disabled = false;
        DOM.submitBtnText.textContent = 'Zapisz';
    }
}

// Global map for deletion timers to allow soft-undo
const deletionTimers = new Map();

async function sendActualDelete(noteId) {
    try {
        const response = await fetch(CONFIG.API.NOTE_BY_ID(noteId), { method: 'DELETE' });
        if (!response.ok) throw new Error(`Błąd HTTP: ${response.status}`);
    } catch (error) {
        console.error('Błąd usuwania API:', error);
        Utils.showToast('Błąd podczas usuwania notatki na serwerze', 'error');
    }
}

function handleDeleteConfirm() {
    if (!AppState.selectedNote) return;
    
    const noteToDelete = { ...AppState.selectedNote };
    const noteId = noteToDelete.id;

    // Usuń lokalnie natychmiastowo (Soft Delete)
    AppState.notes = AppState.notes.filter(n => n.id !== noteId);
    AppState.selectedNote = null;
    
    DOM.emptyState.style.display = 'flex';
    DOM.noteView.style.display = 'none';
    
    // Wyczyść URL po usunięciu notatki
    updateUrl(null);
    
    applyCurrentFilter();
    renderNotesList();
    closeDeleteConfirmation();

    // Pokaż Toast z przyciskiem Cofnij (Undo)
    const toast = Utils.showToast('Notatka usunięta', 'success', {
        actionHtml: `<button id="undo-btn-${noteId}" class="btn-undo-toast">Cofnij</button>`,
        duration: 5000
    });

    if (!toast) {
        // Fallback jeśli toast się nie udał, usuwamy od razu
        sendActualDelete(noteId);
        return;
    }

    // Timeout dla ostatecznego usunięcia (w tym zniknięcia toasta) za 5s
    const timer = setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }
        deletionTimers.delete(noteId);
        
        // Finalne wykonanie DELETE przez API
        sendActualDelete(noteId);
    }, 5000);
    
    deletionTimers.set(noteId, timer);

    // 3. Logika Cofania (Przywrócenie)
    const undoBtn = toast.querySelector(`#undo-btn-${noteId}`);
    if (undoBtn) {
        undoBtn.onclick = (e) => {
            e.stopPropagation();
            // Anuluj serwerowe usunięcie
            clearTimeout(timer);
            deletionTimers.delete(noteId);
            
            // Przywróć notatkę wizualnie i w pamięci
            AppState.notes.push(noteToDelete);
            AppState.selectedNote = noteToDelete;
            
            applyCurrentFilter();
            renderNotesList();
            renderNoteView(noteToDelete);
            
            DOM.emptyState.style.display = 'none';
            DOM.noteView.style.display = 'flex';
            updateUrl(noteId);
            
            // Zwiń stary Toast i pokaż info o przywróceniu
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
            
            Utils.showToast('Cofnięto usunięcie. Notatka przywrócona.', 'info');
        };
    }
}

// RENDEROWANIE I UI

function renderNotesList() {
    DOM.notesList.innerHTML = '';

    if (AppState.filteredNotes.length === 0) {
        const msg = AppState.searchQuery ? 'Brak wyników wyszukiwania' : 'Brak notatek';
        DOM.notesList.innerHTML = `
            <div style="text-align:center; padding:30px; color:var(--text-secondary);">
                <i class="fas fa-search" style="font-size:1.5rem; margin-bottom:10px; opacity:0.5;"></i>
                <p>${msg}</p>
            </div>
        `;
        // Brak notatek - pokaż stan pustki, ukryj siatkę Masonry
        if (DOM.notesMasonryGrid) DOM.notesMasonryGrid.style.display = 'none';
        if (!AppState.selectedNote && DOM.emptyState) DOM.emptyState.style.display = 'flex';
        return;
    }

    AppState.filteredNotes.forEach(note => {
        const isActive = AppState.selectedNote && AppState.selectedNote.id === note.id;
        const el = document.createElement('div');
        el.className = `note-card ${isActive ? 'active' : ''}`;
        
        el.setAttribute('data-note-id', note.id);
        
        el.onclick = (e) => {
            // Nie wybieraj notatki jeśli kliknięto w przycisk akcji
            if (e.target.closest('.note-card-action-btn')) {
                return;
            }
            selectNote(note.id);
            updateUrl(note.id);
        };
        
        const date = Utils.formatDate(note.updatedAt || note.createdAt);
        
        // Usunięcie tagów HTML oraz znaczników Markdown z podglądu
        const rawContent = note.content || '';
        const cleanContent = Utils.stripMarkdown(Utils.stripHtml(rawContent));
        const preview = cleanContent ? (cleanContent.substring(0, 60) + (cleanContent.length > 60 ? '...' : '')) : '';
        
        const visibilityIcons = {
            'PRIVATE': 'fa-lock',
            'SHARED_WITH_USERS': 'fa-user-friends',
            'GROUP': 'fa-users',
            'PUBLIC': 'fa-globe'
        };
        
        const visibilityLabels = {
            'PRIVATE': 'Prywatna',
            'SHARED_WITH_USERS': 'Udostępniona',
            'GROUP': 'Kierunek',
            'PUBLIC': 'Publiczna'
        };

        el.innerHTML = `
            <div class="note-card-actions">
                <button class="note-card-action-btn ${note.isFavorited ? 'active' : ''}" 
                        data-action="favorite" 
                        title="${note.isFavorited ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}">
                    <i class="fa${note.isFavorited ? 's' : 'r'} fa-star"></i>
                </button>
                <button class="note-card-action-btn" 
                        data-action="edit" 
                        title="Edytuj notatkę">
                    <i class="fas fa-pen"></i>
                </button>
            </div>
            <h3>${Utils.escapeHtml(Utils.stripMarkdown(note.title))}</h3>
            <p>${Utils.escapeHtml(preview)}</p>
            <div class="note-card-footer">
                <span title="${Utils.formatFullDate(note.updatedAt || note.createdAt)}">${Utils.formatDate(note.updatedAt || note.createdAt)}</span>
                <span class="note-card-visibility ${(note.visibility || 'PRIVATE').toLowerCase().replace('_', '-')}">
                    <i class="fas ${visibilityIcons[note.visibility || 'PRIVATE']}"></i>
                </span>
            </div>
        `;
        
        // Obsługa przycisków akcji
        const favoriteBtn = el.querySelector('[data-action="favorite"]');
        const editBtn = el.querySelector('[data-action="edit"]');
        
        favoriteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(note.id);
        });
        
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectNote(note.id);
            openEditModal();
        });
        
        DOM.notesList.appendChild(el);
    });

    // Jeśli nr nota nie jest w tej chwili wybrany - pokaż Masonry Grid (zamiast stanu pustki)
    if (!AppState.selectedNote) {
        if (DOM.emptyState) DOM.emptyState.style.display = 'none';
        renderMasonryGrid();
    } else {
        // Notatka jest właśnie otwarta - Masonry skryjmy
        if (DOM.notesMasonryGrid) DOM.notesMasonryGrid.style.display = 'none';
    }
}

function selectNote(id) {
    const note = AppState.notes.find(n => n.id === id);
    if (!note) return;

    AppState.selectedNote = note;
    renderNoteView(note);
    // Odśwież listę, żeby zaktualizować klasę .active
    renderNotesList(); 
}

/* ===== MASONRY GRID ===== */

function renderMasonryGrid() {
    const grid = DOM.notesMasonryGrid;
    if (!grid) return;

    grid.innerHTML = '';

    const visibilityIcons = {
        'PRIVATE': 'fa-lock',
        'SHARED_WITH_USERS': 'fa-user-friends',
        'GROUP': 'fa-users',
        'PUBLIC': 'fa-globe'
    };

    const colorPalette = [
        '#fef9c3', // Yellow
        '#dcfce7', // Green
        '#dbeafe', // Blue
        '#f3e8ff', // Purple
        '#ffe4e6', // Red
        '#fff7ed', // Orange
        '#e0f2fe', // Cyan
        '#f1f5f9'  // Gray (default)
    ];

    AppState.filteredNotes.forEach((note, index) => {
        const rawContent = note.content || '';
        const cleanContent = Utils.stripMarkdown(Utils.stripHtml(rawContent));
        const preview = cleanContent ? cleanContent.substring(0, 200) + (cleanContent.length > 200 ? '...' : '') : '';
        const date = Utils.formatDate(note.updatedAt || note.createdAt);
        const bgColor = colorPalette[index % colorPalette.length];
        const iconClass = visibilityIcons[note.visibility || 'PRIVATE'];

        const card = document.createElement('div');
        card.className = 'masonry-card';
        card.setAttribute('data-note-id', note.id);
        card.style.setProperty('--card-accent', bgColor);

        card.innerHTML = `
            <div class="masonry-card-inner">
                <div class="masonry-card-header">
                    <h3 class="masonry-card-title">${Utils.escapeHtml(Utils.stripMarkdown(note.title))}</h3>
                    <span class="masonry-card-icon" title="${note.visibility || 'PRIVATE'}">
                        <i class="fas ${iconClass}"></i>
                    </span>
                </div>
                ${preview ? `<p class="masonry-card-preview">${Utils.escapeHtml(preview)}</p>` : '<p class="masonry-card-preview empty">Brak treści...</p>'}
                ${
                    note.tags ? `<div class="masonry-card-tags">${
                        note.tags.split(',').map(t => t.trim()).filter(t => t)
                            .slice(0, 3)
                            .map(t => `<span class="masonry-tag">#${Utils.escapeHtml(t)}</span>`).join('')
                    }</div>` : ''
                }
                <div class="masonry-card-footer">
                    <span class="masonry-card-date" title="${Utils.formatFullDate(note.updatedAt || note.createdAt)}">${Utils.formatDate(note.updatedAt || note.createdAt)}</span>
                    ${note.isFavorited ? '<i class="fas fa-star masonry-star"></i>' : ''}
                </div>
            </div>
        `;

        card.addEventListener('click', () => {
            selectNote(note.id);
            updateUrl(note.id);
        });

        grid.appendChild(card);
    });

    grid.style.display = 'block';
}

function renderNoteView(note) {
    if (!DOM.emptyState || !DOM.noteView) return;
    
    DOM.emptyState.style.display = 'none';
    // Ukryj Masonry Grid, bo teraz wyświetlamy notatkę
    if (DOM.notesMasonryGrid) DOM.notesMasonryGrid.style.display = 'none';
    DOM.noteView.style.display = 'flex';

    DOM.noteTitle.textContent = note.title;
    
    // Renderowanie treści - wykrycie formatu (HTML vs Markdown-lite)
    if (note.content && note.content.trim().startsWith('<')) {
        // Nowy format: HTML z Quill
        DOM.noteContent.innerHTML = note.content;
    } else {
        // Stary format: Markdown-lite (kompatybilność wsteczna)
        DOM.noteContent.innerHTML = parseMarkdownLite(note.content);
    }

    
    if (DOM.noteAuthor) DOM.noteAuthor.textContent = getNoteAuthorName(note);
    if (DOM.noteCreatedAt) {
        DOM.noteCreatedAt.textContent = Utils.formatDate(note.createdAt);
        DOM.noteCreatedAt.title = Utils.formatFullDate(note.createdAt);
    }

    // Sprawdź czy notatka była edytowana (updatedAt != null)
    const isEdited = note.updatedAt !== null && note.updatedAt !== undefined;
    if (DOM.noteEditedMeta) {
        DOM.noteEditedMeta.style.display = isEdited ? 'inline-block' : 'none';
        if (isEdited) {
            DOM.noteEditedMeta.title = `Ostatnia edycja: ${Utils.formatFullDate(note.updatedAt)}`;
        }
    }

    // Widoczność badge
    if (DOM.noteVisibilityBadge) {
        const visibilityText = {
            'PRIVATE': 'Tylko ja',
            'SHARED_WITH_USERS': 'Wybrani użytkownicy',
            'GROUP': 'Kierunek',
            'PUBLIC': 'Publiczna'
        };
        DOM.noteVisibilityBadge.textContent = visibilityText[note.visibility] || 'Prywatna';
        DOM.noteVisibilityBadge.className = `badge-visibility ${note.visibility?.toLowerCase() || 'private'}`;

        // Tooltip dla grupy
        if (note.visibility === 'GROUP' && note.studentGroupName) {
            DOM.noteVisibilityBadge.title = `Dostępne dla kierunku: ${note.studentGroupName}`;
            DOM.noteVisibilityBadge.style.cursor = 'help';
        } else {
            DOM.noteVisibilityBadge.removeAttribute('title');
            DOM.noteVisibilityBadge.style.cursor = 'default';
        }
    }

    // Liczniki
    if (DOM.noteViewCount) DOM.noteViewCount.textContent = note.viewCount || 0;
    if (DOM.noteFavoriteCount) DOM.noteFavoriteCount.textContent = note.favoriteCount || 0;

    // Tagi
    if (DOM.noteTags) {
        DOM.noteTags.innerHTML = '';
        if (note.tags) {
            const tagsArray = note.tags.split(',').map(t => t.trim()).filter(t => t);
            tagsArray.forEach(tag => {
                const tagEl = document.createElement('span');
                tagEl.className = 'tag-chip';
                tagEl.textContent = tag;
                DOM.noteTags.appendChild(tagEl);
            });
        }
    }

    // Status ulubionej
    if (DOM.btnFavorite) {
        const isFav = note.isFavorited || false;
        DOM.btnFavorite.innerHTML = isFav 
            ? '<i class="fas fa-star"></i>' 
            : '<i class="far fa-star"></i>';
        DOM.btnFavorite.title = isFav ? 'Usuń z ulubionych' : 'Dodaj do ulubionych';
    }

    // Uprawnienia do edycji
    const canEdit = note.canEdit !== undefined ? note.canEdit : true;
    if (DOM.btnEdit) DOM.btnEdit.style.display = canEdit ? 'block' : 'none';
    if (DOM.btnDelete) DOM.btnDelete.style.display = canEdit ? 'block' : 'none';
}

function applyCurrentFilter() {
    let result = [...AppState.notes];
    
    if (AppState.currentFilter === 'recent') {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        result = result.filter(n => new Date(n.createdAt) > date);
    } else if (AppState.currentFilter === 'edited') {
        result = result.filter(n => n.updatedAt && n.updatedAt !== n.createdAt);
    }

    if (AppState.searchQuery) {
        const q = AppState.searchQuery.toLowerCase();
        result = result.filter(n => 
            (n.title && n.title.toLowerCase().includes(q)) || 
            (n.content && n.content.toLowerCase().includes(q))
        );
    }

    result.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    AppState.filteredNotes = result;
}

// FORMATOWANIE TEKSTU (MARKDOWN LITE)

function parseMarkdownLite(text) {
    if (!text) return '';

    // Sanityzacja HTML (XSS prevention)
    let safeText = Utils.escapeHtml(text);

    // Parsowanie Markdown

    // Kod Inline (`tekst`)
    safeText = safeText.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Pogrubienie (**tekst**)
    safeText = safeText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Kursywa (*tekst*)
    safeText = safeText.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Podkreślenie (__tekst__)
    safeText = safeText.replace(/__([^_]+)__/g, '<u>$1</u>');

    // Linki ([tekst](url))
    safeText = safeText.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+|mailto:[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Nagłówki (# Tekst)
    safeText = safeText.replace(/^# (.*$)/gm, '<h3>$1</h3>');

    // Listy (- element)
    safeText = safeText.replace(/^- (.*$)/gm, '<ul><li>$1</li></ul>');
    
    return safeText;
}

function handleFilterChange(filter) {

    AppState.currentFilter = filter;
    
    AppState.selectedNote = null;
    if (DOM.noteView) DOM.noteView.style.display = 'none';
    if (DOM.emptyState) DOM.emptyState.style.display = 'none';
    updateUrl(null);
    
    if (['my', 'shared', 'group', 'public', 'favorites', 'all'].includes(filter)) {
        loadNotes();
    } else {
        applyCurrentFilter();
        renderNotesList();
    }
}

// Funkcja pomocnicza do aktualizacji URL bez przeładowania
function updateUrl(noteId) {
    const newUrl = noteId 
        ? `${window.location.pathname}?id=${noteId}` 
        : window.location.pathname;
        
    window.history.pushState({path: newUrl}, '', newUrl);
}

// OBSŁUGA MODALI

function openCreateModal() {
    AppState.isEditMode = false;
    AppState.selectedUsers = [];
    AppState.currentVisibility = 'PRIVATE';
    
    DOM.formTitle.textContent = 'Nowa notatka';
    DOM.formNoteTitle.value = '';
    DOM.formNoteTags.value = '';
    DOM.formNoteVisibility.value = 'PRIVATE';
    
    // Wyczyść Quill
    if (AppState.quill) {
        AppState.quill.setContents([]);
        AppState.quill.enable();
    }
    
    // Włącz edycję
    DOM.formNoteTitle.disabled = false;
    DOM.formNoteTags.disabled = false;
    
    // Ukryj sekcję udostępniania
    if (DOM.shareWithUsersSection) DOM.shareWithUsersSection.style.display = 'none';
    if (DOM.visibilityHelp) DOM.visibilityHelp.textContent = 'Notatka będzie widoczna tylko dla Ciebie.';
    
    updateCharCounter(DOM.formNoteTitle, DOM.titleCharCount, 150);
    if (DOM.contentCharCount) DOM.contentCharCount.textContent = '0';
    
    DOM.noteFormOverlay.style.display = 'flex';
    setTimeout(() => DOM.formNoteTitle.focus(), 50);
}

async function openEditModal() {
    if (!AppState.selectedNote) return;
    
    // Sprawdź uprawnienia do edycji (jeśli zdefiniowane)
    if (AppState.selectedNote.canEdit === false) {
        Utils.showToast('Nie masz uprawnień do edycji tej notatki.', 'warning');
        return;
    }

    AppState.isEditMode = true;
    AppState.editingNoteId = AppState.selectedNote.id;
    AppState.selectedUsers = [];
    
    DOM.formTitle.textContent = 'Edycja notatki';
    DOM.formNoteTitle.value = AppState.selectedNote.title;
    DOM.formNoteTags.value = AppState.selectedNote.tags || '';
    DOM.formNoteVisibility.value = AppState.selectedNote.visibility || 'PRIVATE';
    
    // Wczytaj treść do Quill
    if (AppState.quill) {
        const content = AppState.selectedNote.content || '';
        if (content.trim().startsWith('<')) {
            // Treść HTML — wczytaj bezpośrednio
            AppState.quill.root.innerHTML = content;
        } else {
            // Stara treść Markdown — konwertuj na HTML przez parser i wczytaj
            AppState.quill.root.innerHTML = parseMarkdownLite(content);
        }
        AppState.quill.enable();
    }
    
    // Włącz edycję
    DOM.formNoteTitle.disabled = false;
    DOM.formNoteTags.disabled = false;
    
    // Załaduj użytkowników jeśli udostępniona
    if (AppState.selectedNote.visibility === 'SHARED_WITH_USERS') {
        try {
            const response = await fetch(CONFIG.API.SHARED_USERS(AppState.selectedNote.id));
            if (response.ok) {
                const users = await response.json();
                AppState.selectedUsers = users;
                renderSelectedUsers();
            }
        } catch (error) {
            console.error('Błąd pobierania użytkowników:', error);
            Utils.showToast('Nie udało się pobrać listy użytkowników', 'error');
        }
    }
    
    handleVisibilityChange();
    renderSelectedUsers();
    
    updateCharCounter(DOM.formNoteTitle, DOM.titleCharCount, 150);
    if (DOM.contentCharCount && AppState.quill) {
        DOM.contentCharCount.textContent = `${AppState.quill.getLength() - 1}`;
    }
    
    DOM.noteFormOverlay.style.display = 'flex';
}

function toggleFullscreenModal(e) {
    if (e) e.preventDefault();
    DOM.noteFormOverlay.classList.toggle('fullscreen');
    
    const icon = DOM.btnToggleFullscreen.querySelector('i');
    if (DOM.noteFormOverlay.classList.contains('fullscreen')) {
        icon.classList.remove('fa-expand');
        icon.classList.add('fa-compress');
        DOM.btnToggleFullscreen.title = "Zamknij pełny ekran";
    } else {
        icon.classList.remove('fa-compress');
        icon.classList.add('fa-expand');
        DOM.btnToggleFullscreen.title = "Pełny ekran";
    }
}

function closeFormModal() {
    DOM.noteFormOverlay.style.display = 'none';
    
    // Reset fullscreen
    DOM.noteFormOverlay.classList.remove('fullscreen');
    const icon = DOM.btnToggleFullscreen.querySelector('i');
    if (icon) {
        icon.classList.remove('fa-compress');
        icon.classList.add('fa-expand');
    }
    DOM.btnToggleFullscreen.title = "Pełny ekran";
}

function toggleNotesSidebar() {
    if (!DOM.notesSidebar) return;
    const isCollapsed = DOM.notesSidebar.classList.toggle('collapsed');
    if (DOM.btnToggleSidebar) {
        DOM.btnToggleSidebar.title = isCollapsed ? 'Rozwiń panel' : 'Zwiń panel';
    }
}

function openDeleteConfirmation() {
    if (AppState.selectedNote) DOM.deleteConfirmOverlay.style.display = 'flex';
}

function closeDeleteConfirmation() {
    DOM.deleteConfirmOverlay.style.display = 'none';
}


// FUNKCJE WSPÓŁDZIELENIA I ULUBIONE

async function handleToggleFavorite() {
    if (!AppState.selectedNote) return;
    await toggleFavorite(AppState.selectedNote.id);
}

async function toggleFavorite(noteId) {
    try {
        const response = await fetch(CONFIG.API.FAVORITE(noteId), {
            method: 'POST'
        });
        
        if (!response.ok) throw new Error('Błąd zmiany statusu ulubionej');
        
        const updatedNote = await response.json();
        
        // Aktualizacja stanu
        const idx = AppState.notes.findIndex(n => n.id === updatedNote.id);
        if (idx !== -1) {
            AppState.notes[idx] = updatedNote;
        }
        
        // Jeśli to jest aktualnie wybrana notatka, zaktualizuj ją też
        if (AppState.selectedNote && AppState.selectedNote.id === updatedNote.id) {
            AppState.selectedNote = updatedNote;
            renderNoteView(updatedNote);
        }
        
        // Bezpośrednia aktualizacja przycisku na karcie notatki
        const noteCard = document.querySelector(`.note-card[data-note-id="${noteId}"]`);
        if (noteCard) {
            const favBtn = noteCard.querySelector('[data-action="favorite"]');
            if (favBtn) {
                const icon = favBtn.querySelector('i');
                if (updatedNote.isFavorited) {
                    favBtn.classList.add('active');
                    favBtn.title = 'Usuń z ulubionych';
                    if (icon) {
                        icon.classList.remove('far');
                        icon.classList.add('fas');
                    }
                } else {
                    favBtn.classList.remove('active');
                    favBtn.title = 'Dodaj do ulubionych';
                    if (icon) {
                        icon.classList.remove('fas');
                        icon.classList.add('far');
                    }
                }
            }
        }
        
        // Odśwież listę gdy jesteśmy w filtrze Ulubione (żeby usunięta notatka zniknęła)
        if (AppState.currentFilter === 'favorites') {
            await loadNotes();
        }
        
        const msg = updatedNote.isFavorited ? 'Dodano do ulubionych' : 'Usunięto z ulubionych';
        Utils.showToast(msg, 'success');
        
    } catch (error) {
        console.error('Błąd:', error);
        Utils.showToast('Nie udało się zmienić statusu ulubionej', 'error');
    }
}

async function openShareModal() {
    if (!AppState.selectedNote) return;

    // Sprawdź uprawnienia do edycji (wymagane też do udostępniania)
    if (AppState.selectedNote.canEdit === false) {
        Utils.showToast('Tylko autor notatki może zarządzać jej udostępnianiem.', 'warning');
        return;
    }
    
    // Otwórz modal edycji z pre-wypełnionymi danymi
    AppState.isEditMode = true;
    AppState.editingNoteId = AppState.selectedNote.id;
    
    DOM.formTitle.textContent = 'Udostępnij notatkę';
    DOM.formNoteTitle.value = AppState.selectedNote.title;
    DOM.formNoteTags.value = AppState.selectedNote.tags || '';
    DOM.formNoteVisibility.value = AppState.selectedNote.visibility || 'PRIVATE';
    
    // Wczytaj treść do Quill (tylko do odczytu)
    if (AppState.quill) {
        const content = AppState.selectedNote.content || '';
        if (content.trim().startsWith('<')) {
            AppState.quill.root.innerHTML = content;
        } else {
            AppState.quill.root.innerHTML = parseMarkdownLite(content);
        }
        AppState.quill.disable();
    }
    
    // Wyłącz edycję tytułu i tagów
    DOM.formNoteTitle.disabled = true;
    DOM.formNoteTags.disabled = true;
    
    // Pokaż sekcję udostępniania jeśli SHARED_WITH_USERS
    handleVisibilityChange();
    
    // Załaduj użytkowników jeśli notatka jest udostępniona
    if (AppState.selectedNote.visibility === 'SHARED_WITH_USERS' && AppState.selectedNote.sharedWithUserIds) {
        AppState.selectedUsers = AppState.selectedNote.sharedWithUserIds.map(id => ({ id }));
        renderSelectedUsers();
    }
    
    DOM.noteFormOverlay.style.display = 'flex';
}

async function handleCopyNote() {
    if (!AppState.selectedNote) return;
    
    try {
        const response = await fetch(CONFIG.API.COPY(AppState.selectedNote.id), {
            method: 'POST'
        });
        
        if (!response.ok) throw new Error('Błąd kopiowania notatki');
        
        const copiedNote = await response.json();
        
        const chip = document.querySelector('.filter-chip[data-filter="my"]');
        if (chip) {
             chip.click();
             // Jeśli już byliśmy na 'my', wymuś odświeżenie
             if (AppState.currentFilter === 'my') {
                 loadNotes();
             }
        } else {
             // Fallback
             loadNotes();
        }
        
        Utils.showToast('Notatka została skopiowana do Twojej kolekcji', 'success');
        
    } catch (error) {
        console.error('Błąd:', error);
        Utils.showToast('Nie udało się skopiować notatki', 'error');
    }
}

function handleVisibilityChange() {
    const visibility = DOM.formNoteVisibility.value;
    AppState.currentVisibility = visibility;
    
    // Pokaż/ukryj sekcję wyboru użytkowników
    if (DOM.shareWithUsersSection) {
        DOM.shareWithUsersSection.style.display = visibility === 'SHARED_WITH_USERS' ? 'block' : 'none';
    }
    
    // Zmień tekst pomocy
    const helpTexts = {
        'PRIVATE': 'Notatka będzie widoczna tylko dla Ciebie.',
        'SHARED_WITH_USERS': 'Wybierz użytkowników, którzy będą mogli zobaczyć tę notatkę.',
        'GROUP': 'Notatka będzie widoczna dla wszystkich na Twoim kierunku.',
        'PUBLIC': 'Notatka będzie widoczna dla wszystkich użytkowników systemu.'
    };
    
    if (DOM.visibilityHelp) {
        DOM.visibilityHelp.textContent = helpTexts[visibility] || '';
    }
}

async function handleUserSearch(e) {
    const query = e.target.value.trim();
    
    if (query.length < 2) {
        DOM.userSearchResults.innerHTML = '';
        return;
    }
    
    try {
        const response = await fetch(`${CONFIG.API.SEARCH_USERS}?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) throw new Error('Błąd wyszukiwania');
        
        const users = await response.json();
        renderUserSearchResults(users);
        
    } catch (error) {
        console.error('Błąd wyszukiwania:', error);
        DOM.userSearchResults.innerHTML = '<div style="padding: 10px; color: var(--danger);">Błąd wyszukiwania</div>';
    }
}

function renderUserSearchResults(users) {
    if (!DOM.userSearchResults) return;
    
    DOM.userSearchResults.innerHTML = '';
    
    if (users.length === 0) {
        DOM.userSearchResults.innerHTML = '<div style="padding: 10px; color: var(--text-secondary);">Brak wyników</div>';
        return;
    }
    
    users.forEach(user => {
        // Sprawdź czy użytkownik już jest wybrany
        const isSelected = AppState.selectedUsers.some(u => u.id === user.id);
        
        if (!isSelected) {
            const userEl = document.createElement('div');
            userEl.className = 'user-search-result';
            userEl.innerHTML = `
                <div>
                    <strong>${Utils.escapeHtml(user.firstName)} ${Utils.escapeHtml(user.lastName)}</strong>
                    <br><small>${Utils.escapeHtml(user.email)}</small>
                </div>
            `;
            userEl.onclick = () => selectUser(user);
            DOM.userSearchResults.appendChild(userEl);
        }
    });
}

function selectUser(user) {
    // Dodaj do wybranych
    if (!AppState.selectedUsers.some(u => u.id === user.id)) {
        AppState.selectedUsers.push(user);
        renderSelectedUsers();
        
        // Wyczyść wyszukiwanie
        if (DOM.userSearchInput) DOM.userSearchInput.value = '';
        DOM.userSearchResults.innerHTML = '';
    }
}

function removeSelectedUser(userId) {
    AppState.selectedUsers = AppState.selectedUsers.filter(u => u.id !== userId);
    renderSelectedUsers();
}

function renderSelectedUsers() {
    if (!DOM.selectedUsersList) return;
    
    DOM.selectedUsersList.innerHTML = '';
    
    if (AppState.selectedUsers.length === 0) {
        DOM.selectedUsersList.innerHTML = '<div style="padding: 10px; color: var(--text-secondary); font-size: 0.9rem;">Nie wybrano użytkowników</div>';
        return;
    }
    
    AppState.selectedUsers.forEach(user => {
        const userChip = document.createElement('div');
        userChip.className = 'user-chip';
        userChip.innerHTML = `
            <span>${Utils.escapeHtml(user.firstName || '')} ${Utils.escapeHtml(user.lastName || '')}</span>
            <button type="button" onclick="removeSelectedUser(${user.id})">
                <i class="fas fa-times"></i>
            </button>
        `;
        DOM.selectedUsersList.appendChild(userChip);
    });
}

async function shareNoteData(noteId, visibility) {
    const payload = {
        visibility: visibility,
        userIds: visibility === 'SHARED_WITH_USERS' ? AppState.selectedUsers.map(u => u.id) : []
    };
    
    const response = await fetch(CONFIG.API.SHARE(noteId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
        throw new Error('Błąd udostępniania notatki');
    }
    
    return await response.json();
}

function getNoteAuthorName(note) {
    if (!note) return '';
    if (note.authorName) return note.authorName;
    if (note.userFirstName || note.userLastName) {
        return `${note.userFirstName || ''} ${note.userLastName || ''}`.trim();
    }
    return '';
}

// Funkcja globalna dla inline onclick
window.removeSelectedUser = function(userId) {
    AppState.selectedUsers = AppState.selectedUsers.filter(u => u.id !== userId);
    renderSelectedUsers();
};

function changeFontSize(delta, targetId) {
    const el = document.getElementById(targetId);
    if (!el) return;

    let currentSizeStr = window.getComputedStyle(el, null).getPropertyValue('font-size');
    let currentSize = parseFloat(currentSizeStr);
    
    if (isNaN(currentSize)) {
        currentSize = 16;
    }
    
    const newSize = currentSize + delta;
    if (newSize < 10 || newSize > 40) return;

    el.style.setProperty('font-size', newSize + 'px', 'important');
}

async function exportToPdf() {
    if (!AppState.selectedNote) return;

    const element = document.getElementById('noteContent');
    if (!element) return;

    Utils.showToast('Generowanie pliku PDF...', 'info');

    // Sprawdź czy biblioteka jest załadowana
    if (typeof html2pdf === 'undefined') {
        try {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
        } catch (e) {
            Utils.showToast('Błąd ładowania biblioteki PDF.', 'error');
            return;
        }
    }

    const opt = {
        margin:       10,
        filename:     `${AppState.selectedNote.title || 'Notatka'}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // Dodanie tytułu do PDF (tymczasowo wstawiamy do HTML)
    const container = document.createElement('div');
    container.innerHTML = `
        <style>
            .pdf-container { color: #000000 !important; background-color: #ffffff !important; font-family: sans-serif; }
            .pdf-container h1, .pdf-container h2, .pdf-container h3, .pdf-container div, .pdf-container p, .pdf-container span, .pdf-container li { 
                color: #000000 !important; 
                page-break-inside: avoid; 
            }
            .pdf-container a { color: #0000FF !important; }
            .pdf-container code { background-color: #f0f0f0 !important; color: #333 !important; border: 1px solid #ccc; page-break-inside: avoid; }
            /* Dodatkowe zabezpieczenie przed łamaniem wewnątrz linii */
            .pdf-container p { page-break-inside: avoid; orphans: 3; widows: 3; }
        </style>
        <div class="pdf-container">
            <h1 style="font-size: 24px; margin-bottom: 20px;">${AppState.selectedNote.title}</h1>
            <div style="line-height: 1.6;">
                ${element.innerHTML}
            </div>
            <div style="margin-top: 30px; font-size: 10px; color: #666; border-top: 1px solid #ddd; padding-top: 10px;">
                Wygenerowano: ${new Date().toLocaleString()}
            </div>
        </div>
    `;
    
    html2pdf().set(opt).from(container).save().then(() => {
        Utils.showToast('Pobrano plik PDF.', 'success');
    }).catch(err => {
        console.error(err);
        Utils.showToast('Błąd generowania PDF.', 'error');
    });
}

async function exportToDocx() {
    if (!AppState.selectedNote) return;

    const element = document.getElementById('noteContent');
    if (!element) return;

    Utils.showToast('Generowanie pliku DOCX...', 'info');

    // Sprawdzenie czy biblioteka jest załadowana
    if (typeof htmlDocx === 'undefined') {
        try {
            // Użycie html-docx-js z jsdelivr
            await loadScript('https://cdn.jsdelivr.net/npm/html-docx-js@0.3.1/dist/html-docx.js');
        } catch (e) {
            console.error(e);
            Utils.showToast('Błąd ładowania biblioteki DOCX.', 'error');
            return;
        }
    }

    try {
        const title = AppState.selectedNote.title || 'Notatka';
        
        // Przygotowanie HTML do konwersji
        const contentHtml = `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8">
                    <title>${Utils.escapeHtml(title)}</title>
                    <style>
                        body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; }
                        h1 { font-size: 16pt; color: #2e74b5; }
                        h3 { font-size: 13pt; color: #2e74b5; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
                        code { background: #f0f0f0; font-family: 'Courier New', monospace; }
                        a { color: #0563c1; text-decoration: underline; }
                    </style>
                </head>
                <body>
                    <h1>${Utils.escapeHtml(title)}</h1>
                    <p style="color: grey; font-size: 9pt;">
                        Autor: ${Utils.escapeHtml(getNoteAuthorName(AppState.selectedNote))}<br>
                        Data: ${new Date().toLocaleString()}
                    </p>
                    <hr>
                    ${element.innerHTML}
                </body>
            </html>
        `;

        // Konwersja
        const converted = htmlDocx.asBlob(contentHtml);
        
        // Pobieranie
        const a = document.createElement('a');
        a.href = URL.createObjectURL(converted);
        a.download = `${title}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        Utils.showToast('Pobrano plik DOCX.', 'success');

    } catch (error) {
        console.error('DOCX Export Error:', error);
        Utils.showToast('Błąd generowania pliku DOCX.', 'error');
    }
}

function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}
