/* MODUŁ NOTATKI */

const CONFIG = {
    API: {
        BASE: '/api/notes',
        MY_NOTES: '/api/notes/my-notes',
        NOTE_BY_ID: (id) => `/api/notes/${id}`
    },
    LIMITS: {
        TITLE_MAX: 150,
        CONTENT_MAX: 4000
    },
    TIMING: {
        DEBOUNCE_DELAY: 300,
        TOAST_DURATION: 3000,
        MODAL_TRANSITION: 100
    }
};

const AppState = {
    notes: [],
    filteredNotes: [],
    selectedNote: null,
    currentFilter: 'all',
    searchQuery: '',
    isEditMode: false,
    editingNoteId: null
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
    btnEdit: document.getElementById('btnEdit'),
    btnDelete: document.getElementById('btnDelete'),
    
    // Modal (formularz)
    noteFormOverlay: document.getElementById('noteFormOverlay'),
    formTitle: document.getElementById('formTitle'),
    formNoteTitle: document.getElementById('formNoteTitle'),
    formNoteContent: document.getElementById('formNoteContent'),
    
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
    toastContainer: document.getElementById('toastContainer')
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

    // Akcje formularza
    if (DOM.btnCloseModal) DOM.btnCloseModal.addEventListener('click', closeFormModal);
    if (DOM.btnCancelForm) DOM.btnCancelForm.addEventListener('click', closeFormModal);
    if (DOM.btnSubmitForm) DOM.btnSubmitForm.addEventListener('click', handleFormSubmit);

    // Liczniki
    if (DOM.formNoteTitle) {
        DOM.formNoteTitle.addEventListener('input', () => updateCharCounter(DOM.formNoteTitle, DOM.titleCharCount, 150));
    }
    if (DOM.formNoteContent) {
        DOM.formNoteContent.addEventListener('input', () => updateCharCounter(DOM.formNoteContent, DOM.contentCharCount, 4000));
    }

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
    counterElement.textContent = `${length}/${limit}`;
    counterElement.classList.remove('warning', 'danger');
    if (length >= limit) counterElement.classList.add('danger');
    else if (length >= limit * 0.9) counterElement.classList.add('warning');
}

// ZAPYTANIA API

async function loadNotes() {
    DOM.notesList.innerHTML = '<div class="loading-spinner" style="margin: 20px auto;"></div>';
    
    try {
        const response = await fetch(CONFIG.API.MY_NOTES);
        
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

    if (!title) { showFormError('Wpisz tytuł notatki'); return; }
    if (!content) { showFormError('Wpisz treść notatki'); return; }

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
            const response = await fetch(CONFIG.API.NOTE_BY_ID(AppState.editingNoteId), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(noteData)
            });
            resultNote = await handleResponse(response);

            const idx = AppState.notes.findIndex(n => n.id === resultNote.id);
            if (idx !== -1) AppState.notes[idx] = resultNote;
            
            // Aktualizacja wybranej notatki
            if (AppState.selectedNote?.id === resultNote.id) {
                AppState.selectedNote = resultNote; // Ważne: aktualizuj również selectedNote
                renderNoteView(resultNote);
            }
            showToast('Notatka została pomyślnie zaktualizowana.', 'success');
        } else {
            const response = await fetch(CONFIG.API.BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(noteData)
            });
            resultNote = await handleResponse(response);

            AppState.notes.unshift(resultNote);
            selectNote(resultNote.id);
            
            // Aktualizacja URL po utworzeniu nowej notatki
            updateUrl(resultNote.id);
            
            showToast('Notatka została pomyślnie utworzona.', 'success');
        }

        applyCurrentFilter();
        renderNotesList();
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
        
        el.onclick = () => {
            selectNote(note.id);
            // Zaktualizuj URL przy kliknięciu w notatkę
            updateUrl(note.id);
        };
        
        const date = formatRelativeTime(note.updatedAt || note.createdAt);
        const preview = note.content ? (note.content.substring(0, 60) + (note.content.length > 60 ? '...' : '')) : '';

        el.innerHTML = `
            <h3>${escapeHtml(note.title)}</h3>
            <p>${escapeHtml(preview)}</p>
            <div class="note-card-footer">
                <span>${date}</span>
            </div>
        `;
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
    DOM.noteContent.textContent = note.content; 
    
    if (DOM.noteAuthor) DOM.noteAuthor.textContent = `${note.userFirstName} ${note.userLastName}`;
    if (DOM.noteCreatedAt) DOM.noteCreatedAt.textContent = formatDateTime(note.createdAt);

    // Sprawdź czy notatka była edytowana (updatedAt != null)
    const isEdited = note.updatedAt !== null && note.updatedAt !== undefined;
    if (DOM.noteEditedMeta) DOM.noteEditedMeta.style.display = isEdited ? 'inline-block' : 'none';
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

function handleFilterChange(filter) {
    AppState.currentFilter = filter;
    applyCurrentFilter();
    renderNotesList();
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
    DOM.formTitle.textContent = 'Nowa notatka';
    DOM.formNoteTitle.value = '';
    DOM.formNoteContent.value = '';
    DOM.formError.style.display = 'none';
    
    updateCharCounter(DOM.formNoteTitle, DOM.titleCharCount, 150);
    updateCharCounter(DOM.formNoteContent, DOM.contentCharCount, 4000);
    
    DOM.noteFormOverlay.style.display = 'flex';
    setTimeout(() => DOM.formNoteTitle.focus(), 50);
}

function openEditModal() {
    if (!AppState.selectedNote) return;
    AppState.isEditMode = true;
    AppState.editingNoteId = AppState.selectedNote.id;
    
    DOM.formTitle.textContent = 'Edycja notatki';
    DOM.formNoteTitle.value = AppState.selectedNote.title;
    DOM.formNoteContent.value = AppState.selectedNote.content;
    DOM.formError.style.display = 'none';
    
    updateCharCounter(DOM.formNoteTitle, DOM.titleCharCount, 150);
    updateCharCounter(DOM.formNoteContent, DOM.contentCharCount, 4000);
    
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