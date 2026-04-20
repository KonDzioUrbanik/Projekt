package com.pansgroup.projectbackend.module.system;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.AppenderBase;
import jakarta.annotation.PostConstruct;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Component
public class SystemLogCollector extends AppenderBase<ILoggingEvent> {
    private static final int MAX_LOGS = 50;
    private final List<LogEntry> logs = new CopyOnWriteArrayList<>();

    @PostConstruct
    public void init() {
        LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();
        this.setContext(context);
        this.start();
        
        Logger rootLogger = context.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
        rootLogger.addAppender(this);
    }

    @Override
    protected void append(ILoggingEvent event) {
        // Zbieramy tylko WARN i ERROR dla panelu systemowego
        if (event.getLevel().isGreaterOrEqual(Level.WARN)) {
            if (logs.size() >= MAX_LOGS) {
                logs.remove(0);
            }
            logs.add(new LogEntry(
                event.getTimeStamp(),
                event.getLevel().toString(),
                event.getFormattedMessage()
            ));
        }
    }

    public void clearLogs() {
        logs.clear();
    }

    public List<LogEntry> getRecentLogs() {
        List<LogEntry> result = new ArrayList<>(logs);
        Collections.reverse(result);
        return result;
    }

    public record LogEntry(long timestamp, String level, String message) {}
}
