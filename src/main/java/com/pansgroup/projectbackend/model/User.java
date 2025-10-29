package com.pansgroup.projectbackend.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
@Entity(name = "users")
public class User {


    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Id
    private Long id;

    @NotBlank(message = "{user.firstName.notBlank}")
    @Size(min = 2, max = 30, message = "{user.firstName.size}")
    private String firstName;

    @NotBlank(message = "{user.lastName.notBlank}")
    @Size(min = 2, max = 30, message = "{user.lastName.size}")
    @NotBlank
    private String lastName;

    @NotBlank(message = "{user.email.notBlank}")
    @Email(message = "{user.email.invalid}")
    @Column(unique = true)
    @Email
    @NotBlank
    private String email;

    @NotBlank(message = "{user.password.notBlank}")
    @Size(min = 2, message = "{user.password.size}")
    @NotBlank
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;

    private String role;

}
