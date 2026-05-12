'use strict';

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('marketGrid')) return;
    // ── ZMIENNE GŁÓWNE I STAN ──
    const CURRENT_USER_EMAIL = document.getElementById('userEmail')?.value || ''; // Jeśli masz w layout, w przeciwnym razie mock
    let allAds = [];
    let currentTab = 'all';
    let currentSort = 'newest';
    let pendingContactAuthorId = null;
    let pendingReportAdId = null;

    const CATEGORY_META = {
        BOOKS_NOTES:    { label:'Podręczniki', badge:'badge-books', icon:'' },
        HOUSING:        { label:'Stancje',     badge:'badge-housing', icon:'' },
        TUTORING_HELP:  { label:'Korepetycje', badge:'badge-help', icon:'' },
        ELECTRONICS:    { label:'Elektronika', badge:'badge-tech', icon:'' },
        LOST_FOUND:     { label:'Zguba/Znalezisko', badge:'badge-lost', icon:'' },
        GIVEAWAY:       { label:'Oddam darmo', badge:'badge-free', icon:'' },
        PROJECT_PARTNER:{ label:'Projekt',     badge:'badge-project', icon:'' },
        OTHER:          { label:'Inne',        badge:'badge-other', icon:'' },
    };

    // ── NARZĘDZIA (XSS, CSRF) ──
    function esc(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g,'&amp;')
            .replace(/</g,'&lt;')
            .replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;')
            .replace(/'/g,'&#39;');
    }

    function getCsrfHeaders() {
        const token = document.querySelector('meta[name="_csrf"]')?.content;
        const header = document.querySelector('meta[name="_csrf_header"]')?.content;
        return (token && header) ? { [header]: token } : {};
    }

    function showToast(msg, type = 'success') {
        Utils.showToast(msg, type);
    }

    // ── MODAL ──
    document.querySelectorAll('.market-modal-overlay').forEach(overlay => {
        document.body.appendChild(overlay);
    });

    function openModal(id) {
        const m = document.getElementById(id);
        if (m) {
            m.classList.add('open');
            m.querySelector('[data-close]')?.focus();
        }
    }

    function closeModal(id) {
        document.getElementById(id)?.classList.remove('open');
    }

    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.market-modal-overlay.open').forEach(m => closeModal(m.id));
        }
    });

    // Custom Confirm Modal
    function showConfirmModal(message, isDestructive, onConfirm) {
        const modal = document.getElementById('confirmActionModal');
        const msgEl = document.getElementById('confirmModalMessage');
        const btn = document.getElementById('confirmActionBtn');
        if (!modal || !msgEl || !btn) return;
        
        msgEl.textContent = message;
        
        // Zmiana koloru przycisku w zależności od tego czy akcja jest niszcząca
        if (isDestructive) {
            btn.className = 'market-btn-danger';
            btn.textContent = 'Usuń';
        } else {
            btn.className = 'market-btn-primary';
            btn.textContent = 'Potwierdź';
        }
        
        // Czyste odpięcie starych zdarzeń
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', () => {
            closeModal('confirmActionModal');
            onConfirm();
        });
        
        openModal('confirmActionModal');
    }

    // ── ZMIENNE DO PAGINACJI ──
    let currentPage = 0;
    const pageSize = 12;
    let isLastPage = false;
    let currentStats = { myActiveCount: 0, myAddedToday: 0 };
    let isLoadingMore = false;

    // ── API CALLS ──
    async function fetchAds(page = 0, append = false) {
        try {
            const loader = document.getElementById('pageLoader');
            if (loader && !append) loader.style.display = 'flex';

            const search = document.getElementById('searchInput')?.value || '';
            const cat = document.getElementById('catFilter')?.value || '';
            const cond = document.getElementById('condFilter')?.value || '';
            
            let sortParam = 'createdAt,desc';
            if (currentSort === 'price_asc') sortParam = 'price,asc';
            if (currentSort === 'price_desc') sortParam = 'price,desc';

            let url = `/api/market/offers?page=${page}&size=${pageSize}&sort=${sortParam}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            if (cat) url += `&category=${cat}`;
            if (cond) url += `&condition=${cond}`;

            const res = await fetch(url);
            if (!res.ok) throw new Error('Błąd ładowania ogłoszeń');
            const data = await res.json();
            
            if (data.content) {
                isLastPage = data.last;
                if (append) {
                    allAds = [...allAds, ...data.content];
                    appendNewAds(data.content);
                } else {
                    allAds = data.content;
                    render();
                }
            } else {
                allAds = data;
                isLastPage = true;
                render();
            }
        } catch (error) {
            console.error(error);
            showToast('Nie udało się pobrać ogłoszeń.', 'error');
        } finally {
            const loader = document.getElementById('pageLoader');
            if (loader) loader.style.display = 'none';
        }
    }

    async function fetchFavoriteAds(page = 0, append = false) {
        try {
            const loader = document.getElementById('pageLoader');
            if (loader && !append) loader.style.display = 'flex';

            let url = `/api/market/favorites?page=${page}&size=${pageSize}&sort=createdAt,desc`;

            const res = await fetch(url);
            if (!res.ok) throw new Error('Błąd ładowania ulubionych');
            const data = await res.json();

            if (data.content) {
                isLastPage = data.last;
                if (append) {
                    allAds = [...allAds, ...data.content];
                    appendNewAds(data.content);
                } else {
                    allAds = data.content;
                    render();
                }
            } else {
                allAds = data;
                isLastPage = true;
                render();
            }
        } catch (error) {
            console.error(error);
            showToast('Nie udało się pobrać Twoich ulubionych.', 'error');
        } finally {
            const loader = document.getElementById('pageLoader');
            if (loader) loader.style.display = 'none';
        }
    }

    async function fetchMyAds(page = 0, append = false) {
        try {
            const loader = document.getElementById('pageLoader');
            if (loader && !append) loader.style.display = 'flex';

            const search = document.getElementById('searchInput')?.value || '';
            const cat = document.getElementById('catFilter')?.value || '';
            const cond = document.getElementById('condFilter')?.value || '';

            let sortParam = 'createdAt,desc';
            if (currentSort === 'price_asc') sortParam = 'price,asc';
            if (currentSort === 'price_desc') sortParam = 'price,desc';

            let url = `/api/market/my-offers?page=${page}&size=${pageSize}&sort=${sortParam}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            if (cat) url += `&category=${cat}`;
            if (cond) url += `&condition=${cond}`;

            const res = await fetch(url);
            if (!res.ok) throw new Error('Błąd ładowania Twoich ogłoszeń');
            const data = await res.json();

            if (data.content) {
                isLastPage = data.last;
                if (append) {
                    allAds = [...allAds, ...data.content];
                    appendNewAds(data.content);
                } else {
                    allAds = data.content;
                    render();
                }
            } else {
                allAds = data;
                isLastPage = true;
                render();
            }

            if (loader) loader.style.display = 'none';
        } catch (error) {
            console.error(error);
            showToast('Nie udało się pobrać Twoich ofert.', 'error');
        }
    }

    async function fetchStats() {
        try {
            const res = await fetch('/api/market/stats');
            if (!res.ok) return;
            currentStats = await res.json();
            
            if (document.getElementById('statTotal')) document.getElementById('statTotal').textContent = currentStats.totalActive;
            if (document.getElementById('statMine')) document.getElementById('statMine').textContent = currentStats.myOffers;
            if (document.getElementById('statToday')) document.getElementById('statToday').textContent = currentStats.addedToday;
            if (document.getElementById('statCategories')) document.getElementById('statCategories').textContent = currentStats.categoriesCount;
            
            updateLimitBars();
        } catch (err) {
            console.error('Stats fetch error:', err);
        }
    }

    function updateLimitBars() {
        const activeCountElem = document.getElementById('activeCount');
        const activeFillElem = document.getElementById('activeLimitFill');
        const todayCountElem = document.getElementById('todayCount');
        const todayFillElem = document.getElementById('todayLimitFill');

        if (activeCountElem && activeFillElem) {
            const val = currentStats.myActiveCount || 0;
            activeCountElem.textContent = val;
            const pct = Math.min((val / 5) * 100, 100);
            activeFillElem.style.width = pct + '%';
            if (val >= 5) activeFillElem.className = 'limit-fill full';
            else if (val >= 4) activeFillElem.className = 'limit-fill warn';
            else activeFillElem.className = 'limit-fill';
        }

        if (todayCountElem && todayFillElem) {
            const val = currentStats.myAddedToday || 0;
            todayCountElem.textContent = val;
            const pct = Math.min((val / 3) * 100, 100);
            todayFillElem.style.width = pct + '%';
            if (val >= 3) todayFillElem.className = 'limit-fill full';
            else if (val >= 2) todayFillElem.className = 'limit-fill warn';
            else todayFillElem.className = 'limit-fill';
        }
    }

    // ── RENDER ──
    function getFilteredSorted() {
        // Filtrowanie odbywa się teraz po stronie serwera, 
        // więc zwracamy po prostu allAds.
        return allAds;
    }

    function formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso), now = new Date();
        const diff = now - d;
        const m = Math.floor(diff/60000);
        if (m < 1) return 'przed chwilą';
        if (m < 60) return `${m} min temu`;
        const h = Math.floor(m/60);
        if (h < 24) return `${h} godz. temu`;
        if (h < 48) return 'wczoraj';
        return d.toLocaleDateString('pl-PL', { day:'numeric', month:'short' });
    }

    function renderPriceHtml(ad) {
        if (ad.category === 'GIVEAWAY') return `<span class="price-free">Za darmo</span>`;
        if (ad.category === 'LOST_FOUND' || ad.category === 'PROJECT_PARTNER' || !ad.price) return `<span class="price-contact">Kontakt</span>`;
        return `<span class="card-price">${Number(ad.price).toFixed(2)}&nbsp;zł</span>`;
    }

    function renderConditionTag(cond) {
        if (cond === 'NEW') return `<span class="card-condition"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> Nowe</span>`;
        if (cond === 'USED') return `<span class="card-condition"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> Używane</span>`;
        return '';
    }

    function buildCard(ad) {
        const meta = CATEGORY_META[ad.category] || CATEGORY_META.OTHER;
        const resolved = ad.status === 'RESOLVED';
        const authorNameStr = ad.authorName || '? ?';
        const initials = esc(authorNameStr).split(' ').map(p => p[0]).join('').substring(0,2).toUpperCase();

        let actions = '';
        if (ad.isOwner) {
            actions = `
                ${!resolved ? `<button class="btn-card resolve" data-action="resolve" data-id="${ad.id}" title="Oznacz jako zrealizowane" aria-label="Oznacz jako zrealizowane">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                </button>` : ''}
                <button class="btn-card del" data-action="delete" data-id="${ad.id}" title="Usuń ogłoszenie" aria-label="Usuń ogłoszenie">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>`;
        } else {
            actions = `
                <button class="btn-card report" data-action="report" data-id="${ad.id}" data-title="${esc(ad.title)}" title="Zgłoś naruszenie" aria-label="Zgłoś naruszenie">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                </button>
                <button class="btn-card fav ${ad.isFavorite ? 'active' : ''}" data-action="favorite" data-id="${ad.id}" title="${ad.isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}" aria-label="Ulubione">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="${ad.isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                </button>   
                <button class="btn-card contact" data-action="contact" data-id="${ad.id}" data-author-id="${ad.authorId}" data-author-name="${esc(ad.authorName)}" data-title="${esc(ad.title)}" title="Napisz do autora" aria-label="Napisz do ${esc(ad.authorName)}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>`;
        }

        const ownerBadge = ad.isOwner ? `<span class="owner-badge">Twoje</span>` : '';

        return `
            <article class="market-card${resolved ? ' resolved' : ''}" role="listitem" aria-label="Ogłoszenie: ${esc(ad.title)}" data-id="${ad.id}" style="cursor: pointer;">
                ${resolved ? '<div class="resolved-stamp" aria-hidden="true">ZREALIZOWANE</div>' : ''}
                <div class="card-top">
                    <span class="card-badge ${meta.badge}" aria-label="Kategoria: ${meta.label}">${esc(meta.label)}</span>
                    <time class="card-date" datetime="${esc(ad.createdAt)}">${formatDate(ad.createdAt)}</time>
                </div>
                <div class="card-body">
                    <h3 class="card-title">${esc(ad.title)}</h3>
                    <p class="card-desc">${esc(ad.description)}</p>
                    <div class="card-meta">
                        ${renderConditionTag(ad.condition)}
                        ${renderPriceHtml(ad)}
                    </div>
                </div>
                <div class="card-footer">
                    <div class="card-author">
                        <div class="author-avatar" aria-hidden="true">${initials}</div>
                        <span class="author-name">${esc(ad.authorName)}</span>
                        ${ownerBadge}
                    </div>
                    <div class="card-actions">${actions}</div>
                </div>
            </article>`;
    }

    function render() {
        const ads = getFilteredSorted();
        const grid = document.getElementById('marketGrid');
        const count = document.getElementById('resultsCount');
        if (!grid || !count) return;

        count.innerHTML = `<strong>${ads.length}</strong> ${ads.length === 1 ? 'ogłoszenie' : (ads.length > 1 && ads.length < 5 ? 'ogłoszenia' : 'ogłoszeń')}`;

        if (ads.length === 0) {
            grid.innerHTML = `<div class="empty-state" role="status"><div class="empty-icon" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
                <h3>Brak ogłoszeń</h3><p>Nie znaleziono ogłoszeń spełniających Twoje kryteria.</p></div>`;
        } else {
            grid.innerHTML = ads.map(buildCard).join('');
            updateLoadMoreButton();
        }

        updateLimitBars();
    }

    function updateLoadMoreButton() {
        const grid = document.getElementById('marketGrid');
        // Usuń stary kontener przycisku jeśli istnieje
        const oldBtn = document.getElementById('loadMoreContainer');
        if (oldBtn) oldBtn.remove();

        if (!isLastPage) {
            grid.insertAdjacentHTML('beforeend', `
                <div id="loadMoreContainer" style="grid-column: 1/-1; text-align: center; margin-top: 20px;">
                    <button id="loadMoreBtn" class="market-btn-outline" style="border-radius: 20px; padding: 10px 30px;">Pokaż więcej ogłoszeń</button>
                </div>
            `);
        }
    }

    function appendNewAds(newAds) {
        const grid = document.getElementById('marketGrid');
        if (!grid) return;

        // Usuń stary przycisk przed dodaniem nowych kart
        const oldBtn = document.getElementById('loadMoreContainer');
        if (oldBtn) oldBtn.remove();

        const html = newAds.map(buildCard).join('');
        grid.insertAdjacentHTML('beforeend', html);

        // Dodaj nowy przycisk na końcu
        updateLoadMoreButton();
        
        // Zaktualizuj licznik wyników
        const count = document.getElementById('resultsCount');
        if (count) {
            count.innerHTML = `<strong>${allAds.length}</strong> ${allAds.length === 1 ? 'ogłoszenie' : (allAds.length > 1 && allAds.length < 5 ? 'ogłoszenia' : 'ogłoszeń')}`;
        }
    }

    // ── EVENT DELEGATION (card actions) ──
    const gridEl = document.getElementById('marketGrid');
    if (gridEl) {
        gridEl.addEventListener('click', e => {
            // Obsługa load more
            if (e.target.id === 'loadMoreBtn') {
                currentPage++;
                const btn = e.target;
                btn.disabled = true;
                btn.innerHTML = 'Ładowanie...';
                if (currentTab === 'mine') fetchMyAds(currentPage, true);
                else if (currentTab === 'fav') fetchFavoriteAds(currentPage, true);
                else fetchAds(currentPage, true);
                return;
            }

            const btn = e.target.closest('[data-action]');
            if (!btn) {
                // Jeśli kliknięto kartę, ale nie w żaden konkretny przycisk akcji - pokaż modal ze szczegółami
                const card = e.target.closest('.market-card');
                if (card) {
                    const id = Number(card.dataset.id);
                    openDetailsModal(id);
                }
                return;
            }
            const action = btn.dataset.action;
            const id = Number(btn.dataset.id);

            if (action === 'resolve') {
                showConfirmModal('Oznaczyć to ogłoszenie jako zrealizowane?', false, async () => {
                    try {
                        const res = await fetch(`/api/market/offers/${id}/resolve`, { 
                            method: 'PATCH',
                            headers: getCsrfHeaders()
                        });
                        if (!res.ok) throw new Error('Błąd zmiany statusu');
                        
                        const ad = allAds.find(a => a.id === id);
                        if (ad) ad.status = 'RESOLVED';
                        fetchStats();
                        render();
                        showToast('Ogłoszenie oznaczone jako zrealizowane.');
                    } catch(err) {
                        showToast(err.message, 'error');
                    }
                });
            }
            if (action === 'delete') {
                showConfirmModal('Czy na pewno usunąć to ogłoszenie? Operacja jest nieodwracalna.', true, async () => {
                    try {
                        const res = await fetch(`/api/market/offers/${id}`, { 
                            method: 'DELETE',
                            headers: getCsrfHeaders()
                        });
                        if (!res.ok) throw new Error('Błąd usuwania');
                        
                        allAds = allAds.filter(a => a.id !== id);
                        fetchStats();
                        render();
                        showToast('Ogłoszenie zostało usunięte.', 'success');
                    } catch(err) {
                        showToast(err.message, 'error');
                    }
                });
            }
            if (action === 'contact') {
                const authorId = btn.dataset.authorId;
                const authorName = btn.dataset.authorName;
                const title = btn.dataset.title;
                pendingContactAuthorId = authorId;
                
                const avatarEl = document.getElementById('contactAvatar');
                if (avatarEl) avatarEl.textContent = authorName.split(' ').map(p=>p[0]).join('').substring(0,2).toUpperCase();
                
                const nameEl = document.getElementById('contactName');
                if (nameEl) nameEl.textContent = authorName;
                
                const titleEl = document.getElementById('contactOfferTitle');
                if (titleEl) titleEl.textContent = 'Ogłoszenie: ' + title;
                
                const msgEl = document.getElementById('contactMsg');
                if (msgEl) msgEl.value = `Cześć! Jestem zainteresowany/a Twoim ogłoszeniem "${title}". `;
                
                openModal('contactModal');
            }
            if (action === 'report') {
                e.stopPropagation();
                const adTitle = btn.dataset.title;
                pendingReportAdId = id;
                const titleEl = document.getElementById('reportAdTitle');
                if (titleEl) titleEl.textContent = adTitle;
                document.getElementById('reportReason').value = '';
                document.getElementById('reportDetails').value = '';
                
                const counter = document.getElementById('reportDetailsLen');
                if (counter) counter.textContent = '0';
                
                const msg = document.getElementById('reportFormMsg');
                if (msg) msg.className = 'market-form-message'; // Reset
                
                openModal('reportModal');
            }
            if (action === 'favorite') {
                e.stopPropagation(); // nie otwieraj modala szczegółów
                toggleFav(id, btn);
            }
        });
    }

    async function toggleFav(id, btn) {
        try {
            const res = await fetch(`/api/market/favorites/${id}`, {
                method: 'POST',
                headers: getCsrfHeaders()
            });
            if (!res.ok) throw new Error('Błąd zmiany ulubionych');
            const isFav = await res.json();
            
            // 1. Aktualizacja stanu w źródle prawdy (tablica allAds)
            const ad = allAds.find(a => a.id === id);
            if (ad) ad.isFavorite = isFav;
            
            // 2. Jeśli jesteśmy w zakładce 'fav', a właśnie usunięto z ulubionych - usuwamy z tablicy
            if (currentTab === 'fav' && !isFav) {
                allAds = allAds.filter(a => a.id !== id);
            }
            
            // 3. Renderowanie całego widoku na podstawie nowego stanu
            render();
            
            showToast(isFav ? 'Dodano do ulubionych' : 'Usunięto z ulubionych');
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    // ── MODAL SZCZEGÓŁÓW ──
    function openDetailsModal(id) {
        const ad = allAds.find(a => a.id === id);
        if (!ad) return;

        const meta = CATEGORY_META[ad.category] || CATEGORY_META.OTHER;
        const authorNameStr = ad.authorName || '? ?';
        const initials = esc(authorNameStr).split(' ').map(p => p[0]).join('').substring(0,2).toUpperCase();

        document.getElementById('detailsTitle').textContent = ad.title;
        document.getElementById('detailsDescription').textContent = ad.description;
        document.getElementById('detailsAuthor').textContent = ad.authorName;
        document.getElementById('detailsDate').textContent = formatDate(ad.createdAt);
        document.getElementById('detailsAvatar').textContent = initials;
        
        const profileLink = document.getElementById('detailsProfileLink');
        if (profileLink) {
            profileLink.href = `/profile/user?userId=${ad.authorId}`;
        }
        
        const catBadge = document.getElementById('detailsCategory');
        catBadge.className = 'card-badge ' + meta.badge;
        catBadge.textContent = meta.label;

        const condBadge = document.getElementById('detailsCondition');
        if (ad.condition === 'NEW') {
            condBadge.innerHTML = 'Nowe';
            condBadge.style.display = 'inline-flex';
        } else if (ad.condition === 'USED') {
            condBadge.innerHTML = 'Używane';
            condBadge.style.display = 'inline-flex';
        } else {
            condBadge.style.display = 'none';
        }

        const priceEl = document.getElementById('detailsPrice');
        if (ad.category === 'GIVEAWAY') priceEl.innerHTML = 'Za darmo';
        else if (ad.category === 'LOST_FOUND' || ad.category === 'PROJECT_PARTNER' || !ad.price) priceEl.innerHTML = 'Kontakt';
        else priceEl.innerHTML = Number(ad.price).toFixed(2) + ' zł';

        const contactBtn = document.getElementById('detailsContactBtn');
        if (ad.isOwner) {
            contactBtn.style.display = 'none';
        } else {
            contactBtn.style.display = 'inline-flex';
            contactBtn.onclick = () => {
                closeModal('detailsModal');
                
                pendingContactAuthorId = ad.authorId;
                const avatarEl = document.getElementById('contactAvatar');
                if (avatarEl) avatarEl.textContent = initials;
                
                const nameEl = document.getElementById('contactName');
                if (nameEl) nameEl.textContent = ad.authorName;
                
                const titleEl = document.getElementById('contactOfferTitle');
                if (titleEl) titleEl.textContent = 'Ogłoszenie: ' + ad.title;
                
                const msgEl = document.getElementById('contactMsg');
                if (msgEl) msgEl.value = `Cześć! Jestem zainteresowany/a Twoim ogłoszeniem "${ad.title}". `;
                
                openModal('contactModal');
            };
        }

        openModal('detailsModal');
    }

    // ── REPORT SUBMIT ──
    document.getElementById('submitReportBtn')?.addEventListener('click', async () => {
        const msg = document.getElementById('reportFormMsg');
        if (msg) msg.className = 'market-form-message'; // Reset

        const reason = document.getElementById('reportReason').value;
        const details = document.getElementById('reportDetails').value.trim();
        
        if (!reason) {
            if (msg) {
                msg.className = 'market-form-message error';
                msg.textContent = 'Proszę wybrać powód zgłoszenia.';
            } else {
                showToast('Proszę wybrać powód zgłoszenia.', 'warn');
            }
            return;
        }

        const btn = document.getElementById('submitReportBtn');
        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = 'Wysyłanie...';

        try {
            const res = await fetch(`/api/market/offers/${pendingReportAdId}/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getCsrfHeaders()
                },
                body: JSON.stringify({ reason, details })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || 'Nie udało się wysłać zgłoszenia.');
            }

            if (msg) {
                msg.className = 'market-form-message success';
                msg.textContent = 'Dziękujemy. Zgłoszenie zostało wysłane i zostanie rozpatrzone przez moderatora.';
                setTimeout(() => closeModal('reportModal'), 2000);
            } else {
                showToast('Zgłoszenie zostało wysłane.', 'success');
                closeModal('reportModal');
            }
        } catch (err) {
            if (msg) {
                msg.className = 'market-form-message error';
                msg.textContent = err.message;
            } else {
                showToast(err.message, 'error');
            }
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });

    // ── ROADMAP MODAL ──
    const roadmapBtn = document.getElementById('roadmapBtn');
    if (roadmapBtn) {
        roadmapBtn.addEventListener('click', () => {
            openModal('roadmapModal');
        });
    }

    // ── FILTERS ──
    let filterTimeout = null;
    ['searchInput','catFilter','condFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(id === 'searchInput' ? 'input' : 'change', () => {
            clearTimeout(filterTimeout);
            filterTimeout = setTimeout(() => {
                currentPage = 0;
                if (currentTab === 'mine') fetchMyAds(0, false);
                else fetchAds(0, false);
            }, id === 'searchInput' ? 400 : 0);
        });
    });

    // ── TABS ──
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => { 
                b.classList.remove('active'); 
                b.setAttribute('aria-selected','false'); 
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected','true');
            currentTab = btn.dataset.tab;
            
            const banner = document.getElementById('myAdsBanner');
                        if (banner) banner.style.display = currentTab === 'mine' ? 'flex' : 'none';
            
            currentPage = 0; // reset paginacji po zmianie zakładki
            if (currentTab === 'mine') {
                fetchMyAds(0, false);
            } else if (currentTab === 'fav') {
                fetchFavoriteAds(0, false);
            } else {
                fetchAds(0, false);
            }
        });
    });

    // ── SORT ──
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSort = btn.dataset.sort;
            currentPage = 0; // po zmianie sortowania też ładujemy od nowa, żeby uniknąć niespójności
            if (currentTab === 'mine') fetchMyAds(0, false);
            else fetchAds(0, false);
        });
    });

    // ── ADD AD MODAL ──
    const addAdBtn = document.getElementById('addOfferBtn');
    if (addAdBtn) {
        addAdBtn.addEventListener('click', () => {
            document.getElementById('addOfferForm')?.reset();
            if (document.getElementById('titleLen')) document.getElementById('titleLen').textContent = '0';
            if (document.getElementById('descLen')) document.getElementById('descLen').textContent = '0';
            const formMsg = document.getElementById('addFormMsg');
            if (formMsg) formMsg.className = 'market-form-message';
            openModal('addModal');
        });
    }

    document.getElementById('formTitle')?.addEventListener('input', function() {
        document.getElementById('titleLen').textContent = this.value.length;
    });
    document.getElementById('formDescription')?.addEventListener('input', function() {
        document.getElementById('descLen').textContent = this.value.length;
    });
    document.getElementById('reportDetails')?.addEventListener('input', function() {
        const el = document.getElementById('reportDetailsLen');
        if (el) el.textContent = this.value.length;
    });

    const noPriceCategories = new Set(['GIVEAWAY','LOST_FOUND','PROJECT_PARTNER']);
    const noConditionCategories = new Set(['HOUSING','TUTORING_HELP','LOST_FOUND','PROJECT_PARTNER']);
    
    document.getElementById('formCategory')?.addEventListener('change', function() {
        const pg = document.getElementById('priceGroup');
        const pi = document.getElementById('formPrice');
        const label = pg?.querySelector('.market-form-label');
        if (!pg || !pi || !label) return;
        
        const hide = noPriceCategories.has(this.value);
        pg.style.opacity = hide ? '0.4' : '1';
        pi.disabled = hide;
        if (hide) {
            pi.value = '';
            label.innerHTML = 'Cena (zł)';
        } else {
            label.innerHTML = 'Cena (zł) <span>*</span>';
        }

        // Logic for Condition
        const condGroup = document.getElementById('formCondition')?.closest('.market-form-group');
        const condSelect = document.getElementById('formCondition');
        if (condGroup && condSelect) {
            const noCond = noConditionCategories.has(this.value);
            condGroup.style.display = noCond ? 'none' : 'block';
            if (noCond) condSelect.value = 'NOT_APPLICABLE';
            else if (condSelect.value === 'NOT_APPLICABLE') condSelect.value = 'USED';
        }
    });

    document.getElementById('submitOfferBtn')?.addEventListener('click', async (e) => {
        e.preventDefault(); // Zatrzymaj klasyczny submit
        const form = document.getElementById('addOfferForm');
        if (!form || !form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const msg = document.getElementById('addFormMsg');
        const title = document.getElementById('formTitle').value.trim();
        const category = document.getElementById('formCategory').value;
        const condition = document.getElementById('formCondition').value;
        const priceRaw = document.getElementById('formPrice').value;
        const description = document.getElementById('formDescription').value.trim();

        // Dodatkowa walidacja klienta
        if (title.length < 5) { msg.className='market-form-message error'; msg.textContent='Tytuł musi mieć co najmniej 5 znaków.'; return; }
        if (!category) { msg.className='market-form-message error'; msg.textContent='Wybierz kategorię.'; return; }
        if (description.length < 20) { msg.className='market-form-message error'; msg.textContent='Opis musi mieć co najmniej 20 znaków.'; return; }
        const price = priceRaw ? parseFloat(priceRaw) : null;
        if (!noPriceCategories.has(category) && (price === null || isNaN(price))) {
            msg.className = 'market-form-message error';
            msg.textContent = 'Proszę podać prawidłową cenę dla tej kategorii.';
            document.getElementById('formPrice').focus();
            return;
        }
        if (price !== null && (isNaN(price) || price < 0)) { msg.className='market-form-message error'; msg.textContent='Podaj prawidłową cenę.'; return; }

        const btn = document.getElementById('submitOfferBtn');
        btn.disabled = true;
        btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></path></svg> Publikowanie...';

        const data = { title, category, condition, price, description };

        try {
            const res = await fetch('/api/market/offers', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...getCsrfHeaders()
                },
                body: JSON.stringify(data)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Wystąpił błąd przy dodawaniu ogłoszenia.');
            }

            const newAd = await res.json();
            allAds.unshift(newAd);
            closeModal('addModal');
            fetchStats();
            render();
        } catch (error) {
            msg.className='market-form-message error';
            msg.textContent = error.message;
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg> Opublikuj ogłoszenie';
        }
    });

    // ── CONTACT SEND ──
    document.getElementById('sendContactBtn')?.addEventListener('click', async () => {
        const msgTxt = document.getElementById('contactMsg').value.trim();
        const msgEl = document.getElementById('contactFormMsg');
        
        if (!msgTxt) { 
            if (msgEl) {
                msgEl.className = 'market-form-message error';
                msgEl.textContent = 'Napisz wiadomość przed wysłaniem.';
            } else {
                showToast('Napisz wiadomość przed wysłaniem.', 'warn'); 
            }
            return; 
        }
        
        const btn = document.getElementById('sendContactBtn');
        btn.disabled = true;
        
        // Integracja z panelem Czat
        const adTitle = document.getElementById('contactOfferTitle').textContent.replace('Ogłoszenie: ', '');
        window.location.href = `/student/chat?userId=${pendingContactAuthorId}&subject=${encodeURIComponent('Ogłoszenie: ' + adTitle)}&message=${encodeURIComponent(msgTxt)}`;
        
        // Zamykamy modal (strona i tak się przeładuje, ale dla bezpieczeństwa)
        closeModal('contactModal');
        btn.disabled = false;
    });

    // Wczytaj dane początkowe
    fetchStats();
    fetchAds(0, false).then(() => {
        // Sprawdź czy w URL jest adId (przydatne dla linków z panelu admina)
        const urlParams = new URLSearchParams(window.location.search);
        const adIdParam = urlParams.get('adId');
        if (adIdParam) {
            const adId = Number(adIdParam);
            // Jeśli ogłoszenie jest już w allAds, otwórz modal
            const ad = allAds.find(a => a.id === adId);
            if (ad) {
                openDetailsModal(adId);
            } else {
                // Jeśli nie ma go w pierwszej stronie, pobierzemy je osobno (opcjonalnie)
                // Na razie szukamy tylko w pobranych
                console.log('Ad not found in current view:', adId);
            }
        }
    });
});
