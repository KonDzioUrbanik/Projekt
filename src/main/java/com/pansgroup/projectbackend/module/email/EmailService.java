package com.pansgroup.projectbackend.module.email; // Przykładowa ścieżka

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
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
            MimeMessage mimeMessage = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "utf-8");

            helper.setFrom(senderEmail);
            helper.setTo(toEmail);
            helper.setSubject("Potwierdzenie rejestracji w PANS portal");

            String confirmationUrl = "https://konradcode.pl/confirm?token=" + token;

            String htmlContent = buildConfirmationEmailHtml(confirmationUrl);
            helper.setText(htmlContent, true);

            javaMailSender.send(mimeMessage);

        } catch (MessagingException | MailException e) {
            System.err.println("Błąd podczas wysyłania e-maila: " + e.getMessage());
        }
    }

    public void sendPasswordResetEmail(String toEmail, String token) {
        try {
            MimeMessage mimeMessage = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "utf-8");

            helper.setFrom(senderEmail);
            helper.setTo(toEmail);
            helper.setSubject("Reset Hasła w PANS portal");

            String resetUrl = "https://konradcode.pl/reset-password?token=" + token;

            String htmlContent = buildPasswordResetEmailHtml(resetUrl);
            helper.setText(htmlContent, true);

            javaMailSender.send(mimeMessage);

        } catch (MessagingException | MailException e) {
            System.err.println("Błąd podczas wysyłania e-maila: " + e.getMessage());
        }
    }

    private String buildConfirmationEmailHtml(String confirmationUrl) {
        return "<!DOCTYPE html>" +
                "<html lang='pl'>" +
                "<head>" +
                "    <meta charset='UTF-8'>" +
                "    <meta name='viewport' content='width=device-width, initial-scale=1.0'>" +
                "    <title>Potwierdzenie rejestracji</title>" +
                "</head>" +
                "<body style='margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif; background-color: #f5f5f5;'>"
                +
                "    <table role='presentation' style='width: 100%; border-collapse: collapse; padding: 40px 20px;'>" +
                "        <tr>" +
                "            <td style='padding: 0;'>" +
                "                <table role='presentation' style='max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px;'>"
                +
                "                    <!-- Header -->" +
                "                    <tr>" +
                "                        <td style='padding: 32px 32px 24px; border-bottom: 1px solid #e0e0e0;'>" +
                "                            <h1 style='margin: 0; color: #1a1a1a; font-size: 20px; font-weight: 600;'>PANS Portal</h1>"
                +
                "                            <p style='margin: 4px 0 0 0; color: #666666; font-size: 13px;'>Platforma studencka</p>"
                +
                "                        </td>" +
                "                    </tr>" +
                "                    <!-- Content -->" +
                "                    <tr>" +
                "                        <td style='padding: 40px 32px;'>" +
                "                            <h2 style='margin: 0 0 16px 0; color: #1a1a1a; font-size: 22px; font-weight: 600;'>Witaj!</h2>"
                +
                "                            <p style='margin: 0 0 24px 0; color: #333333; font-size: 15px; line-height: 1.6;'>"
                +
                "                                Dziękujemy za rejestrację w PANS Portal. Aby aktywować swoje konto, potwierdź swój adres e-mail klikając poniższy przycisk."
                +
                "                            </p>" +
                "                            <!-- Button -->" +
                "                            <table role='presentation' style='margin: 0 0 24px 0;'>" +
                "                                <tr>" +
                "                                    <td>" +
                "                                        <a href='" + confirmationUrl
                + "' style='display: inline-block; padding: 12px 32px; background-color: #4a9eff; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 15px;'>Potwierdź adres e-mail</a>"
                +
                "                                    </td>" +
                "                                </tr>" +
                "                            </table>" +
                "                            <p style='margin: 0 0 8px 0; color: #666666; font-size: 13px; line-height: 1.5;'>"
                +
                "                                Jeśli przycisk nie działa, skopiuj i wklej poniższy link w przeglądarce:"
                +
                "                            </p>" +
                "                            <p style='margin: 0; padding: 12px; background-color: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 4px; word-break: break-all;'>"
                +
                "                                <a href='" + confirmationUrl
                + "' style='color: #4a9eff; text-decoration: none; font-size: 13px;'>" + confirmationUrl + "</a>" +
                "                            </p>" +
                "                        </td>" +
                "                    </tr>" +
                "                    <!-- Notice -->" +
                "                    <tr>" +
                "                        <td style='padding: 0 32px 32px;'>" +
                "                            <div style='padding: 16px; background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 6px;'>"
                +
                "                                <p style='margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;'>"
                +
                "                                    <strong>Uwaga:</strong> Jeśli to nie Ty rejestrowałeś się w systemie, zignoruj tę wiadomość."
                +
                "                                </p>" +
                "                            </div>" +
                "                        </td>" +
                "                    </tr>" +
                "                    <!-- Footer -->" +
                "                    <tr>" +
                "                        <td style='padding: 24px 32px; border-top: 1px solid #e0e0e0; background-color: #fafafa;'>"
                +
                "                            <p style='margin: 0 0 4px 0; color: #666666; font-size: 13px;'>PANS Portal</p>"
                +
                "                            <p style='margin: 0; color: #999999; font-size: 12px;'>© 2026 Wszystkie prawa zastrzeżone</p>"
                +
                "                        </td>" +
                "                    </tr>" +
                "                </table>" +
                "            </td>" +
                "        </tr>" +
                "    </table>" +
                "</body>" +
                "</html>";
    }

    private String buildPasswordResetEmailHtml(String resetUrl) {
        return "<!DOCTYPE html>" +
                "<html lang='pl'>" +
                "<head>" +
                "    <meta charset='UTF-8'>" +
                "    <meta name='viewport' content='width=device-width, initial-scale=1.0'>" +
                "    <title>Reset hasła</title>" +
                "</head>" +
                "<body style='margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif; background-color: #f5f5f5;'>"
                +
                "    <table role='presentation' style='width: 100%; border-collapse: collapse; padding: 40px 20px;'>" +
                "        <tr>" +
                "            <td style='padding: 0;'>" +
                "                <table role='presentation' style='max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px;'>"
                +
                "                    <!-- Header -->" +
                "                    <tr>" +
                "                        <td style='padding: 32px 32px 24px; border-bottom: 1px solid #e0e0e0;'>" +
                "                            <h1 style='margin: 0; color: #1a1a1a; font-size: 20px; font-weight: 600;'>PANS Portal</h1>"
                +
                "                            <p style='margin: 4px 0 0 0; color: #666666; font-size: 13px;'>Platforma studencka</p>"
                +
                "                        </td>" +
                "                    </tr>" +
                "                    <!-- Content -->" +
                "                    <tr>" +
                "                        <td style='padding: 40px 32px;'>" +
                "                            <h2 style='margin: 0 0 16px 0; color: #1a1a1a; font-size: 22px; font-weight: 600;'>Reset hasła</h2>"
                +
                "                            <p style='margin: 0 0 24px 0; color: #333333; font-size: 15px; line-height: 1.6;'>"
                +
                "                                Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta. Kliknij poniższy przycisk, aby ustawić nowe hasło."
                +
                "                            </p>" +
                "                            <!-- Button -->" +
                "                            <table role='presentation' style='margin: 0 0 24px 0;'>" +
                "                                <tr>" +
                "                                    <td>" +
                "                                        <a href='" + resetUrl
                + "' style='display: inline-block; padding: 12px 32px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 15px;'>Zresetuj hasło</a>"
                +
                "                                    </td>" +
                "                                </tr>" +
                "                            </table>" +
                "                            <p style='margin: 0 0 8px 0; color: #666666; font-size: 13px; line-height: 1.5;'>"
                +
                "                                Jeśli przycisk nie działa, skopiuj i wklej poniższy link w przeglądarce:"
                +
                "                            </p>" +
                "                            <p style='margin: 0; padding: 12px; background-color: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 4px; word-break: break-all;'>"
                +
                "                                <a href='" + resetUrl
                + "' style='color: #dc2626; text-decoration: none; font-size: 13px;'>" + resetUrl + "</a>" +
                "                            </p>" +
                "                        </td>" +
                "                    </tr>" +
                "                    <!-- Security Notice -->" +
                "                    <tr>" +
                "                        <td style='padding: 0 32px 32px;'>" +
                "                            <div style='padding: 16px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px;'>"
                +
                "                                <p style='margin: 0 0 8px 0; color: #991b1b; font-size: 13px; font-weight: 600;'>Bezpieczeństwo</p>"
                +
                "                                <ul style='margin: 0; padding-left: 20px; color: #991b1b; font-size: 13px; line-height: 1.6;'>"
                +
                "                                    <li>Link ważny przez 10 minut</li>" +
                "                                    <li>Jeśli to nie Ty, zignoruj tę wiadomość</li>" +
                "                                    <li>Hasło nie zmieni się bez Twojej akcji</li>" +
                "                                </ul>" +
                "                            </div>" +
                "                        </td>" +
                "                    </tr>" +
                "                    <!-- Footer -->" +
                "                    <tr>" +
                "                        <td style='padding: 24px 32px; border-top: 1px solid #e0e0e0; background-color: #fafafa;'>"
                +
                "                            <p style='margin: 0 0 4px 0; color: #666666; font-size: 13px;'>PANS Portal</p>"
                +
                "                            <p style='margin: 0; color: #999999; font-size: 12px;'>© 2026 Wszystkie prawa zastrzeżone</p>"
                +
                "                        </td>" +
                "                    </tr>" +
                "                </table>" +
                "            </td>" +
                "        </tr>" +
                "    </table>" +
                "</body>" +
                "</html>";
    }

}