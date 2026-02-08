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
        SEARCH_USERS: '/api/users/search'
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
    searchTimeout: null
};

const DOM = {
    // Pasek boczny
    notesList: document.getElementById('notesList'),
    searchInput: document.getElementById('searchInput'),
    filterChips: document.querySelectorAll('.filter-chip'),
    btnNewNote: document.getElementById('btnNewNote'),
    
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
    formError: document.getElementById('formError'),
    
    deleteConfirmOverlay: document.getElementById('deleteConfirmOverlay'),
    btnCancelDelete: document.getElementById('btnCancelDelete'),
    btnConfirmDelete: document.getElementById('btnConfirmDelete'),

    // Kontener powiadomień
    toastContainer: document.getElementById('toastContainer'),

    // Nowe przyciski (Eksport/Resize)
    btnTextInc: document.getElementById('btnTextInc'),
    btnTextDec: document.getElementById('btnTextDec'),
    btnExportPdf: document.getElementById('btnExportPdf'),
    btnExportDocx: document.getElementById('btnExportDocx')
};

// INICJALIZACJA

document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    setupEventListeners();
    loadNotes();
}

function setupEventListeners() {
    // Szukanie
    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('input', debounce((e) => {
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

    // Akcje notatki
    if (DOM.btnEdit) DOM.btnEdit.addEventListener('click', openEditModal);
    if (DOM.btnDelete) DOM.btnDelete.addEventListener('click', openDeleteConfirmation);
    if (DOM.btnFavorite) DOM.btnFavorite.addEventListener('click', handleToggleFavorite);
    if (DOM.btnShare) DOM.btnShare.addEventListener('click', openShareModal);
    if (DOM.btnCopy) DOM.btnCopy.addEventListener('click', handleCopyNote);

    // Eksport i Resize
    if (DOM.btnExportPdf) DOM.btnExportPdf.addEventListener('click', exportToPdf);
    if (DOM.btnExportDocx) DOM.btnExportDocx.addEventListener('click', exportToDocx);
    if (DOM.btnTextInc) DOM.btnTextInc.addEventListener('click', () => changeFontSize(2, 'noteContent'));
    if (DOM.btnTextDec) DOM.btnTextDec.addEventListener('click', () => changeFontSize(-2, 'noteContent'));



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
        DOM.userSearchInput.addEventListener('input', debounce(handleUserSearch, CONFIG.TIMING.USER_SEARCH_DEBOUNCE));
    }


    // Liczniki
    if (DOM.formNoteTitle) {
        DOM.formNoteTitle.addEventListener('input', () => updateCharCounter(DOM.formNoteTitle, DOM.titleCharCount, 150));
    }
    if (DOM.formNoteContent) {
        DOM.formNoteContent.addEventListener('input', () => updateCharCounter(DOM.formNoteContent, DOM.contentCharCount, null));
    }

    // Formatowanie tekstu (Markdown Lite)
    const formatBtns = document.querySelectorAll('.btn-format');
    formatBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); // Zapobiega submitowi formularza
            const format = btn.dataset.format;
            handleFormatting(format);
        });
    });


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
            // Jeśli wróciliśmy do czystego /dashboard/notes (bez ID), zamykamy podgląd
            AppState.selectedNote = null;
            if (DOM.emptyState) DOM.emptyState.style.display = 'flex';
            if (DOM.noteView) DOM.noteView.style.display = 'none';
            renderNotesList();
        }
    });
}

// LOGIKA: CZAS I LICZNIKI

