package com.pansgroup.projectbackend.module.user;

import com.pansgroup.projectbackend.module.user.dto.LoginRequestDto;
import com.pansgroup.projectbackend.module.user.dto.UserCreateDto;
import com.pansgroup.projectbackend.module.user.dto.UserResponseDto;

import java.util.List;

public interface UserService {
    UserResponseDto create(UserCreateDto dto);

    List<UserResponseDto> findAll();
    UserResponseDto findByEmail(String email);
    User authenticate(LoginRequestDto dto);
    User findUserByEmailInternal(String email); // Potrzebujemy tego

}
