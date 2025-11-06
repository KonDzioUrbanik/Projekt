package com.pansgroup.projectbackend.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
// IMPORTY ZALEŻNOŚCI SPRING SECURITY
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.InternalAuthenticationServiceException; // <-- NOWY IMPORT
import org.springframework.security.core.userdetails.UsernameNotFoundException;
// ------------------------------------
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /* ====== Helpers ====== */

    private ProblemDetail pd(HttpStatus status,
                             String title,
                             String detail,
                             HttpServletRequest req,
                             String code) {
        ProblemDetail p = ProblemDetail.forStatusAndDetail(status, detail);
        p.setTitle(title);
        if (req != null) {
            p.setInstance(URI.create(req.getRequestURI()));
        }
        p.setProperty("code", code);
        // kompatybilność z frontendem (data.detail || data.message)
        p.setProperty("message", detail);
        return p;
    }

    private ProblemDetail pd(HttpStatus status, String title, String detail, HttpServletRequest req,
                             String code, Map<String, ?> extra) {
        ProblemDetail p = pd(status, title, detail, req, code);
        if (extra != null) {
            extra.forEach(p::setProperty);
        }
        return p;
    }

    /* ====== 404: brak zasobu (np. z DispatcherServlet w Spring 6) ====== */
    @ExceptionHandler(NoResourceFoundException.class)
    public ProblemDetail handleNoResourceFound(NoResourceFoundException ex, HttpServletRequest req) {
        return pd(HttpStatus.NOT_FOUND, "Not found",
                "Resource not found: " + ex.getResourcePath(), req, "not_found");
    }

    /* ====== 405: zła metoda HTTP ====== */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ProblemDetail handleMethodNotSupported(HttpRequestMethodNotSupportedException ex, HttpServletRequest req) {
        return pd(HttpStatus.METHOD_NOT_ALLOWED, "Method not allowed",
                "Metoda HTTP nie jest obsługiwana dla tego endpointu.", req, "method_not_allowed",
                Map.of("reason", ex.getMessage()));
    }

    /* ====== 409: duplikacja numeru albumu ====== */
    @ExceptionHandler(AlbumNumberAlreadyExistsException.class)
    public ProblemDetail handleDuplicateAlbumNumber(AlbumNumberAlreadyExistsException ex, HttpServletRequest req) {
        return pd(HttpStatus.CONFLICT, "Duplicate album number",
                ex.getMessage(), req, "number_album_exists");
    }

    /* ====== 400: @Valid na @RequestBody ====== */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex, HttpServletRequest req) {
        Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        FieldError::getField,
                        FieldError::getDefaultMessage,
                        (a, b) -> a,
                        LinkedHashMap::new
                ));
        return pd(HttpStatus.BAD_REQUEST, "Validation error",
                "Niepoprawne dane formularza.", req, "validation_failed",
                Map.of("errors", errors));
    }

    /* ====== 400: walidacja @RequestParam/@PathVariable ====== */
    @ExceptionHandler(ConstraintViolationException.class)
    public ProblemDetail handleConstraintViolation(ConstraintViolationException ex, HttpServletRequest req) {
        var errors = ex.getConstraintViolations().stream()
                .collect(Collectors.toMap(
                        v -> v.getPropertyPath().toString(),
                        ConstraintViolation::getMessage,
                        (a, b) -> a,
                        LinkedHashMap::new
                ));
        return pd(HttpStatus.BAD_REQUEST, "Constraint violation",
                "Niepoprawne dane żądania.", req, "constraint_violation",
                Map.of("errors", errors));
    }

    /* ====== 400: zły payload / typy ====== */
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ProblemDetail handleBadPayload(Exception ex, HttpServletRequest req) {
        return pd(HttpStatus.BAD_REQUEST, "Malformed request",
                "Nieprawidłowy format danych wejściowych.", req, "bad_payload",
                Map.of("reason", ex.getMessage()));
    }

    /* ====== 400: puste pole domenowe ====== */
    @ExceptionHandler(BlankFieldException.class)
    public ProblemDetail handleBlank(BlankFieldException ex, HttpServletRequest req) {
        return pd(HttpStatus.BAD_REQUEST, "Validation error",
                ex.getMessage(), req, "blank_field",
                Map.of("errors", Map.of(ex.getField(), "nie może być puste")));
    }

    // ==================================================================
    // TUTAJ JEST OSTATECZNA POPRAWKA
    // ==================================================================

    /* ====== 401: uwierzytelnianie (logowanie) ====== */
    @ExceptionHandler({
            BadCredentialsException.class,
            UsernameNotFoundException.class,
            DisabledException.class,
            InternalAuthenticationServiceException.class, // <-- NOWY: Błąd opakowujący
            com.pansgroup.projectbackend.exception.BadCredentialsException.class,
            com.pansgroup.projectbackend.exception.UsernameNotFoundException.class
    })
    public ProblemDetail handleAuthFailed(Exception ex, HttpServletRequest req) {
        String detail;

        // NOWA LOGIKA: Sprawdzamy, czy wyjątek LUB jego przyczyna to DisabledException
        if (ex instanceof DisabledException || (ex.getCause() != null && ex.getCause() instanceof DisabledException)) {
            // Jeśli tak, pobieramy wiadomość z SecurityConfig ("Konto nie zostało aktywowane...")
            // Jeśli komunikat jest w wyjątku opakowującym, też go weźmiemy
            detail = ex.getMessage();

            // Poprawka, aby na pewno pobrać właściwy komunikat
            if (ex.getCause() != null && ex.getCause() instanceof DisabledException) {
                detail = ex.getCause().getMessage();
            }

        } else {
            // W przeciwnym razie, dajemy domyślny błąd
            detail = "Nieprawidłowe dane logowania.";
        }

        return pd(HttpStatus.UNAUTHORIZED, "Authentication failed",
                detail, req, "auth_failed");
    }

    // ==================================================================
    // KONIEC POPRAWKI
    // ==================================================================


    /* ====== 403: brak uprawnień (np. filtr JWT) ====== */
    @ExceptionHandler(AccessDeniedException.class)
    public ProblemDetail handleAccessDenied(AccessDeniedException ex, HttpServletRequest req) {
        return pd(HttpStatus.FORBIDDEN, "Access denied",
                "Brak uprawnień do wykonania tej operacji.", req, "access_denied");
    }

    /* ====== 400: password mismatch ====== */
    @ExceptionHandler(PasswordMismatchException.class)
    public ProblemDetail handlePasswordMismatch(PasswordMismatchException ex, HttpServletRequest req) {
        return pd(HttpStatus.BAD_REQUEST, "Password mismatch",
                ex.getMessage(), req, "password_mismatch");
    }

    /* ====== 404: domenowe not found ====== */
    @ExceptionHandler(NoteNotFoundException.class)
    public ProblemDetail handleNoteNotFound(NoteNotFoundException ex, HttpServletRequest req) {
        return pd(HttpStatus.NOT_FOUND, "Not found",
                ex.getMessage(), req, "note_not_found");
    }

    @ExceptionHandler(StudentGroupNotFoundException.class)
    public ProblemDetail handleStudentGroupNotFound(StudentGroupNotFoundException ex, HttpServletRequest req) {
        return pd(HttpStatus.NOT_FOUND, "Not found",
                ex.getMessage(), req, "group_not_found");
    }

    @ExceptionHandler(ScheduleEntryNotFoundException.class)
    public ProblemDetail handleScheduleEntryNotFound(ScheduleEntryNotFoundException ex, HttpServletRequest req) {
        return pd(HttpStatus.NOT_FOUND, "Not found",
                ex.getMessage(), req, "schedule_not_found");
    }

    /* ====== 409: konflikt/unikalność (np. email) ====== */
    @ExceptionHandler(EmailAlreadyExistsException.class)
    public ProblemDetail handleDuplicateEmail(EmailAlreadyExistsException ex, HttpServletRequest req) {
        return pd(HttpStatus.CONFLICT, "Duplicate email",
                ex.getMessage(), req, "email_exists");
    }

    /* ====== 409: naruszenie constraintów DB ====== */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail handleDataIntegrity(DataIntegrityViolationException ex, HttpServletRequest req) {
        String reason = ex.getMostSpecificCause() != null
                ? ex.getMostSpecificCause().getMessage()
                : ex.getMessage();
        return pd(HttpStatus.CONFLICT, "Constraint violation",
                "Operacja narusza ograniczenia integralności danych.", req, "db_constraint",
                Map.of("reason", reason));
    }

    /* ====== 500: fallback ====== */
    @ExceptionHandler(Exception.class)
    public ProblemDetail handleGeneral(Exception ex, HttpServletRequest req) {
        // Logujemy błąd DOKŁADNIE, aby widzieć, co się stało
        log.error("Unhandled exception caught by handleGeneral on {}: {}",
                req != null ? req.getRequestURI() : "unknown",
                ex.getMessage(),
                ex); // Dodajemy pełny stack trace do logów

        return pd(HttpStatus.INTERNAL_SERVER_ERROR, "Unexpected error",
                "Wewnętrzny błąd serwera.", req, "unexpected",
                Map.of("reason", ex.getMessage()));
    }
}