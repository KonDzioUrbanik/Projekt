package com.pansgroup.projectbackend.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
// NOWY IMPORT - dla błędu ze Spring Security
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
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

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Object> handleNoResourceFound(NoResourceFoundException ex) {
        return new ResponseEntity<>("Resource not found: " + ex.getResourcePath(), HttpStatus.NOT_FOUND);
    }

    /* ---- 409: Błąd duplikacji numeru albumu ----- */
    @ExceptionHandler(AlbumNumberAlreadyExistsException.class)
    ProblemDetail handleDuplicateAlbumNumber(AlbumNumberAlreadyExistsException ex, HttpServletRequest req) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
        pd.setTitle("Duplicate album number");
        pd.setInstance(URI.create(req.getRequestURI()));
        pd.setProperty("code", "number_album_exists");
        return pd;
    }


    /* ---------- 400: błędy walidacji z @Valid na @RequestBody ---------- */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail handleValidation(MethodArgumentNotValidException ex, HttpServletRequest req) {
        Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        FieldError::getField,
                        FieldError::getDefaultMessage,
                        (a, b) -> a, // pierwszy wygrywa
                        LinkedHashMap::new
                ));

        ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        pd.setTitle("Validation error");
        pd.setDetail("Niepoprawne dane formularza.");
        pd.setInstance(URI.create(req.getRequestURI()));
        pd.setProperty("errors", errors);
        pd.setProperty("code", "validation_failed");
        return pd;
    }

    /* ---------- 400: walidacja dla @RequestParam/@PathVariable ---------- */
    @ExceptionHandler(ConstraintViolationException.class)
    ProblemDetail handleConstraintViolation(ConstraintViolationException ex, HttpServletRequest req) {
        var errors = ex.getConstraintViolations().stream()
                .collect(Collectors.toMap(
                        v -> v.getPropertyPath().toString(),
                        v -> v.getMessage(),
                        (a, b) -> a,
                        LinkedHashMap::new
                ));

        ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        pd.setTitle("Constraint violation");
        pd.setDetail("Niepoprawne dane żądania.");
        pd.setInstance(URI.create(req.getRequestURI()));
        pd.setProperty("errors", errors);
        pd.setProperty("code", "constraint_violation");
        return pd;
    }

    /* ---------- 400: parsowanie JSON/enum/typów ---------- */
    @ExceptionHandler({
            HttpMessageNotReadableException.class,
            MethodArgumentTypeMismatchException.class
    })
    ProblemDetail handleBadPayload(Exception ex, HttpServletRequest req) {
        ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        pd.setTitle("Malformed request");
        pd.setDetail("Nieprawidłowy format danych wejściowych.");
        pd.setInstance(URI.create(req.getRequestURI()));
        pd.setProperty("code", "bad_payload");
        pd.setProperty("reason", ex.getMessage());
        return pd;
    }

    /* ---------- 400 -------*/
    @ExceptionHandler(BlankFieldException.class)
    ProblemDetail handleBlank(BlankFieldException ex, HttpServletRequest req) {
        ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        pd.setTitle("Validation error");
        pd.setDetail(ex.getMessage());
        pd.setInstance(URI.create(req.getRequestURI()));
        pd.setProperty("code", "blank_field");
        pd.setProperty("errors", Map.of(ex.getField(), "nie może być puste"));
        return pd;
    }

    // ---------- NOWA METODA OBSŁUGI BŁĘDU LOGOWANIA ----------
    /* ---------- 401: Błąd uwierzytelniania ---------- */
    @ExceptionHandler({
            BadCredentialsException.class, // Błąd ze Spring Security
            com.pansgroup.projectbackend.exception.BadCredentialsException.class,
            com.pansgroup.projectbackend.exception.UsernameNotFoundException.class
    })
    ProblemDetail handleAuthFailed(Exception ex, HttpServletRequest req) {
        ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.UNAUTHORIZED);
        pd.setTitle("Authentication failed");
        pd.setDetail("Nieprawidłowe dane logowania.");
        pd.setInstance(URI.create(req.getRequestURI()));
        pd.setProperty("code", "auth_failed");
        return pd;
    }
    // ---------------------------------------------------------


    /* ---------- 404: nie znaleziono notatki ---------- */
    @ExceptionHandler(NoteNotFoundException.class)
    ProblemDetail handleNoteNotFound(NoteNotFoundException ex, HttpServletRequest req) {
        ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        pd.setTitle("Not found");
        pd.setDetail(ex.getMessage());
        pd.setInstance(URI.create(req.getRequestURI()));
        pd.setProperty("code", "note_not_found");
        return pd;
    }


    /* ---------- 409: kolizje biznesowe / unikalność ---------- */
    @ExceptionHandler(EmailAlreadyExistsException.class)
    ProblemDetail handleDuplicateEmail(EmailAlreadyExistsException ex, HttpServletRequest req) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
        pd.setTitle("Duplicate email");
        pd.setInstance(URI.create(req.getRequestURI()));
        pd.setProperty("code", "email_exists");
        return pd;
    }

    /* ---------- 409: constrainty bazodanowe ---------- */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail handleDataIntegrity(DataIntegrityViolationException ex, HttpServletRequest req) {
        ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        pd.setTitle("Constraint violation");
        pd.setDetail("Operacja narusza ograniczenia integralności danych.");
        pd.setInstance(URI.create(req.getRequestURI()));
        pd.setProperty("code", "db_constraint");
        pd.setProperty("reason", ex.getMostSpecificCause() != null
                ? ex.getMostSpecificCause().getMessage()
                : ex.getMessage());
        return pd;
    }

    /* ---------- 500: fallback ---------- */
    @ExceptionHandler(Exception.class)
    ProblemDetail handleGeneral(Exception ex, HttpServletRequest req) {
        // Logowanie błędu może być przydatne do debugowania
        // (możesz dodać tu logger)
        System.err.println("Unhandled exception: " + ex.getMessage());
        ex.printStackTrace();

        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, "Wewnętrzny błąd serwera.");
        pd.setTitle("Unexpected error");
        pd.setInstance(URI.create(req.getRequestURI()));
        pd.setProperty("code", "unexpected");
        pd.setProperty("reason", ex.getMessage());
        return pd;
    }
}