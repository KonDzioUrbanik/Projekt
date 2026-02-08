package com.pansgroup.projectbackend.module.note;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NoteRepository extends JpaRepository<Note, Long> {
    
    // Notatki użytkownika
    List<Note> findByAuthor_Id(Long userId);
    
    // Notatki udostępnione dla użytkownika
    @Query("SELECT n FROM Note n JOIN n.sharedWith u WHERE u.id = :userId")
    List<Note> findSharedWithUser(@Param("userId") Long userId);
    
    // Notatki grupy (kierunku)
    @Query("SELECT n FROM Note n WHERE n.visibility = 'GROUP' AND n.author.studentGroup.id = :groupId")
    List<Note> findByGroupVisibility(@Param("groupId") Long groupId);
    
    // Wszystkie publiczne notatki
    @Query("SELECT n FROM Note n WHERE n.visibility = 'PUBLIC' ORDER BY n.createdAt DESC")
    List<Note> findPublicNotes();
    
    // Ulubione notatki użytkownika
    @Query("SELECT n FROM Note n JOIN n.favoritedBy u WHERE u.id = :userId")
    List<Note> findFavoritesByUser(@Param("userId") Long userId);
    
    // Notatki z konkretnym tagiem
    @Query("SELECT n FROM Note n WHERE n.tags LIKE CONCAT('%', :tag, '%')")
    List<Note> findByTag(@Param("tag") String tag);
    
    // Najpopularniejsze notatki publiczne
    @Query("SELECT n FROM Note n WHERE n.visibility = 'PUBLIC' ORDER BY n.viewCount DESC")
    List<Note> findTopPublicNotes();
}


