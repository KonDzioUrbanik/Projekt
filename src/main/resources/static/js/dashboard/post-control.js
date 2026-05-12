(function () {
    'use strict';

    const Forum = {
        state: {
            threads: [],
            selectedThreadId: null,
            includeArchived: false,
            mode: 'student',
            groups: [],
            activeView: 'browse',
            pendingDeleteAction: null,
            currentThread: null,
            editingThreadId: null,
            editingCommentId: null,
            searchQuery: '',
            searchScope: 'all',
            liveUpdateIntervalMs: 3000,
            liveUpdateTimerId: null,
            liveUpdateRequestInFlight: false,
            liveFeedRequestInFlight: false,
            lastThreadRenderSignature: '',
            lastFeedRenderSignature: '',
            currentPage: 1,
            pageSize: 8,
            filterType: 'newest'
        },

        els: {
            form: document.getElementById('forumThreadForm'),
            title: document.getElementById('forumThreadTitle'),
            content: document.getElementById('forumThreadContent'),
            targetGroup: document.getElementById('forumTargetGroup'),
            includeArchived: document.getElementById('forumIncludeArchived'),
            list: document.getElementById('forumThreadList'),
            detail: document.getElementById('forumThreadDetail'),
            createPreview: document.getElementById('forumCreatePreview'),
            browseSection: document.getElementById('forumBrowseSection'),
            detailSection: document.getElementById('forumDetailSection'),
            createSection: document.getElementById('forumCreateSection'),
            createCancelBtn: document.getElementById('forumCreateCancelBtn'),
            deleteModal: document.getElementById('forumDeleteModal'),
            deleteModalText: document.getElementById('forumDeleteModalText'),
            deleteCancelBtn: document.getElementById('forumDeleteCancelBtn'),
            deleteConfirmBtn: document.getElementById('forumDeleteConfirmBtn'),
            searchInput: document.getElementById('forumSearchInput'),
            searchScope: document.getElementById('forumSearchScope'),
            resultsCount: document.getElementById('forumResultsCount'),
            pagination: document.getElementById('forumPagination'),
            prevPageBtn: document.getElementById('forumPrevPageBtn'),
            nextPageBtn: document.getElementById('forumNextPageBtn'),
            pageIndicator: document.getElementById('forumPageIndicator'),
            filterTabs: document.querySelectorAll('.forum-filter-btn')
        },

        init() {
            if (!this.els.form || !this.els.list || !this.els.detail) return;
            this.state.mode = this.els.form.dataset.mode || 'student';
            
            // Odczyt wybranego wątku z URL
            const urlParams = new URLSearchParams(window.location.search);
            const threadId = urlParams.get('threadId');
            if (threadId) {
                this.state.selectedThreadId = Number(threadId);
                this.setView('detail');
            } else {
                this.setView('browse');
            }

            this.attachListeners();
            this.bootstrap();
        },

        async bootstrap() {
            if (this.state.mode === 'admin' && this.els.targetGroup) {
                await this.loadGroups();
            }
            await this.loadThreads();
            this.updateCreatePreview();
        },

        attachListeners() {
            this.els.form.addEventListener('submit', (e) => this.createThread(e));
            this.els.content?.addEventListener('input', () => this.updateCreatePreview());
            this.bindMarkdownToolbar();
            this.els.includeArchived?.addEventListener('change', () => {
                this.state.includeArchived = !!this.els.includeArchived.checked;
                this.state.currentPage = 1;
                this.loadThreads();
            });

            this.els.searchInput?.addEventListener('input', Utils.debounce((event) => {
                this.state.searchQuery = (event.target.value || '').trim().toLowerCase();
                this.state.currentPage = 1;
                this.refreshThreadSelectionForFilter();
                this.renderThreadList();
                this.renderSelectedThread();
            }, 250));

            this.els.searchScope?.addEventListener('change', (event) => {
                this.state.searchScope = event.target.value || 'all';
                this.state.currentPage = 1;
                this.refreshThreadSelectionForFilter();
                this.renderThreadList();
                this.renderSelectedThread();
            });

            this.els.prevPageBtn?.addEventListener('click', () => {
                if (this.state.currentPage > 1) {
                    this.state.currentPage--;
                    this.renderThreadList();
                }
            });

            this.els.nextPageBtn?.addEventListener('click', () => {
                this.state.currentPage++;
                this.renderThreadList();
            });

            this.els.filterTabs?.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.els.filterTabs.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.state.filterType = btn.dataset.filter;
                    this.state.currentPage = 1;
                    this.refreshThreadSelectionForFilter();
                    this.renderThreadList();
                });
            });

            this.els.createViewBtn = document.getElementById('forumCreateViewBtn');
            this.els.createViewBtn?.addEventListener('click', () => {
                this.state.selectedThreadId = null;
                this.setView('create');
            });
            this.els.createCancelBtn?.addEventListener('click', () => {
                this.setView('browse');
            });

            this.els.deleteCancelBtn?.addEventListener('click', () => this.closeDeleteModal());
            this.els.deleteConfirmBtn?.addEventListener('click', () => this.confirmDelete());
            this.els.deleteModal?.addEventListener('click', (event) => {
                if (event.target === this.els.deleteModal) this.closeDeleteModal();
            });
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') this.closeDeleteModal();
            });

            document.addEventListener('visibilitychange', () => {
                if (document.hidden) return;
                this.pollThreadFeed();
                this.pollSelectedThread();
            });

            window.addEventListener('beforeunload', () => this.stopLiveUpdates());
            window.addEventListener('pagehide', () => this.stopLiveUpdates());
        },

        bindMarkdownToolbar() {
            document.querySelectorAll('.forum-md-toolbar .forum-md-btn').forEach((button) => {
                button.addEventListener('click', () => {
                    const action = button.dataset.md;
                    this.applyMarkdownAction(action);
                });
            });
        },

        applyMarkdownAction(action) {
            const textarea = this.els.content;
            if (!textarea) return;

            textarea.focus();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selected = textarea.value.substring(start, end);

            switch (action) {
                case 'bold':
                    this.replaceSelection(textarea, start, end, `**${selected || 'tekst'}**`, selected || 'tekst');
                    break;
                case 'italic':
                    this.replaceSelection(textarea, start, end, `*${selected || 'tekst'}*`, selected || 'tekst');
                    break;
                case 'code':
                    this.replaceSelection(textarea, start, end, `\`${selected || 'kod'}\``, selected || 'kod');
                    break;
                case 'h2':
                    this.prefixCurrentLine(textarea, '## ');
                    break;
                case 'h3':
                    this.prefixCurrentLine(textarea, '### ');
                    break;
                case 'list':
                    this.prefixCurrentLine(textarea, '- ');
                    break;
                case 'quote':
                    this.prefixCurrentLine(textarea, '> ');
                    break;
                case 'link': {
                    const label = selected || 'opis linku';
                    this.replaceSelection(textarea, start, end, `[${label}](https://)`, label);
                    break;
                }
                default:
                    return;
            }

            textarea.dispatchEvent(new Event('input'));
        },

        replaceSelection(textarea, start, end, replacement, selectedText) {
            const before = textarea.value.slice(0, start);
            const after = textarea.value.slice(end);
            textarea.value = before + replacement + after;

            const markerStart = replacement.indexOf(selectedText);
            if (markerStart >= 0) {
                const selStart = start + markerStart;
                textarea.setSelectionRange(selStart, selStart + selectedText.length);
            } else {
                const pos = start + replacement.length;
                textarea.setSelectionRange(pos, pos);
            }
        },

        prefixCurrentLine(textarea, prefix) {
            const value = textarea.value;
            const caret = textarea.selectionStart;
            const lineStart = value.lastIndexOf('\n', Math.max(0, caret - 1)) + 1;
            const lineEndRaw = value.indexOf('\n', caret);
            const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw;
            const line = value.slice(lineStart, lineEnd);

            const updatedLine = line.startsWith(prefix) ? line : prefix + line;
            textarea.value = value.slice(0, lineStart) + updatedLine + value.slice(lineEnd);
            const newCaret = caret + (updatedLine.length - line.length);
            textarea.setSelectionRange(newCaret, newCaret);
        },

        setView(view) {
            this.state.activeView = view;

            this.els.browseSection?.classList.toggle('forum-hidden', view !== 'browse');
            this.els.detailSection?.classList.toggle('forum-hidden', view !== 'detail');
            this.els.createSection?.classList.toggle('forum-hidden', view !== 'create');

            if (view === 'create') {
                requestAnimationFrame(() => this.els.title?.focus());
            }

            this.syncLiveUpdatesForSelection();
        },

        async loadGroups() {
            try {
                const response = await fetch('/api/groups');
                if (!response.ok) throw new Error('Nie udało się pobrać grup.');
                this.state.groups = await response.json();
                this.els.targetGroup.innerHTML = '<option value="">Moja grupa</option>';
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

        async loadThreads() {
            try {
                const query = this.state.includeArchived ? '?includeArchived=true' : '';
                const response = await fetch('/api/forum/threads' + query);
                if (!response.ok) throw new Error(await this.readError(response));

                const data = await response.json();
                this.state.threads = Array.isArray(data) ? data : [];
                this.state.lastFeedRenderSignature = this.buildFeedRenderSignature(this.state.threads);

                this.refreshThreadSelectionForFilter();

                this.renderThreadList();
                await this.renderSelectedThread();
                this.syncLiveUpdatesForSelection();
            } catch (err) {
                this.els.list.innerHTML = this.emptyHtml('Nie udało się załadować wątków.');
                this.els.detail.innerHTML = this.emptyHtml('Brak szczegółów wątku.');
                this.showError(err.message || 'Nieudane pobieranie forum.');
                this.stopLiveUpdates();
            }
        },

        async createThread(event) {
            event.preventDefault();

            const title = (this.els.title.value || '').trim();
            const content = (this.els.content.value || '').trim();

            if (!title || !content) {
                this.showError('Uzupełnij tytuł i treść wątku.');
                return;
            }

            const formData = new FormData();
            formData.append('title', title);
            formData.append('content', content);

            if (this.state.mode === 'admin' && this.els.targetGroup && this.els.targetGroup.value) {
                formData.append('targetGroupId', this.els.targetGroup.value);
            }

            const filesInput = this.els.form.querySelector('input[type="file"]');
            if (filesInput && filesInput.files.length > 0) {
                Array.from(filesInput.files).forEach(file => {
                    formData.append('files', file);
                });
            }

            try {
                const response = await fetch('/api/forum/threads', {
                    method: 'POST',
                    body: formData
                });
                if (!response.ok) throw new Error(await this.readError(response));

                const created = await response.json();
                this.els.form.reset();
                this.state.selectedThreadId = created.id;
                this.updateCreatePreview();
                this.setView('browse');
                this.showSuccess('Wątek został opublikowany.');
                await this.loadThreads();
            } catch (err) {
                this.showError(err.message || 'Nie udało się utworzyć wątku.');
            }
        },

        async openThread(threadId) {
            this.state.selectedThreadId = threadId;
            this.setView('detail');
            await this.renderSelectedThread();
        },

        async renderSelectedThread() {
            const filteredThreads = this.getFilteredThreads();
            if (!this.state.selectedThreadId || !filteredThreads.some((t) => t.id === this.state.selectedThreadId)) {
                this.state.currentThread = null;
                this.state.lastThreadRenderSignature = '';
                this.els.detail.innerHTML = this.emptyHtml('Wybierz wątek z listy, aby zobaczyć szczegóły.');
                return;
            }

            try {
                const thread = await this.fetchThreadById(this.state.selectedThreadId);
                this.state.currentThread = thread;
                this.state.lastThreadRenderSignature = this.buildThreadRenderSignature(thread);
                this.renderThreadDetail(thread);
            } catch (err) {
                this.els.detail.innerHTML = this.emptyHtml('Nie udało się pobrać szczegółów wątku.');
                this.showError(err.message || 'Błąd ładowania szczegółów wątku.');
            }
        },

        syncLiveUpdatesForSelection() {
            const shouldRun = this.state.activeView === 'browse';
            if (shouldRun) {
                this.startLiveUpdates();
                return;
            }
            this.stopLiveUpdates();
        },

        startLiveUpdates() {
            if (this.state.liveUpdateTimerId) return;
            this.state.liveUpdateTimerId = window.setInterval(() => {
                this.pollThreadFeed();
                this.pollSelectedThread();
            }, this.state.liveUpdateIntervalMs);
        },

        stopLiveUpdates() {
            if (!this.state.liveUpdateTimerId) return;
            window.clearInterval(this.state.liveUpdateTimerId);
            this.state.liveUpdateTimerId = null;
            this.state.liveUpdateRequestInFlight = false;
            this.state.liveFeedRequestInFlight = false;
        },

        async pollThreadFeed() {
            if (this.state.liveFeedRequestInFlight || this.state.activeView !== 'browse' || document.hidden) {
                return;
            }

            this.state.liveFeedRequestInFlight = true;
            try {
                const refreshedThreads = await this.fetchThreadsFeed(true);
                const nextFeedSignature = this.buildFeedRenderSignature(refreshedThreads);
                if (nextFeedSignature === this.state.lastFeedRenderSignature) {
                    return;
                }

                const prevSelectedId = this.state.selectedThreadId;
                this.state.threads = refreshedThreads;
                this.state.lastFeedRenderSignature = nextFeedSignature;

                this.refreshThreadSelectionForFilter();
                this.renderThreadList();

                // Re-render details when selected thread changed/vanished after feed refresh.
                if (!prevSelectedId || this.state.selectedThreadId !== prevSelectedId || !refreshedThreads.some((t) => t.id === prevSelectedId)) {
                    await this.renderSelectedThread();
                }
            } catch (_) {
                // Silent on background refresh - avoid noisy toasts every interval.
            } finally {
                this.state.liveFeedRequestInFlight = false;
            }
        },

        async pollSelectedThread() {
            const selectedThreadId = this.state.selectedThreadId;
            if (!selectedThreadId || this.state.liveUpdateRequestInFlight || this.shouldPauseLiveUpdates()) {
                return;
            }

            this.state.liveUpdateRequestInFlight = true;
            try {
                const thread = await this.fetchThreadById(selectedThreadId, true);
                this.mergeThreadIntoFeed(thread);

                if (selectedThreadId !== this.state.selectedThreadId) {
                    return;
                }

                const nextSignature = this.buildThreadRenderSignature(thread);
                if (nextSignature !== this.state.lastThreadRenderSignature) {
                    this.state.currentThread = thread;
                    this.state.lastThreadRenderSignature = nextSignature;
                    this.renderThreadDetail(thread);
                    this.renderThreadList();
                }
            } catch (_) {
                // Silent on background refresh - avoid noisy toasts every interval.
            } finally {
                this.state.liveUpdateRequestInFlight = false;
            }
        },

        shouldPauseLiveUpdates() {
            return document.hidden
                || !!this.state.editingThreadId
                || !!this.state.editingCommentId
                || this.hasUnsavedCommentDraft();
        },

        hasUnsavedCommentDraft() {
            const form = document.getElementById('forumCommentForm');
            if (!form) return false;

            const textarea = form.querySelector('textarea');
            const files = form.querySelector('input[type="file"]');
            const textDirty = !!(textarea && (textarea.value || '').trim());
            const filesDirty = !!(files && files.files && files.files.length > 0);
            return textDirty || filesDirty;
        },

        buildThreadRenderSignature(thread) {
            const commentsSignature = (thread.comments || [])
                .map((comment) => [
                    comment.id,
                    comment.updatedAt || comment.createdAt || '',
                    comment.voteScore || 0,
                    comment.currentUserVote || ''
                ].join(':'))
                .join('|');

            return [
                thread.id,
                thread.updatedAt || '',
                thread.voteScore || 0,
                thread.currentUserVote || '',
                thread.locked ? '1' : '0',
                thread.archived ? '1' : '0',
                thread.pinned ? '1' : '0',
                commentsSignature
            ].join('::');
        },

        buildFeedRenderSignature(threads) {
            return (threads || []).map((thread) => [
                thread.id,
                thread.updatedAt || thread.createdAt || '',
                thread.voteScore || 0,
                thread.currentUserVote || '',
                (thread.comments || []).length,
                thread.pinned ? '1' : '0',
                thread.locked ? '1' : '0',
                thread.archived ? '1' : '0'
            ].join(':')).join('|');
        },

        async fetchThreadsFeed(bypassCache = false) {
            const baseQuery = this.state.includeArchived ? '?includeArchived=true' : '';
            const cacheBuster = bypassCache ? `${baseQuery ? '&' : '?'}ts=${Date.now()}` : '';
            const response = await fetch(`/api/forum/threads${baseQuery}${cacheBuster}`, { cache: 'no-store' });
            if (!response.ok) throw new Error(await this.readError(response));
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        },

        async fetchThreadById(threadId, bypassCache = false) {
            const suffix = bypassCache ? `?ts=${Date.now()}` : '';
            const response = await fetch(`/api/forum/threads/${threadId}${suffix}`, { cache: 'no-store' });
            if (!response.ok) throw new Error(await this.readError(response));
            return response.json();
        },

        mergeThreadIntoFeed(thread) {
            if (!thread || !thread.id) return;
            const index = this.state.threads.findIndex((item) => item.id === thread.id);
            if (index >= 0) {
                this.state.threads[index] = thread;
            }
        },

        startThreadEdit(threadId) {
            this.state.editingThreadId = threadId;
            this.state.editingCommentId = null;
            if (this.state.currentThread) {
                this.renderThreadDetail(this.state.currentThread);
            }
        },

        cancelThreadEdit() {
            this.state.editingThreadId = null;
            if (this.state.currentThread) {
                this.renderThreadDetail(this.state.currentThread);
            }
        },

        async saveThreadEdit(threadId, title, content) {
            try {
                const response = await fetch(`/api/forum/threads/${threadId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, content })
                });
                if (!response.ok) throw new Error(await this.readError(response));

                this.state.editingThreadId = null;
                this.showSuccess('Wątek zaktualizowany.');
                await this.loadThreads();
            } catch (err) {
                this.showError(err.message || 'Nie udało się zaktualizować wątku.');
            }
        },

        startCommentEdit(commentId) {
            this.state.editingCommentId = commentId;
            if (this.state.currentThread) {
                this.renderThreadDetail(this.state.currentThread);
            }
        },

        cancelCommentEdit() {
            this.state.editingCommentId = null;
            if (this.state.currentThread) {
                this.renderThreadDetail(this.state.currentThread);
            }
        },

        async saveCommentEdit(threadId, commentId, content) {
            try {
                const response = await fetch(`/api/forum/threads/${threadId}/comments/${commentId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content })
                });
                if (!response.ok) throw new Error(await this.readError(response));

                this.state.editingCommentId = null;
                this.showSuccess('Komentarz zaktualizowany.');
                await this.loadThreads();
            } catch (err) {
                this.showError(err.message || 'Nie udało się zaktualizować komentarza.');
            }
        },

        async addComment(threadId, textarea) {
            const content = (textarea.value || '').trim();
            if (!content) {
                this.showError('Komentarz nie może być pusty.');
                return;
            }

            const formData = new FormData();
            formData.append('content', content);

            const filesInput = textarea.closest('form')?.querySelector('input[type="file"]');
            if (filesInput && filesInput.files.length > 0) {
                Array.from(filesInput.files).forEach(file => {
                    formData.append('files', file);
                });
            }

            try {
                const response = await fetch(`/api/forum/threads/${threadId}/comments`, {
                    method: 'POST',
                    body: formData
                });
                if (!response.ok) throw new Error(await this.readError(response));

                this.showSuccess('Komentarz dodany.');
                textarea.value = '';
                const filesInput2 = textarea.closest('form')?.querySelector('input[type="file"]');
                if (filesInput2) filesInput2.value = '';
                await this.loadThreads();
            } catch (err) {
                this.showError(err.message || 'Nie udało się dodać komentarza.');
            }
        },

        async voteThread(threadId, voteType) {
            try {
                const response = await fetch(`/api/forum/threads/${threadId}/vote?voteType=${voteType}`, {
                    method: 'POST'
                });
                if (!response.ok) throw new Error(await this.readError(response));

                await this.loadThreads();
            } catch (err) {
                this.showError(err.message || 'Nie udało się zaktualizować głosu.');
            }
        },

        async voteComment(threadId, commentId, voteType) {
            try {
                const response = await fetch(`/api/forum/threads/${threadId}/comments/${commentId}/vote?voteType=${voteType}`, {
                    method: 'POST'
                });
                if (!response.ok) throw new Error(await this.readError(response));

                await this.loadThreads();
            } catch (err) {
                this.showError(err.message || 'Nie udało się zaktualizować głosu.');
            }
        },

        viewUserProfile(userId) {
            if (!userId) return;
            window.location.href = `/profile/user?userId=${userId}`;
        },

        requestDeleteThread(id) {
            this.openDeleteModal(
                'Czy na pewno chcesz usunąć ten wątek? Tej operacji nie da się cofnąć.',
                async () => {
                    const response = await fetch(`/api/forum/threads/${id}`, { method: 'DELETE' });
                    if (!response.ok) throw new Error(await this.readError(response));
                    this.showSuccess('Wątek usunięty.');
                    await this.loadThreads();
                }
            );
        },

        requestDeleteComment(threadId, commentId) {
            this.openDeleteModal(
                'Czy na pewno chcesz usunąć ten komentarz? Tej operacji nie da się cofnąć.',
                async () => {
                    const response = await fetch(`/api/forum/threads/${threadId}/comments/${commentId}`, {
                        method: 'DELETE'
                    });
                    if (!response.ok) throw new Error(await this.readError(response));
                    this.showSuccess('Komentarz usunięty.');
                    await this.loadThreads();
                }
            );
        },

        openDeleteModal(message, action) {
            this.state.pendingDeleteAction = action;
            if (this.els.deleteModalText) this.els.deleteModalText.textContent = message;
            this.els.deleteModal?.classList.add('active');
            this.els.deleteModal?.setAttribute('aria-hidden', 'false');
        },

        closeDeleteModal() {
            // Zdejmuje focus z klikniętego przycisku zapobiegając błędom aria-hidden
            if (document.activeElement) {
                document.activeElement.blur();
            }

            this.els.deleteModal?.classList.remove('active');
            this.els.deleteModal?.setAttribute('aria-hidden', 'true');
            this.state.pendingDeleteAction = null;
        },

        async confirmDelete() {
            const action = this.state.pendingDeleteAction;
            this.closeDeleteModal();
            if (!action) return;

            try {
                await action();
            } catch (err) {
                this.showError(err.message || 'Nie udało się usunąć elementu.');
            }
        },

        async toggleModeration(threadId, patch) {
            try {
                const response = await fetch(`/api/forum/threads/${threadId}/moderation`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(patch)
                });
                if (!response.ok) throw new Error(await this.readError(response));

                this.showSuccess('Status wątku zaktualizowany.');
                await this.loadThreads();
            } catch (err) {
                this.showError(err.message || 'Nie udało się zmoderować wątku.');
            }
        },

        renderThreadList() {
            const allVisibleThreads = this.getFilteredThreads();
            if (this.els.resultsCount) {
                this.els.resultsCount.textContent = `${allVisibleThreads.length} wyników`;
            }

            const totalPages = Math.max(1, Math.ceil(allVisibleThreads.length / this.state.pageSize));
            if (this.state.currentPage > totalPages) {
                this.state.currentPage = totalPages;
            }

            const startIndex = (this.state.currentPage - 1) * this.state.pageSize;
            const endIndex = startIndex + this.state.pageSize;
            const visibleThreads = allVisibleThreads.slice(startIndex, endIndex);

            if (!visibleThreads.length) {
                this.els.list.innerHTML = this.emptyHtml(
                    this.state.searchQuery
                        ? 'Brak wyników dla podanej frazy.'
                        : 'Brak wątków. Dodaj pierwszy temat.'
                );
                if (this.els.pagination) this.els.pagination.style.display = 'none';
                return;
            }

            this.els.list.innerHTML = visibleThreads.map((thread) => {
                const active = thread.id === this.state.selectedThreadId ? 'active' : '';
                const snippet = this.toPlainText(thread.content).slice(0, 95);
                const badges = [
                    thread.pinned ? '<span class="forum-badge pinned" title="Przypięty"><i class="fas fa-thumbtack"></i></span>' : '',
                    thread.locked ? '<span class="forum-badge locked" title="Zablokowany"><i class="fas fa-lock"></i></span>' : '',
                    thread.archived ? '<span class="forum-badge archived" title="Archiwum"><i class="fas fa-archive"></i></span>' : '',
                    this.isEdited(thread.createdAt, thread.updatedAt) ? '<span class="forum-badge edited" title="Edytowano"><i class="fas fa-pen"></i></span>' : ''
                ].join('');

                return `
                    <article class="forum-thread-item ${active}" data-thread-id="${thread.id}">
                        <h4 class="forum-thread-item-title">${Utils.escapeHtml(thread.title || '')}${badges}</h4>
                        <div class="forum-thread-item-meta">
                            ${this.authorChipHtml({
                                userId: thread.authorId,
                                firstName: thread.authorFirstName,
                                lastName: thread.authorLastName,
                                role: thread.authorRole,
                                compact: true
                            })}
                            <span>${Utils.escapeHtml(this.formatDate(thread.createdAt))}</span>
                        </div>
                        <p class="forum-thread-item-snippet">${Utils.escapeHtml(snippet)}${snippet.length >= 95 ? '...' : ''}</p>
                        <div class="forum-thread-item-meta">
                            <span class="forum-counter-line"><i class="far fa-comment"></i>${Number((thread.comments || []).length)}</span>
                            <span class="forum-counter-line">
                                <i class="fas fa-arrow-up" style="color: ${thread.voteScore > 0 ? '#10b981' : 'var(--text-light)'}"></i>
                                <span style="color: ${thread.voteScore > 0 ? '#10b981' : thread.voteScore < 0 ? '#ef4444' : 'var(--text-secondary)'}; font-weight: 600;">
                                    ${thread.voteScore}
                                </span>
                            </span>
                        </div>
                    </article>
                `;
            }).join('');

            this.els.list.querySelectorAll('[data-thread-id]').forEach((el) => {
                el.addEventListener('click', () => this.openThread(Number(el.dataset.threadId)));
            });

            this.els.list.querySelectorAll('.forum-author-chip[data-author-id]').forEach((chip) => {
                chip.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const authorId = chip.dataset.authorId;
                    if (authorId) this.viewUserProfile(authorId);
                });
            });

            this.bindAvatarFallbacks(this.els.list);

            if (this.els.pagination) {
                if (allVisibleThreads.length > 0) {
                    this.els.pagination.style.display = 'flex';
                    this.els.pageIndicator.textContent = `Strona ${this.state.currentPage} z ${totalPages}`;
                    this.els.prevPageBtn.disabled = this.state.currentPage <= 1;
                    this.els.nextPageBtn.disabled = this.state.currentPage >= totalPages;
                } else {
                    this.els.pagination.style.display = 'none';
                }
            }
        },

        refreshThreadSelectionForFilter() {
            const visibleThreads = this.getFilteredThreads();
            if (!visibleThreads.length) {
                this.state.selectedThreadId = null;
                return;
            }

            if (!this.state.selectedThreadId || !visibleThreads.some((t) => t.id === this.state.selectedThreadId)) {
                this.state.selectedThreadId = visibleThreads[0].id;
            }
        },

        getFilteredThreads() {
            let filtered = this.state.threads;

            if (this.state.searchQuery) {
                const query = this.state.searchQuery;
                const scope = this.state.searchScope || 'all';

                filtered = filtered.filter((thread) => {
                    const title = (thread.title || '').toLowerCase();
                    const author = this.authorName(thread.authorFirstName, thread.authorLastName).toLowerCase();

                    if (scope === 'title') return title.includes(query);
                    if (scope === 'author') return author.includes(query);
                    return title.includes(query) || author.includes(query);
                });
            }

            if (this.state.filterType === 'hot') {
                filtered = [...filtered].sort((a, b) => (b.voteScore || 0) - (a.voteScore || 0));
            } else if (this.state.filterType === 'open') {
                filtered = filtered.filter(t => !t.locked && !t.archived);
            }

            return filtered;
        },

        renderThreadDetail(thread) {
            const createdAt = this.formatDate(thread.createdAt);
            const editedAt = this.isEdited(thread.createdAt, thread.updatedAt) ? this.formatDate(thread.updatedAt) : null;
            const statusBadges = [
                thread.pinned ? '<span class="forum-badge pinned" title="Przypięty"><i class="fas fa-thumbtack"></i></span>' : '',
                thread.locked ? '<span class="forum-badge locked" title="Zablokowany"><i class="fas fa-lock"></i></span>' : '',
                thread.archived ? '<span class="forum-badge archived" title="Archiwum"><i class="fas fa-archive"></i></span>' : ''
            ].join('');

            const moderationPanelHtml = thread.canModerate
                ? `
                    <div class="forum-moderation-panel">
                        <div class="forum-moderation-panel-title">
                            <i class="fas fa-shield-alt"></i> Panel Moderatora
                        </div>
                        <div class="forum-moderation-toggles">
                            <label class="forum-toggle-wrapper">
                                <span>Przypnij</span>
                                <div class="forum-toggle-switch ${thread.pinned ? 'active' : ''}" data-action="toggle-pin" data-next="${!thread.pinned}"></div>
                            </label>
                            <label class="forum-toggle-wrapper">
                                <span>Zablokuj</span>
                                <div class="forum-toggle-switch ${thread.locked ? 'active' : ''}" data-action="toggle-lock" data-next="${!thread.locked}"></div>
                            </label>
                            <label class="forum-toggle-wrapper">
                                <span>Archiwizuj</span>
                                <div class="forum-toggle-switch ${thread.archived ? 'active' : ''}" data-action="toggle-archive" data-next="${!thread.archived}"></div>
                            </label>
                        </div>
                    </div>
                `
                : '';

            const hasThreadActions = thread.canDelete || thread.canEdit;
            const threadPostControl = hasThreadActions ? `
                <div class="forum-post-control" style="margin-top: 1.5rem; display: flex; gap: 0.5rem; justify-content: flex-end; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                    ${thread.canEdit ? `<button class="forum-btn ghost" data-action="edit-thread"><i class="fas fa-pen"></i> Edytuj</button>` : ''}
                    ${thread.canDelete ? `<button class="forum-btn danger ghost" data-action="delete-thread"><i class="fas fa-trash-alt"></i> Usuń</button>` : ''}
                </div>
            ` : '';

            const comments = (thread.comments || []).map((comment) => this.commentHtml(thread.id, comment)).join('');
            const showLikeButton = !thread.canModerate;

            const commentForm = !thread.locked && !thread.archived
                ? `
                    <form class="forum-comment-form" id="forumCommentForm">
                        <textarea class="forum-textarea" id="forumCommentInput" maxlength="2000" placeholder="Napisz komentarz..."></textarea>
                        <div class="forum-form-group" style="margin-top: 0.5rem;">
                            <input type="file" id="forumCommentFiles" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.docx" style="font-size: 0.75rem;">
                        </div>
                        <button class="forum-btn secondary" type="submit">Dodaj</button>
                    </form>
                `
                : '<div class="forum-empty">Komentowanie niedostępne dla zablokowanego/archiwalnego wątku.</div>';

            const backBtn = '<button class="forum-btn ghost" id="forumMobileBackBtn" type="button" style="margin-bottom: 1rem;"><i class="fas fa-arrow-left"></i> Wróć do listy</button>';
            const isEditingThread = this.state.editingThreadId === thread.id;
            const threadBody = isEditingThread
                ? `
                    <form id="forumThreadEditForm" class="forum-thread-edit-form" data-thread-id="${thread.id}">
                        <div class="forum-form-group">
                            <label for="forumEditTitle">Tytuł</label>
                            <input id="forumEditTitle" class="forum-input" maxlength="180" value="${Utils.escapeHtml(thread.title || '')}" required>
                        </div>
                        <div class="forum-form-group">
                            <label for="forumEditContent">Treść</label>
                            <textarea id="forumEditContent" class="forum-textarea" maxlength="4000" required>${Utils.escapeHtml(thread.content || '')}</textarea>
                        </div>
                        <div class="forum-actions">
                            <button class="forum-btn ghost" type="button" id="forumCancelEditThreadBtn">Anuluj</button>
                            <button class="forum-btn primary" type="submit">Zapisz</button>
                        </div>
                    </form>
                `
                : `<div class="forum-markdown">${this.renderMarkdown(thread.content || '')}</div>`;

            this.els.detail.classList.remove('forum-detail-empty');
            this.els.detail.innerHTML = `
                <div class="forum-detail">
                    <header class="forum-detail-head">
                        ${backBtn}
                        <h2 class="forum-detail-title">${Utils.escapeHtml(thread.title || '')}</h2>
                        <div class="forum-detail-meta">
                            ${this.authorChipHtml({
                                userId: thread.authorId,
                                firstName: thread.authorFirstName,
                                lastName: thread.authorLastName,
                                role: thread.authorRole,
                                compact: false
                            })}
                            <span>${Utils.escapeHtml(createdAt)}${editedAt ? ` <span class="forum-badge edited" title="Edytowano: ${Utils.escapeHtml(editedAt)}"><i class="fas fa-pen"></i></span>` : ''} | ${Utils.escapeHtml(thread.groupName || '-')} ${statusBadges}</span>
                        </div>
                    </header>

                    ${moderationPanelHtml}

                    <div class="forum-detail-body">
                        ${threadBody}
                        ${threadPostControl}
                    </div>

                    ${thread.attachments && thread.attachments.length > 0 ? `
                        <div class="forum-attachments">
                            <h5 style="margin: 0 0 0.5rem 0; font-size: 0.85rem; color: var(--text-light); font-weight: 600;">
                                <i class="fas fa-paperclip"></i> Załączniki (${thread.attachments.length})
                            </h5>
                            <div class="forum-attachments-list">
                                ${thread.attachments.map(att => `
                                    <a href="/api/forum/attachments/${att.id}" download="${att.originalFileName}" class="forum-attachment-item" title="${Utils.escapeHtml(att.originalFileName)}">
                                        <i class="fas fa-file"></i>
                                        <span class="forum-attachment-name">${Utils.escapeHtml(att.originalFileName)}</span>
                                        <span class="forum-attachment-size">${this.formatFileSize(att.fileSize)}</span>
                                    </a>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <div class="forum-detail-toolbar">
                        ${showLikeButton
                            ? `<div class="forum-vote-buttons">
                                   <button class="forum-vote-btn ${thread.currentUserVote === 'UPVOTE' ? 'active upvote' : ''}" id="forumUpvoteBtn" data-vote-type="upvote" title="Plusuj">
                                       <i class="fas fa-arrow-up"></i>
                                   </button>
                                   <span class="forum-vote-score ${thread.voteScore > 0 ? 'positive' : thread.voteScore < 0 ? 'negative' : ''}" id="forumVoteScore">
                                       ${thread.voteScore}
                                   </span>
                                   <button class="forum-vote-btn ${thread.currentUserVote === 'DOWNVOTE' ? 'active downvote' : ''}" id="forumDownvoteBtn" data-vote-type="downvote" title="Minusuj">
                                       <i class="fas fa-arrow-down"></i>
                                   </button>
                               </div>`
                            : '<span></span>'}

                        <div class="forum-mini-actions">
                        </div>
                    </div>

                    <section class="forum-comments">
                        <h4>Komentarze (${Number((thread.comments || []).length)})</h4>
                        ${comments || '<div class="forum-empty">Brak komentarzy.</div>'}
                        ${commentForm}
                    </section>
                </div>
            `;

            this.els.detail.querySelector('.forum-detail-head .forum-author-chip[data-author-id]')?.addEventListener('click', (e) => {
                e.preventDefault();
                const authorId = e.currentTarget.dataset.authorId;
                if (authorId) {
                    this.viewUserProfile(authorId);
                }
            });

            document.getElementById('forumUpvoteBtn')?.addEventListener('click', () => this.voteThread(thread.id, 'UPVOTE'));
            document.getElementById('forumDownvoteBtn')?.addEventListener('click', () => this.voteThread(thread.id, 'DOWNVOTE'));
            document.getElementById('forumCommentForm')?.addEventListener('submit', (e) => {
                e.preventDefault();
                const input = document.getElementById('forumCommentInput');
                this.addComment(thread.id, input);
            });

            this.els.detail.querySelector('[data-action="delete-thread"]')?.addEventListener('click', () => {
                this.requestDeleteThread(thread.id);
            });
            this.els.detail.querySelector('[data-action="edit-thread"]')?.addEventListener('click', () => {
                this.startThreadEdit(thread.id);
            });

            const threadEditForm = this.els.detail.querySelector('#forumThreadEditForm');
            threadEditForm?.addEventListener('submit', (e) => {
                e.preventDefault();
                const titleInput = threadEditForm.querySelector('#forumEditTitle');
                const contentInput = threadEditForm.querySelector('#forumEditContent');
                this.saveThreadEdit(thread.id, (titleInput?.value || '').trim(), (contentInput?.value || '').trim());
            });
            this.els.detail.querySelector('#forumCancelEditThreadBtn')?.addEventListener('click', () => {
                this.cancelThreadEdit();
            });
            this.els.detail.querySelector('[data-action="toggle-lock"]')?.addEventListener('click', (e) => {
                this.toggleModeration(thread.id, { locked: e.currentTarget.dataset.next === 'true' });
            });
            this.els.detail.querySelector('[data-action="toggle-pin"]')?.addEventListener('click', (e) => {
                this.toggleModeration(thread.id, { pinned: e.currentTarget.dataset.next === 'true' });
            });
            this.els.detail.querySelector('[data-action="toggle-archive"]')?.addEventListener('click', (e) => {
                this.toggleModeration(thread.id, { archived: e.currentTarget.dataset.next === 'true' });
            });

            this.els.detail.querySelectorAll('[data-delete-comment-id]').forEach((btn) => {
                btn.addEventListener('click', () => this.requestDeleteComment(thread.id, Number(btn.dataset.deleteCommentId)));
            });
            this.els.detail.querySelectorAll('[data-edit-comment-id]').forEach((btn) => {
                btn.addEventListener('click', () => this.startCommentEdit(Number(btn.dataset.editCommentId)));
            });
            this.els.detail.querySelectorAll('[data-comment-edit-form-id]').forEach((form) => {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const commentId = Number(form.dataset.commentEditFormId);
                    const input = form.querySelector('textarea');
                    this.saveCommentEdit(thread.id, commentId, (input?.value || '').trim());
                });
            });
            this.els.detail.querySelectorAll('[data-cancel-comment-edit-id]').forEach((btn) => {
                btn.addEventListener('click', () => this.cancelCommentEdit());
            });

            this.els.detail.querySelectorAll('[data-vote-comment-upvote]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const commentId = Number(btn.dataset.voteCommentUpvote);
                    this.voteComment(thread.id, commentId, 'UPVOTE');
                });
            });

            this.els.detail.querySelectorAll('[data-vote-comment-downvote]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const commentId = Number(btn.dataset.voteCommentDownvote);
                    this.voteComment(thread.id, commentId, 'DOWNVOTE');
                });
            });

            this.els.detail.querySelectorAll('.forum-comment .forum-author-chip[data-author-id]').forEach((chip) => {
                chip.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const authorId = chip.dataset.authorId;
                    if (authorId) this.viewUserProfile(authorId);
                });
            });

            this.els.detail.querySelector('#forumMobileBackBtn')?.addEventListener('click', () => {
                this.state.selectedThreadId = null;
                this.setView('browse');
            });

            this.bindAvatarFallbacks(this.els.detail);
        },

        commentHtml(threadId, comment) {
            const createdAt = this.formatDate(comment.createdAt);
            const editedAt = this.isEdited(comment.createdAt, comment.updatedAt) ? this.formatDate(comment.updatedAt) : null;
            const isEditing = this.state.editingCommentId === comment.id;
            const deleteBtn = comment.canDelete
                ? `<button class="forum-mini-btn danger" data-delete-comment-id="${comment.id}"><i class="fas fa-trash-alt"></i> Usuń</button>`
                : '';
            const editBtn = comment.canEdit
                ? `<button class="forum-mini-btn" data-edit-comment-id="${comment.id}"><i class="fas fa-pen"></i> Edytuj</button>`
                : '';

            const contentBlock = isEditing
                ? `
                    <form data-comment-edit-form-id="${comment.id}" class="forum-comment-edit-form">
                        <textarea class="forum-textarea" maxlength="2000" required>${Utils.escapeHtml(comment.content || '')}</textarea>
                        <div class="forum-actions" style="margin-top: 0.5rem;">
                            <button type="button" class="forum-btn ghost" data-cancel-comment-edit-id="${comment.id}">Anuluj</button>
                            <button type="submit" class="forum-btn secondary">Zapisz</button>
                        </div>
                    </form>
                `
                : `<div class="forum-markdown">${this.renderMarkdown(comment.content || '')}</div>`;

             const voteButtonsHtml = `
                 <div class="forum-comment-votes">
                     <button class="forum-vote-btn-small ${comment.currentUserVote === 'UPVOTE' ? 'active upvote' : ''}" data-vote-comment-upvote="${comment.id}" data-vote-type="upvote" title="Plusuj">
                         <i class="fas fa-arrow-up"></i>
                     </button>
                     <span class="forum-vote-score-small ${comment.voteScore > 0 ? 'positive' : comment.voteScore < 0 ? 'negative' : ''}">
                         ${comment.voteScore}
                     </span>
                     <button class="forum-vote-btn-small ${comment.currentUserVote === 'DOWNVOTE' ? 'active downvote' : ''}" data-vote-comment-downvote="${comment.id}" data-vote-type="downvote" title="Minusuj">
                         <i class="fas fa-arrow-down"></i>
                     </button>
                 </div>
             `;

              return `
                  <article class="forum-comment" data-thread-id="${threadId}" data-comment-id="${comment.id}">
                      <div class="forum-comment-content-wrapper">
                          <div class="forum-comment-meta">
                              <span class="forum-comment-author-wrap">
                                  ${this.authorChipHtml({
                                      userId: comment.authorId,
                                      firstName: comment.authorFirstName,
                                      lastName: comment.authorLastName,
                                      role: comment.authorRole,
                                      compact: true
                                  })}
                                  <span>${Utils.escapeHtml(createdAt)}${editedAt ? ` <span class="forum-badge edited" title="Edytowano: ${Utils.escapeHtml(editedAt)}"><i class="fas fa-pen"></i></span>` : ''}</span>
                              </span>
                              <span class="forum-mini-actions">${editBtn}${deleteBtn}</span>
                          </div>
                          ${contentBlock}
                          ${comment.attachments && comment.attachments.length > 0 ? `
                              <div class="forum-attachments" style="margin-top: 0.75rem; border-top: none; border-bottom: none; padding: 0;">
                                  <div style="font-size: 0.75rem; color: var(--text-light); font-weight: 600; margin-bottom: 0.5rem;">
                                      <i class="fas fa-paperclip"></i> Załączniki (${comment.attachments.length})
                                  </div>
                                  <div class="forum-attachments-list">
                                      ${comment.attachments.map(att => `
                                          <a href="/api/forum/comments/attachments/${att.id}" download="${att.originalFileName}" class="forum-attachment-item" title="${Utils.escapeHtml(att.originalFileName)}">
                                              <i class="fas fa-file"></i>
                                              <span class="forum-attachment-name">${Utils.escapeHtml(att.originalFileName)}</span>
                                              <span class="forum-attachment-size">${this.formatFileSize(att.fileSize)}</span>
                                          </a>
                                      `).join('')}
                                  </div>
                              </div>
                          ` : ''}
                      </div>
                      ${voteButtonsHtml}
                  </article>
              `;
        },

        authorChipHtml({ userId, firstName, lastName, role, compact }) {
            const fullName = this.authorName(firstName, lastName);
            const initials = this.authorInitials(firstName, lastName);
            const avatarSrc = userId ? `/api/users/${userId}/avatar` : '';
            const roleLabel = role || 'Użytkownik';
            const compactClass = compact ? ' forum-author-chip--compact' : '';
            const roleClass = ` forum-author-chip--role-${this.authorRoleClass(role)}`;

            return `
                <button type="button" class="forum-author-chip${compactClass}${roleClass}" data-author-id="${Utils.escapeHtml(userId || '')}" title="Przejdź do profilu">
                    <span class="forum-author-avatar" aria-hidden="true">
                        ${avatarSrc
                            ? `<img class="forum-author-avatar-img" src="${Utils.escapeHtml(avatarSrc)}" alt="" loading="lazy">`
                            : ''}
                        <span class="forum-author-avatar-fallback">${Utils.escapeHtml(initials)}</span>
                    </span>
                    <span class="forum-author-text">
                        <span class="forum-author-name">${Utils.escapeHtml(fullName)}</span>
                        <span class="forum-author-role">${Utils.escapeHtml(roleLabel)}</span>
                    </span>
                </button>
            `;
        },

        authorRoleClass(role) {
            const normalized = String(role || '').trim().toUpperCase();
            if (normalized.includes('ADMIN')) return 'admin';
            if (normalized.includes('STAROSTA')) return 'starosta';
            if (normalized.includes('STUDENT')) return 'student';
            return 'user';
        },

        bindAvatarFallbacks(root) {
            if (!root) return;
            root.querySelectorAll('.forum-author-avatar-img').forEach((img) => {
                if (img.dataset.bound === '1') return;
                img.dataset.bound = '1';

                const onError = () => {
                    img.style.display = 'none';
                };

                if (!img.complete) {
                    img.addEventListener('error', onError, { once: true });
                } else if (img.naturalWidth === 0) {
                    onError();
                }
            });
        },

        authorInitials(firstName, lastName) {
            const a = (firstName || '').trim();
            const b = (lastName || '').trim();
            const first = a ? a[0] : '';
            const second = b ? b[0] : '';
            const initials = `${first}${second}`.toUpperCase();
            return initials || '?';
        },

        isEdited(createdAt, updatedAt) {
            if (!createdAt || !updatedAt) return false;
            const created = new Date(createdAt).getTime();
            const updated = new Date(updatedAt).getTime();
            if (Number.isNaN(created) || Number.isNaN(updated)) return false;
            return updated - created > 1000;
        },

        updateCreatePreview() {
            if (!this.els.createPreview) return;
            const value = (this.els.content?.value || '').trim();
            this.els.createPreview.innerHTML = value
                ? this.renderMarkdown(value)
                : '<span style="color: var(--text-placeholder);">Podgląd treści pojawi się tutaj.</span>';
        },

        renderMarkdown(input) {
            let text = Utils.escapeHtml(input || '');

            text = text.replace(/^###\s+(.*)$/gm, '<h4>$1</h4>');
            text = text.replace(/^##\s+(.*)$/gm, '<h3>$1</h3>');
            text = text.replace(/^#\s+(.*)$/gm, '<h2>$1</h2>');

            text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
            text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

            text = text.replace(/^\-\s+(.*)$/gm, '<li>$1</li>');
            text = text.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

            text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
                const safe = /^(https?:\/\/)/i.test(url) ? url : '';
                if (!safe) return label;
                return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
            });

            text = text
                .split('\n\n')
                .map((block) => {
                    if (block.startsWith('<h') || block.startsWith('<ul>')) return block;
                    return `<p>${block.replace(/\n/g, '<br>')}</p>`;
                })
                .join('');

            return text;
        },

        toPlainText(value) {
            const stripped = typeof Utils.stripMarkdown === 'function'
                ? Utils.stripMarkdown(String(value || ''))
                : String(value || '');
            return stripped
                .replace(/\s+/g, ' ')
                .trim();
        },

        emptyHtml(message) {
            return `<div class="forum-empty">${Utils.escapeHtml(message)}</div>`;
        },

        authorName(firstName, lastName) {
            return [firstName, lastName].filter(Boolean).join(' ') || 'Nieznany autor';
        },

        formatDate(value) {
            if (!value) return '-';
            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) return '-';
            return parsed.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
        },

        formatFileSize(bytes) {
            if (!bytes) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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

    const ModerationTabs = {
        init() {
            const tabs = document.querySelectorAll('.moderation-tab-btn');
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const target = tab.dataset.tab;
                    this.switchTab(target);
                });
            });

            // Check URL for tab
            const urlParams = new URLSearchParams(window.location.search);
            const tab = urlParams.get('tab');
            if (tab === 'market') {
                this.switchTab('market');
            }
        },

        switchTab(tabName) {
            const tabs = document.querySelectorAll('.moderation-tab-btn');
            tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));

            document.getElementById('forumModSection').classList.toggle('mod-section-hidden', tabName !== 'forum');
            document.getElementById('marketModSection').classList.toggle('mod-section-hidden', tabName !== 'market');

            if (tabName === 'market') {
                MarketAdmin.init();
            }
        }
    };

    const MarketAdmin = {
        state: {
            isInitialized: false,
            reports: []
        },

        init() {
            if (this.state.isInitialized) return;
            
            // Przenosimy modale do body, aby uniknąć problemów z uwięzieniem ich 
            // w kontenerze z niższym z-index niż nagłówek (tzw. stacking context).
            const modals = document.querySelectorAll('.forum-modal-overlay');
            modals.forEach(modal => {
                if (modal.parentNode !== document.body) {
                    document.body.appendChild(modal);
                }
            });

            this.fetchReports();
            this.state.isInitialized = true;
        },

        async fetchReports() {
            const reportsBody = document.getElementById('reportsBody');
            const reportsLoader = document.getElementById('reportsLoader');
            const reportsTable = document.getElementById('reportsTable');
            const emptyReports = document.getElementById('emptyReports');

            try {
                const res = await fetch('/api/admin/market/reports');
                if (!res.ok) throw new Error('Błąd ładowania zgłoszeń');
                const reports = await res.json();
                this.state.reports = reports;
                
                reportsLoader.style.display = 'none';
                if (reports.length === 0) {
                    reportsTable.style.display = 'none';
                    emptyReports.style.display = 'block';
                    return;
                }

                emptyReports.style.display = 'none';
                reportsTable.style.display = 'table';
                reportsBody.innerHTML = reports.map(report => this.renderReportRow(report)).join('');
            } catch (error) {
                console.error(error);
                if (window.Utils && Utils.showToast) Utils.showToast('Nie udało się pobrać zgłoszeń.', 'error');
            }
        },

        renderReportRow(report) {
            const date = new Date(report.createdAt).toLocaleString('pl-PL');
            return `
                <tr onclick="MarketAdmin.showReportDetails(${report.id})">
                    <td data-label="ID"><span>${report.id}</span></td>
                    <td data-label="Ogłoszenie">
                        <div>
                            <div style="font-weight: 600;">${this.esc(report.adTitle)}</div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary);">ID: ${report.adId}</div>
                        </div>
                    </td>
                    <td data-label="Powód"><span><span class="reason-badge ${this.getReasonClass(report.reason)}">${this.getReasonLabel(report.reason)}</span></span></td>
                    <td data-label="Szczegóły"><div><div class="truncate-text" style="max-width: 200px;" title="${this.esc(report.details)}">${this.esc(report.details) || '—'}</div></div></td>
                    <td data-label="Zgłaszający">
                        <div>
                            <div style="font-weight: 500;">${this.esc(report.reporterName)}</div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary);">${this.esc(report.reporterEmail)}</div>
                        </div>
                    </td>
                    <td data-label="Data"><span>${date}</span></td>
                    <td data-label="Akcje">
                        <div class="action-buttons" onclick="event.stopPropagation()">
                            <button class="btn-action btn-resolve" onclick="MarketAdmin.resolveReport(${report.id})" title="Zignoruj">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="btn-action btn-delete" onclick="MarketAdmin.deleteAd(${report.adId}, ${report.id})" title="Usuń ogłoszenie">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        },

        getReasonLabel(reason) {
            const labels = { SPAM:'Spam', INAPPROPRIATE_CONTENT:'Niewłaściwe', DUPLICATE:'Duplikat', WRONG_CATEGORY:'Błędna kat.', OTHER:'Inne' };
            return labels[reason] || reason;
        },

        getReasonClass(reason) {
            const classes = { SPAM:'reason-spam', INAPPROPRIATE_CONTENT:'reason-inappropriate', DUPLICATE:'reason-duplicate', WRONG_CATEGORY:'reason-wrong-category', OTHER:'reason-other' };
            return classes[reason] || '';
        },

        showReportDetails(reportId) {
            const report = this.state.reports.find(r => r.id === reportId);
            if (!report) return;

            const modal = document.getElementById('marketReportModal');
            const content = document.getElementById('marketReportContent');

            const date = new Date(report.createdAt).toLocaleString('pl-PL');

            content.innerHTML = `
                <div class="report-detail-grid">
                    <div>
                        <label class="report-detail-label">Zgłoszone ogłoszenie</label>
                        <div class="report-ad-box">
                            <div style="font-weight: 600; font-size: 1.1rem; margin-bottom: 4px;">${this.esc(report.adTitle)}</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 10px;">ID ogłoszenia: ${report.adId}</div>
                            <button type="button" onclick="MarketAdmin.previewAd(${report.adId})" class="forum-btn ghost" style="font-size: 0.8rem; padding: 6px 12px;">
                                <i class="fas fa-eye" style="margin-right: 6px;"></i>Podgląd ogłoszenia
                            </button>
                        </div>
                    </div>
                    
                    <div class="report-detail-row">
                        <div>
                            <label class="report-detail-label">Powód zgłoszenia</label>
                            <span class="reason-badge ${this.getReasonClass(report.reason)}">${this.getReasonLabel(report.reason)}</span>
                        </div>
                        <div>
                            <label class="report-detail-label">Data zgłoszenia</label>
                            <div style="font-weight: 500;">${date}</div>
                        </div>
                    </div>

                    <div>
                        <label class="report-detail-label">Szczegóły / Treść zgłoszenia</label>
                        <div class="report-details-box">
                            ${this.esc(report.details) || '<i style="color: var(--text-muted);">Brak dodatkowych szczegółów</i>'}
                        </div>
                    </div>

                    <div>
                        <label class="report-detail-label">Zgłaszający</label>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 36px; height: 36px; background: var(--color-primary); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700;">
                                ${report.reporterName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style="font-weight: 600;">${this.esc(report.reporterName)}</div>
                                <div style="font-size: 0.8rem; color: var(--text-secondary);">${this.esc(report.reporterEmail)}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="report-modal-footer" style="display: flex; gap: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border-color);">
                    <button class="forum-btn secondary" data-action="resolve-from-modal">
                        <i class="fas fa-check" style="margin-right: 6px;"></i>Rozstrzygnij
                    </button>
                    <button class="forum-btn danger" data-action="delete-from-modal">
                        <i class="fas fa-trash" style="margin-right: 6px;"></i>Usuń ogłoszenie
                    </button>
                </div>
            `;

            modal.setAttribute('aria-hidden', 'false');
            
            // Znajdź przyciski
            const resolveBtn = modal.querySelector('[data-action="resolve-from-modal"]');
            const deleteBtn = modal.querySelector('[data-action="delete-from-modal"]');
            
            // CZYSTE ODPIĘCIE STARYCH ZDARZEŃ (Klonowanie eliminuje wyciek listenerów)
            const newResolveBtn = resolveBtn.cloneNode(true);
            resolveBtn.parentNode.replaceChild(newResolveBtn, resolveBtn);
            
            const newDeleteBtn = deleteBtn.cloneNode(true);
            deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
            
            // Dodaj zdarzenia do czystych przycisków
            newResolveBtn.addEventListener('click', () => {
                this.resolveReport(reportId);
            });
            
            newDeleteBtn.addEventListener('click', () => {
                this.deleteAd(report.adId, reportId);
            });
        },

        closeModal() {
            // Zwalniamy fokus z przycisków przed zamknięciem, aby uniknąć błędów aria-hidden
            if (document.activeElement) {
                document.activeElement.blur();
            }
            const modal = document.getElementById('marketReportModal');
            if (modal) {
                modal.setAttribute('aria-hidden', 'true');
            }
            // Zamykamy również modal potwierdzenia jeśli jest otwarty
            Forum.closeDeleteModal();
        },

        async previewAd(adId) {
            const btn = document.querySelector('.report-ad-box button');
            if (!btn) return;
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 6px;"></i>Pobieranie...';
            btn.disabled = true;

            try {
                const res = await fetch(`/api/admin/market/ads/${adId}`);
                if (!res.ok) throw new Error('Nie udało się pobrać szczegółów ogłoszenia. Może zostało już fizycznie usunięte.');
                const ad = await res.json();

                // Tworzymy "Pływający podgląd" wewnątrz istniejącego modala
                const reportContent = document.getElementById('marketReportContent');
                
                // Sprawdzamy czy podgląd już istnieje
                const existingPreview = document.getElementById('adminAdPreviewBox');
                if (existingPreview) existingPreview.remove();

                const previewHtml = `
                    <div id="adminAdPreviewBox" style="margin-top: 20px; padding: 15px; background: var(--bg-body); border: 1px solid var(--border-color); border-radius: 8px; animation: slideDown 0.3s ease;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <h4 style="margin: 0; color: var(--text-main); font-size: 1rem;"><i class="fas fa-search"></i> Podgląd treści</h4>
                            <span class="reason-badge" style="background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-secondary);">Status: ${this.esc(ad.status)}</span>
                        </div>
                        <h3 style="margin: 0 0 10px 0; font-size: 1.1rem; color: var(--text-main);">${this.esc(ad.title)}</h3>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
                            Kategoria: <strong>${ad.category}</strong> | Stan: <strong>${ad.condition}</strong> | Cena: <strong>${ad.price ? ad.price + ' zł' : 'Brak'}</strong>
                        </div>
                        <p style="white-space: pre-wrap; font-size: 0.9rem; line-height: 1.5; color: var(--text-main); margin: 0; max-height: 250px; overflow-y: auto; padding-right: 5px;">${this.esc(ad.description)}</p>
                    </div>
                `;

                reportContent.insertAdjacentHTML('beforeend', previewHtml);
                
                // Scrollujemy modal w dół
                const modalBody = document.getElementById('marketReportModal').querySelector('.forum-modal-card');
                modalBody.scrollTop = modalBody.scrollHeight;

            } catch (error) {
                Utils.showToast(error.message, 'error');
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        },

        async resolveReport(id) {
            this.showConfirm('Oznaczyć to zgłoszenie jako rozstrzygnięte? Ogłoszenie pozostanie na Giełdzie.', async () => {
                try {
                    const res = await fetch(`/api/admin/market/reports/${id}/resolve`, {
                        method: 'POST',
                        headers: this.getCsrfHeaders()
                    });
                    if (!res.ok) throw new Error('Błąd serwera podczas rozstrzygania zgłoszenia');
                    
                    this.closeModal();
                    Utils.showToast('Zgłoszenie zostało oznaczone jako rozstrzygnięte.', 'success');
                    this.fetchReports();
                } catch (error) {
                    Utils.showToast(error.message, 'error');
                }
            });
        },

        async deleteAd(adId, reportId) {
            this.showConfirm('USUNĄĆ ogłoszenie? Tej akcji nie da się cofnąć i wszystkie zgłoszenia z nim powiązane zostaną zamknięte.', async () => {
                try {
                    const res = await fetch(`/api/admin/market/reports/${reportId}/ads/${adId}`, {
                        method: 'DELETE',
                        headers: this.getCsrfHeaders()
                    });
                    if (!res.ok) throw new Error('Błąd serwera podczas usuwania ogłoszenia');
                    
                    this.closeModal();
                    Utils.showToast('Ogłoszenie zostało usunięte.', 'success');
                    this.fetchReports();
                } catch (error) {
                    Utils.showToast(error.message, 'error');
                }
            });
        },

        showConfirm(message, action) {
            Forum.openDeleteModal(message, action);
        },

        esc(str) {
            if (!str) return '';
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        },

        getCsrfHeaders() {
            const token = document.querySelector('meta[name="_csrf"]')?.content;
            const header = document.querySelector('meta[name="_csrf_header"]')?.content;
            return (token && header) ? { [header]: token } : {};
        },

    };

    window.MarketAdmin = MarketAdmin;

    document.addEventListener('DOMContentLoaded', () => {
        Forum.init();
        ModerationTabs.init();
        MarketAdmin.init();
    });
})();