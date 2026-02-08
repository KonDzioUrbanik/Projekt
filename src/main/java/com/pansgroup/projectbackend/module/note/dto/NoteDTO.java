package com.pansgroup.projectbackend.module.note.dto;

import com.pansgroup.projectbackend.module.note.Note;
import com.pansgroup.projectbackend.module.note.NoteVisibility;
import com.pansgroup.projectbackend.module.user.User;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Getter
@Setter
public class NoteDTO {
    private Long id;
    private String title;
    private String content;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Autor
    private Long authorId;
    private String authorName;
    private String authorEmail;
    private String studentGroupName;

    // Współdzielenie
    private NoteVisibility visibility;
    private List<Long> sharedWithUserIds;
    private boolean canEdit;

    @com.fasterxml.jackson.annotation.JsonProperty("isFavorited")
    private boolean isFavorited;

    // Statystyki
    private Integer viewCount;
    private Integer favoriteCount;
    private String tags;
    private Boolean isPinned;

    public static NoteDTO fromEntity(Note note, User currentUser) {
        NoteDTO dto = new NoteDTO();
        dto.setId(note.getId());
        dto.setTitle(note.getTitle());
        dto.setContent(note.getContent());
        dto.setCreatedAt(note.getCreatedAt());
        dto.setUpdatedAt(note.getUpdatedAt());

        // Autor
        dto.setAuthorId(note.getAuthor().getId());
        dto.setAuthorName(note.getAuthor().getFirstName() + " " + note.getAuthor().getLastName());
        dto.setAuthorEmail(note.getAuthor().getEmail());

        // Współdzielenie
        dto.setVisibility(note.getVisibility());
        if (note.getSharedWith() != null) {
            dto.setSharedWithUserIds(
                    note.getSharedWith().stream()
                            .map(User::getId)
                            .collect(Collectors.toList()));
        }

        // Grupa studenta (dla widoczności GROUP)
        if (note.getAuthor().getStudentGroup() != null) {
            dto.setStudentGroupName(note.getAuthor().getStudentGroup().getName());
        }

        // Uprawnienia
        dto.setCanEdit(note.getAuthor().getId().equals(currentUser.getId()));
        dto.setFavorited(note.isFavoritedBy(currentUser));

        // Statystyki
        dto.setViewCount(note.getViewCount());
        dto.setFavoriteCount(note.getFavoriteCount());
        dto.setTags(note.getTags());
        dto.setIsPinned(note.getIsPinned());

        return dto;
    }

    public static NoteDTO fromEntityWithPreview(Note note, User currentUser) {
        return fromEntity(note, currentUser);
    }
}
