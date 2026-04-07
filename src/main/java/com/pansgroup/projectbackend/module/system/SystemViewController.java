package com.pansgroup.projectbackend.module.system;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
@RequiredArgsConstructor
public class SystemViewController {

    @GetMapping("/maintenance")
    public String maintenance() {
        return "common/maintenance";
    }

    @GetMapping("/module-maintenance")
    public String moduleMaintenance() {
        return "common/module-maintenance";
    }

    @GetMapping("/admin/system")
    @PreAuthorize("hasRole('ADMIN')")
    public String systemManagement(Model model) {
        model.addAttribute("activePage", "system");
        return "admin/system";
    }

    @GetMapping("/admin/resources")
    @PreAuthorize("hasRole('ADMIN')")
    public String systemResources(Model model) {
        model.addAttribute("activePage", "admin-resources");
        return "admin/resources";
    }

    @GetMapping("/admin/security")
    @PreAuthorize("hasRole('ADMIN')")
    public String systemSecurity(Model model) {
        model.addAttribute("activePage", "admin-security");
        return "admin/security";
    }
}
