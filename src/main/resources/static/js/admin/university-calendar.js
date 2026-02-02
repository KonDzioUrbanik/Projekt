document.addEventListener('DOMContentLoaded', function() {
    loadEvents();
    setupManagementButtons();
});

// Konfiguracja przycisków panelu
function setupManagementButtons() {
    // Guard against multiple executions to prevent duplicate listeners
    if (window.UNIVERSITY_CALENDAR_LOADED) return;
    window.UNIVERSITY_CALENDAR_LOADED = true;

    const addEventBtn = document.getElementById('btnAddEvent');
    const exportPdfBtn = document.getElementById('btnExportPdf');
    // const editYearBtn = document.getElementById('btnEditYear'); // Removed

    const modal = document.getElementById('addEventModal');
    const closeBtn = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const eventForm = document.getElementById('eventForm');
    const deleteBtn = document.getElementById('deleteEventBtn');
    const modalTitle = document.getElementById('modalTitle');

    // Helper function for color picker visibility
    function toggleColorPicker() {
        const type = document.getElementById('event-type').value;
        const pickerContainer = document.getElementById('color-picker-container');
        if (pickerContainer) {
            pickerContainer.style.display = (type === 'OTHER') ? 'block' : 'none';
        }
    }

    // Close modal function
    const closeModal = () => {
        modal.style.display = 'none';
        eventForm.reset(); 
        delete eventForm.dataset.eventId; // Clear ID on close
        toggleColorPicker();
    };

    // Event listeners for closing modal
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    window.addEventListener('click', function(event) {
        if (event.target == modal) {
            closeModal();
        }
    });

    // Event listener for event type change
    const eventTypeSelect = document.getElementById('event-type');
    if (eventTypeSelect) {
        eventTypeSelect.addEventListener('change', toggleColorPicker);
    }

    // 1. Otwieranie modalu w trybie DODAWANIA
    if (addEventBtn && modal) {
        addEventBtn.addEventListener('click', () => {
            openModal(); // Default: add mode
            toggleColorPicker();
        });
    }

    // Obsługa Eksport PDF
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', () => {
             window.print();
        });
    }

    // Funkcja otwierająca modal
    if (modal) {
        window.openModal = function(eventData = null) {
            modal.style.display = 'flex';
            
            if (eventData) {
                modalTitle.textContent = 'Edytuj wydarzenie';
                
                eventForm.dataset.eventId = eventData.id;
                
                document.getElementById('eventTitle').value = eventData.title;
                document.getElementById('eventDateFrom').value = eventData.dateFrom;
                document.getElementById('eventDateTo').value = eventData.dateTo;
                document.getElementById('event-type').value = eventData.type;
                
                if (eventData.type === 'OTHER') {
                    document.getElementById('color-picker-container').style.display = 'block';
                    document.getElementById('event-color-picker').value = eventData.markerColor || '#3b82f6';
                } else {
                    document.getElementById('color-picker-container').style.display = 'none';
                }

                if (deleteBtn) deleteBtn.style.display = 'block';
            } 
            else {
                modalTitle.textContent = 'Dodaj wydarzenie';
                eventForm.reset();
                
                delete eventForm.dataset.eventId;
                
                document.getElementById('color-picker-container').style.display = 'none';
                if (deleteBtn) deleteBtn.style.display = 'none'; // Hide delete btn
            }
        };

        // Obsługa formularza
        if (eventForm) {
            eventForm.addEventListener('submit', function(e) {
                e.preventDefault();
                
                // Read ID from DOM
                const id = eventForm.dataset.eventId;
                console.log("Submitting form. ID found in dataset:", id); 

                const typeSelectval = document.getElementById('event-type').value;
                let markerColor = null;
                if (typeSelectval === 'OTHER') {
                    markerColor = document.getElementById('event-color-picker').value;
                }

                const formData = {
                    title: document.getElementById('eventTitle').value,
                    dateFrom: document.getElementById('eventDateFrom').value,
                    dateTo: document.getElementById('eventDateTo').value,
                    type: typeSelectval,
                    markerColor: markerColor
                };

                const url = id ? `/api/calendar/${id}` : '/api/calendar';
                const method = id ? 'PUT' : 'POST';

                fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                })
                .then(response => {
                    if (response.ok) return response.json();
                    throw new Error('Network response was not ok');
                })
                .then(() => {
                    closeModal();
                    loadEvents(); // Reload all
                })
                .catch(error => console.error('Error:', error));
            });
        }
    } 
    else {
        window.openModal = function() { console.warn("Modal not available"); };
    }

    // Obsługa Usuwania
    if (deleteBtn && eventForm) {
        deleteBtn.addEventListener('click', () => {
            const id = eventForm.dataset.eventId;
            
            if (id && confirm('Czy na pewno chcesz usunąć to wydarzenie?')) {
                fetch(`/api/calendar/${id}`, {
                    method: 'DELETE'
                })
                .then(response => {
                    if (response.ok) {
                        closeModal();
                        loadEvents();
                    } else {
                        alert('Błąd podczas usuwania.');
                    }
                })
                .catch(console.error);
            }
        });
    }
}

