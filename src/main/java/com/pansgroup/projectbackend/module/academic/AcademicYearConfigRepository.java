package com.pansgroup.projectbackend.module.academic;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AcademicYearConfigRepository extends JpaRepository<AcademicYearConfig, Long> {

    /** Zwraca pierwszą (i jedyną aktywną) konfigurację roku akademickiego. */
    Optional<AcademicYearConfig> findFirstByOrderByIdAsc();
}
