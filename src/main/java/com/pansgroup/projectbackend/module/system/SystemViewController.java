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
}
