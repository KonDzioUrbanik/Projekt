package com.pansgroup.projectbackend.module.system;

import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

@ControllerAdvice
@RequiredArgsConstructor
public class GlobalTemplateAdvice {

    private final UserService userService;

    @ModelAttribute
    public void addUserToModel(Model model) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !auth.getPrincipal().equals("anonymousUser")) {
            try {
                User user = userService.findUserByEmailInternal(auth.getName());
                if (user != null) {
                    model.addAttribute("currentUser", user);
                    model.addAttribute("userFirstName", user.getFirstName());
                    model.addAttribute("userLastName", user.getLastName());
                    model.addAttribute("userFullName", user.getFirstName() + " " + user.getLastName());
                    model.addAttribute("userRole", user.getRole());
                }
            } catch (Exception e) {
                // Ignorujemy błędy wstrzykiwania profilu, aby nie blokować renderowania
            }
        }
    }
}