// Pobieranie i przetwarzanie danych
function loadEvents() {
    fetch('/api/calendar')
        .then(response => response.json())
        .then(events => {
            renderReviewLists(events);
            try {
                applyCalendarMarkers(events);
            } catch (e) {
                console.error("Error applying markers:", e);
            }
            highlightCurrentDay();
        })
        .catch(console.error);
}

// Helper do kolorów
function getEventColorClass(type, title) {
    if (type === 'HOLIDAY') return 'red'; // Czerwony
    if (type === 'EXAM') return 'blue'; // Niebieski
    if (type === 'SCHEDULE_CHANGE') return 'green'; // Zielony
    
    if (type === 'BREAK') {
        const lowerTitle = title ? title.toLowerCase() : '';
        // Przerwa świąteczna -> Czerwony
        if (lowerTitle.includes('świąteczna')) return 'red';
        // Inne przerwy (wakacje, międzysemestralna) -> Fioletowy
        return 'purple';
    }
    return ''; // Domyślny (czarny/szary)
}

// Renderowanie listy wydarzeń (prawa/lewa strona - semestry)
function renderReviewLists(events) {
    const winterList = document.getElementById('winterReviewList');
    const summerList = document.getElementById('summerReviewList');

    if (winterList) winterList.innerHTML = '';
    if (summerList) summerList.innerHTML = '';

    events.forEach(event => {
        // Logika przypisania do semestru (Luty 23 pivot)
        const d = new Date(event.dateFrom);
        const month = d.getMonth() + 1;
        const day = d.getDate();
        
        let isSummer = (month > 2 && month < 10) || (month === 2 && day >= 23);
        const targetList = isSummer ? summerList : winterList;
        
        if (targetList) {
            const li = document.createElement('li');
            li.className = 'event-item';
            
            // Kolor tekstu
            const markerColor = event.markerColor;
            let descClass = 'event-desc';
            let styleAttr = '';

            // Sprawdzamy czy to hex (zaczyna się od #) czy nazwa klasy
            if (markerColor && markerColor.startsWith('#')) {
                styleAttr = `style="color: ${markerColor} !important;"`;
            } else {
                const colorCode = getEventColorClass(event.type, event.title);
                if (colorCode) {
                    descClass += ` text-${colorCode}`;
                }
            }

            li.innerHTML = `
                <span class="event-dates">${event.formattedDateRange}</span>
                <span class="${descClass}" ${styleAttr}>${event.title}</span>
            `;
            
            // Add click listener for Edit
            if (document.getElementById('addEventModal')) { // check if admin
                 li.style.cursor = 'pointer';
                 li.addEventListener('click', () => {
                     openModal(event);
                 });
            }

            targetList.appendChild(li);
        }
    });
}

