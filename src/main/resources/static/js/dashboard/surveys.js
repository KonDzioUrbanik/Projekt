(function () {
    'use strict';

    const Survey = {
        state: {
            role: '',
            canCreate: false,
            surveys: [],
            selectedSurveyId: null,
            currentSurvey: null,
            groups: [],
            search: '',
            activeView: 'browse',
            liveTimerId: null,
            feedInFlight: false,
            detailInFlight: false,
            liveIntervalMs: 4000,
            lastFeedSignature: '',
            lastDetailSignature: '',
            pendingAction: null
        },

        els: {
            module: document.getElementById('surveyModule'),
            browseBtn: document.getElementById('surveyBrowseViewBtn'),
            createBtn: document.getElementById('surveyCreateViewBtn'),
            browseSection: document.getElementById('surveyBrowseSection'),
            createSection: document.getElementById('surveyCreateSection'),
            list: document.getElementById('surveyList'),
            detail: document.getElementById('surveyDetail'),
            search: document.getElementById('surveySearchInput'),
            resultsCount: document.getElementById('surveyResultsCount'),
            createForm: document.getElementById('surveyCreateForm'),
            title: document.getElementById('surveyTitle'),
            description: document.getElementById('surveyDescription'),
            endsAt: document.getElementById('surveyEndsAt'),
            optionsContainer: document.getElementById('surveyOptionsContainer'),
            addOptionBtn: document.getElementById('surveyAddOptionBtn'),
            createCancelBtn: document.getElementById('surveyCreateCancelBtn'),
            adminScope: document.getElementById('surveyAdminScope'),
            globalScope: document.getElementById('surveyGlobalScope'),
            targetGroupWrap: document.getElementById('surveyTargetGroupWrap'),
            targetGroup: document.getElementById('surveyTargetGroup'),
            deleteModal: document.getElementById('surveyDeleteModal'),
            deleteModalText: document.getElementById('surveyDeleteModalText'),
            deleteCancelBtn: document.getElementById('surveyDeleteCancelBtn'),
            deleteConfirmBtn: document.getElementById('surveyDeleteConfirmBtn'),
            extendModal: document.getElementById('surveyExtendModal'),
            extendModalText: document.getElementById('surveyExtendModalText'),
            extendNewEndsAt: document.getElementById('surveyNewEndsAt'),
            extendCancelBtn: document.getElementById('surveyExtendCancelBtn'),
            extendConfirmBtn: document.getElementById('surveyExtendConfirmBtn')
        },

        init() {
            if (!this.els.module || !this.els.list || !this.els.detail) return;

            this.state.role = String(this.els.module.dataset.role || '').toUpperCase().replace('ROLE_', '');
            this.state.canCreate = this.state.role === 'STAROSTA' || this.state.role === 'ADMIN';

            if (this.state.canCreate) {
                this.els.createBtn.style.display = 'inline-flex';
            }
            if (this.state.role === 'ADMIN' && this.els.adminScope) {
                this.els.adminScope.style.display = 'block';
            }

            this.attachListeners();
            this.bootstrap();
        },

        async bootstrap() {
            this.ensureOptionRows(2);
            this.setupDateTimeInputs();

            if (this.state.role === 'ADMIN') {
                await this.loadGroups();
            }

            await this.loadSurveys();
            this.startLiveUpdates();
        },

        attachListeners() {
            this.els.browseBtn?.addEventListener('click', () => this.setView('browse'));
            this.els.createBtn?.addEventListener('click', () => this.setView('create'));
            this.els.createCancelBtn?.addEventListener('click', () => this.setView('browse'));

            this.els.search?.addEventListener('input', Utils.debounce((event) => {
                this.state.search = (event.target.value || '').trim().toLowerCase();
                this.syncSelectionWithFilter();
                this.renderList();
                this.renderDetailFallbackIfNeeded();
            }, 200));

            this.els.addOptionBtn?.addEventListener('click', () => this.addOptionRow(''));

            this.els.globalScope?.addEventListener('change', () => {
                const isGlobal = !!this.els.globalScope.checked;
                if (this.els.targetGroupWrap) {
                    this.els.targetGroupWrap.style.display = isGlobal ? 'none' : 'block';
                }
            });

            this.els.createForm?.addEventListener('submit', (event) => this.createSurvey(event));

            // Modal delete
            this.els.deleteCancelBtn?.addEventListener('click', () => this.closeDeleteModal());
            this.els.deleteConfirmBtn?.addEventListener('click', () => this.confirmDelete());
            this.els.deleteModal?.addEventListener('click', (event) => {
                if (event.target === this.els.deleteModal) this.closeDeleteModal();
            });

            // Modal extend
            this.els.extendCancelBtn?.addEventListener('click', () => this.closeExtendModal());
            this.els.extendConfirmBtn?.addEventListener('click', () => this.confirmExtend());
            this.els.extendModal?.addEventListener('click', (event) => {
                if (event.target === this.els.extendModal) this.closeExtendModal();
            });

            // Keyboard shortcuts
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    this.closeDeleteModal();
                    this.closeExtendModal();
                }
            });

            document.addEventListener('visibilitychange', () => {
                if (document.hidden) return;
                this.pollFeed();
                this.pollSelectedDetail();
            });

            window.addEventListener('beforeunload', () => this.stopLiveUpdates());
            window.addEventListener('pagehide', () => this.stopLiveUpdates());
        },

        setView(view) {
            this.state.activeView = view;
            const isBrowse = view === 'browse';
            this.els.browseSection?.classList.toggle('survey-hidden', !isBrowse);
            this.els.createSection?.classList.toggle('survey-hidden', isBrowse);
            this.els.browseBtn?.classList.toggle('active', isBrowse);
            this.els.createBtn?.classList.toggle('active', !isBrowse);
        },

        async loadGroups() {
            try {
                const response = await fetch('/api/groups');
                if (!response.ok) throw new Error('Nie udało się pobrać grup.');
                this.state.groups = await response.json();

                if (!this.els.targetGroup) return;
                this.els.targetGroup.innerHTML = '<option value="">Wybierz grupę</option>';
                this.state.groups.forEach((group) => {
                    const option = document.createElement('option');
                    option.value = String(group.id);
                    option.textContent = group.name;
                    this.els.targetGroup.appendChild(option);
                });
            } catch (err) {
                this.showError(err.message || 'Nie udało się pobrać grup.');
            }
        },

        async loadSurveys() {
            try {
                const response = await fetch('/api/surveys', { cache: 'no-store' });
                if (!response.ok) throw new Error(await this.readError(response));

                const data = await response.json();
                this.state.surveys = Array.isArray(data) ? data : [];
                this.state.lastFeedSignature = this.buildFeedSignature(this.state.surveys);

                this.syncSelectionWithFilter();
                this.renderList();
                await this.renderSelectedDetail();
            } catch (err) {
                this.els.list.innerHTML = this.emptyHtml('Nie udało się załadować ankiet.');
                this.els.detail.innerHTML = this.emptyHtml('Brak szczegółów ankiety.');
                this.showError(err.message || 'Błąd ładowania ankiet.');
            }
        },

        getFilteredSurveys() {
            if (!this.state.search) return this.state.surveys;
            return this.state.surveys.filter((survey) => String(survey.title || '').toLowerCase().includes(this.state.search));
        },

        syncSelectionWithFilter() {
            const visible = this.getFilteredSurveys();
            if (!visible.length) {
                this.state.selectedSurveyId = null;
                return;
            }

            const stillVisible = visible.some((survey) => survey.id === this.state.selectedSurveyId);
            if (!stillVisible) {
                this.state.selectedSurveyId = visible[0].id;
            }
        },

        renderList() {
            const visible = this.getFilteredSurveys();
            this.els.resultsCount.textContent = `${visible.length} wyników`;

            if (!visible.length) {
                this.els.list.innerHTML = this.emptyHtml(this.state.search
                    ? 'Brak ankiet dla podanej frazy.'
                    : 'Brak ankiet w Twoim zakresie.');
                return;
            }

            this.els.list.innerHTML = visible.map((survey) => {
                const active = survey.id === this.state.selectedSurveyId ? 'active' : '';
                const statusBadge = !survey.active 
                    ? '<span class="survey-badge closed"><i class="fas fa-lock"></i> Zamknięta</span>' 
                    : (survey.expired 
                        ? '<span class="survey-badge closed"><i class="fas fa-hourglass-end"></i> Wygasła</span>' 
                        : '<span class="survey-badge active"><i class="fas fa-check-circle"></i> Aktywna</span>');
                
                const scopeBadge = survey.globalScope 
                    ? '<span class="survey-badge scope"><i class="fas fa-globe"></i> Globalna</span>'
                    : '';

                return `
                    <article class="survey-list-item ${active}" data-survey-id="${survey.id}">
                        <h4 class="survey-item-title">${Utils.escapeHtml(survey.title || '')}</h4>
                        <div class="survey-item-meta" style="margin-top: 0.5rem;">
                            ${statusBadge} ${scopeBadge}
                        </div>
                        <div class="survey-item-meta" style="margin-top: 0.35rem;">
                            <span><i class="fas fa-poll-h"></i> ${Number(survey.totalVotes || 0)} głosów</span>
                            <span><i class="fas fa-layer-group"></i> ${Utils.escapeHtml(survey.targetGroupName || '-')}</span>
                        </div>
                    </article>
                `;
            }).join('');

            this.els.list.querySelectorAll('[data-survey-id]').forEach((item) => {
                item.addEventListener('click', async () => {
                    this.state.selectedSurveyId = Number(item.dataset.surveyId);
                    this.renderList();
                    await this.renderSelectedDetail();
                });
            });
        },

        async renderSelectedDetail() {
            if (!this.state.selectedSurveyId) {
                this.state.currentSurvey = null;
                this.state.lastDetailSignature = '';
                this.els.detail.classList.add('survey-detail-empty');
                this.els.detail.innerHTML = this.emptyHtml('Wybierz ankietę z listy.');
                return;
            }

            try {
                const survey = await this.fetchSurvey(this.state.selectedSurveyId);
                this.state.currentSurvey = survey;
                this.state.lastDetailSignature = this.buildDetailSignature(survey);
                this.renderDetail(survey);
            } catch (err) {
                this.els.detail.classList.add('survey-detail-empty');
                this.els.detail.innerHTML = this.emptyHtml('Nie udało się pobrać szczegółów ankiety.');
                this.showError(err.message || 'Błąd pobierania ankiety.');
            }
        },

        renderDetailFallbackIfNeeded() {
            const visible = this.getFilteredSurveys();
            if (this.state.selectedSurveyId && visible.some((survey) => survey.id === this.state.selectedSurveyId)) {
                return;
            }
            this.els.detail.classList.add('survey-detail-empty');
            this.els.detail.innerHTML = this.emptyHtml('Wybierz ankietę z listy.');
        },

        renderDetail(survey) {
            const canManage = !!survey.canManage;
            const options = (survey.options || []).map((option) => {
                const selectedClass = option.selectedByCurrentUser ? 'selected' : '';
                const voteButton = survey.canVote
                    ? `<button class="survey-btn primary" data-vote-option-id="${option.id}" type="button">Głosuj</button>`
                    : '';

                return `
                    <div class="survey-option-card ${selectedClass}">
                        <div class="survey-option-top">
                            <span class="survey-option-text">${Utils.escapeHtml(option.text || '')}</span>
                            <span class="survey-option-stats">${option.percentage}% (${option.votes})</span>
                        </div>
                        <div class="survey-progress">
                            <div class="survey-progress-fill" style="width: ${Math.max(0, Math.min(100, Number(option.percentage || 0)))}%;"></div>
                        </div>
                        <div class="survey-option-actions">${voteButton}</div>
                    </div>
                `;
            }).join('');

            const statusBadge = !survey.active 
                ? '<span class="survey-badge closed"><i class="fas fa-lock"></i> Zamknięta</span>' 
                : (survey.expired 
                    ? '<span class="survey-badge closed"><i class="fas fa-hourglass-end"></i> Wygasła</span>' 
                    : '<span class="survey-badge active"><i class="fas fa-check-circle"></i> Aktywna</span>');
            
            const scopeBadge = survey.globalScope 
                ? '<span class="survey-badge scope"><i class="fas fa-globe"></i> Globalna</span>'
                : '<span class="survey-badge scope"><i class="fas fa-users"></i> ' + Utils.escapeHtml(survey.targetGroupName || 'Grupa') + '</span>';

            const createdAt = this.formatDate(survey.createdAt);
            const endsAt = survey.endsAt ? this.formatDate(survey.endsAt) : 'bez terminu';
            const authorName = this.authorName(survey);

            let extendButton = '';
            if (canManage && survey.expired) {
                extendButton = '<button class="survey-btn ghost" id="surveyExtendBtn" type="button" style="margin-left: 0.45rem;"><i class="fas fa-hourglass-end"></i> Przedłuż</button>';
            }

            let managePrimaryButton = '';
            if (canManage) {
                if (survey.expired) {
                    managePrimaryButton = '<button class="survey-btn ghost" id="surveyExpiredInfoBtn" type="button" disabled title="Ankieta wygasła czasowo - możesz ją przedłużyć.">Wygasła czasowo</button>';
                } else {
                    managePrimaryButton = `
                        <button class="survey-btn ghost" id="surveyToggleStatusBtn" type="button">
                            ${survey.active ? 'Zamknij ankietę' : 'Wznów ankietę'}
                        </button>
                    `;
                }
            }

            const manageControls = canManage
                ? `
                    <div class="survey-toolbar">
                        <div>
                            ${managePrimaryButton}
                            ${extendButton}
                            <button class="survey-btn danger" id="surveyDeleteBtn" type="button" style="margin-left: 0.45rem;">Usuń ankietę</button>
                        </div>
                    </div>
                `
                : '';

            this.els.detail.classList.remove('survey-detail-empty');
            this.els.detail.innerHTML = `
                <div class="survey-detail">
                    <header class="survey-detail-head">
                        <h2 class="survey-detail-title">${Utils.escapeHtml(survey.title || '')}</h2>
                        <div class="survey-detail-meta">
                            <span class="survey-badge author"><i class="fas fa-user"></i> ${Utils.escapeHtml(authorName)}</span>
                            ${scopeBadge}
                            ${statusBadge}
                            <span class="survey-badge time"><i class="fas fa-calendar-alt"></i> Od: ${Utils.escapeHtml(createdAt)}</span>
                            ${survey.endsAt ? `<span class="survey-badge time"><i class="fas fa-clock"></i> Do: ${Utils.escapeHtml(endsAt)}</span>` : ''}
                        </div>
                    </header>
                    <div class="survey-detail-body">
                        ${survey.description ? `<p class="survey-description">${Utils.escapeHtml(survey.description)}</p>` : ''}
                        ${options || this.emptyHtml('Brak odpowiedzi w ankiecie.')}
                        <div class="survey-toolbar">
                            <strong><i class="fas fa-poll-h"></i> Liczba głosów: ${Number(survey.totalVotes || 0)}</strong>
                            ${survey.hasVoted ? '<span class="survey-badge global"><i class="fas fa-check"></i> Twój głos został zapisany</span>' : ''}
                        </div>
                        ${manageControls}
                    </div>
                </div>
            `;

            this.els.detail.querySelectorAll('[data-vote-option-id]').forEach((button) => {
                button.addEventListener('click', () => this.vote(survey.id, Number(button.dataset.voteOptionId)));
            });

            this.els.detail.querySelector('#surveyToggleStatusBtn')?.addEventListener('click', () => {
                this.toggleStatus(survey.id, !survey.active);
            });

            this.els.detail.querySelector('#surveyDeleteBtn')?.addEventListener('click', () => {
                this.requestDeleteSurvey(survey.id);
            });

            this.els.detail.querySelector('#surveyExtendBtn')?.addEventListener('click', () => {
                this.requestExtendSurvey(survey.id, survey.endsAt);
            });
        },

        authorName(survey) {
            return [survey.authorFirstName, survey.authorLastName].filter(Boolean).join(' ') || 'Nieznany autor';
        },

        addOptionRow(value) {
            if (!this.els.optionsContainer) return;
            const rows = this.els.optionsContainer.querySelectorAll('.survey-option-edit-row');
            if (rows.length >= 12) {
                this.showError('Maksymalnie 12 odpowiedzi w ankiecie.');
                return;
            }

            const row = document.createElement('div');
            row.className = 'survey-option-edit-row';
            row.innerHTML = `
                <input class="survey-input survey-option-input" maxlength="160" value="${Utils.escapeHtml(value || '')}" placeholder="Tekst odpowiedzi" required>
                <button type="button" class="survey-btn ghost" data-remove-option>Usuń</button>
            `;

            row.querySelector('[data-remove-option]')?.addEventListener('click', () => {
                row.remove();
                this.ensureMinimumOptionRows();
            });

            this.els.optionsContainer.appendChild(row);
        },

        ensureOptionRows(minCount) {
            while (this.els.optionsContainer.querySelectorAll('.survey-option-edit-row').length < minCount) {
                this.addOptionRow('');
            }
        },

        ensureMinimumOptionRows() {
            this.ensureOptionRows(2);
        },

        collectCreatePayload() {
            const title = (this.els.title?.value || '').trim();
            if (!title) {
                throw new Error('Podaj tytuł ankiety.');
            }

            const options = Array.from(this.els.optionsContainer.querySelectorAll('.survey-option-input'))
                .map((input) => (input.value || '').trim())
                .filter(Boolean);

            if (options.length < 2) {
                throw new Error('Ankieta musi mieć co najmniej 2 odpowiedzi.');
            }

            const deduplicated = new Set(options.map((option) => option.toLowerCase()));
            if (deduplicated.size !== options.length) {
                throw new Error('Odpowiedzi muszą być unikalne.');
            }

            const rawEndsAt = (this.els.endsAt?.value || '').trim();
            const endsAt = rawEndsAt
                ? (rawEndsAt.length === 16 ? `${rawEndsAt}:00` : rawEndsAt)
                : null;

            if (endsAt) {
                const endsAtDate = new Date(endsAt);
                if (Number.isNaN(endsAtDate.getTime()) || endsAtDate.getTime() <= Date.now()) {
                    throw new Error('Data zakończenia musi być w przyszłości.');
                }
            }

            const payload = {
                title,
                description: (this.els.description?.value || '').trim(),
                options,
                endsAt
            };

            if (this.state.role === 'ADMIN') {
                const globalScope = !!this.els.globalScope?.checked;
                payload.global = globalScope;
                payload.targetGroupId = globalScope ? null : (this.els.targetGroup?.value ? Number(this.els.targetGroup.value) : null);
            }

            return payload;
        },

        resetCreateForm() {
            this.els.createForm?.reset();
            this.els.optionsContainer.innerHTML = '';
            this.ensureOptionRows(2);
            this.refreshCreateEndsAtMin();
            if (this.els.targetGroupWrap) {
                this.els.targetGroupWrap.style.display = this.els.globalScope?.checked ? 'none' : 'block';
            }
        },

        async createSurvey(event) {
            event.preventDefault();
            try {
                const payload = this.collectCreatePayload();
                const response = await fetch('/api/surveys', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) throw new Error(await this.readError(response));

                const created = await response.json();
                this.state.selectedSurveyId = created.id;
                this.showSuccess('Ankieta została utworzona.');
                this.resetCreateForm();
                this.setView('browse');
                await this.loadSurveys();
            } catch (err) {
                this.showError(err.message || 'Nie udało się utworzyć ankiety.');
            }
        },

        async vote(surveyId, optionId) {
            try {
                const response = await fetch(`/api/surveys/${surveyId}/vote`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ optionId })
                });
                if (!response.ok) throw new Error(await this.readError(response));

                this.showSuccess('Głos został zapisany.');
                await this.loadSurveys();
            } catch (err) {
                this.showError(err.message || 'Nie udało się oddać głosu.');
            }
        },

        async toggleStatus(surveyId, active) {
            try {
                const response = await fetch(`/api/surveys/${surveyId}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ active })
                });
                if (!response.ok) throw new Error(await this.readError(response));

                this.showSuccess('Status ankiety został zaktualizowany.');
                await this.loadSurveys();
            } catch (err) {
                this.showError(err.message || 'Nie udało się zmienić statusu ankiety.');
            }
        },

        requestDeleteSurvey(surveyId) {
            const survey = this.state.surveys.find((item) => item.id === surveyId) || this.state.currentSurvey;
            this.state.pendingAction = { type: 'delete', surveyId };
            if (this.els.deleteModalText) {
                const suffix = survey?.title ? `\n\nAnkieta: "${survey.title}"` : '';
                this.els.deleteModalText.textContent = `Czy na pewno chcesz usunąć tę ankietę?${suffix}`;
            }
            this.els.deleteModal?.classList.add('active');
            this.els.deleteModal?.setAttribute('aria-hidden', 'false');
        },

        closeDeleteModal() {
            this.els.deleteModal?.classList.remove('active');
            this.els.deleteModal?.setAttribute('aria-hidden', 'true');
            this.state.pendingAction = null;
        },

        async confirmDelete() {
            const action = this.state.pendingAction;
            this.closeDeleteModal();
            if (!action || action.type !== 'delete') return;

            try {
                const response = await fetch(`/api/surveys/${action.surveyId}`, { method: 'DELETE' });
                if (!response.ok) throw new Error(await this.readError(response));
                this.showSuccess('Ankieta została usunięta.');
                await this.loadSurveys();
            } catch (err) {
                this.showError(err.message || 'Nie udało się usunąć ankiety.');
            }
        },

        requestExtendSurvey(surveyId, currentEndsAt) {
            this.state.pendingAction = { type: 'extend', surveyId };
            const now = new Date();
            const base = currentEndsAt ? new Date(currentEndsAt) : now;
            const candidate = Number.isNaN(base.getTime()) ? now : base;
            const defaultDate = new Date(Math.max(now.getTime(), candidate.getTime()) + 30 * 60 * 1000);
            const defaultValue = this.formatDateTimeForInput(defaultDate);

            if (this.els.extendModalText) {
                this.els.extendModalText.textContent = 'Ankieta jest wygasła. Ustaw nowy termin zakończenia, aby ją ponownie otworzyć.';
            }
            if (this.els.extendNewEndsAt) {
                this.els.extendNewEndsAt.value = defaultValue;
                this.els.extendNewEndsAt.min = this.formatDateTimeForInput(new Date(Date.now() + 60000));
            }
            this.els.extendModal?.classList.add('active');
            this.els.extendModal?.setAttribute('aria-hidden', 'false');
        },

        closeExtendModal() {
            this.els.extendModal?.classList.remove('active');
            this.els.extendModal?.setAttribute('aria-hidden', 'true');
            this.state.pendingAction = null;
        },

        async confirmExtend() {
            const action = this.state.pendingAction;
            this.closeExtendModal();
            if (!action || action.type !== 'extend') return;

            const newEndsAt = (this.els.extendNewEndsAt?.value || '').trim();
            if (!newEndsAt) {
                this.showError('Podaj nową datę zakończenia.');
                return;
            }

            const newEndsAtDate = new Date(newEndsAt);
            if (Number.isNaN(newEndsAtDate.getTime()) || newEndsAtDate.getTime() <= Date.now()) {
                this.showError('Nowa data zakończenia musi być w przyszłości.');
                return;
            }

            try {
                const endsAtWithSeconds = newEndsAt.length === 16 ? `${newEndsAt}:00` : newEndsAt;
                const response = await fetch(`/api/surveys/${action.surveyId}/extend`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endsAt: endsAtWithSeconds })
                });
                if (!response.ok) throw new Error(await this.readError(response));
                this.showSuccess('Ankieta została przedłużona.');
                await this.loadSurveys();
            } catch (err) {
                this.showError(err.message || 'Nie udało się przedłużyć ankiety.');
            }
        },

        formatDateTimeForInput(date) {
            if (!date || !(date instanceof Date)) return '';
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        },

        setupDateTimeInputs() {
            this.refreshCreateEndsAtMin();
            this.refreshExtendEndsAtMin();

            const openPicker = (event) => {
                const input = event.currentTarget;
                if (typeof input?.showPicker === 'function') {
                    input.showPicker();
                }
            };

            this.els.endsAt?.addEventListener('focus', openPicker);
            this.els.extendNewEndsAt?.addEventListener('focus', openPicker);

            window.setInterval(() => {
                this.refreshCreateEndsAtMin();
                this.refreshExtendEndsAtMin();
            }, 30000);
        },

        refreshCreateEndsAtMin() {
            if (!this.els.endsAt) return;
            this.els.endsAt.min = this.formatDateTimeForInput(new Date(Date.now() + 60000));
        },

        refreshExtendEndsAtMin() {
            if (!this.els.extendNewEndsAt) return;
            this.els.extendNewEndsAt.min = this.formatDateTimeForInput(new Date(Date.now() + 60000));
        },

        async fetchSurvey(surveyId, bypassCache = false) {
            const suffix = bypassCache ? `?ts=${Date.now()}` : '';
            const response = await fetch(`/api/surveys/${surveyId}${suffix}`, { cache: 'no-store' });
            if (!response.ok) throw new Error(await this.readError(response));
            return response.json();
        },

        startLiveUpdates() {
            if (this.state.liveTimerId) return;
            this.state.liveTimerId = window.setInterval(() => {
                this.pollFeed();
                this.pollSelectedDetail();
            }, this.state.liveIntervalMs);
        },

        stopLiveUpdates() {
            if (!this.state.liveTimerId) return;
            window.clearInterval(this.state.liveTimerId);
            this.state.liveTimerId = null;
            this.state.feedInFlight = false;
            this.state.detailInFlight = false;
        },

        async pollFeed() {
            if (document.hidden || this.state.feedInFlight || this.state.activeView !== 'browse') return;
            this.state.feedInFlight = true;
            try {
                const response = await fetch(`/api/surveys?ts=${Date.now()}`, { cache: 'no-store' });
                if (!response.ok) return;

                const data = await response.json();
                const nextSurveys = Array.isArray(data) ? data : [];
                const nextSignature = this.buildFeedSignature(nextSurveys);
                if (nextSignature === this.state.lastFeedSignature) {
                    return;
                }

                this.state.surveys = nextSurveys;
                this.state.lastFeedSignature = nextSignature;
                this.syncSelectionWithFilter();
                this.renderList();
                await this.renderSelectedDetail();
            } finally {
                this.state.feedInFlight = false;
            }
        },

        async pollSelectedDetail() {
            if (document.hidden || this.state.detailInFlight || this.state.activeView !== 'browse' || !this.state.selectedSurveyId) {
                return;
            }

            this.state.detailInFlight = true;
            try {
                const survey = await this.fetchSurvey(this.state.selectedSurveyId, true);
                const nextSignature = this.buildDetailSignature(survey);
                if (nextSignature === this.state.lastDetailSignature) {
                    return;
                }

                this.state.currentSurvey = survey;
                this.state.lastDetailSignature = nextSignature;
                this.mergeSurveyToFeed(survey);
                this.renderDetail(survey);
                this.renderList();
            } catch (_) {
                // Intencjonalnie cicho podczas automatycznego odświeżania.
            } finally {
                this.state.detailInFlight = false;
            }
        },

        mergeSurveyToFeed(survey) {
            const index = this.state.surveys.findIndex((item) => item.id === survey.id);
            if (index >= 0) {
                this.state.surveys[index] = survey;
            }
        },

        buildFeedSignature(surveys) {
            return (surveys || []).map((survey) => [
                survey.id,
                survey.updatedAt || survey.createdAt || '',
                survey.totalVotes || 0,
                survey.active ? '1' : '0',
                survey.expired ? '1' : '0',
                survey.hasVoted ? '1' : '0'
            ].join(':')).join('|');
        },

        buildDetailSignature(survey) {
            const optionsSignature = (survey.options || []).map((option) => [
                option.id,
                option.votes || 0,
                option.percentage || 0,
                option.selectedByCurrentUser ? '1' : '0'
            ].join(':')).join('|');

            return [
                survey.id,
                survey.updatedAt || survey.createdAt || '',
                survey.totalVotes || 0,
                survey.active ? '1' : '0',
                survey.expired ? '1' : '0',
                survey.hasVoted ? '1' : '0',
                optionsSignature
            ].join('::');
        },

        emptyHtml(message) {
            return `<div class="survey-empty">${Utils.escapeHtml(message)}</div>`;
        },

        formatDate(value) {
            if (!value) return '-';
            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) return '-';
            return parsed.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
        },

        async readError(response) {
            const text = (await response.text()).trim();
            if (!text) return 'Wystąpił błąd serwera.';
            if (!text.startsWith('{')) return text;
            try {
                const parsed = JSON.parse(text);
                return parsed.message || parsed.detail || text;
            } catch (_) {
                return text;
            }
        },

        showSuccess(message) {
            Utils.showToast(message, 'success');
        },

        showError(message) {
            Utils.showToast(message, 'error');
        }
    };

    document.addEventListener('DOMContentLoaded', () => Survey.init());
})();

