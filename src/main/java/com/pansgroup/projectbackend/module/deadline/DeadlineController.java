package com.pansgroup.projectbackend.module.deadline;

import com.pansgroup.projectbackend.module.deadline.dto.DeadlineCreateDto;
import com.pansgroup.projectbackend.module.deadline.dto.DeadlineResponseDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/deadlines")
public class DeadlineController {

    private final DeadlineService deadlineService;

    public DeadlineController(DeadlineService deadlineService) {
        this.deadlineService = deadlineService;
    }

    @GetMapping
    public ResponseEntity<List<DeadlineResponseDto>> getMyDeadlines(Principal principal) {
        return ResponseEntity.ok(deadlineService.getMyDeadlines(principal.getName()));
    }

    @PostMapping
    public ResponseEntity<DeadlineResponseDto> create(
            @Valid @RequestBody DeadlineCreateDto dto,
            Principal principal) {
        DeadlineResponseDto created = deadlineService.create(dto, principal.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Principal principal) {
        deadlineService.delete(id, principal.getName());
        return ResponseEntity.noContent().build();
    }
}
