package com.pansgroup.projectbackend.controller;

import com.pansgroup.projectbackend.exception.UsernameNotFoundException;
import com.pansgroup.projectbackend.module.dashboard.DashboardService;
import com.pansgroup.projectbackend.module.dashboard.dto.DashboardResponseDto;
import com.pansgroup.projectbackend.module.user.UserService;
import com.pansgroup.projectbackend.module.user.dto.UserResponseDto;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
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
    public String loginView(Principal principal) {
        if (principal != null) {
            return "redirect:/home";
        }
        return "auth/login";
    }

    @GetMapping("/register")
    public String registerView(Principal principal) {
        if (principal != null) {
            return "redirect:/home";
        }
        return "auth/register";
    }

    @GetMapping("/tutorial")
    public String tutorialView() {
        return "tutorial";
    }

    @GetMapping("/confirm")
    public String confirm(@RequestParam("token") String token, RedirectAttributes redirectAttributes) {
        try {
            userService.confirmToken(token);
            redirectAttributes.addFlashAttribute("successMessage",
                    "Konto zostało pomyślnie aktywowane. Możesz się teraz zalogować.");
            return "redirect:/login";

        } catch (UsernameNotFoundException e) {
            redirectAttributes.addFlashAttribute("errorMessage", e.getMessage());
            return "redirect:/token-error";
        }
    }

    @GetMapping("/token-error")
    public String tokenErrorView(Model model) {
        if (!model.containsAttribute("errorMessage")) {
            model.addAttribute("errorMessage",
                    "Wystąpił nieznany błąd lub link jest nieprawidłowy. Skontaktuj się z administratorem.");
        }
        return "auth/password-reset-expired";
    }

    @GetMapping("/reset-password")
    public String resetPasswordView(
            @RequestParam("token") String token,
            Model model) {
        model.addAttribute("token", token);
        return "auth/reset-password";
    }

    @GetMapping("/forgot-password")
    public String forgotPasswordView() {
        return "auth/forgot-password";
    }

    @ModelAttribute("currentUser")
    public UserResponseDto populateUser(Principal principal) {
        if (principal != null) {
            return userService.getCurrentUser(principal.getName());
        }
        return null;
    }

    @GetMapping("/home")
    public String homeView(Model model, Principal principal) {
        model.addAttribute("activePage", "home-portal");
        return "home/index";
    }

    @GetMapping("/student/dashboard")
    public String studentDashboardView(Model model, Principal principal) {
        model.addAttribute("activePage", "home"); // utrzymujemy tożsamość 'home' dla sidebaru studenta
        DashboardResponseDto data = dashboardService.getDashboardData(principal.getName());
        model.addAttribute("notes", data.notes());
        return "dashboard/index";
    }

    @GetMapping("/starosta/dashboard")
    public String starostaDashboardView(Model model) {
        model.addAttribute("activePage", "starosta-home");
        return "starosta/dashboard";
    }

    @GetMapping("/admin/dashboard")
    public String adminDashboardView(Model model) {
        model.addAttribute("activePage", "admin-home");
        return "admin/dashboard";
    }

    @GetMapping("/student/calendar")
    public String calendarView(Model model) {
        model.addAttribute("activePage", "calendar");
        return "dashboard/calendar";
    }

    @GetMapping("/student/schedule")
    public String scheduleView(Model model) {
        model.addAttribute("activePage", "schedule");
        return "dashboard/schedule";
    }

    @GetMapping("/profile")
    public String profileView(Model model) {
        model.addAttribute("activePage", "profile");
        return "dashboard/profile";
    }

    @GetMapping("/settings")
    public String settingsView(Model model) {
        model.addAttribute("activePage", "settings");
        return "dashboard/settings";
    }

    @GetMapping("/change-password")
    public String changePasswordView(Model model) {
        model.addAttribute("activePage", "settings");
        return "auth/change-password";
    }

    @GetMapping("/student/attendance")
    public String attendanceView(Model model) {
        model.addAttribute("activePage", "attendance");
        return "dashboard/attendance";
    }

    @GetMapping("/student/university-calendar")
    public String universityCalendarView(Model model) {
        model.addAttribute("activePage", "university-calendar-public");
        model.addAttribute("currentDate", java.time.LocalDate.now());
        return "admin/university-calendar";
    }

    @GetMapping("/student/forum")
    public String forumView(Model model) {
        model.addAttribute("activePage", "forum");
        return "dashboard/forum";
    }

    @GetMapping("/student/notes")
    public String notesView(Model model) {
        model.addAttribute("activePage", "notes");
        return "dashboard/notes";
    }

    // zarządzanie harmonogramem zajęć
    @GetMapping("/admin/schedule-management")
    public String scheduleManagementView(Model model) {
        model.addAttribute("activePage", "schedule-management");

        return "admin/schedule-management";
    }

    // zarządzanie kierunkami studiów
    @GetMapping("/admin/groups-management")
    public String groupsManagementView(Model model) {
        model.addAttribute("activePage", "groups-management");

        return "admin/groups-management";
    }
}