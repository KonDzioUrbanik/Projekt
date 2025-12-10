package com.pansgroup.projectbackend.module.user;

import com.pansgroup.projectbackend.module.user.dto.UserResponseDto;
import com.pansgroup.projectbackend.module.user.dto.UserUpdateDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class) // Włącza obsługę Mockito
class UserServiceTest {

    @Mock // Udajemy repozytorium (nie łączy się z bazą)
    private UserRepository userRepository;

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