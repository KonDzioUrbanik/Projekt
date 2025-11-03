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
                // ZMIANA TYLKO TUTAJ:
                .orElseThrow(() -> new org.springframework.security.core.userdetails.UsernameNotFoundException("Nie znaleziono użytkownika o adresie: " + e));
    }

    @Override
    public UserResponseDto create(UserCreateDto dto) {
        String normalizedEmail = dto.email().trim().toLowerCase(Locale.ROOT);

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new EmailAlreadyExistsException(normalizedEmail);
        }

        User u = new User();
        u.setFirstName(dto.firstName().trim());
        u.setLastName(dto.lastName().trim());
        u.setEmail(normalizedEmail);
        u.setPassword(passwordEncoder.encode(dto.password()));
        u.setRole(dto.role());
        u.setNrAlbumu(dto.nrAlbumu());

        User saved = userRepository.save(u);
        return toResponse(saved);
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
