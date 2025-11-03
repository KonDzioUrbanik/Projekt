package com.pansgroup.projectbackend.module.user;

import com.pansgroup.projectbackend.module.user.dto.LoginRequestDto;
import com.pansgroup.projectbackend.module.user.dto.UserCreateDto;
import com.pansgroup.projectbackend.module.user.dto.UserResponseDto;
import com.pansgroup.projectbackend.exception.BadCredentialsException;
import com.pansgroup.projectbackend.exception.EmailAlreadyExistsException;
import com.pansgroup.projectbackend.exception.UsernameNotFoundException;
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
                .orElseThrow(() -> new UsernameNotFoundException("Nie znaleziono użytkownika o adresie: " + e));
    }

    @Override
    public UserResponseDto create(UserCreateDto dto) {
        String normalizedEmail = dto.email().trim().toLowerCase(Locale.ROOT);

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new EmailAlreadyExistsException(normalizedEmail);
        }

        // Ekstrakcja numeru indeksu z emaila
        Integer indexNumber = extractIndexNumberFromEmail(normalizedEmail);

        User u = new User();
        u.setFirstName(dto.firstName().trim());
        u.setLastName(dto.lastName().trim());
        u.setEmail(normalizedEmail);
        u.setPassword(passwordEncoder.encode(dto.password()));
        u.setRole("STUDENT"); // Automatycznie rola STUDENT
        u.setNrAlbumu(indexNumber); // Z adresu email

        User saved = userRepository.save(u);
        return toResponse(saved);
    }

    /**
     * Ekstrakcja numeru indeksu z adresu email.
     * Przyklad: "123456@student.com" -> 123456
     */
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
                break; // Stop na pierwszym nie-cyfrowym znaku
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
                .map(this::toResponse)   // bez hasła
                .toList();
    }

    @Override
    public UserResponseDto findByEmail(String email) {
        String e = email.trim().toLowerCase(Locale.ROOT);

        User user = userRepository.findByEmail(e)
                .orElseThrow(() -> new UsernameNotFoundException("Nie znaleziono użytkownika o adresie: " + e));

        return toDto(user);
    }
    private UserResponseDto toDto(User u) {
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


    private UserResponseDto toResponse(User u) {
        return new UserResponseDto(
                u.getId(),
                u.getFirstName(),
                u.getLastName(),
                u.getEmail(),
                u.getRole(),
                u.getNrAlbumu()
        );
    }

}
