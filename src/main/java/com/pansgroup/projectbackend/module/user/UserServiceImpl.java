package com.pansgroup.projectbackend.module.user;

import com.pansgroup.projectbackend.exception.*;
import com.pansgroup.projectbackend.module.email.EmailService;
import com.pansgroup.projectbackend.module.student.StudentGroup;
import com.pansgroup.projectbackend.module.student.StudentGroupRepository;
import com.pansgroup.projectbackend.module.user.confirmation.ConfirmationToken;
import com.pansgroup.projectbackend.module.user.confirmation.ConfirmationTokenRepository;
import com.pansgroup.projectbackend.module.user.dto.*;
import com.pansgroup.projectbackend.module.user.passwordReset.PasswordResetToken;
import com.pansgroup.projectbackend.module.user.passwordReset.PasswordResetTokenRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

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

    public UserServiceImpl(UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            StudentGroupRepository studentGroupRepository,
            EmailService emailService, ConfirmationTokenRepository confirmationTokenRepository,
            PasswordResetTokenRepository passwordResetTokenRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.studentGroupRepository = studentGroupRepository;
        this.emailService = emailService;
        this.confirmationTokenRepository = confirmationTokenRepository;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
    }

    @Override
    public User findUserByEmailInternal(String email) {
        String e = email.trim().toLowerCase(Locale.ROOT);
        return userRepository.findByEmail(e)
                .orElseThrow(() -> new org.springframework.security.core.userdetails.UsernameNotFoundException(
                        "Nie znaleziono użytkownika o adresie: " + e));
    }

    @Override
    public UserResponseDto create(UserCreateDto dto) {
        String normalizedEmail = dto.email().trim().toLowerCase(Locale.ROOT);
        Integer indexNumber = extractIndexNumberFromEmail(normalizedEmail);
        if (indexNumber != null) {
            if (userRepository.existsByNrAlbumu(indexNumber)) {
                throw new AlbumNumberAlreadyExistsException(indexNumber);
            }
        }

        if (userRepository.existsByEmail(normalizedEmail)) {
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
        String tokenValue = UUID.randomUUID().toString();
        ConfirmationToken confirmationToken = new ConfirmationToken();
        confirmationToken.setToken(tokenValue);
        // Mail jest wysyłany
        emailService.sendConfirmationEmail(saved.getEmail(), tokenValue);
        confirmationToken.setExpiryDate(LocalDateTime.now().plusMinutes(10));
        confirmationToken.setUser(saved); // POPRAWNIE: Użytkownik przypisany do tokenu
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
    public UserResponseDto findByEmail(String email) {
        String e = email.trim().toLowerCase(Locale.ROOT);

        User user = userRepository.findByEmail(e)
                .orElseThrow(() -> new UsernameNotFoundException("Nie znaleziono użytkownika o adresie: " + e));

        return mapToResponseDto(user);
    }

    @Override
    public User authenticate(LoginRequestDto dto) {
        String normalizedEmail = dto.getEmail().trim().toLowerCase(Locale.ROOT);

        // Szukamy użytkownika po emailu
        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "Nie znaleziono użytkownika o adresie: " + normalizedEmail));

        // Sprawdzamy poprawność hasła
        if (!passwordEncoder.matches(dto.getPassword(), user.getPassword())) {
            throw new BadCredentialsException(
                    "Wprowadzone dane logowania są nieprawidłowe. Sprawdź adres e-mail i hasło.");
        }

        return user;
    }

    private UserResponseDto mapToResponseDto(User u) {
        Long groupId = u.getStudentGroup() != null ? u.getStudentGroup().getId() : null;
        String groupName = u.getStudentGroup() != null ? u.getStudentGroup().getName() : null;

        // POPRAWKA: Usunięto 9. argument (u.isActivated), aby pasował do DTO
        return new UserResponseDto(
                u.getId(),
                u.getFirstName(),
                u.getLastName(),
                u.getEmail(),
                u.getRole(),
                u.getNrAlbumu(),
                groupId,
                groupName,
                u.isActivated,
                u.getNickName(),
                u.getPhoneNumber(),
                u.getFieldOfStudy(),
                // Priorytet dla roku studiów: Kierunek > Profil
                extractYearFromGroupName(groupName) != null ? extractYearFromGroupName(groupName) : u.getYearOfStudy(),
                u.getStudyMode(),
                u.getBio());
    }

    private Integer extractYearFromGroupName(String groupName) {
        if (groupName == null || groupName.isEmpty()) {
            return null;
        }

        // Szukanie rzymskich cyfr oznaczających rok (I-V)
        // \b zapewnia, że jest to całe słowo (np. żeby nie złapać 'I' w słowie
        // 'Informatyka')
        // Sprawdzamy najpierw IV, żeby nie złapało I czy V
        if (groupName.matches(".*\\bIV\\b.*"))
            return 4;
        if (groupName.matches(".*\\bIII\\b.*"))
            return 3;
        if (groupName.matches(".*\\bII\\b.*"))
            return 2;
        if (groupName.matches(".*\\bI\\b.*"))
            return 1;
        if (groupName.matches(".*\\bV\\b.*"))
            return 5;

        return null;
    }

    @Override
    @Transactional
    public UserResponseDto updateUser(Long userId, UserUpdateDto dto) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));

        // Aktualizacja danych podstawowych
        user.setFirstName(dto.getFirstName());
        user.setLastName(dto.getLastName());

        // Aktualizacja pól informacyjnych profilu
        // UWAGA: Pola poniżej są CZYSTO INFORMACYJNE i NIE wpływają na członkostwo w
        // grupie.
        // Rzeczywiste przypisanie do grupy (user.studentGroup) jest zarządzane
        // WYŁĄCZNIE
        // przez administratora poprzez endpoint assignUserToGroup().
        // Użytkownik może swobodnie edytować te pola dla celów prezentacyjnych.
        user.setNickName(dto.getNickName());
        user.setPhoneNumber(dto.getPhoneNumber());
        user.setFieldOfStudy(dto.getFieldOfStudy());
        user.setYearOfStudy(Integer.valueOf(dto.getYearOfStudy()));
        user.setStudyMode(dto.getStudyMode());
        user.setBio(dto.getBio());

        User savedUser = userRepository.save(user);
        return mapToResponseDto(savedUser);
    }

    @Override
    @Transactional
    public void changePassword(Long userId, PasswordChangeDto dto) {
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
        userToUpdate.setRole(dto.newRole().trim().toUpperCase(Locale.ROOT));
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
        if (dto.groupId() == null) {
            // usunięcie przypisania do kierunku
            userToUpdate.setStudentGroup(null);
        } else {
            // użycie metody z studentGroupRepository, która zwróci encję kierunku
            StudentGroup group = studentGroupRepository.findById(dto.groupId())
                    .orElseThrow(() -> new StudentGroupNotFoundException(dto.groupId()));
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
            throw new UsernameNotFoundException(
                    "Link aktywacyjny jest nieprawidłowy lub wygasł. Zarejestruj się ponownie lub skontaktuj się z administratorem.");
        } else {
            ConfirmationToken confirmationToken = tokenOptional.get();
            if (confirmationToken.getExpiryDate().isBefore(LocalDateTime.now())) {
                throw new UsernameNotFoundException(
                        "Link aktywacyjny wygasł. Zarejestruj się ponownie lub skontaktuj się z administratorem.");
            }
            User user = confirmationToken.getUser();
            user.setActivated(true);
            userRepository.save(user);
            confirmationTokenRepository.delete(confirmationToken);

            // Usuń z cooldown po udanej aktywacji
            confirmationAttemptsCooldown.remove(token);
        }
    }

    @Override
    public void requestPasswordReset(String email) {
        // Rate limiting - sprawdź czy użytkownik nie spamuje
        LocalDateTime lastRequest = passwordResetCooldown.get(email);
        if (lastRequest != null) {
            long secondsSinceLastRequest = Duration.between(lastRequest, LocalDateTime.now()).getSeconds();
            if (secondsSinceLastRequest < COOLDOWN_SECONDS) {
                long remainingSeconds = COOLDOWN_SECONDS - secondsSinceLastRequest;
                throw new TooManyRequestsException(
                        "Poczekaj " + remainingSeconds + " sekund przed ponowną próbą wysłania linku resetującego.");
            }
        }

        Optional<User> user = userRepository.findByEmail(email);
        if (user.isEmpty()) {
            throw new UsernameNotFoundException("Nie znaleziono użytkownika o adresie: " + email);
        } else if (!user.get().isActivated()) {
            throw new AccountInactiveException("Konto z adresem e-mail " + email
                    + " nie zostało aktywowane. Sprawdź swoją skrzynkę pocztową i kliknij w link aktywacyjny.");
        } else {
            User u = user.get();
            PasswordResetToken passwordResetToken = new PasswordResetToken();
            passwordResetToken.setUser(u);
            passwordResetToken.setToken(UUID.randomUUID().toString());
            passwordResetToken.setExpiryDate(LocalDateTime.now().plusMinutes(10));
            passwordResetTokenRepository.save(passwordResetToken);
            emailService.sendPasswordResetEmail(u.getEmail(), passwordResetToken.getToken());

            // Zapisz timestamp ostatniego wysłania dla tego emaila
            passwordResetCooldown.put(email, LocalDateTime.now());
        }
    }

    @Override
    @Transactional
    public void deleteUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));

        // Nie pozwalaj usuwać użytkowników z rolą ADMIN
        if ("ADMIN".equals(user.getRole())) {
            throw new IllegalStateException(
                    "Nie można usunąć konta administratora. Konta z uprawnieniami administratora są chronione.");
        }

        userRepository.delete(user);
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
            }
        } else {
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

        String filename = org.springframework.util.StringUtils.cleanPath(file.getOriginalFilename());
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

        if (file.getSize() > 5 * 1024 * 1024) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Plik jest zbyt duży (max 5MB).");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));

        try {
            user.setAvatarData(file.getBytes());
            user.setAvatarContentType(mimeType);
            userRepository.save(user);
        } catch (java.io.IOException e) {
            throw new RuntimeException("Błąd podczas przetwarzania awatara", e);
        }
    }

    @Override
    @Transactional
    public User getAvatar(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));

        if (user.getAvatarData() == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.NOT_FOUND, "Użytkownik nie ma awatara");
        }
        // Force load LOB data within transaction
        int len = user.getAvatarData().length;
        return user;
    }

    @Override
    @Transactional
    public void removeAvatar(Long userId) {
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
}