package com.pansgroup.projectbackend.module.user;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.pansgroup.projectbackend.module.student.StudentGroup;
import com.pansgroup.projectbackend.module.user.confirmation.ConfirmationToken;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity(name = "users")
@Getter
@Setter
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String firstName;
    private String lastName;

    @Column(unique = true)
    private String email;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;

    @Column(unique = true)
    private Integer nrAlbumu;

    private String role;

    @ManyToOne
    StudentGroup studentGroup;

    @OneToOne
    @JoinColumn(name = "confirmation_token_id")
    ConfirmationToken confirmationToken;

    boolean isActivated;

    private String nickName;
    private String phoneNumber;
    private String fieldOfStudy;
    private Integer YearOfStudy;
    private String studyMode;

    @Column(length = 500)
    private String bio;

    @Lob
    @com.fasterxml.jackson.annotation.JsonIgnore
    private byte[] avatarData;

    private String avatarContentType;

}
