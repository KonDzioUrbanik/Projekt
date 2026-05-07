package com.pansgroup.projectbackend.module.note;

import com.pansgroup.projectbackend.exception.NoteNotFoundException;
import com.pansgroup.projectbackend.exception.UserNotFoundException;
import com.pansgroup.projectbackend.exception.UsernameNotFoundException;
import com.pansgroup.projectbackend.module.user.dto.UserResponseDto;

import com.pansgroup.projectbackend.module.note.dto.*;
import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import com.pansgroup.projectbackend.module.user.event.UserDeletedEvent;

@Slf4j
@Service
@Transactional
public class NoteServiceImpl implements NoteService {
    private final NoteRepository noteRepository;
    private final UserRepository userRepository;
    private final jakarta.persistence.EntityManager entityManager;

    public NoteServiceImpl(NoteRepository noteRepository, UserRepository userRepository, jakarta.persistence.EntityManager entityManager) {
        this.noteRepository = noteRepository;
        this.userRepository = userRepository;
        this.entityManager = entityManager;
    }

    @Override
    public NoteResponseDto create(NoteCreateDto dto, String email) {
        User author = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Użytkownik o e-mailu: " + email + " nie istnieje"));

        Note note = new Note();
        // Sanityzacja HTML (ochrona XSS)
        note.setTitle(Jsoup.clean(dto.title(), Safelist.none()).trim());
        note.setContent(Jsoup.clean(dto.content(), Safelist.relaxed()).trim());
        note.setAuthor(author);
        note.setVisibility(NoteVisibility.PRIVATE); // Domyślnie prywatna
        note.setViewCount(0);
        note.setIsPinned(false);
        if (dto.tags() != null) {
            note.setTags(dto.tags().trim());
        }

        Note saved = noteRepository.save(note);
        return toResponse(saved);
    }

    @Override
    public NoteResponseDto update(Long id, NoteUpdateDto dto) {
        Note note = findNoteByIdAndEnsureOwnership(id);

        // Sanityzacja HTML (ochrona XSS)
        note.setTitle(Jsoup.clean(dto.title(), Safelist.none()).trim());
        note.setContent(Jsoup.clean(dto.content(), Safelist.relaxed()).trim());
        note.setUpdatedAt(LocalDateTime.now());

        Note updated = noteRepository.save(note);
        return toResponse(updated);
    }

    @Override
    public void delete(Long id) {
        Note note = findNoteByIdAndEnsureOwnership(id);
        noteRepository.delete(note);
    }

    @Override
    public NoteDTO findById(Long id) {
        Note note = noteRepository.findById(id)
                .orElseThrow(() -> new NoteNotFoundException(id));

        User currentUser = getCurrentUser();
        // Sprawdź czy użytkownik ma dostęp do notatki
        if (!hasAccessToNote(note, currentUser)) {
            throw new NoteNotFoundException(id);
        }

        note.incrementViewCount();
        noteRepository.save(note);

        return NoteDTO.fromEntity(note, currentUser);
    }

    @Override
    public List<NoteResponseDto> findAll() {
        return noteRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public List<NoteResponseDto> findByUser(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new UserNotFoundException(userId);
        }
        
        User currentUser = getCurrentUser();
        List<Note> allUserNotes = noteRepository.findByAuthor_Id(userId);
        
        return allUserNotes.stream()
                .filter(note -> hasAccessToNote(note, currentUser))
                .map(this::toResponse)
                .toList();
    }

    @Override
    public List<NoteResponseDto> findByUserEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Użytkownik o e-mailu: " + email + " nie istnieje"));

