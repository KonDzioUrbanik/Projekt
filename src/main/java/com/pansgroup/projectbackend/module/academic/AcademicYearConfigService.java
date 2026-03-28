package com.pansgroup.projectbackend.module.academic;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.Optional;

/**
 * Serwis zarządzający konfiguracją roku akademickiego.
 * Stosuje wzorzec "singleton konfiguracji" – zawsze istnieje dokładnie jeden
 * wpis.
 * Tworzony przez AcademicYearInitializer przy starcie aplikacji.
 * Dostępny z innych modułów przez metodę getCurrent().
 */
@Service
@Transactional
public class AcademicYearConfigService {

    private final AcademicYearConfigRepository repository;

    public AcademicYearConfigService(AcademicYearConfigRepository repository) {
        this.repository = repository;
    }

    /**
     * Zwraca aktywną konfigurację roku akademickiego.
     * 
     * @throws ResponseStatusException 404 jeśli konfiguracja nie istnieje.
     */
    @Transactional(readOnly = true)
    public AcademicYearConfigDto getCurrent() {
        return repository.findFirstByOrderByIdAsc()
                .map(this::toDto)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Brak konfiguracji roku akademickiego. Skontaktuj się z administratorem systemu."));
    }

    /**
     * Zwraca Optional z aktualną konfiguracją (bezpieczna wersja bez wyjątku).
     * Używana przez inne moduły (np. postęp semestru) z graceful degradation.
     */
    @Transactional(readOnly = true)
    public Optional<AcademicYearConfigDto> findCurrent() {
        return repository.findFirstByOrderByIdAsc().map(this::toDto);
    }

    /**
     * Aktualizuje aktywną konfigurację roku akademickiego.
     * Jeśli konfiguracja nie istnieje, tworzy nową.
     */
    public AcademicYearConfigDto update(AcademicYearConfigDto dto) {
        AcademicYearConfig config = repository.findFirstByOrderByIdAsc()
                .orElseGet(AcademicYearConfig::new);

        validate(dto);

        config.setAcademicYear(dto.getAcademicYear().trim());
        config.setWinterSemesterStart(dto.getWinterSemesterStart());
        config.setWinterSemesterEnd(dto.getWinterSemesterEnd());
        config.setSummerSemesterStart(dto.getSummerSemesterStart());
        config.setSummerSemesterEnd(dto.getSummerSemesterEnd());
        
        // Zabezpieczenie przed 409 Conflict: jeśli z frontendu przychodzi null (bo ukryliśmy pole),
        // zachowaj starą wartość. Jeśli encja też była pusta (nowy rekord), ustaw bezpieczny defaults.
        if (dto.getWeekAStartDate() != null) {
            config.setWeekAStartDate(dto.getWeekAStartDate());
        } else if (config.getWeekAStartDate() == null) {
            config.setWeekAStartDate(LocalDate.of(2025, 10, 6)); // default fallback
        }

        return toDto(repository.save(config));
    }

    /**
     * Inicjalizuje domyślną konfigurację jeśli żadna nie istnieje.
     * Wywoływana przez AcademicYearInitializer przy starcie.
     */
    public void initializeIfAbsent(AcademicYearConfigDto defaults) {
        if (repository.count() == 0) {
            update(defaults);
        }
    }

    /**
     * Zwraca aktualny semestr: "WINTER", "SUMMER" lub "NONE" (przerwa).
     * Używane przez moduł postępu semestru i inne.
     */
    @Transactional(readOnly = true)
    public String getCurrentSemester() {
        return findCurrent().map(cfg -> {
            LocalDate today = LocalDate.now();
            if (!today.isBefore(cfg.getWinterSemesterStart()) && !today.isAfter(cfg.getWinterSemesterEnd())) {
                return "WINTER";
            }
            if (!today.isBefore(cfg.getSummerSemesterStart()) && !today.isAfter(cfg.getSummerSemesterEnd())) {
                return "SUMMER";
            }
            return "NONE";
        }).orElse("NONE");
    }

    // ── Prywatne ───────────────────────────────────────────────────────────────

    private void validate(AcademicYearConfigDto dto) {
        if (dto.getAcademicYear() == null || dto.getAcademicYear().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nazwa roku akademickiego jest wymagana.");
        }
        if (dto.getWinterSemesterStart() == null || dto.getWinterSemesterEnd() == null
                || dto.getSummerSemesterStart() == null || dto.getSummerSemesterEnd() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Wszystkie daty semestrów są wymagane.");
        }
        if (!dto.getWinterSemesterEnd().isAfter(dto.getWinterSemesterStart())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Data końca semestru zimowego musi być późniejsza niż data początku.");
        }
        if (!dto.getSummerSemesterEnd().isAfter(dto.getSummerSemesterStart())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Data końca semestru letniego musi być późniejsza niż data początku.");
        }
        // weekAStartDate jest opcjonalny – przeznaczony do przyszłego algorytmu A/B
    }

    private AcademicYearConfigDto toDto(AcademicYearConfig e) {
        return AcademicYearConfigDto.builder()
                .id(e.getId())
                .academicYear(e.getAcademicYear())
                .winterSemesterStart(e.getWinterSemesterStart())
                .winterSemesterEnd(e.getWinterSemesterEnd())
                .summerSemesterStart(e.getSummerSemesterStart())
                .summerSemesterEnd(e.getSummerSemesterEnd())
                .weekAStartDate(e.getWeekAStartDate())
                .winterSemesterLabel(formatSemesterRange(e.getWinterSemesterStart(), e.getWinterSemesterEnd()))
                .summerSemesterLabel(formatSemesterRange(e.getSummerSemesterStart(), e.getSummerSemesterEnd()))
                .build();
    }

    private String formatSemesterRange(java.time.LocalDate from, java.time.LocalDate to) {
        if (from == null || to == null)
            return "";
        return formatDate(from) + " - " + formatDate(to);
    }

    private String formatDate(java.time.LocalDate date) {
        String[] months = {
                "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
                "lipca", "sierpnia", "września", "października", "listopada", "grudnia"
        };
        return date.getDayOfMonth() + " " + months[date.getMonthValue() - 1] + " " + date.getYear();
    }
}
