package com.pansgroup.projectbackend.module.wordle;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserRepository;
import com.pansgroup.projectbackend.module.wordle.dto.WordleGameResponseDto;
import com.pansgroup.projectbackend.module.wordle.dto.WordleGameResponseDto.GuessResult;
import com.pansgroup.projectbackend.module.wordle.dto.WordleGameResponseDto.LetterResult;
import com.pansgroup.projectbackend.module.wordle.dto.WordleStatsDto;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

@Service
public class WordleServiceImpl implements WordleService {

    private static final Logger log = LoggerFactory.getLogger(WordleServiceImpl.class);
    private static final int MAX_ATTEMPTS = 6;
    private static final int WORD_LENGTH = 5;

    /** URL do pobrania wszystkich polskich słów (SJP-based, GitHub) - jako poprawne zgadnięcia */
    private static final String ALL_WORDS_URL =
            "https://raw.githubusercontent.com/kkrypt0nn/wordlists/main/wordlists/languages/polish.txt";

    /** URL do pobrania kuratorowanych 5-literowych słów (Slowotok, GitHub) - jako hasła dnia */
    private static final String DAILY_WORDS_URL =
            "https://raw.githubusercontent.com/MarekRudzki/Slowotok/master/assets/5_letter_words.txt";

    private final WordleWordRepository wordRepo;
    private final WordleAttemptRepository attemptRepo;
    private final UserRepository userRepo;
    private final ObjectMapper objectMapper;

    /** Pula 5-literowych polskich słów (lowercase, bez nazw własnych) - używana do losowania hasła dnia */
    private List<String> wordPool = new ArrayList<>();

    /** Zbiór wszystkich akceptowanych słów (do walidacji prób) - szersza baza słów */
    private Set<String> validWords = new HashSet<>();

    /** Data uruchomienia gry — do obliczania numeru gry */
    private static final LocalDate EPOCH = LocalDate.of(2025, 1, 1);

    public WordleServiceImpl(WordleWordRepository wordRepo,
                             WordleAttemptRepository attemptRepo,
                             UserRepository userRepo,
                             ObjectMapper objectMapper) {
        this.wordRepo = wordRepo;
        this.attemptRepo = attemptRepo;
        this.userRepo = userRepo;
        this.objectMapper = objectMapper;
    }

    // ─── Initialization ──────────────────────────────────────────────

    @PostConstruct
    public void init() {
        loadDictionaries();
        ensureTodayWord();
    }

