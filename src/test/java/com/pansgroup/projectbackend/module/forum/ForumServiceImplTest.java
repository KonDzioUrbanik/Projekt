package com.pansgroup.projectbackend.module.forum;

import com.pansgroup.projectbackend.module.forum.dto.ForumThreadCreateDto;
import com.pansgroup.projectbackend.module.student.StudentGroup;
import com.pansgroup.projectbackend.module.student.StudentGroupRepository;
import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ForumServiceImplTest {

    @Mock
    private ForumThreadRepository forumThreadRepository;

    @Mock
    private ForumCommentRepository forumCommentRepository;

    @Mock
    private ForumThreadLikeRepository forumThreadLikeRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private StudentGroupRepository studentGroupRepository;

    @InjectMocks
    private ForumServiceImpl forumService;

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldStripHtmlFromThreadContent() {
        User user = new User();
        user.setId(1L);
        user.setEmail("student@test.pl");
        user.setRole("ROLE_STUDENT");

        StudentGroup group = new StudentGroup();
        group.setId(5L);
        group.setName("Informatyka");
        user.setStudentGroup(group);

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        user.getEmail(),
                        "x",
                        java.util.List.of(new SimpleGrantedAuthority("ROLE_STUDENT"))
                )
        );

        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(forumThreadRepository.save(any(ForumThread.class))).thenAnswer(inv -> {
            ForumThread thread = inv.getArgument(0);
            thread.setId(7L);
            return thread;
        });

        ForumThreadCreateDto dto = new ForumThreadCreateDto("<b>Temat</b>", "<script>alert(1)</script> Czesc", null);
        var result = forumService.createThread(dto);

        assertEquals("Temat", result.title());
        assertEquals("alert(1) Czesc", result.content());
    }

    @Test
    void shouldRequireGroupForNonAdminThreadCreation() {
        User user = new User();
        user.setId(2L);
        user.setEmail("student2@test.pl");
        user.setRole("ROLE_STUDENT");
        user.setStudentGroup(null);

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        user.getEmail(),
                        "x",
                        java.util.List.of(new SimpleGrantedAuthority("ROLE_STUDENT"))
                )
        );

        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> forumService.createThread(new ForumThreadCreateDto("Temat", "Tresc", null)));

        assertNotNull(ex.getReason());
        assertTrue(ex.getReason().contains("grupy"));
    }
}