function formatRelativeTime(dateString) {
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
}

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
            // Używamy '==' żeby porównać string z URL z liczbą ID z API
            const targetNote = AppState.notes.find(n => n.id == noteIdParam);
            
            if (targetNote) {
                // Wybierz notatkę i wyświetl
                selectNote(targetNote.id);
                
                // Poczekaj chwilę aż DOM się odświeży i przewiń listę
                setTimeout(() => {
                    const activeCard = document.querySelector(`.note-card[data-note-id="${targetNote.id}"]`);
                    if (activeCard) {
                        activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);
            }
        }
    } catch (error) {
        console.error('Błąd ładowania:', error);
        showToast('Nie udało się nawiązać połączenia z serwerem. Sprawdź swoje połączenie internetowe.', 'error');
        
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
    const content = DOM.formNoteContent.value.trim();
    const tags = DOM.formNoteTags ? DOM.formNoteTags.value.trim() : '';
    const visibility = DOM.formNoteVisibility ? DOM.formNoteVisibility.value : 'PRIVATE';

    if (!title) { showFormError('Wpisz tytuł notatki'); return; }
    if (!content) { showFormError('Wpisz treść notatki'); return; }
    
    if (visibility === 'SHARED_WITH_USERS' && AppState.selectedUsers.length === 0) {
        showFormError('Wybierz użytkowników, którym chcesz udostępnić notatkę');
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
                showToast('Ustawienia udostępniania zostały zaktualizowane.', 'success');
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
                await shareNoteData(resultNote.id, visibility);
            }
            
            showToast('Notatka została pomyślnie zaktualizowana.', 'success');
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
            
            showToast('Notatka została pomyślnie utworzona.', 'success');
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
        showFormError(error.message || 'Wystąpił nieoczekiwany błąd.');
    } finally {
        DOM.btnSubmitForm.disabled = false;
        DOM.submitBtnText.textContent = 'Zapisz';
    }
}

