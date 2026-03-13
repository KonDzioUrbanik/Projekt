package com.pansgroup.projectbackend.exception;

/**
 * Wyjątek rzucany gdy użytkownik próbuje wysłać zbyt wiele requestów w krótkim
 * czasie
 * (rate limiting dla operacji typu forgot-password)
 */
public class TooManyRequestsException extends RuntimeException {
    public TooManyRequestsException(String message) {
        super(message);
    }
}
