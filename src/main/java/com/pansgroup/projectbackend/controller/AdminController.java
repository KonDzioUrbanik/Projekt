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
public class AdminController {

    private final UserService userService;

    public AdminController(UserService userService) {
        this.userService = userService;
    }

    @ModelAttribute("currentUser")
    public UserResponseDto populateUser(Principal principal) {
        if (principal != null) {
            return userService.getCurrentUser(principal.getName());
        }
        return null;
    }

    // Endpoint: /admin/users
    @GetMapping("/users")
    public String usersView(Model model) {
        // Pobieranie listy wszystkich uzytkownikow z serwisu
        List<UserResponseDto> users = userService.findAll();

        // Wrzucenie do modelu
        model.addAttribute("users", users);

        // Ustawienie aktywnej strony dla sidebara
        model.addAttribute("activePage", "users");

        // Zwrocenie widoku HTML
        return "admin/admin-users";
    }

    // Endpoint: /admin/announcement
    @GetMapping("/announcement")
    public String announcementView(Model model) {

        // Ustawienie aktywnej strony dla sidebara
        model.addAttribute("activePage", "announcement");

        // Zwrocenie widoku HTML
        return "admin/announcement";
    }

    // Endpoint: /admin/post-control
    @GetMapping("/post-control")
    public String postControlView(Model model) {

        // Ustawienie aktywnej strony dla sidebara
        model.addAttribute("activePage", "post-control");

        // Zwrocenie widoku HTML
        return "admin/post-control";
    }

    // Endpoint: /admin/university-calendar
    @GetMapping("/university-calendar")
    public String universityCalendarView(Model model) {

        // Ustawienie aktywnej strony dla sidebara
        model.addAttribute("activePage", "university-calendar");
        model.addAttribute("currentDate", java.time.LocalDate.now());

        // Zwrocenie widoku HTML
        return "admin/university-calendar";
    }

    // Endpoint: /admin/alerts
    @GetMapping("/alerts")
    public String alertsView(Model model) {

        // Ustawienie aktywnej strony dla sidebara
        model.addAttribute("activePage", "alerts");

        // Zwrocenie widoku HTML
        return "admin/alerts";
    }
}