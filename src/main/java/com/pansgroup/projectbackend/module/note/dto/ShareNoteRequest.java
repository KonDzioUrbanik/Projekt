package com.pansgroup.projectbackend.module.note.dto;

import com.pansgroup.projectbackend.module.note.NoteVisibility;
import lombok.Getter;
import lombok.Setter;

import java.util.Set;

@Getter
@Setter
public class ShareNoteRequest {
    private NoteVisibility visibility;
    private Set<Long> userIds; // Używane tylko gdy visibility = SHARED_WITH_USERS
}
