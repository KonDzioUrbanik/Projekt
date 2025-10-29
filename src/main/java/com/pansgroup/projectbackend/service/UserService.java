package com.pansgroup.projectbackend.service;

import com.pansgroup.projectbackend.dto.UserDto;
import com.pansgroup.projectbackend.model.User;

import java.util.List;

public interface UserService {
    User create(User user);
    List<UserDto> findAll();

}
