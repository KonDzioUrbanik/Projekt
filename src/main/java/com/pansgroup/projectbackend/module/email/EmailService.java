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

    public EmailService(JavaMailSender javaMailSender,
                        @Value("${spring.mail.username}") String senderEmail) {
        this.javaMailSender = javaMailSender;
        this.senderEmail = senderEmail;

    }

    // Metoda do wysyłania maila
    public void sendConfirmationEmail(String toEmail, String token) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(senderEmail);
            message.setTo(toEmail);
            message.setSubject("Potwierdzenie rejestracji w PANS portal");

            String confirmationUrl = "https://konradcode.pl/confirm?token=" + token;

            String text = "Dziękujemy za rejestrację!\n\n"
                    + "Aby aktywować swoje konto, kliknij w poniższy link:\n"
                    + confirmationUrl
                    + "\n\nJeśli to nie Ty się rejestrowałeś, zignoruj tę wiadomość.";
            message.setText(text);

            javaMailSender.send(message);

        } catch (MailException e) {
            System.err.println("Błąd podczas wysyłania e-maila: " + e.getMessage());
        }
    }

    public void sendPasswordResetEmail(String toEmail, String token) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(senderEmail);
            message.setTo(toEmail);
            message.setSubject("Reset Hasła w PANS portal");

            String confirmationUrl = "https://konradcode.pl/reset-password?token=" + token;

            String text = "Chyba ktoś tu zapomniał hasła!\n\n"
                    + "Aby zresetować swoje hasło, kliknij w poniższy link:\n"
                    + confirmationUrl
                    + "\n\nJeśli to nie Ty resetujesz hasło, zignoruj tę wiadomość.";
            message.setText(text);

            javaMailSender.send(message);

        } catch (MailException e) {
            System.err.println("Błąd podczas wysyłania e-maila: " + e.getMessage());
        }
    }

}