async function handleDeleteConfirm() {
    if (!AppState.selectedNote) return;
    
    DOM.btnConfirmDelete.disabled = true;
    DOM.btnConfirmDelete.textContent = 'Usuwanie...';

    try {
        const response = await fetch(CONFIG.API.NOTE_BY_ID(AppState.selectedNote.id), { method: 'DELETE' });

        if (!response.ok) throw new Error(`Błąd HTTP: ${response.status}`);

        AppState.notes = AppState.notes.filter(n => n.id !== AppState.selectedNote.id);
        AppState.selectedNote = null;
        
        DOM.emptyState.style.display = 'flex';
        DOM.noteView.style.display = 'none';
        
        // Wyczyść URL po usunięciu notatki
        updateUrl(null);
        
        applyCurrentFilter();
        renderNotesList();
        closeDeleteConfirmation();
        showToast('Notatka została trwale usunięta.', 'success');

    } catch (error) {
        console.error('Błąd usuwania:', error);
        showToast('Nie udało się usunąć notatki. Sprawdź połączenie internetowe i spróbuj ponownie.', 'error');
    } finally {
        DOM.btnConfirmDelete.disabled = false;
        DOM.btnConfirmDelete.textContent = 'Usuń notatkę';
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
        
        const date = formatRelativeTime(note.updatedAt || note.createdAt);
        const preview = note.content ? (note.content.substring(0, 60) + (note.content.length > 60 ? '...' : '')) : '';
        
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
            <h3>${escapeHtml(note.title)}</h3>
            <p>${escapeHtml(preview)}</p>
            <div class="note-card-footer">
                <span>${date}</span>
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
}

function selectNote(id) {
    const note = AppState.notes.find(n => n.id === id);
    if (!note) return;

    AppState.selectedNote = note;
    renderNoteView(note);
    // Odśwież listę, żeby zaktualizować klasę .active
    renderNotesList(); 
}

function renderNoteView(note) {
    if (!DOM.emptyState || !DOM.noteView) return;
    
    DOM.emptyState.style.display = 'none';
    DOM.noteView.style.display = 'flex';

    DOM.noteTitle.textContent = note.title;
    
    // Renderowanie Markdown (bezpieczne)
    DOM.noteContent.innerHTML = parseMarkdownLite(note.content);

    
    if (DOM.noteAuthor) DOM.noteAuthor.textContent = getNoteAuthorName(note);
    if (DOM.noteCreatedAt) DOM.noteCreatedAt.textContent = formatDateTime(note.createdAt);

    // Sprawdź czy notatka była edytowana (updatedAt != null)
    const isEdited = note.updatedAt !== null && note.updatedAt !== undefined;
    if (DOM.noteEditedMeta) {
        DOM.noteEditedMeta.style.display = isEdited ? 'inline-block' : 'none';
        if (isEdited) {
            DOM.noteEditedMeta.title = `Ostatnia edycja: ${formatDateTime(note.updatedAt)}`;
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

    // 1. Sanityzacja HTML (XSS prevention)
    // Najpierw zamieniamy niebezpieczne znaki na encje HTML
    // WAŻNE: To musi być pierwszy krok!
    let safeText = escapeHtml(text);

    // 2. Parsowanie Markdown
    // Kolejność ma znaczenie (np. Code block przed innymi)

    // Kod Inline (`tekst`)
    safeText = safeText.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Pogrubienie (**tekst**)
    safeText = safeText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Kursywa (*tekst*)
    safeText = safeText.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Podkreślenie (__tekst__)
    safeText = safeText.replace(/__([^_]+)__/g, '<u>$1</u>');

    // Linki ([tekst](url))
    // Uwaga: URL też może być niebezpieczny (javascript:...), ale escapeHtml zamienił już dwukropki? Nie.
    // Dodatkowe zabezpieczenie dla linków: tylko http, https, mailto
    safeText = safeText.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+|mailto:[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Nagłówki (# Tekst) - tylko na początku linii
    // Używamy flagi 'm' (multiline)
    safeText = safeText.replace(/^# (.*$)/gm, '<h3>$1</h3>');

    // Listy (- element) - tylko na początku linii
    // To jest uproszczone - zamienia myślniki na kropki unicode, 
    // bo prawdziwa lista <ul> wymagałaby wrapowania wielu linii.
    // Dla Markdown Lite zrobimy trick wizualny lub prostą listę.
    
    // Opcja A: Prosta zamiana na flex/grid w CSS (ale tu robimy HTML replacement)
    // Zróbmy tak: każda linia zaczynająca się od "- " dostaje klasę list-item-line
    // A w CSS (już dodane): ul/li. 
    // Spróbujmy zamienić na <ul><li>...</li></ul> ? Trudne regexem.
    // Prościej: "- tekst" -> "<li>tekst</li>" i wrapujemy całość w <ul>?
    // Najprościej: "- tekst" -> "• tekst" (z wcięciem)
    
    // Lepsze podejście:
    safeText = safeText.replace(/^- (.*$)/gm, '<ul><li>$1</li></ul>');
    // Problem: to stworzy osobne <ul> dla każdego elementu.
    // Fix: CSS merge margins? Albo zostawmy to. Dla prostych notatek OK.
    
    // Nowe linie -> <br> (ale nie wewnątrz tagów blokowych jak h3, ul)
    // To jest trudne. Zostawmy white-space: pre-wrap w CSS (to już mamy).
    // Jedynie musimy usunąć entery PO nagłówkach, żeby nie było dziur.
    
    return safeText;
}

function handleFormatting(formatType) {
    const textarea = DOM.formNoteContent;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    let newText = '';
    let cursorOffset = 0;

    switch (formatType) {
        case 'bold':
            newText = `**${selectedText}**`;
            cursorOffset = 2; // Pozycjonowanie wewnątrz gwiazdek
            break;
        case 'italic':
            newText = `*${selectedText}*`;
            cursorOffset = 1;
            break;
        case 'underline':
            newText = `__${selectedText}__`;
            cursorOffset = 2;
            break;
        case 'heading':
            newText = `# ${selectedText}`;
            cursorOffset = 2;
            break;
        case 'list':
            newText = `- ${selectedText}`;
            cursorOffset = 2;
            break;
        case 'code':
            newText = `\`${selectedText}\``;
            cursorOffset = 1;
            break;
        case 'link':
            if (selectedText) {
                newText = `[${selectedText}](url)`;
            } else {
                newText = `[tekst](url)`;
            }
            cursorOffset = 1; // Żeby edytować tekst
            break;
    }

    // Wstawienie tekstu
    textarea.setRangeText(newText, start, end, 'end');
    
    // Przywrócenie focusu i ustawienie kursora
    textarea.focus();
    
    if (!selectedText && cursorOffset > 0) {
        // Jeśli nie było zaznaczenia, wstawiamy kursor W ŚRODEK znaczników
        textarea.setSelectionRange(start + cursorOffset, start + cursorOffset + (formatType === 'link' ? 5 : 0));
    }
    
    // Wyzwolenie eventu input (żeby zaktualizować licznik znaków)
    const event = new Event('input');
    textarea.dispatchEvent(event);
}

function handleFilterChange(filter) {

    AppState.currentFilter = filter;
    
    // Dla niektórych filtrów musimy przeładować dane z serwera
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
    DOM.formNoteContent.value = '';
    DOM.formNoteTags.value = '';
    DOM.formNoteVisibility.value = 'PRIVATE';
    DOM.formError.style.display = 'none';
    
    // Włącz edycję
    DOM.formNoteTitle.disabled = false;
    DOM.formNoteContent.disabled = false;
    DOM.formNoteTags.disabled = false;
    
    // Ukryj sekcję udostępniania
    if (DOM.shareWithUsersSection) DOM.shareWithUsersSection.style.display = 'none';
    if (DOM.visibilityHelp) DOM.visibilityHelp.textContent = 'Notatka będzie widoczna tylko dla Ciebie.';
    
    updateCharCounter(DOM.formNoteTitle, DOM.titleCharCount, 150);
    updateCharCounter(DOM.formNoteContent, DOM.contentCharCount, null);
    
    DOM.noteFormOverlay.style.display = 'flex';
    setTimeout(() => DOM.formNoteTitle.focus(), 50);
}

function openEditModal() {
    if (!AppState.selectedNote) return;
    
    // Sprawdź uprawnienia do edycji (jeśli zdefiniowane)
    if (AppState.selectedNote.canEdit === false) {
        showToast('Nie masz uprawnień do edycji tej notatki.', 'warning');
        return;
    }

    AppState.isEditMode = true;
    AppState.editingNoteId = AppState.selectedNote.id;
    AppState.selectedUsers = [];
    
    DOM.formTitle.textContent = 'Edycja notatki';
    DOM.formNoteTitle.value = AppState.selectedNote.title;
    DOM.formNoteContent.value = AppState.selectedNote.content;
    DOM.formNoteTags.value = AppState.selectedNote.tags || '';
    DOM.formNoteVisibility.value = AppState.selectedNote.visibility || 'PRIVATE';
    DOM.formError.style.display = 'none';
    
    // Włącz edycję
    DOM.formNoteTitle.disabled = false;
    DOM.formNoteContent.disabled = false;
    DOM.formNoteTags.disabled = false;
    
    // Załaduj użytkowników jeśli udostępniona
    if (AppState.selectedNote.visibility === 'SHARED_WITH_USERS' && AppState.selectedNote.sharedWithUserIds) {
        // Tutaj możemy tylko przechować ID, szczegóły będą przy renderowaniu
        AppState.selectedUsers = AppState.selectedNote.sharedWithUserIds.map(id => ({ id }));
    }
    
    handleVisibilityChange();
    renderSelectedUsers();
    
    updateCharCounter(DOM.formNoteTitle, DOM.titleCharCount, 150);
    updateCharCounter(DOM.formNoteContent, DOM.contentCharCount, null);
    
    DOM.noteFormOverlay.style.display = 'flex';
}

function closeFormModal() {
    DOM.noteFormOverlay.style.display = 'none';
}

function openDeleteConfirmation() {
    if (AppState.selectedNote) DOM.deleteConfirmOverlay.style.display = 'flex';
}

function closeDeleteConfirmation() {
    DOM.deleteConfirmOverlay.style.display = 'none';
}

function showFormError(msg) {
    DOM.formError.textContent = msg;
    DOM.formError.style.display = 'block';
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
        showToast(msg, 'success');
        
    } catch (error) {
        console.error('Błąd:', error);
        showToast('Nie udało się zmienić statusu ulubionej', 'error');
    }
}

async function openShareModal() {
    if (!AppState.selectedNote) return;

    // Sprawdź uprawnienia do edycji (wymagane też do udostępniania)
    if (AppState.selectedNote.canEdit === false) {
        showToast('Tylko autor notatki może zarządzać jej udostępnianiem.', 'warning');
        return;
    }
    
    // Otwórz modal edycji z pre-wypełnionymi danymi
    AppState.isEditMode = true;
    AppState.editingNoteId = AppState.selectedNote.id;
    
    DOM.formTitle.textContent = 'Udostępnij notatkę';
    DOM.formNoteTitle.value = AppState.selectedNote.title;
    DOM.formNoteContent.value = AppState.selectedNote.content;
    DOM.formNoteTags.value = AppState.selectedNote.tags || '';
    DOM.formNoteVisibility.value = AppState.selectedNote.visibility || 'PRIVATE';
    
    // Wyłącz edycję tytułu i treści
    // Wyłącz edycję tytułu, treści i tagów
    DOM.formNoteTitle.disabled = true;
    DOM.formNoteContent.disabled = true;
    DOM.formNoteTags.disabled = true;
    
    // Pokaż sekcję udostępniania jeśli SHARED_WITH_USERS
    handleVisibilityChange();
    
    // Załaduj użytkowników jeśli notatka jest udostępniona
    if (AppState.selectedNote.visibility === 'SHARED_WITH_USERS' && AppState.selectedNote.sharedWithUserIds) {
        AppState.selectedUsers = AppState.selectedNote.sharedWithUserIds.map(id => ({ id }));
        renderSelectedUsers();
    }
    
    DOM.formError.style.display = 'none';
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
        
        showToast('Notatka została skopiowana do Twojej kolekcji', 'success');
        
    } catch (error) {
        console.error('Błąd:', error);
        showToast('Nie udało się skopiować notatki', 'error');
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
                    <strong>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</strong>
                    <br><small>${escapeHtml(user.email)}</small>
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
            <span>${escapeHtml(user.firstName || '')} ${escapeHtml(user.lastName || '')}</span>
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

// NARZĘDZIA I POWIADOMIENIA

function showToast(message, type = 'success') {
    if (!DOM.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 'exclamation-circle';
    
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;

    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function formatDateTime(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('pl-PL', { 
        day: 'numeric', month: 'long', hour: '2-digit', minute:'2-digit' 
    });
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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

// ROZSZERZENIA: PDF I RESIZE

function changeFontSize(delta, targetId) {
    const el = document.getElementById(targetId);
    if (!el) return;

    const currentSize = window.getComputedStyle(el, null).getPropertyValue('font-size');
    const newSize = (parseFloat(currentSize) + delta);

    // Limity
    if (newSize < 10 || newSize > 40) return;

    el.style.fontSize = newSize + 'px';
}

async function exportToPdf() {
    if (!AppState.selectedNote) return;

    const element = document.getElementById('noteContent');
    if (!element) return;

    showToast('Generowanie pliku PDF...', 'info');

    // Sprawdź czy biblioteka jest załadowana
    if (typeof html2pdf === 'undefined') {
        try {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
        } catch (e) {
            showToast('Błąd ładowania biblioteki PDF.', 'error');
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

    // Hack dla stylów (html2pdf używa stylów strony, ale nasze są w CSS)
    // html2pdf radzi sobie ze stylami inline lub stylami w <style>.
    // Spróbujmy wygenerować prosto z kontenera.
    
    html2pdf().set(opt).from(container).save().then(() => {
        showToast('Pobrano plik PDF.', 'success');
    }).catch(err => {
        console.error(err);
        showToast('Błąd generowania PDF.', 'error');
    });
}

async function exportToDocx() {
    if (!AppState.selectedNote) return;

    const element = document.getElementById('noteContent');
    if (!element) return;

    showToast('Generowanie pliku DOCX...', 'info');

    // Sprawdź czy biblioteka jest załadowana
    if (typeof htmlDocx === 'undefined') {
        try {
            // Używamy wersji z unpkg (html-docx-js)
            // Uwaga: html-docx-js udostępnia globalny obiekt 'htmlDocx' lub 'asBlob'
            await loadScript('https://unpkg.com/html-docx-js/dist/html-docx.js');
        } catch (e) {
            console.error(e);
            showToast('Błąd ładowania biblioteki DOCX.', 'error');
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
                    <title>${escapeHtml(title)}</title>
                    <style>
                        body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; }
                        h1 { font-size: 16pt; color: #2e74b5; }
                        h3 { font-size: 13pt; color: #2e74b5; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
                        code { background: #f0f0f0; font-family: 'Courier New', monospace; }
                        a { color: #0563c1; text-decoration: underline; }
                    </style>
                </head>
                <body>
                    <h1>${escapeHtml(title)}</h1>
                    <p style="color: grey; font-size: 9pt;">
                        Autor: ${escapeHtml(getNoteAuthorName(AppState.selectedNote))}<br>
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
        
        showToast('Pobrano plik DOCX.', 'success');

    } catch (error) {
        console.error('DOCX Export Error:', error);
        showToast('Błąd generowania pliku DOCX.', 'error');
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
