package com.pansgroup.projectbackend.controller;


import com.pansgroup.projectbackend.exception.UsernameNotFoundException;
import com.pansgroup.projectbackend.module.dashboard.DashboardService;
import com.pansgroup.projectbackend.module.dashboard.dto.DashboardResponseDto;
import com.pansgroup.projectbackend.module.user.UserService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

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

    @GetMapping("/confirm")
    public String confirm(@RequestParam("token") String token, RedirectAttributes redirectAttributes) {
        try {
            userService.confirmToken(token);
            redirectAttributes.addFlashAttribute("successMessage", "Konto zostało pomyślnie aktywowane! Możesz się teraz zalogować.");
            return "redirect:/login";

        } catch (UsernameNotFoundException e) {
            redirectAttributes.addFlashAttribute("errorMessage", e.getMessage());
            return "redirect:/token-error";
        }
    }


    @GetMapping("/token-error")
    public String tokenErrorView(Model model) {
        if (!model.containsAttribute("errorMessage")) {
            model.addAttribute("errorMessage", "Wystąpił nieznany błąd lub link jest nieprawidłowy.");
        }
        return "password-reset-expired";
    }
    @GetMapping("/reset-password")
    public String resetPasswordView(
            @RequestParam("token") String token,
            Model model
    ) {
        model.addAttribute("token", token);
        return "reset-password";
    }

    @GetMapping("/forgot-password")
    public String forgotPasswordView() {
        return "forgot-password";
    }

    @GetMapping("/dashboard")
    public String dashboardView(Model model, Principal principal) {
        String userEmail = principal.getName();
        DashboardResponseDto data = dashboardService.getDashboardData(userEmail);
        model.addAttribute("currentUser", data.user());
        model.addAttribute("notes", data.notes());

        return "dashboard";
    }




    //dodalem sobie mapping dla planu zajec zeby potestowac
    @GetMapping("/schedule")
    public String scheduleView(Model model, Principal principal){
        String userEmail = principal.getName();

        model.addAttribute("userEmail", userEmail);

        return "schedule";
    }

    //i dla edycji profilu
    @GetMapping("/profile")
    public String profileView(Model model, Principal principal){
        String userEmail = principal.getName();

        DashboardResponseDto data = dashboardService.getDashboardData(userEmail);
        model.addAttribute("currentUser", data.user());

        model.addAttribute("userEmail", userEmail);
        

        return "user-profile";
    }

    @GetMapping("/change-password")
    public String changePasswordView(Model model, Principal principal){
        String userEmail = principal.getName();

        DashboardResponseDto data = dashboardService.getDashboardData(userEmail);
        model.addAttribute("currentUser", data.user());

        model.addAttribute("userEmail", userEmail);

        return "change-password";
    }
}