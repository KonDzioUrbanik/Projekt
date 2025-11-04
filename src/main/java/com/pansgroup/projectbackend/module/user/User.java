package com.pansgroup.projectbackend.module.user;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.pansgroup.projectbackend.module.student.StudentGroup;
import jakarta.persistence.*;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Entity(name = "users")
@Getter @Setter
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
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

}
