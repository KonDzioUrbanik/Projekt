package com.pansgroup.projectbackend.module.user;

import com.pansgroup.projectbackend.exception.*;
import com.pansgroup.projectbackend.module.user.dto.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@Transactional
public class UserServiceImpl implements UserService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;


    public UserServiceImpl(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public User findUserByEmailInternal(String email) {
        String e = email.trim().toLowerCase(Locale.ROOT);
        return userRepository.findByEmail(e)
                // ZMIANA TYLKO TUTAJ:
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

        User saved = userRepository.save(u);
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
        return new UserResponseDto(
                u.getId(),
                u.getFirstName(),
                u.getLastName(),
                u.getEmail(),
                u.getRole(),
                u.getNrAlbumu()
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

        // Werifikacja bieżącego hasła
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
        User user = findUserByEmailInternal(email);
        return mapToResponseDto(user);
    }

    @Override
    public UserResponseDto updateRoleUser(String email, UserRoleUpdateDto dto) {
        User userToUpdate = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Taki email nie istnieje: " + email));
        userToUpdate.setRole(dto.newRole().trim().toUpperCase(Locale.ROOT));
        return mapToResponseDto(userRepository.save(userToUpdate));
    }

}
