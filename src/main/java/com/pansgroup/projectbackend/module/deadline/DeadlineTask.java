package com.pansgroup.projectbackend.module.deadline;

import com.pansgroup.projectbackend.module.student.StudentGroup;
import com.pansgroup.projectbackend.module.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "deadline_tasks")
@Getter
@Setter
public class DeadlineTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(length = 500)
    private String description;

    @Column(length = 80)
    private String courseName;

    @Column(nullable = false)
    private LocalDateTime dueDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DeadlineTaskType taskType = DeadlineTaskType.OTHER;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DeadlineVisibility visibility = DeadlineVisibility.PRIVATE;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    /**
     * Wypełnione tylko gdy visibility == GROUP.
     * Pozwala na izolację danych między grupami.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id")
    private StudentGroup group;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;
}
