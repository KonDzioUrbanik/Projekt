package com.pansgroup.projectbackend.module.user;

import com.pansgroup.projectbackend.module.user.dto.*;

import java.util.List;
import org.springframework.web.multipart.MultipartFile;

public interface UserService {
    UserResponseDto create(UserCreateDto dto);

    List<UserResponseDto> findAll();

    UserResponseDto findByEmail(String email);

    User authenticate(LoginRequestDto dto);

    User findUserByEmailInternal(String email); // Potrzebujemy tego

    UserResponseDto updateUser(Long userId, UserUpdateDto dto);

    void changePassword(Long userId, PasswordChangeDto dto);

    UserResponseDto getCurrentUser(String email);

    UserResponseDto updateRoleUser(String email, UserRoleUpdateDto dto);

    UserResponseDto assignUserToGroup(String email, UserGroupAssignmentDto dto);

    void deleteUser(Long userId);

    void confirmToken(String token);

    void requestPasswordReset(String email);

    void processPasswordReset(String token, String newPassword, String confirmPassword);

    void uploadAvatar(Long userId, MultipartFile file);

    User getAvatar(Long userId);

    void removeAvatar(Long userId);
}
