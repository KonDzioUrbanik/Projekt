package com.pansgroup.projectbackend.module.user.event;

import com.pansgroup.projectbackend.module.user.User;
import org.springframework.context.ApplicationEvent;

public class UserDeletedEvent extends ApplicationEvent {
    private final User user;

    public UserDeletedEvent(Object source, User user) {
        super(source);
        this.user = user;
    }

    public User getUser() {
        return user;
    }
}
