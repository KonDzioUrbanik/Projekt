package com.pansgroup.projectbackend.module.user;

import lombok.extern.slf4j.Slf4j;
import com.pansgroup.projectbackend.exception.*;
import com.pansgroup.projectbackend.module.email.EmailService;
import com.pansgroup.projectbackend.module.student.StudentGroup;
import com.pansgroup.projectbackend.module.student.StudentGroupRepository;
import com.pansgroup.projectbackend.module.user.confirmation.ConfirmationToken;
import com.pansgroup.projectbackend.module.user.confirmation.ConfirmationTokenRepository;
import com.pansgroup.projectbackend.module.user.dto.*;
import com.pansgroup.projectbackend.module.system.AdminSecurityAuditService;
import com.pansgroup.projectbackend.module.user.passwordReset.PasswordResetToken;
import com.pansgroup.projectbackend.module.user.passwordReset.PasswordResetTokenRepository;
import com.pansgroup.projectbackend.module.system.SystemService;
import com.pansgroup.projectbackend.module.forum.ForumService;
import com.pansgroup.projectbackend.module.note.NoteService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.context.ApplicationEventPublisher;
import com.pansgroup.projectbackend.module.user.event.UserDeletedEvent;
import org.springframework.web.server.ResponseStatusException;
import com.pansgroup.projectbackend.security.LoginAttemptService;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@SuppressWarnings("ALL")
@Service
@Transactional
public class UserServiceImpl implements UserService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final StudentGroupRepository studentGroupRepository;
    private final EmailService emailService;
    private final ConfirmationTokenRepository confirmationTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;

    // Rate limiting dla forgot-password: email -> ostatni czas wysłania
    private final ConcurrentHashMap<String, LocalDateTime> passwordResetCooldown = new ConcurrentHashMap<>();
    private static final long COOLDOWN_SECONDS = 60;

    // Rate limiting dla confirmation: token -> ostatni czas próby
    private final ConcurrentHashMap<String, LocalDateTime> confirmationAttemptsCooldown = new ConcurrentHashMap<>();
    private static final long CONFIRMATION_COOLDOWN_SECONDS = 5;

    private final SystemService systemService;
    private final ForumService forumService;
    private final NoteService noteService;
    private final AdminSecurityAuditService securityAuditService;
    private final LoginAttemptService loginAttemptService;
    private final ApplicationEventPublisher eventPublisher;
    private final jakarta.persistence.EntityManager entityManager;

    public UserServiceImpl(UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            StudentGroupRepository studentGroupRepository,
            EmailService emailService,
            ConfirmationTokenRepository confirmationTokenRepository,
            PasswordResetTokenRepository passwordResetTokenRepository,
            SystemService systemService,
            ForumService forumService,
            NoteService noteService,
            AdminSecurityAuditService securityAuditService,
            LoginAttemptService loginAttemptService,
            ApplicationEventPublisher eventPublisher,
            jakarta.persistence.EntityManager entityManager) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.studentGroupRepository = studentGroupRepository;
        this.emailService = emailService;
        this.confirmationTokenRepository = confirmationTokenRepository;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.systemService = systemService;
        this.forumService = forumService;
        this.noteService = noteService;
        this.securityAuditService = securityAuditService;
        this.loginAttemptService = loginAttemptService;
        this.eventPublisher = eventPublisher;
        this.entityManager = entityManager;
    }

    @Override
    public User findUserByEmailInternal(String email) {
        String e = email.trim().toLowerCase(Locale.ROOT);
        return userRepository.findByEmail(e)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "Nie znaleziono użytkownika o adresie: " + e));
    }

    @Override
    public UserResponseDto create(UserCreateDto dto) {
        if (!systemService.isModuleEnabled("registration_enabled")) {
            securityAuditService.recordEvent("REGISTRATION_FAILED", getClientIp(), "Rejestracja zablokowana systemowo", null, "Guest");
            throw new RegistrationDisabledException();
        }
        String normalizedEmail = dto.email().trim().toLowerCase(Locale.ROOT);
        Integer indexNumber = extractIndexNumberFromEmail(normalizedEmail);
        if (indexNumber != null) {
            if (userRepository.existsByNrAlbumu(indexNumber)) {
                securityAuditService.recordEvent("REGISTRATION_FAILED", getClientIp(), "Nr albumu już istnieje: " + indexNumber, null, normalizedEmail);
                throw new AlbumNumberAlreadyExistsException(indexNumber);
            }
        }

        if (userRepository.existsByEmail(normalizedEmail)) {
            securityAuditService.recordEvent("REGISTRATION_FAILED", getClientIp(), "Email już zajęty: " + normalizedEmail, null, normalizedEmail);
            throw new EmailAlreadyExistsException(normalizedEmail);
        }

        User u = new User();
        u.setFirstName(dto.firstName().trim());
        u.setLastName(dto.lastName().trim());
        u.setEmail(normalizedEmail);
        u.setPassword(passwordEncoder.encode(dto.password()));
        u.setRole("STUDENT"); // Automatycznie rola STUDENT
        u.setNrAlbumu(indexNumber); // Z adresu email
        u.setActivated(false); // Poprawnie ustawione

        User saved = userRepository.save(u);
        securityAuditService.recordEvent("REGISTRATION_SUCCESS", getClientIp(), "Pomyślna rejestracja użytkownika: " + saved.getEmail(), saved.getId(), saved.getEmail());
        
        String tokenValue = UUID.randomUUID().toString();
        ConfirmationToken confirmationToken = new ConfirmationToken();
        confirmationToken.setToken(tokenValue);
        // Mail jest wysyłany
        emailService.sendConfirmationEmail(saved.getEmail(), tokenValue);
        confirmationToken.setExpiryDate(LocalDateTime.now().plusMinutes(10));
        confirmationToken.setUser(saved);
        confirmationTokenRepository.save(confirmationToken);

        return mapToResponseDto(saved);
    }

    private Integer extractIndexNumberFromEmail(String email) {
        if (email == null || email.isEmpty()) {
            return null;
        }

        // Nr indeksu to pierwsze cyfry przed '@'
        String localPart = email.split("@")[0];

        // Ekstrakcja cyfr z początku
        StringBuilder digits = new StringBuilder();
        for (char c : localPart.toCharArray()) {
            if (Character.isDigit(c)) {
                digits.append(c);
            } else {
                break;
            }
        }

        if (!digits.isEmpty()) {
            try {
                return Integer.parseInt(digits.toString());
            } catch (NumberFormatException e) {
                return null;
            }
        }

        return null;
    }

    @Override
    public List<UserResponseDto> findAll() {
        return userRepository.findAll()
                .stream()
                .sorted((u1, u2) -> Long.compare(u1.getId(), u2.getId())) // sortowanie po id rosnaco
                .map(this::mapToResponseDto) // bez hasła
                .toList();
    }

    @Override
    public UserResponseDto findById(Long id) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ID użytkownika nie może być puste.");
        }
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));
        return mapToResponseDto(user);
    }

    @Override
    public UserResponseDto findByEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email nie może być pusty.");
        }
        String e = email.trim().toLowerCase(Locale.ROOT);

        User user = userRepository.findByEmail(e)
                .orElseThrow(() -> new UsernameNotFoundException("Nie znaleziono użytkownika o adresie: " + e));

        return mapToResponseDto(user);
    }

    @Override
    public User authenticate(LoginRequestDto dto) {
        String normalizedEmail = dto.getEmail().trim().toLowerCase(Locale.ROOT);

        // 1. Sprawdzenie blokady (Account Lockout protection)
        if (loginAttemptService.isBlocked(normalizedEmail)) {
            securityAuditService.recordEvent("LOGIN_BLOCKED", getClientIp(),
                    "Próba logowania na zablokowane konto: " + normalizedEmail, null, normalizedEmail);
            throw new DisabledException("Konto zostało tymczasowo zablokowane z powodu zbyt wielu nieudanych prób logowania. Odczekaj 15 minut.");
        }

        // 2. Szukamy użytkownika
        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "Nie znaleziono użytkownika o adresie: " + normalizedEmail));

        // 3. Sprawdzamy poprawność hasła
        if (!passwordEncoder.matches(dto.getPassword(), user.getPassword())) {
            loginAttemptService.loginFailed(normalizedEmail); // Rejestracja porażki
            throw new BadCredentialsException(
                    "Wprowadzone dane logowania są nieprawidłowe. Sprawdź adres e-mail i hasło.");
        }

        // 4. Sukces - reset licznika
        loginAttemptService.loginSucceeded(normalizedEmail);
        return user;
    }

    private UserResponseDto mapToResponseDto(User u) {
        return new UserResponseDto(
                u.getId(),
                u.getFirstName(),
                u.getLastName(),
                u.getEmail(),
                u.getRole(),
                u.getNrAlbumu(),
                u.getStudentGroup() != null ? u.getStudentGroup().getId() : null,
                u.getStudentGroup() != null ? u.getStudentGroup().getName() : null,
                u.isActivated(),
                u.isBlocked(),
                u.getNickName(),
                u.getPhoneNumber(),
                u.getFieldOfStudy(),
                u.getYearOfStudy(),
                u.getStudyMode(),
                u.getBio(),
                u.getLastLogin(),
                u.getCreatedAt(),
                u.getLastLoginIp(),
                u.getFailedLoginAttempts(),
                u.getPreviousLogin());
    }

    /*
     * Metoda została zastąpiona nową logiką w serwisie systemowym,
     * zostawiam jako komentarz jeśli byłaby potrzebna w przyszłości
     */
    /*
     * private Integer extractYearFromGroupName(String groupName) {
     * ...
     * }
     */

    @Override
    @Transactional
    public UserResponseDto updateUser(Long userId, UserUpdateDto dto) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ID użytkownika jest wymagane.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));

        // Aktualizacja danych podstawowych
        user.setFirstName(dto.getFirstName());
        user.setLastName(dto.getLastName());

        // Aktualizacja pól informacyjnych profilu
        user.setNickName(dto.getNickName());
        user.setPhoneNumber(dto.getPhoneNumber());
        user.setFieldOfStudy(dto.getFieldOfStudy());
        if (dto.getYearOfStudy() != null && !dto.getYearOfStudy().isBlank()) {
            try {
                user.setYearOfStudy(Integer.valueOf(dto.getYearOfStudy()));
            } catch (NumberFormatException e) {
                // Skocz jeśli błąd formatu
            }
        } else {
            user.setYearOfStudy(null);
        }
        user.setStudyMode(dto.getStudyMode());
        user.setBio(dto.getBio());

        User savedUser = userRepository.save(user);
        return mapToResponseDto(savedUser);
    }

    @Override
    @Transactional
    public void changePassword(Long userId, PasswordChangeDto dto) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ID użytkownika jest wymagane.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));

        // Weryfikacja bieżącego hasła
        if (!passwordEncoder.matches(dto.getCurrentPassword(), user.getPassword())) {
            throw new PasswordMismatchException("Podane obecne hasło jest nieprawidłowe.");
        }

        // Weryfikacja nowego hasła i potwierdzenia
        if (!dto.getNewPassword().equals(dto.getConfirmPassword())) {
            throw new PasswordMismatchException("Nowe hasło i potwierdzenie hasła nie są identyczne.");
        }

        // Zmiana hasła
        user.setPassword(passwordEncoder.encode(dto.getNewPassword()));
        userRepository.save(user);
        securityAuditService.recordEvent("PASSWORD_CHANGE", null, "Użytkownik zmienił hasło: " + user.getEmail(), user.getId(), user.getEmail());
    }

    @Override
    public UserResponseDto getCurrentUser(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Taki email nie istnieje: " + email));
        return mapToResponseDto(user);
    }

    @Override
    public UserResponseDto updateRoleUser(String email, UserRoleUpdateDto dto) {
        User userToUpdate = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Taki email nie istnieje: " + email));
        
        String newRole = dto.newRole().trim().toUpperCase(Locale.ROOT);
        
        // Zabezpieczenie: Starosta musi mieć przypisany kierunek
        if ("STAROSTA".equals(newRole) && userToUpdate.getStudentGroup() == null) {
            throw new IllegalStateException("Nie można przypisać roli Starosty użytkownikowi bez przypisanego kierunku.");
        }

        userToUpdate.setRole(newRole);
        User saved = userRepository.save(userToUpdate);
        securityAuditService.recordEvent("ROLE_CHANGE", null, "Zmiana roli na " + newRole + " dla: " + email, null, email);
        return mapToResponseDto(saved);
    }

    @Override
    public UserResponseDto updateActivationStatus(Long userId, UserActivationUpdateDto dto) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ID użytkownika jest wymagane.");
        }
        User userToUpdate = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));

        if ("ADMIN".equalsIgnoreCase(userToUpdate.getRole()) && !Boolean.TRUE.equals(dto.activated())) {
            throw new IllegalStateException("Nie można dezaktywować konta administratora.");
        }

        userToUpdate.setActivated(Boolean.TRUE.equals(dto.activated()));
        return mapToResponseDto(userRepository.save(userToUpdate));
    }

    @Override
    @Transactional
    public UserResponseDto assignUserToGroup(String email, UserGroupAssignmentDto dto) {
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);

        // 1. Znajdź użytkownika
        User userToUpdate = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "Nie znaleziono użytkownika o adresie: " + normalizedEmail));

        // 2. Znajdź encję kierunku lub usuń przypisanie (jeśli groupId == null)
        Long groupId = dto.groupId();
        if (groupId == null) {
            // Zabezpieczenie: Nie można usunąć kierunku Staroście
            if ("STAROSTA".equalsIgnoreCase(userToUpdate.getRole())) {
                throw new IllegalStateException("Nie można usunąć kierunku użytkownikowi z rolą Starosty. Najpierw zmień jego rolę.");
            }
            // usunięcie przypisania do kierunku
            userToUpdate.setStudentGroup(null);
        } else {
            // użycie metody z studentGroupRepository, która zwróci encję kierunku
            StudentGroup group = studentGroupRepository.findById(groupId)
                    .orElseThrow(() -> new StudentGroupNotFoundException(groupId));
            // 3. Przypisz kierunek do użytkownika
            userToUpdate.setStudentGroup(group);
        }

        // 4. Zapisz i zwróć DTO
        return mapToResponseDto(userRepository.save(userToUpdate));
    }

    @Override
    public void confirmToken(String token) {
        // Rate limiting - sprawdź czy nie ma zbyt wielu prób dla tego tokenu
        LocalDateTime lastAttempt = confirmationAttemptsCooldown.get(token);
        if (lastAttempt != null) {
            long secondsSinceLastAttempt = Duration.between(lastAttempt, LocalDateTime.now()).getSeconds();
            if (secondsSinceLastAttempt < CONFIRMATION_COOLDOWN_SECONDS) {
                long remainingSeconds = CONFIRMATION_COOLDOWN_SECONDS - secondsSinceLastAttempt;
                throw new TooManyRequestsException(
                        "Zbyt wiele prób aktywacji. Poczekaj " + remainingSeconds + " sekund przed ponowną próbą.");
            }
        }

        // Zapisz timestamp próby
        confirmationAttemptsCooldown.put(token, LocalDateTime.now());

        // Wszystko tutaj jest poprawne
        Optional<ConfirmationToken> tokenOptional = confirmationTokenRepository.findByToken(token);
        if (!tokenOptional.isPresent()) {
            securityAuditService.recordEvent("ACTIVATION_FAILED", getClientIp(), "Nieprawidłowy token aktywacji: " + token, null, "Guest");
            throw new UsernameNotFoundException(
                    "Link aktywacyjny jest nieprawidłowy lub wygasł. Zarejestruj się ponownie lub skontaktuj się z administratorem.");
        } else {
            ConfirmationToken confirmationToken = tokenOptional.get();
            if (confirmationToken.getExpiryDate().isBefore(LocalDateTime.now())) {
                securityAuditService.recordEvent("ACTIVATION_FAILED", getClientIp(), "Token wygasł dla: " + (confirmationToken.getUser() != null ? confirmationToken.getUser().getEmail() : "unknown"), null, "Guest");
                throw new UsernameNotFoundException(
                        "Link aktywacyjny wygasł. Zarejestruj się ponownie lub skontaktuj się z administratorem.");
            }
            User user = confirmationToken.getUser();
            user.setActivated(true);
            userRepository.save(user);
            confirmationTokenRepository.delete(confirmationToken);
            
            securityAuditService.recordEvent("ACCOUNT_ACTIVATED", getClientIp(), "Konto aktywowane pomyślnie: " + user.getEmail(), user.getId(), user.getEmail());

            // Usuń z cooldown po udanej aktywacji
            confirmationAttemptsCooldown.remove(token);
        }
    }

    @Override
    public void requestPasswordReset(String email) {
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);

        // Rate limiting - sprawdź czy użytkownik nie spamuje
        LocalDateTime lastRequest = passwordResetCooldown.get(normalizedEmail);
        if (lastRequest != null) {
            long secondsSinceLastRequest = Duration.between(lastRequest, LocalDateTime.now()).getSeconds();
            if (secondsSinceLastRequest < COOLDOWN_SECONDS) {
                long remainingSeconds = COOLDOWN_SECONDS - secondsSinceLastRequest;
                throw new TooManyRequestsException(
                        "Poczekaj " + remainingSeconds + " sekund przed ponowną próbą wysłania linku resetującego.");
            }
        }
        passwordResetCooldown.put(normalizedEmail, LocalDateTime.now());

        Optional<User> userOpt = userRepository.findByEmail(normalizedEmail);

        if (userOpt.isEmpty()) {
            log.warn("Privacy-hardened: Password reset requested for non-existent email: {}", normalizedEmail);
            // Zwracamy normalnie, aby nie zdradzać istnienia konta
            return;
        }

        User u = userOpt.get();
        if (!u.isActivated()) {
            log.warn("Privacy-hardened: Password reset requested for inactive account: {}", normalizedEmail);
            // Również zwracamy normalnie (bezpieczeństwo przez niejasność)
            return;
        }

        // Generowanie tokenu i wysyłka
        PasswordResetToken passwordResetToken = new PasswordResetToken();
        passwordResetToken.setUser(u);
        passwordResetToken.setToken(UUID.randomUUID().toString());
        passwordResetToken.setExpiryDate(LocalDateTime.now().plusMinutes(10));
        passwordResetTokenRepository.save(passwordResetToken);

        emailService.sendPasswordResetEmail(u.getEmail(), passwordResetToken.getToken());
        securityAuditService.recordEvent("PASSWORD_RESET_REQUESTED", getClientIp(),
                "Wysłano link do resetowania hasła: " + u.getEmail(), u.getId(), u.getEmail());
    }

    @Override
    @Transactional
    public void deleteUser(Long userId) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ID użytkownika jest wymagane.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));

        if ("ADMIN".equals(user.getRole())) {
            throw new IllegalStateException("Nie można usunąć konta administratora.");
        }

        // --- 1. EVENT DRIVEN CLEANUP ---
        // Najpierw informujemy Notatki i Dysk (korzystamy z usera w pamięci)
        eventPublisher.publishEvent(new UserDeletedEvent(this, user));

        // --- 2. TWARDE CIĘCIE CYKLU (NATIVE SQL) ---
        // Zerujemy klucze bezpośrednio w bazie
        entityManager.createNativeQuery("UPDATE users SET confirmation_token_id = NULL WHERE id = :uid")
                .setParameter("uid", userId).executeUpdate();

        entityManager.createNativeQuery("DELETE FROM confirmation_token WHERE user_id = :uid")
                .setParameter("uid", userId).executeUpdate();
                
        entityManager.createNativeQuery("DELETE FROM password_reset_token WHERE user_id = :uid")
                .setParameter("uid", userId).executeUpdate();

        // --- 3. AMNEZJA HIBERNATE ---
        // Synchronizujemy zmiany SQL z sesją JPA i czyścimy cache L1, 
        // aby finałowe delete nie widziało już starych powiązań (np. z tokenami).
        entityManager.flush();
        entityManager.clear();

        // --- 4. FINALNE USUNIĘCIE ---
        User cleanUser = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));
                
        userRepository.delete(cleanUser);
        userRepository.flush();
    }

    @Override
    public void processPasswordReset(String token, String newPassword, String confirmPassword) {
        if (!newPassword.equals(confirmPassword)) {
            throw new PasswordMismatchException(
                    "Wprowadzone hasła nie są identyczne. Upewnij się, że oba pola zawierają to samo hasło.");
        }
        Optional<PasswordResetToken> tokenOptional = passwordResetTokenRepository.findByToken(token);
        if (!tokenOptional.isEmpty()) {
            if (tokenOptional.get().getExpiryDate().isBefore(LocalDateTime.now())) {
                throw new UsernameNotFoundException("Link do resetowania hasła wygasł. Wystąp o nowy link resetujący.");
            } else {
                PasswordResetToken passwordResetToken = tokenOptional.get();
                User user = passwordResetToken.getUser();
                user.setPassword(passwordEncoder.encode(newPassword));
                userRepository.save(user);
                passwordResetTokenRepository.delete(passwordResetToken);
                securityAuditService.recordEvent("PASSWORD_RESET_SUCCESS", getClientIp(), "Hasło zresetowane pomyślnie: " + user.getEmail(), user.getId(), user.getEmail());
            }
        } else {
            securityAuditService.recordEvent("PASSWORD_RESET_FAILED", getClientIp(), "Nieprawidłowy lub wygasły token resetu", null, "Guest");
            throw new UsernameNotFoundException(
                    "Link do resetowania hasła jest nieprawidłowy lub wygasł. Wystąp o nowy link resetujący.");
        }
    }

    @Override
    @Transactional
    public void uploadAvatar(Long userId, org.springframework.web.multipart.MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Plik nie może być pusty");
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null) {
             throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Nazwa pliku nie może być pusta.");
        }
        String filename = org.springframework.util.StringUtils.cleanPath(originalFilename);
        String extension = org.springframework.util.StringUtils.getFilenameExtension(filename);
        List<String> allowedExtensions = java.util.Arrays.asList("jpg", "jpeg", "png", "gif");

        if (extension == null || !allowedExtensions.contains(extension.toLowerCase())) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    "Niedozwolone rozszerzenie pliku: " + extension + ". Dozwolone: jpg, png, gif.");
        }

        String mimeType = file.getContentType();
        if (mimeType == null || !mimeType.startsWith("image/")) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Niedozwolony typ pliku: " + mimeType);
        }

        try {
            byte[] fileData = file.getBytes();
            
            // Magic Bytes Verification (Anti-MIME Sniffing)
            try (java.io.InputStream is = new java.io.ByteArrayInputStream(fileData)) {
                String detectedMime = new org.apache.tika.Tika().detect(is);
                if (!detectedMime.startsWith("image/")) {
                    throw new org.springframework.web.server.ResponseStatusException(
                            org.springframework.http.HttpStatus.BAD_REQUEST, 
                            "Przesłany plik nie jest prawdziwym obrazem (wykryto: " + detectedMime + ")");
                }
            }

            if (userId == null) {
                throw new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.BAD_REQUEST, "ID użytkownika jest wymagane.");
            }
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new UserNotFoundException(userId));

            user.setAvatarData(fileData);
            user.setAvatarContentType(mimeType);
            userRepository.save(user);
            securityAuditService.recordEvent("AVATAR_UPLOAD", null, "Wgrano nowy awatar dla: " + user.getEmail(), user.getId(), user.getEmail());
        } catch (java.io.IOException e) {
            throw new RuntimeException("Błąd podczas przetwarzania awatara", e);
        }
    }

    @Override
    @Transactional
    public User getAvatar(Long userId) {
        if (userId == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "ID użytkownika jest wymagane.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));

        if (user.getAvatarData() == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.NOT_FOUND, "Użytkownik nie ma awatara");
        }
        return user;
    }

    @Override
    @Transactional
    public void removeAvatar(Long userId) {
        if (userId == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "ID użytkownika jest wymagane.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));
        user.setAvatarData(null);
        user.setAvatarContentType(null);
        userRepository.save(user);
    }

    @Override
    public List<UserResponseDto> searchUsers(String query) {
        String searchPattern = "%" + query.toLowerCase() + "%";
        List<User> users = userRepository.searchByNameOrEmail(searchPattern);
        return users.stream()
                .map(this::mapToResponseDto)
                .toList();
    }

    @Override
    @Transactional
    public void updateLastLogin(String email, String ip) {
        userRepository.findByEmail(email.toLowerCase(Locale.ROOT)).ifPresent(user -> {
            user.setPreviousLogin(user.getLastLogin()); // Zapamiętaj poprzedni czas
            user.setLastLogin(java.time.LocalDateTime.now()); // Ustaw nowy czas
            user.setLastLoginIp(ip);
            user.setFailedLoginAttempts(0); // Reset przy udanym logowaniu
            userRepository.save(user);
        });
    }

    @Override
    @Transactional
    public void incrementFailedAttempts(String email) {
        userRepository.findByEmail(email.toLowerCase(Locale.ROOT)).ifPresent(user -> {
            Integer current = user.getFailedLoginAttempts();
            user.setFailedLoginAttempts((current != null ? current : 0) + 1);
            userRepository.save(user);
        });
    }

    @Override
    @Transactional
    public void resetFailedAttempts(String email) {
        userRepository.findByEmail(email.toLowerCase(Locale.ROOT)).ifPresent(user -> {
            user.setFailedLoginAttempts(0);
            userRepository.save(user);
        });
    }

    @Override
    @Transactional
    public UserResponseDto toggleBlock(Long userId) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ID użytkownika jest wymagane.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UsernameNotFoundException("Nie znaleziono użytkownika o ID: " + userId));

        // Zabezpieczenie przed blokowaniem administratorów
        if ("ADMIN".equalsIgnoreCase(user.getRole())) {
            throw new IllegalStateException("Nie można zablokować konta administratora.");
        }

        user.setBlocked(!user.isBlocked());
        User saved = userRepository.save(user);
        String action = saved.isBlocked() ? "BLOCKED" : "UNBLOCKED";
        securityAuditService.recordEvent("USER_STATUS_CHANGE", null, "Użytkownik " + action + ": " + saved.getEmail(), null, saved.getEmail());
        return mapToResponseDto(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserActivityResponseDto> getUserActivity(Long userId) {
        if (userId == null) {
            return java.util.Collections.emptyList();
        }
        List<UserActivityResponseDto> activities = new java.util.ArrayList<>();
        forumService.getUserThreads(userId).stream().limit(5).forEach(t -> activities.add(new UserActivityResponseDto(t.id(), "FORUM_THREAD", t.title(), t.content(), t.createdAt(), "Wątek na forum")));
        noteService.findByUser(userId).stream().limit(5).forEach(n -> activities.add(new UserActivityResponseDto(n.id(), "NOTE", n.title(), n.content(), n.createdAt(), "Notatka")));
        return activities.stream().sorted((a1, a2) -> a2.createdAt().compareTo(a1.createdAt())).limit(5).toList();
    }

    private String getClientIp() {
        try {
            org.springframework.web.context.request.ServletRequestAttributes attr = 
                (org.springframework.web.context.request.ServletRequestAttributes) org.springframework.web.context.request.RequestContextHolder.currentRequestAttributes();
            return securityAuditService.extractClientIp(attr.getRequest());
        } catch (Exception e) {
            return "0:0:0:0:0:0:0:1";
        }
    }
}