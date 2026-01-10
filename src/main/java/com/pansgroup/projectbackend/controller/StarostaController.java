package com.pansgroup.projectbackend.controller;

import com.pansgroup.projectbackend.module.user.User;
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
import java.util.stream.Collectors;

@Controller
@RequestMapping("/starosta")
@PreAuthorize("hasAnyRole('STAROSTA', 'ADMIN')") // Starosta i Admin mogą wejść
public class StarostaController {

    private final UserService userService;

    public StarostaController(UserService userService) {
        this.userService = userService;
    }

    @ModelAttribute("currentUser")
    public UserResponseDto populateUser(Principal principal) {
        if (principal != null) {
            return userService.getCurrentUser(principal.getName());
        }
        return null;
    }

    // Panel główny starosty
    @GetMapping
    public String starostaIndex(Model model, Principal principal) {
        UserResponseDto currentUser = userService.getCurrentUser(principal.getName());

        // Pobranie użytkowników z tego samego kierunku
        List<UserResponseDto> groupMembers = userService.findAll().stream()
                .filter(user -> currentUser.groupId() != null &&
                               currentUser.groupId().equals(user.groupId()))
                .collect(Collectors.toList());

        model.addAttribute("groupMembers", groupMembers);
        model.addAttribute("activePage", "starosta-home");

        return "starosta/index";
    }

    // Zarządzanie kierunkiem
    @GetMapping("/group-management")
    public String groupManagement(Model model, Principal principal) {
        UserResponseDto currentUser = userService.getCurrentUser(principal.getName());

        // Pobranie użytkowników z tego samego kierunku
        List<UserResponseDto> groupMembers = userService.findAll().stream()
                .filter(user -> currentUser.groupId() != null &&
                               currentUser.groupId().equals(user.groupId()))
                .collect(Collectors.toList());

        model.addAttribute("groupMembers", groupMembers);
        model.addAttribute("activePage", "group-management");

        return "starosta/group-management";
    }

    // Obecności
    @GetMapping("/attendance")
    public String attendance(Model model) {
        model.addAttribute("activePage", "attendance");
        return "starosta/attendance";
    }

    // Ogłoszenia
    @GetMapping("/announcements")
    public String announcements(Model model) {
        model.addAttribute("activePage", "announcements");
        return "starosta/announcements";
    }
}

