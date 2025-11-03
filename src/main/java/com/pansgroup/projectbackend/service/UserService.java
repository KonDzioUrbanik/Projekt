package com.pansgroup.projectbackend.service;

import com.pansgroup.projectbackend.dto.LoginRequestDto;
import com.pansgroup.projectbackend.dto.UserCreateDto;
import com.pansgroup.projectbackend.dto.UserResponseDto;
import com.pansgroup.projectbackend.model.User;

import java.util.List;

public interface UserService {
    UserResponseDto create(UserCreateDto dto);

    List<UserResponseDto> findAll();
    UserResponseDto findByEmail(String email);
    User authenticate(LoginRequestDto dto);
    User findUserByEmailInternal(String email); // Potrzebujemy tego

}
