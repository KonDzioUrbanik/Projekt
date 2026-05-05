package com.pansgroup.projectbackend.module.survey;

import com.pansgroup.projectbackend.module.student.StudentGroup;
import com.pansgroup.projectbackend.module.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "portal_surveys")
@Getter
@Setter
public class Survey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 180)
    private String title;

    @Column(length = 2000)
    private String description;

    @Column(nullable = false)
    private boolean globalScope;

    @Column(nullable = false)
    private boolean active = true;

    private LocalDateTime endsAt;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_group_id")
    private StudentGroup targetGroup;

    @OneToMany(mappedBy = "survey", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<SurveyOption> options = new ArrayList<>();

    @OneToMany(mappedBy = "survey", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SurveyVote> votes = new ArrayList<>();

    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean multipleChoice = false;

    @PreUpdate
    void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}

