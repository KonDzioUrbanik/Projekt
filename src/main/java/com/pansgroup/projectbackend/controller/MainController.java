package com.pansgroup.projectbackend.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class MainController {


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
}