    private void loadDictionaries() {
        HttpClient client = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();

        // 1. Załaduj hasła dnia (Slowotok)
        try {
            log.info("[Wordle] Pobieranie puli haseł dnia z {}...", DAILY_WORDS_URL);
            HttpRequest reqDaily = HttpRequest.newBuilder().uri(URI.create(DAILY_WORDS_URL)).GET().build();
            HttpResponse<String> resDaily = client.send(reqDaily, HttpResponse.BodyHandlers.ofString());
            if (resDaily.statusCode() == 200) {
                Set<String> dailyWords = new LinkedHashSet<>();
                try (BufferedReader reader = new BufferedReader(new java.io.StringReader(resDaily.body()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        String w = line.trim().toLowerCase();
                        if (w.isEmpty() || w.contains("-") || w.contains(" ") || !w.matches("[a-ząćęłńóśźż]+")) continue;
                        if (w.length() == WORD_LENGTH) {
                            dailyWords.add(w);
                        }
                    }
                }
                wordPool = new ArrayList<>(dailyWords);
                log.info("[Wordle] Załadowano {} haseł dnia.", wordPool.size());
            } else {
                log.warn("[Wordle] Błąd pobierania haseł dnia (HTTP {}).", resDaily.statusCode());
            }
        } catch (Exception e) {
            log.warn("[Wordle] Wyjątek podczas pobierania haseł dnia: {}", e.getMessage());
        }

        // 2. Załaduj słownik walidacji (kkrypt0nn)
        try {
            log.info("[Wordle] Pobieranie słownika poprawnych zgadnięć z {}...", ALL_WORDS_URL);
            HttpRequest reqAll = HttpRequest.newBuilder().uri(URI.create(ALL_WORDS_URL)).GET().build();
            HttpResponse<String> resAll = client.send(reqAll, HttpResponse.BodyHandlers.ofString());
            if (resAll.statusCode() == 200) {
                Set<String> allFiveLetterWords = new HashSet<>();
                try (BufferedReader reader = new BufferedReader(new java.io.StringReader(resAll.body()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        String w = line.trim().toLowerCase();
                        if (w.isEmpty() || w.contains("-") || w.contains(" ") || !w.matches("[a-ząćęłńóśźż]+")) continue;
                        if (w.length() == WORD_LENGTH) {
                            allFiveLetterWords.add(w);
                        }
                    }
                }
                validWords = allFiveLetterWords;
                log.info("[Wordle] Załadowano {} poprawnych zgadnięć.", validWords.size());
            } else {
                log.warn("[Wordle] Błąd pobierania słownika (HTTP {}).", resAll.statusCode());
            }
        } catch (Exception e) {
            log.warn("[Wordle] Wyjątek podczas pobierania słownika: {}", e.getMessage());
        }

        // Odfiltruj pulę haseł: zostaw tylko te, które znajdują się też w głównym słowniku
        if (!wordPool.isEmpty() && !validWords.isEmpty()) {
            List<String> intersection = new ArrayList<>();
            for (String w : wordPool) {
                if (validWords.contains(w)) {
                    intersection.add(w);
                }
            }
            wordPool = intersection;
            log.info("[Wordle] Po filtracji z głównym słownikiem zostało {} haseł dnia.", wordPool.size());
        }

        // Dodaj pozostałą wordPool do validWords na wszelki wypadek
        if (!wordPool.isEmpty()) {
            validWords.addAll(wordPool);
        }

        // Fallback w razie awarii sieci lub wyzerowania puli
        if (wordPool.isEmpty() || validWords.isEmpty()) {
            loadFallbackWords();
        }
    }

    /** Lista awaryjna gdyby internet zawiódł */
    private void loadFallbackWords() {
        List<String> fallback = Arrays.asList(
                "stary", "walka", "piąty", "motyw", "droga", "kolor", "praca", "świat", "kilka",
                "firma", "seria", "model", "forma", "klasa", "kryzys", "nauka", "pokój", "punkt",
                "miłość", "efekt", "wyraz", "obraz", "burza", "książ", "zamek", "taniec", "obrót",
                "gwiaź", "rower", "rynek", "serce", "muzyk", "łódka", "maska", "sklep", "chleb",
                "kwiat", "okrąg", "trawa", "ścian", "morze", "radio", "piłka", "prąd", "drzwi",
                "tabor", "stołu", "ogień", "lampa", "dywan", "peron", "śnieg", "deszcz", "wiatr",
                "chmur", "płyta", "kawał", "ulica", "młody", "cichy", "mocny", "jasny", "biały",
                "czarn", "numer", "adres", "salon", "hotel", "miast", "osoba", "pomoc", "wiara",
                "siłow", "dźwię", "piętr", "butel", "liczy", "tytuł", "dział", "płaszcz"
        );
        List<String> filtered = fallback.stream().filter(w -> w.length() == WORD_LENGTH).collect(Collectors.toList());
        if (wordPool.isEmpty()) wordPool = new ArrayList<>(filtered);
        if (validWords.isEmpty()) validWords = new HashSet<>(filtered);
        log.info("[Wordle] Użyto słów z listy awaryjnej.");
    }

    // ─── Scheduler ───────────────────────────────────────────────────

    /** Codziennie o północy wybieraj nowe hasło dnia */
    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void scheduleMidnightWord() {
        ensureTodayWord();
    }

    private void ensureTodayWord() {
        LocalDate today = LocalDate.now();
        if (wordRepo.findByGameDate(today).isEmpty()) {
            if (wordPool.isEmpty()) {
                log.error("[Wordle] Pula słów jest pusta! Nie można wygenerować hasła dnia.");
                return;
            }
            String chosen = wordPool.get(ThreadLocalRandom.current().nextInt(wordPool.size())).toUpperCase();
            WordleWord ww = new WordleWord();
            ww.setWord(chosen);
            ww.setGameDate(today);
            wordRepo.save(ww);
            log.info("[Wordle] Hasło dnia na {} zostało ustawione.", today);
        }
    }

    // ─── Game logic ─────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public WordleGameResponseDto getTodayGame() {
        User user = getCurrentUser();
        LocalDate today = LocalDate.now();
        int gameNumber = (int) ChronoUnit.DAYS.between(EPOCH, today);

        Optional<WordleAttempt> attemptOpt = attemptRepo.findByUserAndGameDate(user, today);
        WordleWord todayWord = wordRepo.findByGameDate(today).orElse(null);
        if (todayWord == null) {
            ensureTodayWord();
            todayWord = wordRepo.findByGameDate(today).orElse(null);
        }

        if (attemptOpt.isEmpty()) {
            // Nowa gra — brak prób
            return new WordleGameResponseDto(
                    List.of(), false, MAX_ATTEMPTS, false, null, gameNumber
            );
        }

        WordleAttempt attempt = attemptOpt.get();
        List<String> guesses = parseGuesses(attempt.getGuesses());
        String answer = todayWord != null ? todayWord.getWord() : "";
        List<GuessResult> results = guesses.stream()
                .map(g -> evaluateGuess(g, answer))
                .toList();

        boolean gameOver = attempt.isSolved() || guesses.size() >= MAX_ATTEMPTS;
        String revealedAnswer = gameOver ? answer : null;

        return new WordleGameResponseDto(
                results, attempt.isSolved(),
                MAX_ATTEMPTS - guesses.size(), gameOver,
                revealedAnswer, gameNumber
        );
    }

    @Override
    @Transactional
    public WordleGameResponseDto submitGuess(String guess) {
        User user = getCurrentUser();
        LocalDate today = LocalDate.now();
        int gameNumber = (int) ChronoUnit.DAYS.between(EPOCH, today);

        WordleWord todayWord = wordRepo.findByGameDate(today)
                .orElseThrow(() -> new IllegalStateException("Hasło dnia nie zostało jeszcze wygenerowane."));

        String normalizedGuess = guess.toUpperCase();
        String answer = todayWord.getWord();

        // Pobierz lub utwórz attempt
        WordleAttempt attempt = attemptRepo.findByUserAndGameDate(user, today)
                .orElseGet(() -> {
                    WordleAttempt a = new WordleAttempt();
                    a.setUser(user);
                    a.setGameDate(today);
                    a.setGuesses("[]");
                    return a;
                });

        List<String> guesses = parseGuesses(attempt.getGuesses());

        // Walidacja
        if (attempt.isSolved()) {
            throw new IllegalStateException("Już rozwiązałeś dzisiejsze Wordle!");
        }
        if (guesses.size() >= MAX_ATTEMPTS) {
            throw new IllegalStateException("Wykorzystano wszystkie próby na dziś.");
        }

        // Dodaj zgadywanie
        guesses.add(normalizedGuess);
        boolean solved = normalizedGuess.equals(answer);
        attempt.setGuesses(serializeGuesses(guesses));
        attempt.setSolved(solved);
        attemptRepo.save(attempt);

        // Buduj response
        List<GuessResult> results = guesses.stream()
                .map(g -> evaluateGuess(g, answer))
                .toList();

        boolean gameOver = solved || guesses.size() >= MAX_ATTEMPTS;
        String revealedAnswer = gameOver ? answer : null;

        return new WordleGameResponseDto(
                results, solved,
                MAX_ATTEMPTS - guesses.size(), gameOver,
                revealedAnswer, gameNumber
        );
    }

    @Override
    public boolean isValidWord(String word) {
        return validWords.contains(word.toLowerCase());
    }

    @Override
    @Transactional(readOnly = true)
    public WordleStatsDto getStats() {
        User user = getCurrentUser();
        long played = attemptRepo.countByUser(user);
        long won = attemptRepo.countByUserAndSolvedTrue(user);
        int winPct = played > 0 ? (int) Math.round(100.0 * won / played) : 0;

        // Oblicz streak — ile dni z rzędu rozwiązano (wstecz od dziś)
        long streak = calculateStreak(user);

        // Oblicz dystrybucję zgadnięć
        Map<Integer, Integer> distribution = new HashMap<>();
        for (int i = 1; i <= MAX_ATTEMPTS; i++) distribution.put(i, 0);

        List<WordleAttempt> allAttempts = attemptRepo.findByUser(user);
        for (WordleAttempt a : allAttempts) {
            if (a.isSolved()) {
                List<String> guesses = parseGuesses(a.getGuesses());
                int attempts = guesses.size();
                if (attempts > 0 && attempts <= MAX_ATTEMPTS) {
                    distribution.put(attempts, distribution.get(attempts) + 1);
                }
            }
        }

        return new WordleStatsDto(played, won, winPct, streak, streak, distribution);
    }

    @Override
    @Transactional(readOnly = true)
    public List<com.pansgroup.projectbackend.module.wordle.dto.WordleRankingDto> getRanking() {
        return attemptRepo.findTopPlayers(org.springframework.data.domain.PageRequest.of(0, 10));
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    private long calculateStreak(User user) {
        LocalDate date = LocalDate.now();
        long streak = 0;
        for (int i = 0; i < 365; i++) {
            Optional<WordleAttempt> a = attemptRepo.findByUserAndGameDate(user, date);
            if (a.isPresent() && a.get().isSolved()) {
                streak++;
                date = date.minusDays(1);
            } else if (a.isPresent() && !a.get().isSolved()) {
                break;
            } else {
                // Brak próby tego dnia — jeśli to dzisiejszy dzień, kontynuuj (jeszcze nie grał)
                if (i == 0) {
                    date = date.minusDays(1);
                    continue;
                }
                break;
            }
        }
        return streak;
    }

    private GuessResult evaluateGuess(String guess, String answer) {
        int len = Math.min(guess.length(), answer.length());
        LetterResult[] results = new LetterResult[len];

        // Liczymy wystąpienia liter w answer
        int[] answerLetterCount = new int[128]; // wystarczy dla ASCII + polskich w uppercase
        Map<Character, Integer> answerCharCount = new HashMap<>();
        for (char c : answer.toCharArray()) {
            answerCharCount.merge(c, 1, Integer::sum);
        }

        // Krok 1: Oznacz CORRECT
        boolean[] usedInAnswer = new boolean[len];
        for (int i = 0; i < len; i++) {
            if (guess.charAt(i) == answer.charAt(i)) {
                results[i] = new LetterResult(guess.charAt(i), "CORRECT");
                usedInAnswer[i] = true;
                answerCharCount.merge(guess.charAt(i), -1, Integer::sum);
            }
        }

        // Krok 2: Oznacz PRESENT lub ABSENT
        for (int i = 0; i < len; i++) {
            if (results[i] != null) continue;
            char c = guess.charAt(i);
            if (answerCharCount.getOrDefault(c, 0) > 0) {
                results[i] = new LetterResult(c, "PRESENT");
                answerCharCount.merge(c, -1, Integer::sum);
            } else {
                results[i] = new LetterResult(c, "ABSENT");
            }
        }

        return new GuessResult(guess, Arrays.asList(results));
    }

    private List<String> parseGuesses(String json) {
        if (json == null || json.isBlank()) return new ArrayList<>();
        try {
            return new ArrayList<>(objectMapper.readValue(json, new TypeReference<List<String>>() {}));
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private String serializeGuesses(List<String> guesses) {
        try {
            return objectMapper.writeValueAsString(guesses);
        } catch (Exception e) {
            return "[]";
        }
    }

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepo.findByEmail(email)
                .orElseThrow(() -> new IllegalStateException("Nie znaleziono zalogowanego użytkownika."));
    }

    // ─── Admin operations ────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getAdminInfo() {
        LocalDate today = LocalDate.now();
        WordleWord todayWord = wordRepo.findByGameDate(today).orElse(null);
        return Map.of(
                "currentWord", todayWord != null ? todayWord.getWord() : "BRAK",
                "gameDate", today.toString(),
                "wordPoolSize", wordPool.size(),
                "validWordsSize", validWords.size()
        );
    }

    @Override
    @Transactional
    public Map<String, Object> rerollTodayWord() {
        LocalDate today = LocalDate.now();
        if (wordPool.isEmpty()) {
            return Map.of("error", "Pula słów jest pusta!");
        }

        // Usuń stare hasło dnia oraz wszystkie dotychczasowe próby dzisiejszej gry
        wordRepo.findByGameDate(today).ifPresent(wordRepo::delete);
        attemptRepo.deleteByGameDate(today);
        wordRepo.flush();
        attemptRepo.flush();

        // Wylosuj nowe
        String chosen = wordPool.get(ThreadLocalRandom.current().nextInt(wordPool.size())).toUpperCase();
        WordleWord ww = new WordleWord();
        ww.setWord(chosen);
        ww.setGameDate(today);
        wordRepo.save(ww);

        log.info("[Wordle] Admin wylosował nowe hasło dnia: {}", chosen);
        return Map.of(
                "newWord", chosen,
                "gameDate", today.toString(),
                "message", "Nowe hasło dnia zostało wylosowane."
        );
    }
}