// Nakładanie kolorowych kółek na tabelę
function applyCalendarMarkers(events) {
    // Mapa: 'YYYY-MM-DD' -> { color: '...', title: '...' }
    const dateDataMap = new Map();

    events.forEach(event => {
        const colorClass = event.markerColor || getEventColorClass(event.type, event.title);
        if (!colorClass) return; // Ignorujemy standardowe dydaktyczne

        // Ekspansja zakresu dat na pojedyncze dni
        let current = new Date(event.dateFrom);
        const end = new Date(event.dateTo);
        
        while (current <= end) {
            const dateStr = current.toISOString().split('T')[0];
            // Nadpisujemy
            const isHex = (event.markerColor && event.markerColor.startsWith('#'));
            dateDataMap.set(dateStr, {
                color: isHex ? '' : (event.markerColor || getEventColorClass(event.type, event.title)),
                hexColor: isHex ? event.markerColor : null,
                title: event.title,
                originalEvent: event
            });
            current.setDate(current.getDate() + 1);
        }
    });

    // 2. Iteracja po HTML i malowanie
    const monthCards = document.querySelectorAll('.month-card');
    const isAdmin = !!document.getElementById('addEventModal'); // Check ONCE
    
    const monthsPL = {
        'Styczeń': 0, 'Luty': 1, 'Marzec': 2, 'Kwiecień': 3, 'Maj': 4, 'Czerwiec': 5,
        'Lipiec': 6, 'Sierpień': 7, 'Wrzesień': 8, 'Październik': 9, 'Listopad': 10, 'Grudzień': 11
    };

    monthCards.forEach(card => {
        const headerText = card.querySelector('.month-header').innerText.trim(); 
        const parts = headerText.split(' ');
        const monthName = parts[0];
        let year = parseInt(parts[1]); // e.g. "Październik 2025" -> 2025
        if (isNaN(year) && parts.length > 2) year = parseInt(parts[2]); // "Luty 2026 (Zima)" -> 2026

        if (!monthsPL.hasOwnProperty(monthName)) return;
        
        const monthIndex = monthsPL[monthName];
        const cells = card.querySelectorAll('td');

        cells.forEach(cell => {
            const dayText = cell.innerText.trim();
            if (!dayText || isNaN(dayText)) return;
            
            const day = parseInt(dayText);
            const cellDate = new Date(year, monthIndex, day);
            const yearStr = cellDate.getFullYear();
            const monthStr = String(cellDate.getMonth() + 1).padStart(2, '0');
            const dayStr = String(cellDate.getDate()).padStart(2, '0');
            const dateKey = `${yearStr}-${monthStr}-${dayStr}`;

            cell.innerHTML = day; 
            cell.removeAttribute('style');

            if (dateDataMap.has(dateKey)) {
                const data = dateDataMap.get(dateKey);
                
                let style = '';
                const cursorStyle = isAdmin ? 'cursor: pointer;' : '';

                if (data.hexColor) {
                    style = `style="background-color: ${data.hexColor}; color: white; ${cursorStyle}"`;
                } else {
                    style = `style="${cursorStyle}"`;
                }

                cell.innerHTML = `<span class="day-marker ${data.color}" ${style} title="${data.title}">${day}</span>`;
                
                // Add click listener
                if (isAdmin) {
                    const marker = cell.querySelector('.day-marker');
                    if (marker) {
                        marker.addEventListener('click', () => {
                            openModal(data.originalEvent);
                        });
                    }
                }
            }
        });
    });
}

function highlightCurrentDay() {
    const wrapper = document.querySelector('.calendar-wrapper');
    const serverDateStr = wrapper ? wrapper.dataset.serverDate : null;

    if (serverDateStr) {
        // serverDateStr format: 'YYYY-MM-DD'
        const parts = serverDateStr.split('-');
        const currentYear = parseInt(parts[0]);
        const currentMonth = parseInt(parts[1]) - 1; // 0-indexed for MonthsPL array
        const currentDay = parseInt(parts[2]);

        const monthCards = document.querySelectorAll('.month-card');
        const monthsPL = {
            'Styczeń': 0, 'Luty': 1, 'Marzec': 2, 'Kwiecień': 3, 'Maj': 4, 'Czerwiec': 5,
            'Lipiec': 6, 'Sierpień': 7, 'Wrzesień': 8, 'Październik': 9, 'Listopad': 10, 'Grudzień': 11
        };

        monthCards.forEach(card => {
            const headerText = card.querySelector('.month-header').innerText.trim(); 
            const headerParts = headerText.split(' ');
            const monthName = headerParts[0];
            let year = parseInt(headerParts[1]);
            if (isNaN(year) && headerParts.length > 2) year = parseInt(headerParts[2]);

            if (monthsPL[monthName] === currentMonth && year === currentYear) {
                // Determine which cell is "currentDay"
                const cells = card.querySelectorAll('td');
                cells.forEach(cell => {
                    const dayText = cell.innerText.trim();
                    if (dayText && parseInt(dayText) === currentDay) {
                        cell.classList.add('today-highlight');
                    }
                });
            }
        });
    }
}
// Helper to attach event to map needed in previous step

