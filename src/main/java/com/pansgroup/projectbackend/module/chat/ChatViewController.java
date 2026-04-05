package com.pansgroup.projectbackend.module.chat;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@Controller
@PreAuthorize("isAuthenticated()")
public class ChatViewController {

    @GetMapping("/student/chat")
    public String chatIndex(Model model) {
        model.addAttribute("activePage", "chat");
        return "dashboard/chat";
    }

    @GetMapping("/student/chat/{conversationId}")
    public String chatOpen(@PathVariable Long conversationId, Model model) {
        model.addAttribute("activePage", "chat");
        model.addAttribute("openConversationId", conversationId);
        return "dashboard/chat";
    }
}
