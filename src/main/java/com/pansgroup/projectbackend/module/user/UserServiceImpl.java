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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
@Transactional
public class UserServiceImpl implements UserService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final StudentGroupRepository studentGroupRepository;
    private final EmailService emailService;
    private final ConfirmationTokenRepository confirmationTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;


    public UserServiceImpl(UserRepository userRepository,
                           PasswordEncoder passwordEncoder,
                           StudentGroupRepository studentGroupRepository,
                           EmailService emailService, ConfirmationTokenRepository confirmationTokenRepository, PasswordResetTokenRepository passwordResetTokenRepository) {
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
                .orElseThrow(() -> new org.springframework.security.core.userdetails.UsernameNotFoundException("Nie znaleziono użytkownika o adresie: " + e));
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
        emailService.sendConfirmationEmail(saved.getEmail(),  tokenValue);
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
                .map(this::mapToResponseDto)   // bez hasła
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
                .orElseThrow(() -> new UsernameNotFoundException("Nie znaleziono użytkownika o adresie: " + normalizedEmail));

        // Sprawdzamy poprawność hasła
        if (!passwordEncoder.matches(dto.getPassword(), user.getPassword())) {
            throw new BadCredentialsException("Nieprawidłowe dane logowania");
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
                u.isActivated
        );
    }

    @Override
    @Transactional
    public UserResponseDto updateUser(Long userId, UserUpdateDto dto) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));

        // Zmiana imienia i nazwiska użytkownika
        user.setFirstName(dto.getFirstName());
        user.setLastName(dto.getLastName());

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
            throw new PasswordMismatchException("Nieprawidłowe bieżące hasło");
        }

        // Weryfikacja nowego hasła i potwierdzenia
        if (!dto.getNewPassword().equals(dto.getConfirmPassword())) {
            throw new PasswordMismatchException("Nowe hasło i potwierdzenie hasła nie pasują do siebie");
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
                .orElseThrow(() -> new UsernameNotFoundException("Nie znaleziono użytkownika o adresie: " + normalizedEmail));

        // 2. Znajdź encję grupy
        // Używamy metody z studentgrouprepository, która zwróci encję Grupy
        StudentGroup group = studentGroupRepository.findById(dto.groupId())
                .orElseThrow(() -> new StudentGroupNotFoundException(dto.groupId()));

        // 3. Przypisz grupę do użytkownika
        userToUpdate.setStudentGroup(group);

        // 4. Zapisz i zwróć DTO
        return mapToResponseDto(userRepository.save(userToUpdate));
    }

    @Override
    public void confirmToken(String token) {
        // Wszystko tutaj jest poprawne
        Optional<ConfirmationToken> tokenOptional = confirmationTokenRepository.findByToken(token);
        if (!tokenOptional.isPresent()) {
            throw new UsernameNotFoundException("Token jest błędny " + token + " bądz nie istnieje");
        }
        else  {
            ConfirmationToken confirmationToken = tokenOptional.get();
            if (confirmationToken.getExpiryDate().isBefore(LocalDateTime.now())) {
                throw new UsernameNotFoundException("Token przeterminowany");
            }
            User user = confirmationToken.getUser();
            user.setActivated(true);
            userRepository.save(user);
            confirmationTokenRepository.delete(confirmationToken);
        }
    }

    @Override
    public void requestPasswordReset(String email) {
        Optional<User> user = userRepository.findByEmail(email);
        if (user.isEmpty()) {
            throw new UsernameNotFoundException("Nie znaleziono użytkownika o adresie: " + email);
        }
        else {
            User u = user.get();
            PasswordResetToken passwordResetToken = new PasswordResetToken();
            passwordResetToken.setUser(u);
            passwordResetToken.setToken(UUID.randomUUID().toString());
            passwordResetToken.setExpiryDate(LocalDateTime.now().plusMinutes(10));
            passwordResetTokenRepository.save(passwordResetToken);

        }
    }

    @Override
    public void processPasswordReset(String token, String newPassword, String confirmPassword) {
        if (!newPassword.equals(confirmPassword)) {
            throw new PasswordMismatchException("Hasła nie są takie same");
        }
        Optional<PasswordResetToken> tokenOptional = passwordResetTokenRepository.findByToken(token);
        if (!tokenOptional.isEmpty()) {
            if (tokenOptional.get().getExpiryDate().isBefore(LocalDateTime.now())) {
                throw new UsernameNotFoundException("Token przeterminowany");
            } else {
                PasswordResetToken passwordResetToken = tokenOptional.get();
                User user = passwordResetToken.getUser();
                user.setPassword(passwordEncoder.encode(newPassword));
                userRepository.save(user);
                passwordResetTokenRepository.delete(passwordResetToken);
            }
        } else {
            throw new UsernameNotFoundException("Token jest błędny " + token + " bądź nie istnieje");
        }
    }
}