package com.pansgroup.projectbackend.module.email; // Przykładowa ścieżka

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private final JavaMailSender javaMailSender;
    private final String senderEmail;

// W konstruktorze EmailService

    public EmailService(JavaMailSender javaMailSender,
                        @Value("${spring.mail.username}") String senderEmail) {
        this.javaMailSender = javaMailSender;
        this.senderEmail = senderEmail;

        // ----- DODAJ TEN BLOK DO TESTOWANIA -----
        System.out.println("======================================================");
        System.out.println("TESTOWY ODCZYT ZMIENNEJ: " + this.senderEmail);
        System.out.println("======================================================");
        // ----------------------------------------
    }

    // Metoda do wysyłania maila
    public void sendConfirmationEmail(String toEmail, String token) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(senderEmail);
            message.setTo(toEmail);
            message.setSubject("Potwierdzenie rejestracji w PANSportal");

            // WAŻNE: Na razie localhost, docelowo zmień na "https://konradcode.pl"
            String confirmationUrl = "https://konradcode.pl/confirm?token=" + token;

            String text = "Dziękujemy za rejestrację!\n\n"
                    + "Aby aktywować swoje konto, kliknij w poniższy link:\n"
                    + confirmationUrl
                    + "\n\nJeśli to nie Ty się rejestrowałeś, zignoruj tę wiadomość.";
            message.setText(text);

            javaMailSender.send(message);

        } catch (MailException e) {
            // Dobrze jest logować błędy, gdyby serwer OVH odrzucił maila
            System.err.println("Błąd podczas wysyłania e-maila: " + e.getMessage());
        }
    }
}