package com.pansgroup.projectbackend.service;

import com.pansgroup.projectbackend.dto.UserCreateDto;
import com.pansgroup.projectbackend.dto.UserResponseDto;

import java.util.List;

public interface UserService {
    UserResponseDto create(UserCreateDto dto);

    List<UserResponseDto> findAll();
    UserResponseDto findByEmail(String email);

}
