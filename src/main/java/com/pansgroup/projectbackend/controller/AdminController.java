package com.pansgroup.projectbackend.controller;

import com.pansgroup.projectbackend.module.user.UserService;
import com.pansgroup.projectbackend.module.user.dto.UserResponseDto;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;

import java.security.Principal;
import java.util.List;

@Controller
@RequestMapping("/admin") // Wszystkie metody bbeda zaczynac sis od /admin
@PreAuthorize("hasRole('ADMIN')") // Zabezpieczenie: Tylko admin wejdzie do tej klasy
public class AdminController{

    private final UserService userService;

    public AdminController(UserService userService){
        this.userService = userService;
    }

    @ModelAttribute("currentUser")
    public UserResponseDto populateUser(Principal principal){
        if(principal != null){
            return userService.getCurrentUser(principal.getName());
        }
        return null;
    }

    // Endpoint: /admin/users
    @GetMapping("/users")
    public String usersView(Model model){
        // Pobieranie listy wszystkich uzytkownikow z serwisu
        List<UserResponseDto> users = userService.findAll();
        
        // Wrzucenie do modelu
        model.addAttribute("users", users);
        
        // Ustawienie aktywnej strony dla sidebara
        model.addAttribute("activePage", "users");

        // Zwrocenie widoku HTML
        return "admin/admin-users";
    }
}