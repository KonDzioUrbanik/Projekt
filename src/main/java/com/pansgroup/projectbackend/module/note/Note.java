package com.pansgroup.projectbackend.module.note;

import com.pansgroup.projectbackend.module.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "notes")
@Getter
@Setter
public class Note {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User author;

    // === WSPÓŁDZIELENIE NOTATEK ===

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(255) default 'PRIVATE'")
    private NoteVisibility visibility = NoteVisibility.PRIVATE;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "note_shared_with", joinColumns = @JoinColumn(name = "note_id"), inverseJoinColumns = @JoinColumn(name = "user_id"))
    private Set<User> sharedWith = new HashSet<>();

    // === ULEPSZENIA ===

    @Column(length = 200)
    private String tags; // np. "matematyka,egzamin,wykład5"

    @Column(nullable = false, columnDefinition = "integer default 0")
    private Integer viewCount = 0;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "note_favorites", joinColumns = @JoinColumn(name = "note_id"), inverseJoinColumns = @JoinColumn(name = "user_id"))
    private Set<User> favoritedBy = new HashSet<>();

    @Column(nullable = false, columnDefinition = "boolean default false")
    private Boolean isPinned = false;

    // Metody pomocnicze

    public void incrementViewCount() {
        this.viewCount++;
    }

    public Integer getFavoriteCount() {
        return this.favoritedBy != null ? this.favoritedBy.size() : 0;
    }

    public boolean isSharedWith(User user) {
        return this.sharedWith != null && this.sharedWith.contains(user);
    }

    public boolean isFavoritedBy(User user) {
        return this.favoritedBy != null && this.favoritedBy.contains(user);
    }
}
