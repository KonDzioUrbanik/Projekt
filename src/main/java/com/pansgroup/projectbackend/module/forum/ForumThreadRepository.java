package com.pansgroup.projectbackend.module.forum;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ForumThreadRepository extends JpaRepository<ForumThread, Long> {

    @Override
    @EntityGraph(attributePaths = {"author", "studentGroup", "comments", "comments.author"})
    Optional<ForumThread> findById(Long id);

    @EntityGraph(attributePaths = {"author", "studentGroup", "comments", "comments.author"})
    List<ForumThread> findByStudentGroup_IdAndArchivedFalseOrderByPinnedDescCreatedAtDesc(Long groupId);

    @EntityGraph(attributePaths = {"author", "studentGroup", "comments", "comments.author"})
    List<ForumThread> findByStudentGroup_IdOrderByArchivedAscPinnedDescCreatedAtDesc(Long groupId);

    @EntityGraph(attributePaths = {"author", "studentGroup", "comments", "comments.author"})
    List<ForumThread> findAllByOrderByArchivedAscPinnedDescCreatedAtDesc();
}



