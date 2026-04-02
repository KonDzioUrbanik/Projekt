package com.pansgroup.projectbackend.module.system;

import lombok.RequiredArgsConstructor;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

@ControllerAdvice
@RequiredArgsConstructor
public class GlobalBannerAdvice {

    private final SystemService systemService;

    @ModelAttribute
    public void addGlobalBanner(Model model) {
        String bannerText = systemService.getSetting("global_banner_text", "");
        if (bannerText != null && !bannerText.isBlank()) {
            model.addAttribute("globalBannerText", bannerText);
        }
    }
}