        return noteRepository.findByAuthor_Id(user.getId()).stream()
                .map(this::toResponse)
                .toList();
    }

    // WSPÓŁDZIELENIE NOTATEK

    @Transactional
    public NoteDTO shareNote(Long noteId, ShareNoteRequest request) {
        User currentUser = getCurrentUser();
        Note note = findNoteByIdAndEnsureOwnership(noteId);

        note.setVisibility(request.getVisibility());

        // Jeśli udostępniamy wybranym użytkownikom
        if (request.getVisibility() == NoteVisibility.SHARED_WITH_USERS && request.getUserIds() != null) {
            Set<User> usersToShare = new HashSet<>();
            for (Long userId : request.getUserIds()) {
                User user = userRepository.findById(userId)
                        .orElseThrow(() -> new UserNotFoundException(userId));
                usersToShare.add(user);
            }
            note.setSharedWith(usersToShare);
        } else {
            note.setSharedWith(new HashSet<>()); // Wyczyść listę
        }

        // Nie aktualizujemy updatedAt - udostępnienie nie jest edycją treści
        Note saved = noteRepository.save(note);

        return NoteDTO.fromEntity(saved, currentUser);
    }

    public List<NoteDTO> getSharedWithMe() {
        User currentUser = getCurrentUser();
        List<Note> sharedNotes = noteRepository.findSharedWithUser(currentUser.getId());

        return sharedNotes.stream()
                .map(note -> NoteDTO.fromEntityWithPreview(note, currentUser))
                .collect(Collectors.toList());
    }

    public List<NoteDTO> getGroupNotes() {
        User currentUser = getCurrentUser();

        if (currentUser.getStudentGroup() == null) {
            return new ArrayList<>();
        }

        List<Note> groupNotes = noteRepository.findByGroupVisibility(currentUser.getStudentGroup().getId());

        return groupNotes.stream()
                .map(note -> NoteDTO.fromEntityWithPreview(note, currentUser))
                .collect(Collectors.toList());
    }

    public List<NoteDTO> getPublicNotes() {
        User currentUser = getCurrentUser();
        List<Note> publicNotes = noteRepository.findPublicNotes();

        return publicNotes.stream()
                .map(note -> NoteDTO.fromEntityWithPreview(note, currentUser))
                .collect(Collectors.toList());
    }

    public List<NoteDTO> getAllAccessibleNotes() {
        User currentUser = getCurrentUser();

        // Zbierz wszystkie notatki do których użytkownik ma dostęp
        Set<Note> accessibleNotes = new HashSet<>();

        // Własne notatki
        accessibleNotes.addAll(noteRepository.findByAuthor_Id(currentUser.getId()));

        // Udostępnione dla mnie
        accessibleNotes.addAll(noteRepository.findSharedWithUser(currentUser.getId()));

        // Notatki grupy
        if (currentUser.getStudentGroup() != null) {
            accessibleNotes.addAll(noteRepository.findByGroupVisibility(currentUser.getStudentGroup().getId()));
        }

        // Publiczne
        accessibleNotes.addAll(noteRepository.findPublicNotes());

        return accessibleNotes.stream()
                .sorted(Comparator.comparing(Note::getCreatedAt).reversed())
                .map(note -> NoteDTO.fromEntityWithPreview(note, currentUser))
                .collect(Collectors.toList());
    }

    // ULUBIONE

    @Transactional
    public NoteDTO toggleFavorite(Long noteId) {
        User currentUser = getCurrentUser();
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new NoteNotFoundException(noteId));

        // Sprawdź czy użytkownik ma dostęp do notatki
        if (!hasAccessToNote(note, currentUser)) {
            throw new NoteNotFoundException(noteId);
        }

        if (note.isFavoritedBy(currentUser)) {
            note.getFavoritedBy().remove(currentUser);
        } else {
            note.getFavoritedBy().add(currentUser);
        }

        Note saved = noteRepository.save(note);
        return NoteDTO.fromEntity(saved, currentUser);
    }

    public List<NoteDTO> getFavorites() {
        User currentUser = getCurrentUser();
        List<Note> favorites = noteRepository.findFavoritesByUser(currentUser.getId());

        return favorites.stream()
                .map(note -> NoteDTO.fromEntityWithPreview(note, currentUser))
                .collect(Collectors.toList());
    }

    // TAGI

    @Transactional
    public NoteDTO updateTags(Long noteId, String tags) {
        User currentUser = getCurrentUser();
        Note note = findNoteByIdAndEnsureOwnership(noteId);

        // Sanityzacja tagów (brak HTML)
        note.setTags(tags != null ? Jsoup.clean(tags, Safelist.none()).trim() : null);
        note.setUpdatedAt(LocalDateTime.now());

        Note saved = noteRepository.save(note);
        return NoteDTO.fromEntity(saved, currentUser);
    }

    public List<NoteDTO> searchByTag(String tag) {
        User currentUser = getCurrentUser();
        List<Note> notes = noteRepository.findByTag(tag);

        // Filtruj tylko te do których użytkownik ma dostęp
        return notes.stream()
                .filter(note -> hasAccessToNote(note, currentUser))
                .map(note -> NoteDTO.fromEntityWithPreview(note, currentUser))
                .collect(Collectors.toList());
    }

    // KOPIOWANIE

    @Transactional
    public NoteDTO copyNote(Long noteId) {
        User currentUser = getCurrentUser();
        Note originalNote = noteRepository.findById(noteId)
                .orElseThrow(() -> new NoteNotFoundException(noteId));

        // Sprawdź dostęp
        if (!hasAccessToNote(originalNote, currentUser)) {
            throw new NoteNotFoundException(noteId);
        }

        // Utwórz kopię
        Note copy = new Note();
        copy.setTitle(originalNote.getTitle() + " (kopia)");
        copy.setContent(originalNote.getContent());
        copy.setAuthor(currentUser);
        copy.setVisibility(NoteVisibility.PRIVATE);
        copy.setTags(originalNote.getTags());
        copy.setViewCount(0);
        copy.setIsPinned(false);

        Note saved = noteRepository.save(copy);
        return NoteDTO.fromEntity(saved, currentUser);
    }

    // METODY POMOCNICZE

    private boolean hasAccessToNote(Note note, User user) {
        // Autor zawsze ma dostęp
        if (note.getAuthor().getId().equals(user.getId())) {
            return true;
        }

        // Sprawdź widoczność
        switch (note.getVisibility()) {
            case PRIVATE:
                return false;
            case SHARED_WITH_USERS:
                return note.isSharedWith(user);
            case GROUP:
                return user.getStudentGroup() != null &&
                        user.getStudentGroup().getId().equals(note.getAuthor().getStudentGroup().getId());
            case PUBLIC:
                return true;
            default:
                return false;
        }
    }

    private NoteResponseDto toResponse(Note n) {
        User u = n.getAuthor();
        String groupName = u.getStudentGroup() != null ? u.getStudentGroup().getName() : null;

        return new NoteResponseDto(
                n.getId(),
                n.getTitle(),
                n.getContent(),
                u.getId(),
                u.getFirstName(),
                u.getLastName(),
                n.getVisibility().name(),
                n.getCreatedAt(),
                n.getUpdatedAt(),
                groupName);
    }

    private User getCurrentUser() {
        String email = getCurrentUserEmail();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Użytkownik nie znaleziony: " + email));
    }

    private String getCurrentUserEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalStateException("Użytkownik nie jest uwierzytelniony.");
        }
        return authentication.getName();
    }

    public List<UserResponseDto> getNoteSharedUsers(Long noteId) {
        Note note = findNoteByIdAndEnsureOwnership(noteId);
        return note.getSharedWith().stream()
                .map(this::mapToUserDto)
                .toList();
    }

    private UserResponseDto mapToUserDto(User u) {
        return new UserResponseDto(
                u.getId(),
                u.getFirstName(),
                u.getLastName(),
                u.getEmail(),
                u.getRole(),
                u.getNrAlbumu(),
                u.getStudentGroup() != null ? u.getStudentGroup().getId() : null,
                u.getStudentGroup() != null ? u.getStudentGroup().getName() : null,
                u.isActivated(),
                u.isBlocked(),
                u.getNickName(),
                u.getPhoneNumber(),
                u.getFieldOfStudy(),
                u.getYearOfStudy(),
                u.getStudyMode(),
                u.getBio(),
                u.getLastLogin(),
                u.getCreatedAt(),
                u.getLastLoginIp(),
                u.getFailedLoginAttempts(),
                u.getPreviousLogin());
    }

    private Note findNoteByIdAndEnsureOwnership(Long noteId) {
        String userEmail = getCurrentUserEmail();

        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new NoteNotFoundException(noteId));

        if (!note.getAuthor().getEmail().equalsIgnoreCase(userEmail)) {
            throw new NoteNotFoundException(noteId);
        }

        return note;
    }

    @EventListener
    @Transactional
    public void onUserDeleted(UserDeletedEvent event) {
        Long userId = event.getUser().getId();
        
        // Krok 1: Bezpieczne pobranie wszystkich notatek użytkownika
        List<Note> userNotes = noteRepository.findByAuthor_Id(userId);
        
        // Krok 2: Używamy standardowych metod czyszczenia list po obu stronach relacji ManyToMany
        // (to wyczyści wpisy w note_shared_with i note_favorites dla notatek autora)
        for (Note note : userNotes) {
            note.getSharedWith().clear();
            note.getFavoritedBy().clear();
        }
        noteRepository.saveAllAndFlush(userNotes);

        // Krok 3: Czyszczenie złącz, gdzie usunięty użytkownik "wisiał" w notatkach innych osób
        noteRepository.deleteUserFromSharedNotes(userId);
        noteRepository.deleteUserFromFavoriteNotes(userId);
        
        // Krok 4: Ostateczne, twarde usunięcie notatek autora
        noteRepository.deleteAllInBatch(userNotes); // Twardy, bezpośredni flush usunięcia
        
        log.info("[Notes] Completely wiped notes and relations for user ID={}", userId);
    }
}
