package com.pansgroup.projectbackend.controller;


import com.pansgroup.projectbackend.module.dashboard.DashboardService;
import com.pansgroup.projectbackend.module.dashboard.dto.DashboardResponseDto;
import com.pansgroup.projectbackend.module.user.UserService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.security.Principal;

@Controller
public class MainController {
    private final DashboardService dashboardService;
    private final UserService userService;

    public MainController(DashboardService dashboardService, UserService userService) {
        this.dashboardService = dashboardService;
        this.userService = userService;
    }

    @GetMapping("/")
    public String mainView() {
        return "index";
    }

    @GetMapping("/login")
    public String loginView() {
        return "login";
    }

    @GetMapping("/register")
    public String registerView() {
        return "register";
    }

    @GetMapping("/tutorial")
    public String tutorialView() {
        return "tutorial";
    }

    @GetMapping("/dashboard")
    public String dashboardView(Model model, Principal principal) {
        String userEmail = principal.getName();
        DashboardResponseDto data = dashboardService.getDashboardData(userEmail);
        model.addAttribute("currentUser", data.user());
        model.addAttribute("notes", data.notes());

        return "dashboard";
    }
    @GetMapping("/confirm")
    public String confirm(@RequestParam("token") String token) {
        userService.confirmToken(token);
        return "redirect:/login";
    }

}