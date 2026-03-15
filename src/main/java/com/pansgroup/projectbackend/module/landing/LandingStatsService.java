package com.pansgroup.projectbackend.module.landing;

import com.pansgroup.projectbackend.module.student.StudentGroupRepository;
import com.pansgroup.projectbackend.module.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class LandingStatsService {

    private static final Logger log = LoggerFactory.getLogger(LandingStatsService.class);
    private static final String STUDENT_ROLE = "STUDENT";
    private static final String STAROSTA_ROLE = "STAROSTA";

    private final UserRepository userRepository;
    private final StudentGroupRepository studentGroupRepository;

    public LandingStatsService(UserRepository userRepository,
                               StudentGroupRepository studentGroupRepository) {
        this.userRepository = userRepository;
        this.studentGroupRepository = studentGroupRepository;
    }

    public LandingStats getLandingStats() {
        try {
            long activeStudents = userRepository.countByRoleIgnoreCaseAndIsActivatedTrue(STUDENT_ROLE)
                    + userRepository.countByRoleIgnoreCaseAndIsActivatedTrue(STAROSTA_ROLE);
            long activeStudyPrograms = studentGroupRepository.count();

            return new LandingStats(activeStudents, activeStudyPrograms);
        } catch (Exception exception) {
            log.warn("Nie udało się pobrać statystyk landing page. Zwracam wartości zerowe.", exception);
            return new LandingStats(0, 0);
        }
    }
}
