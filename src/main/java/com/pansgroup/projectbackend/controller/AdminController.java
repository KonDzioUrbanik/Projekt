package com.pansgroup.projectbackend.controller;

import com.pansgroup.projectbackend.module.academic.AcademicYearConfigService;
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
@RequestMapping("/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final UserService userService;
    private final AcademicYearConfigService academicYearConfigService;

    public AdminController(UserService userService, AcademicYearConfigService academicYearConfigService) {
        this.userService = userService;
        this.academicYearConfigService = academicYearConfigService;
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
        List<UserResponseDto> users = userService.findAll();
        model.addAttribute("users", users);
        model.addAttribute("activePage", "users");
        return "admin/admin-users";
    }

    // Endpoint: /admin/announcement
    @GetMapping("/announcement")
    public String announcementView(Model model) {
        model.addAttribute("activePage", "announcement");
        return "admin/admin-announcement";
    }

    // Endpoint: /admin/post-control
    @GetMapping("/post-control")
    public String postControlView(Model model) {
        model.addAttribute("activePage", "post-control");
        return "admin/post-control";
    }

    // Endpoint: /admin/university-calendar
    @GetMapping("/university-calendar")
    public String universityCalendarView(Model model) {
        model.addAttribute("activePage", "university-calendar");
        model.addAttribute("currentDate", java.time.LocalDate.now());
        // Przekazanie konfiguracji roku akademickiego do widoku
        academicYearConfigService.findCurrent()
                .ifPresent(cfg -> model.addAttribute("academicYearConfig", cfg));
        return "admin/university-calendar";
    }

    // Endpoint: /admin/alerts
    @GetMapping("/alerts")
    public String alertsView(Model model) {
        model.addAttribute("activePage", "alerts");
        return "admin/alerts";
    }

    // Endpoint: /admin/feedback
    @GetMapping("/feedback")
    public String feedbackView(Model model) {
        model.addAttribute("activePage", "feedback");
        return "admin/admin-feedback";
    }

    // Endpoint: /admin/schedule
    @GetMapping("/schedule")
    public String scheduleView(Model model) {
        model.addAttribute("activePage", "schedule");
        return "admin/schedule-management";
    }
}
