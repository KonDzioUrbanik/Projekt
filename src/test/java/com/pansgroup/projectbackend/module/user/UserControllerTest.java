package com.pansgroup.projectbackend.module.user;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pansgroup.projectbackend.module.user.dto.UserResponseDto;
import com.pansgroup.projectbackend.module.user.dto.UserUpdateDto;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest // Ładuje cały kontekst aplikacji
@AutoConfigureMockMvc // Konfiguruje narzędzie do strzelania w API
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc; // To nasze "narzędzie" do udawania przeglądarki

    @Autowired
    private ObjectMapper objectMapper; // Zamienia obiekty Java na JSON

    @MockitoBean // Podmieniamy prawdziwy serwis na mocka w kontekście Springa
    private UserService userService;

    @Test
    @WithMockUser(username = "student@pans.pl", roles = {"STUDENT"}) // Udajemy zalogowanego usera
    void shouldUpdateCurrentUser_WhenDataIsValid() throws Exception {
        // GIVEN
        UserUpdateDto updateDto = new UserUpdateDto();
        updateDto.setFirstName("Jan");
        updateDto.setLastName("Testowy");
        updateDto.setNickName("Mistrz");

        // Przygotowujemy odpowiedź, jaką zwróciłby serwis
        UserResponseDto responseDto = new UserResponseDto(
                1L, "Jan", "Testowy", "student@pans.pl", "STUDENT", 12345, null, null, true,
                "Mistrz", "123", "IT", 1, "S", "Bio"
        );

        // Musimy zasymulować, że najpierw znajdujemy usera po mailu (bo tak działa kontroler: Authentication -> email -> ID)
        User mockUser = new User();
        mockUser.setId(1L);
        mockUser.setEmail("student@pans.pl");

        Mockito.when(userService.findUserByEmailInternal("student@pans.pl")).thenReturn(mockUser);
        Mockito.when(userService.updateUser(eq(1L), any(UserUpdateDto.class))).thenReturn(responseDto);

        // WHEN & THEN
        mockMvc.perform(put("/api/users/me") // Strzelamy PUT na endpoint
                        .contentType(MediaType.APPLICATION_JSON) // Mówimy, że wysyłamy JSON
                        .content(objectMapper.writeValueAsString(updateDto))) // Wkładamy JSON w body
                .andExpect(status().isOk()) // Oczekujemy statusu 200 OK
                .andExpect(jsonPath("$.firstName").value("Jan")) // Sprawdzamy czy w JSON-ie zwrotnym jest Jan
                .andExpect(jsonPath("$.nickName").value("Mistrz")); // Sprawdzamy nowe pole
    }
}