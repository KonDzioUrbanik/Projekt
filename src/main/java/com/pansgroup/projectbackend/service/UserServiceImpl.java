package com.pansgroup.projectbackend.service;


import com.pansgroup.projectbackend.dto.UserDto;
import com.pansgroup.projectbackend.exception.EmailAlreadyExistsException;
import com.pansgroup.projectbackend.model.User;
import com.pansgroup.projectbackend.repository.UserRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
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
    public User create(User user) {
        String normalized = user.getEmail().trim().toLowerCase(Locale.ROOT);


        user.setPassword(passwordEncoder.encode(user.getPassword()));

        if (userRepository.existsByEmail(normalized)) {
            throw new EmailAlreadyExistsException(normalized);
        }

        user.setEmail(normalized);
        return userRepository.save(user);
    }

    @Override
    public List<UserDto> findAll() {
        return userRepository.findAll()
                .stream()
                .map(u -> new UserDto(u.getId(), u.getFirstName(), u.getLastName(), u.getEmail(), u.getRole()))
                .toList();
    }

}
