package com.pansgroup.projectbackend.service;

import org.apache.tika.Tika;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;

@Service
public class FileStorageService {

    private static final Map<String, String> ALLOWED_MIME_TYPES = Map.of(
            "jpg",  "image/jpeg",
            "jpeg", "image/jpeg",
            "png",  "image/png",
            "pdf",  "application/pdf",
            "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    private final Path fileStorageLocation;
    private final Tika tika = new Tika();

    public FileStorageService(@Value("${app.upload.dir:uploads/announcements}") String uploadDir) {
        this.fileStorageLocation = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.fileStorageLocation);
        } catch (Exception ex) {
            throw new RuntimeException("Nie można utworzyć katalogu przechowywania plików: " + uploadDir, ex);
        }
    }

    /**
     * Przechowuje plik po weryfikacji rozszerzenia i zawartości (MIME via Tika).
     * Zwraca UUID-based nazwę pliku do przechowywania w bazie.
     */
    public String storeFile(MultipartFile file) {
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nazwa pliku nie może być pusta.");
        }
        String originalFileName = StringUtils.cleanPath(originalFilename);

        if (originalFileName.contains("..") || originalFileName.contains("/") || originalFileName.contains("\\")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Nazwa pliku zawiera niedozwolone znaki: " + originalFileName);
        }

        String extension = StringUtils.getFilenameExtension(originalFileName);
        if (extension == null || !ALLOWED_MIME_TYPES.containsKey(extension.toLowerCase())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Niedozwolony format pliku. Dozwolone: " + String.join(", ", ALLOWED_MIME_TYPES.keySet()));
        }

        try {
            byte[] fileBytes = file.getBytes();

            // Weryfikacja rzeczywistej zawartości pliku (ochrona przed podmienionym rozszerzeniem)
            String detectedMime = tika.detect(fileBytes);
            if (detectedMime.contains(";")) {
                detectedMime = detectedMime.split(";")[0].trim();
            }

            String expectedMime = ALLOWED_MIME_TYPES.get(extension.toLowerCase());
            boolean mimeMatch = detectedMime.equalsIgnoreCase(expectedMime)
                    // Tika może zwracać OPC/OOXML wrapper dla DOCX
                    || ("docx".equalsIgnoreCase(extension) && detectedMime.contains("openxmlformats"))
                    || ("docx".equalsIgnoreCase(extension) && detectedMime.equals("application/x-tika-ooxml"))
                    || ("docx".equalsIgnoreCase(extension) && detectedMime.equals("application/zip"));

            if (!mimeMatch) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Zawartość pliku (" + detectedMime + ") nie odpowiada deklarowanemu rozszerzeniu ." + extension + ".");
            }

            String storedFileName = UUID.randomUUID() + "." + extension.toLowerCase();
            Path targetLocation = this.fileStorageLocation.resolve(storedFileName);
            Files.write(targetLocation, fileBytes);

            return storedFileName;

        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Nie można zapisać pliku. Spróbuj ponownie.", ex);
        }
    }

    /**
     * Ładuje plik jako Resource do przesłania klientowi.
     * Zabezpieczone przed path traversal – plik musi znajdować się w katalogu uploads.
     */
    public Resource loadFileAsResource(String storedFileName) {
        try {
            // Blokada path traversal
            Path filePath = this.fileStorageLocation.resolve(storedFileName).normalize();
            if (!filePath.startsWith(this.fileStorageLocation)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Dostęp do pliku zabroniony.");
            }

            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists() && resource.isReadable()) {
                return resource;
            } else {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Plik nie znaleziony: " + storedFileName);
            }
        } catch (MalformedURLException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Błąd ładowania pliku.", ex);
        }
    }

    /**
     * Usuwa plik z systemu plików (np. przy usuwaniu ogłoszenia).
     */
    public void deleteFile(String storedFileName) {
        try {
            Path filePath = this.fileStorageLocation.resolve(storedFileName).normalize();
            if (filePath.startsWith(this.fileStorageLocation)) {
                Files.deleteIfExists(filePath);
            }
        } catch (IOException ex) {
            // Logujemy ale nie przerywamy – usunięcie metadanych z DB jest ważniejsze
            System.err.println("Ostrzeżenie: nie można usunąć pliku " + storedFileName + ": " + ex.getMessage());
        }
    }
}
