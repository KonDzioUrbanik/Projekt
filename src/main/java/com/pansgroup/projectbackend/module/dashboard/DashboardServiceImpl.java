package com.pansgroup.projectbackend.module.dashboard;

import com.pansgroup.projectbackend.module.dashboard.dto.DashboardResponseDto;
import com.pansgroup.projectbackend.module.note.NoteService;
import com.pansgroup.projectbackend.module.note.dto.NoteResponseDto;
import com.pansgroup.projectbackend.module.user.UserService;
import com.pansgroup.projectbackend.module.user.dto.UserResponseDto;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class DashboardServiceImpl implements DashboardService {


    private final UserService userService;
    private final NoteService noteService;

    public DashboardServiceImpl(UserService userService, NoteService noteService) {
        this.userService = userService;
        this.noteService = noteService;
    }

    @Override
    public DashboardResponseDto getDashboardData(String userEmail) {
        UserResponseDto currentUser = userService.findByEmail(userEmail);
        List<NoteResponseDto> userNotes = noteService.findByUser(currentUser.id());
        return new DashboardResponseDto(currentUser, userNotes);
    }
}