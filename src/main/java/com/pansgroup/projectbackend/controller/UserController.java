package com.pansgroup.projectbackend.controller;

import com.pansgroup.projectbackend.dto.UserDto;
import com.pansgroup.projectbackend.model.User;
import com.pansgroup.projectbackend.repository.UserRepository;
import com.pansgroup.projectbackend.service.UserService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("api/users")
public class UserController {
    UserRepository userRepository;
    UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping
    public User createUsers(@RequestBody User user){
       return userService.create(user);
    }
    @GetMapping
    public List<UserDto> findAll(){
        return userService.findAll();
    }


}
