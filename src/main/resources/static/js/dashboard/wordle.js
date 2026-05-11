/* ═══════════════════════════════════════════════════════
   WORDLE — Frontend Logic
   ═══════════════════════════════════════════════════════ */

(function () {
    'use strict';

    const MAX_ATTEMPTS = 6;
    const WORD_LENGTH  = 5;

    // ─── DOM references ──────────────────────────────────
    if (!document.getElementById('wordleBoard')) return;

    const board       = document.getElementById('wordleBoard');
    const keyboard    = document.getElementById('wordleKeyboard');
    const msgEl       = document.getElementById('wordleMessage');
    const gameNumEl   = document.getElementById('wordleGameNumber');
    const countdownEl = document.getElementById('wordleCountdown');
    const statsCountdownEl = document.getElementById('statsCountdown');

    // Modals
    const helpModal   = document.getElementById('wordleHelpModal');
    const statsModal  = document.getElementById('wordleStatsModal');
    const rankingModal = document.getElementById('wordleRankingModal');

    // ─── State ───────────────────────────────────────────
    let currentRow    = 0;
    let currentCol    = 0;
    let currentGuess  = '';
    let gameOver      = false;
    let solved        = false;
    let guesses       = [];      // array of strings
    let guessResults  = [];      // array of GuessResult from API
    let isSubmitting  = false;

    // ─── Init ────────────────────────────────────────────
    buildBoard();
    bindKeyboard();
    bindModals();
    startCountdownTimer();
    loadGame();

    // ─── Board builder ───────────────────────────────────
    function buildBoard() {
        if (!board) return;
        board.innerHTML = '';
        for (let r = 0; r < MAX_ATTEMPTS; r++) {
            const row = document.createElement('div');
            row.className = 'wordle-row';
            row.dataset.row = r;
            for (let c = 0; c < WORD_LENGTH; c++) {
                const tile = document.createElement('div');
                tile.className = 'wordle-tile';
                tile.dataset.row = r;
                tile.dataset.col = c;
                row.appendChild(tile);
            }
            board.appendChild(row);
        }
    }

    // ─── Keyboard ────────────────────────────────────────
    function bindKeyboard() {
        if (!keyboard) return;

        // On-screen keyboard
        keyboard.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-key]');
            if (!btn) return;
            handleKey(btn.dataset.key);
        });

        // Physical keyboard
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.altKey || e.metaKey) return;
            // Check if focus is on an input/textarea
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

            if (e.key === 'Enter') {
                handleKey('ENTER');
            } else if (e.key === 'Backspace') {
                handleKey('BACKSPACE');
            } else {
                const key = e.key.toUpperCase();
                if (/^[A-ZĄĆĘŁŃÓŚŹŻ]$/.test(key)) {
                    handleKey(key);
                }
            }
        });
    }

    function handleKey(key) {
        if (gameOver || isSubmitting) return;

        if (key === 'ENTER') {
            submitGuess();
        } else if (key === 'BACKSPACE') {
            deleteLetter();
        } else {
            addLetter(key);
        }
    }

    function addLetter(letter) {
        if (currentCol >= WORD_LENGTH) return;
        const tile = getTile(currentRow, currentCol);
        tile.textContent = letter;
        tile.classList.add('filled');
        currentGuess += letter;
        currentCol++;
    }

    function deleteLetter() {
        if (currentCol <= 0) return;
        currentCol--;
        const tile = getTile(currentRow, currentCol);
        tile.textContent = '';
        tile.classList.remove('filled');
        currentGuess = currentGuess.slice(0, -1);
    }

    async function submitGuess() {
        if (currentGuess.length < WORD_LENGTH) {
            shakeRow(currentRow);
            showMessage('Za mało liter', 'error');
            return;
        }

        isSubmitting = true;
        try {
            const res = await fetch('/api/wordle/guess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guess: currentGuess })
            });

            const data = await res.json();

            if (!res.ok) {
                shakeRow(currentRow);
                showMessage(data.error || 'Błąd', 'error');
                return;
            }

            // Animate the latest guess
            const latestResult = data.guesses[data.guesses.length - 1];
            await animateRow(currentRow, latestResult);

            // Update keyboard colors
            updateKeyboard(data.guesses);

            // Update state
            guesses.push(currentGuess);
            guessResults = data.guesses;
            solved = data.solved;
            gameOver = data.gameOver;

            if (solved) {
                const messages = ['Genialnie!', 'Wspaniale!', 'Świetnie!', 'Nieźle!', 'Dobrze!', 'Uff, w ostatniej chwili!'];
                showMessage(messages[Math.min(currentRow, messages.length - 1)], 'success');
                bounceRow(currentRow);
                setTimeout(() => openStatsModal(), 1500);
            } else if (gameOver) {
                showMessage('Hasło: ' + data.answer, 'error');
                setTimeout(() => openStatsModal(), 2000);
            }

            currentRow++;
            currentCol = 0;
            currentGuess = '';

        } catch (err) {
            showMessage('Błąd połączenia', 'error');
        } finally {
            isSubmitting = false;
        }
    }

    // ─── Animations ──────────────────────────────────────
    function animateRow(row, result) {
        return new Promise((resolve) => {
            const tiles = getRowTiles(row);
            let delay = 0;
            tiles.forEach((tile, idx) => {
                setTimeout(() => {
                    tile.classList.add('flip');
                    const status = result.letters[idx].status.toLowerCase();
                    setTimeout(() => {
                        tile.classList.add(status);
                        tile.classList.remove('flip');
                        // Re-add flip for smooth transition
                        tile.style.animation = 'none';
                        tile.offsetHeight; // reflow
                        tile.style.animation = '';
                    }, 250);
                }, delay);
                delay += 200;
            });
            setTimeout(resolve, delay + 300);
        });
    }

    function shakeRow(row) {
        const rowEl = board.children[row];
        if (rowEl) {
            rowEl.classList.add('shake');
            setTimeout(() => rowEl.classList.remove('shake'), 500);
        }
    }

    function bounceRow(row) {
        const tiles = getRowTiles(row);
        tiles.forEach((tile, idx) => {
            setTimeout(() => {
                tile.classList.add('win-bounce');
            }, idx * 100);
        });
    }

    // ─── Keyboard coloring ───────────────────────────────
    function updateKeyboard(allGuesses) {
        const keyStates = {};
        // Priority: correct > present > absent
        for (const guess of allGuesses) {
            for (const lr of guess.letters) {
                const key = lr.letter;
                const status = lr.status.toLowerCase();
                const current = keyStates[key];
                if (!current || priority(status) > priority(current)) {
                    keyStates[key] = status;
                }
            }
        }
        // Apply to keyboard buttons
        keyboard.querySelectorAll('button[data-key]').forEach(btn => {
            const key = btn.dataset.key;
            if (keyStates[key]) {
                btn.classList.remove('correct', 'present', 'absent');
                btn.classList.add(keyStates[key]);
            }
        });
    }

    function priority(status) {
        if (status === 'correct') return 3;
        if (status === 'present') return 2;
        if (status === 'absent')  return 1;
        return 0;
    }

    // ─── Load game from API ──────────────────────────────
    async function loadGame() {
        if (!board) return;
        try {
            const res = await fetch('/api/wordle/today');
            if (!res.ok) return;
            const data = await res.json();

            gameNumEl.textContent = 'Gra #' + data.gameNumber;
            guessResults = data.guesses || [];
            solved = data.solved;
            gameOver = data.gameOver;

            // Restore board
            guessResults.forEach((result, rowIdx) => {
                const tiles = getRowTiles(rowIdx);
                result.letters.forEach((lr, colIdx) => {
                    tiles[colIdx].textContent = lr.letter;
                    tiles[colIdx].classList.add('filled', lr.status.toLowerCase());
                });
                guesses.push(result.word);
            });

            currentRow = guessResults.length;
            updateKeyboard(guessResults);

            if (solved) {
                showMessage('Już rozwiązałeś dzisiejsze Wordle!', 'success');
            } else if (gameOver) {
                showMessage('Hasło: ' + data.answer, 'error');
            }
        } catch (err) {
            console.error('[Wordle] Błąd ładowania gry:', err);
        }
    }

    // ─── Messages ────────────────────────────────────────
    function showMessage(text, type) {
        msgEl.textContent = text;
        msgEl.className = 'wordle-message' + (type ? ' ' + type : '');
        if (type !== 'success' || !solved) {
            clearTimeout(msgEl._timeout);
            msgEl._timeout = setTimeout(() => {
                if (!solved && !gameOver) msgEl.textContent = '';
            }, 3000);
        }
    }

    // ─── Helpers ─────────────────────────────────────────
    function getTile(row, col) {
        return board.querySelector(`.wordle-tile[data-row="${row}"][data-col="${col}"]`);
    }

    function getRowTiles(row) {
        return Array.from(board.querySelectorAll(`.wordle-tile[data-row="${row}"]`));
    }

    // ─── Countdown timer ─────────────────────────────────
    function startCountdownTimer() {
        function update() {
            const now = new Date();
            const midnight = new Date(now);
            midnight.setHours(24, 0, 0, 0);
            const diff = midnight - now;

            const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
            const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
            const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');

            const timeStr = `${h}:${m}:${s}`;
            if (countdownEl) countdownEl.textContent = timeStr;
            if (statsCountdownEl) statsCountdownEl.textContent = timeStr;
        }
        update();
        setInterval(update, 1000);
    }

    // ─── Modals ──────────────────────────────────────────
    function bindModals() {
        // Help
        document.getElementById('wordleHelpBtn').addEventListener('click', () => {
            helpModal.classList.add('active');
            helpModal.setAttribute('aria-hidden', 'false');
        });
        document.getElementById('closeHelpModal').addEventListener('click', () => {
            helpModal.classList.remove('active');
            helpModal.setAttribute('aria-hidden', 'true');
        });

        // Stats
        const statsBtn = document.getElementById('wordleStatsBtn');
        if (statsBtn) statsBtn.addEventListener('click', openStatsModal);
        document.getElementById('closeStatsModal').addEventListener('click', () => {
            statsModal.classList.remove('active');
            statsModal.setAttribute('aria-hidden', 'true');
        });

        // Ranking
        const rankingBtn = document.getElementById('wordleRankingBtn');
        if (rankingBtn) rankingBtn.addEventListener('click', openRankingModal);
        document.getElementById('closeRankingModal').addEventListener('click', () => {
            rankingModal.classList.remove('active');
            rankingModal.setAttribute('aria-hidden', 'true');
        });

        // Close on overlay click
        [helpModal, statsModal, rankingModal].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                    modal.setAttribute('aria-hidden', 'true');
                }
            });
        });
    }

    async function openStatsModal() {
        try {
            const res = await fetch('/api/wordle/stats');
            if (res.ok) {
                const stats = await res.json();
                document.getElementById('statPlayed').textContent  = stats.gamesPlayed;
                document.getElementById('statWon').textContent     = stats.gamesWon;
                document.getElementById('statWinPct').textContent   = stats.winPercentage;
                document.getElementById('statStreak').textContent   = stats.currentStreak;

                // Render distribution
                const distContainer = document.getElementById('guessDistributionContainer');
                if (distContainer && stats.guessDistribution) {
                    distContainer.innerHTML = '';
                    let maxCount = 0;
                    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
                        if (stats.guessDistribution[i] > maxCount) maxCount = stats.guessDistribution[i];
                    }
                    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
                        const count = stats.guessDistribution[i] || 0;
                        const widthPct = maxCount > 0 ? Math.max(5, Math.round((count / maxCount) * 100)) : 5;
                        
                        const row = document.createElement('div');
                        row.style.display = 'flex';
                        row.style.alignItems = 'center';
                        row.style.gap = '0.5rem';

                        const numLabel = document.createElement('div');
                        numLabel.textContent = i;
                        numLabel.style.width = '1rem';
                        numLabel.style.fontWeight = 'bold';
                        numLabel.style.color = 'var(--text-secondary)';

                        const barContainer = document.createElement('div');
                        barContainer.style.flex = '1';
                        barContainer.style.background = 'var(--bg-step)';
                        barContainer.style.borderRadius = '4px';

                        const bar = document.createElement('div');
                        bar.style.width = widthPct + '%';
                        bar.style.background = count > 0 ? '#16a34a' : '#4b5563';
                        bar.style.color = '#fff';
                        bar.style.fontSize = '0.8rem';
                        bar.style.padding = '0.1rem 0.4rem';
                        bar.style.borderRadius = '4px';
                        bar.style.textAlign = 'right';
                        bar.style.fontWeight = 'bold';
                        bar.textContent = count;

                        barContainer.appendChild(bar);
                        row.appendChild(numLabel);
                        row.appendChild(barContainer);
                        distContainer.appendChild(row);
                    }
                }
            }
        } catch (err) {
            console.error('[Wordle] Błąd statystyk:', err);
        }
        statsModal.classList.add('active');
        statsModal.setAttribute('aria-hidden', 'false');
    }

    async function openRankingModal() {
        try {
            const res = await fetch('/api/wordle/ranking');
            if (res.ok) {
                const ranking = await res.json();
                const list = document.getElementById('wordleRankingList');
                list.innerHTML = '';
                
                if (ranking.length === 0) {
                    list.innerHTML = '<li style="text-align: center; color: var(--text-secondary);">Brak wyników. Zagraj, aby być pierwszym!</li>';
                } else {
                    ranking.forEach((player, idx) => {
                        const initial = player.lastName ? player.lastName.charAt(0) + '.' : '';
                        const name = player.firstName + ' ' + initial;
                        
                        const li = document.createElement('li');
                        li.style.display = 'flex';
                        li.style.justifyContent = 'space-between';
                        li.style.padding = '0.5rem 0';
                        li.style.borderBottom = '1px solid var(--border-color)';
                        
                        let medal = '';
                        if (idx === 0) medal = '🥇 ';
                        else if (idx === 1) medal = '🥈 ';
                        else if (idx === 2) medal = '🥉 ';
                        else medal = `<span style="display:inline-block; width:1.5rem; text-align:center;">${idx + 1}.</span> `;

                        const nameSpan = document.createElement('span');
                        nameSpan.innerHTML = `${medal} <strong>${name}</strong>`;
                        
                        const scoreSpan = document.createElement('span');
                        scoreSpan.textContent = `${player.gamesWon} wygranych`;
                        scoreSpan.style.color = '#16a34a';
                        scoreSpan.style.fontWeight = 'bold';

                        li.appendChild(nameSpan);
                        li.appendChild(scoreSpan);
                        list.appendChild(li);
                    });
                }
            }
        } catch (err) {
            console.error('[Wordle] Błąd rankingu:', err);
        }
        rankingModal.classList.add('active');
        rankingModal.setAttribute('aria-hidden', 'false');
    }
    // ─── Admin panel ─────────────────────────────────────
    const adminPanel = document.getElementById('wordleAdminPanel');
    if (adminPanel) {
        loadAdminInfo();
        document.getElementById('adminRerollBtn').addEventListener('click', rerollWord);
        
        const revealBtn = document.getElementById('adminRevealBtn');
        const wordSpan = document.getElementById('adminCurrentWord');
        if (revealBtn && wordSpan) {
            revealBtn.addEventListener('click', () => {
                if (wordSpan.style.filter === 'none') {
                    wordSpan.style.filter = 'blur(5px)';
                    revealBtn.innerHTML = '<i class="fas fa-eye"></i> Pokaż';
                } else {
                    wordSpan.style.filter = 'none';
                    revealBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Ukryj';
                }
            });
            wordSpan.addEventListener('click', () => {
                wordSpan.style.filter = wordSpan.style.filter === 'none' ? 'blur(5px)' : 'none';
                revealBtn.innerHTML = wordSpan.style.filter === 'none' ? '<i class="fas fa-eye-slash"></i> Ukryj' : '<i class="fas fa-eye"></i> Pokaż';
            });
        }
    }

    async function loadAdminInfo() {
        try {
            const res = await fetch('/api/wordle/admin/info');
            if (res.ok) {
                const data = await res.json();
                document.getElementById('adminCurrentWord').textContent = data.currentWord;
                document.getElementById('adminGameDate').textContent = data.gameDate;
                document.getElementById('adminPoolSize').textContent = data.wordPoolSize;
                
                const validWordsEl = document.getElementById('adminValidWordsSize');
                if (validWordsEl) validWordsEl.textContent = data.validWordsSize || 0;
            }
        } catch (err) {
            console.error('[Wordle] Błąd ładowania info admina:', err);
        }
    }

    async function rerollWord() {
        if (!confirm('Czy na pewno chcesz wylosować nowe hasło dnia? Obecne hasło zostanie zastąpione.')) {
            return;
        }
        try {
            const res = await fetch('/api/wordle/admin/reroll', { method: 'POST' });
            const data = await res.json();
            if (data.error) {
                showMessage(data.error, 'error');
            } else {
                document.getElementById('adminCurrentWord').textContent = data.newWord;
                showMessage('Nowe hasło: ' + data.newWord, 'success');
            }
        } catch (err) {
            showMessage('Błąd losowania', 'error');
        }
    }

})();
