package com.pansgroup.projectbackend.module.user;

import com.pansgroup.projectbackend.module.user.dto.UserResponseDto;
import com.pansgroup.projectbackend.module.user.dto.UserUpdateDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class) // Włącza obsługę Mockito
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    @Mock
    private com.pansgroup.projectbackend.module.student.StudentGroupRepository studentGroupRepository;

    @Mock
    private com.pansgroup.projectbackend.module.email.EmailService emailService;

    @Mock
    private com.pansgroup.projectbackend.module.user.confirmation.ConfirmationTokenRepository confirmationTokenRepository;

    @Mock
    private com.pansgroup.projectbackend.module.user.passwordReset.PasswordResetTokenRepository passwordResetTokenRepository;

    @Mock
    private com.pansgroup.projectbackend.module.system.SystemService systemService;

    @Mock
    private com.pansgroup.projectbackend.module.forum.ForumService forumService;

    @Mock
    private com.pansgroup.projectbackend.module.note.NoteService noteService;

    @Mock
    private com.pansgroup.projectbackend.module.system.AdminSecurityAuditService securityAuditService;

    @Mock
    private com.pansgroup.projectbackend.security.LoginAttemptService loginAttemptService;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks // Wstrzykujemy fałszywe repozytorium do prawdziwego serwisu
    private UserServiceImpl userService;

    @Test
    void shouldUpdateUser_WhenUserExists() {
        // GIVEN (Przygotowanie danych)
        Long userId = 1L;

        // Tworzymy użytkownika, który "jest w bazie"
        User existingUser = new User();
        existingUser.setId(userId);
        existingUser.setFirstName("StareImie");
        existingUser.setEmail("test@pans.pl");

        // Tworzymy dane, które przychodzą z formularza
        UserUpdateDto updateDto = new UserUpdateDto();
        updateDto.setFirstName("NoweImie");
        updateDto.setLastName("Kowalski");
        updateDto.setNickName("Kondzio");
        updateDto.setBio("Lubię programować");
        // --- TUTAJ DODAJ BRAKUJĄCE POLE ---
        // Jeśli w DTO masz Integer:
        updateDto.setYearOfStudy(String.valueOf(2));
        // Jeśli jednak w DTO masz String:
        // updateDto.setYearOfStudy("2");

        // Uczymy mocka
        when(userRepository.findById(userId)).thenReturn(Optional.of(existingUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // WHEN (Wykonanie akcji)
        UserResponseDto result = userService.updateUser(userId, updateDto);

        // THEN (Sprawdzenie wyników)
        assertNotNull(result);
        assertEquals("NoweImie", result.firstName());
        assertEquals("Kondzio", result.nickName());

        verify(userRepository).save(any(User.class));
    }
}