package com.pansgroup.projectbackend.service;

import com.pansgroup.projectbackend.dto.UserCreateDto;
import com.pansgroup.projectbackend.dto.UserResponseDto;
import com.pansgroup.projectbackend.exception.EmailAlreadyExistsException;
import com.pansgroup.projectbackend.model.User;
import com.pansgroup.projectbackend.repository.UserRepository;
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
        u.setRole(dto.role());              // jeśli masz enum Role – użyj enuma
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
