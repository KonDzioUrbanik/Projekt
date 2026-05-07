package com.pansgroup.projectbackend.module.survey;

import com.pansgroup.projectbackend.module.student.StudentGroup;
import com.pansgroup.projectbackend.module.student.StudentGroupRepository;
import com.pansgroup.projectbackend.module.survey.dto.SurveyCreateDto;
import com.pansgroup.projectbackend.module.survey.dto.SurveyOptionResultDto;
import com.pansgroup.projectbackend.module.survey.dto.SurveyResponseDto;
import com.pansgroup.projectbackend.module.survey.dto.SurveyStatusUpdateDto;
import com.pansgroup.projectbackend.module.survey.dto.SurveyVoteRequestDto;
import com.pansgroup.projectbackend.module.survey.dto.SurveyExtendDto;
import com.pansgroup.projectbackend.module.survey.dto.SurveyUpdateDto;
import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.context.event.EventListener;
import com.pansgroup.projectbackend.module.user.event.UserDeletedEvent;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import java.time.LocalDateTime;
import java.util.*;

@Service
@Transactional
public class SurveyServiceImpl implements SurveyService {

    private final SurveyRepository surveyRepository;
    private final SurveyVoteRepository surveyVoteRepository;
    private final SurveyOptionRepository surveyOptionRepository;
    private final StudentGroupRepository studentGroupRepository;
    private final UserRepository userRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public SurveyServiceImpl(SurveyRepository surveyRepository,
                             SurveyVoteRepository surveyVoteRepository,
                             SurveyOptionRepository surveyOptionRepository,
                             StudentGroupRepository studentGroupRepository,
                             UserRepository userRepository) {
        this.surveyRepository = surveyRepository;
        this.surveyVoteRepository = surveyVoteRepository;
        this.surveyOptionRepository = surveyOptionRepository;
        this.studentGroupRepository = studentGroupRepository;
        this.userRepository = userRepository;
    }

    @Override
    @Transactional
    public List<SurveyResponseDto> listVisibleSurveys() {
        User currentUser = requireCurrentUser();
        String role = normalizeRole(currentUser);
        boolean isAdmin = isAdmin(role);
        Long groupId = currentUser.getStudentGroup() != null ? currentUser.getStudentGroup().getId() : -1L;

        List<Survey> surveys = surveyRepository.findVisibleForUser(isAdmin, groupId);
        return mapResponses(surveys, currentUser, false);
    }

    @Override
    @Transactional
    public SurveyResponseDto getSurveyForCurrentUser(Long surveyId) {
        User currentUser = requireCurrentUser();
        Survey survey = findSurveyOrThrow(surveyId);

        if (!canAccessSurvey(currentUser, survey)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak dostępu do tej ankiety.");
        }

        return mapResponses(List.of(survey), currentUser, false).get(0);
    }

    @Override
    @Transactional
    public SurveyResponseDto getSurveyPublicResults(Long surveyId) {
        User currentUser = requireCurrentUser();
        Survey survey = findSurveyOrThrow(surveyId);

        if (!canAccessSurvey(currentUser, survey)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak dostępu do wyników tej ankiety.");
        }

        return mapResponses(List.of(survey), currentUser, true).get(0);
    }

    @Override
    public SurveyResponseDto createSurvey(SurveyCreateDto dto) {
        User currentUser = requireCurrentUser();
        String role = normalizeRole(currentUser);

        if (!isAdmin(role) && !isStarosta(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak uprawnień do tworzenia ankiet.");
        }

        // Limity tworzenia ankiet (nie dotyczą admina)
        if (!isAdmin(role)) {
            long activeSurveyCount = surveyRepository.countOpenByAuthorId(currentUser.getId());
            if (activeSurveyCount >= 5) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Osiągnięto limit 5 aktywnych ankiet. Zamknij lub usuń istniejące ankiety.");
            }

            surveyRepository.findLatestCreatedAtByAuthorId(currentUser.getId())
                    .ifPresent(lastCreated -> {
                        if (lastCreated.plusMinutes(5).isAfter(LocalDateTime.now())) {
                            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                                    "Musisz odczekać 5 minut od utworzenia ostatniej ankiety.");
                        }
                    });
        }

        List<String> cleanedOptions = normalizeOptions(dto.options());
        LocalDateTime endsAt = dto.endsAt();
        validateFutureEndsAt(endsAt, "Data zakończenia musi być w przyszłości.");

        Survey survey = new Survey();
        survey.setTitle(dto.title().trim());
        survey.setDescription(dto.description() == null ? null : dto.description().trim());
        survey.setAuthor(currentUser);
        survey.setActive(true);
        survey.setEndsAt(endsAt);
        survey.setMultipleChoice(Boolean.TRUE.equals(dto.multipleChoice()));

        if (isAdmin(role)) {
            boolean global = dto.global() == null || dto.global();
            survey.setGlobalScope(global);
            if (!global) {
                Long targetGroupId = dto.targetGroupId();
                if (targetGroupId == null) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Dla ankiety nieglobalnej wybierz grupę docelową.");
                }
                StudentGroup targetGroup = studentGroupRepository.findById(targetGroupId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nie znaleziono grupy docelowej."));
                survey.setTargetGroup(targetGroup);
            }
        } else {
            StudentGroup ownGroup = currentUser.getStudentGroup();
            if (ownGroup == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Starosta musi mieć przypisaną grupę, aby tworzyć ankiety.");
            }
            survey.setGlobalScope(false);
            survey.setTargetGroup(ownGroup);
        }

        for (int i = 0; i < cleanedOptions.size(); i++) {
            SurveyOption option = new SurveyOption();
            option.setSurvey(survey);
            option.setText(cleanedOptions.get(i));
            option.setSortOrder(i);
            survey.getOptions().add(option);
        }

        Survey saved = surveyRepository.save(survey);
        return mapResponses(List.of(saved), currentUser, false).get(0);
    }

    @Override
    public SurveyResponseDto vote(Long surveyId, SurveyVoteRequestDto dto) {
        User currentUser = requireCurrentUser();
        Survey survey = findSurveyOrThrow(surveyId);

        if (!canAccessSurvey(currentUser, survey)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak dostępu do tej ankiety.");
        }

        if (!isSurveyOpen(survey)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ta ankieta jest zamknięta.");
        }

        List<Long> requestedOptionIds = dto.optionIds();
        if (requestedOptionIds == null || requestedOptionIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Wybierz przynajmniej jedną odpowiedź.");
        }

        if (!survey.isMultipleChoice() && requestedOptionIds.size() > 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "W tej ankiecie można wybrać tylko jedną odpowiedź.");
        }

        List<SurveyOption> selectedOptions = survey.getOptions().stream()
                .filter(option -> requestedOptionIds.contains(option.getId()))
                .toList();

        if (selectedOptions.size() != requestedOptionIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Wybrane odpowiedzi nie należą do tej ankiety.");
        }

        if (!surveyVoteRepository.findBySurvey_IdAndUser_Id(surveyId, currentUser.getId()).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Oddałeś już głos w tej ankiecie.");
        }

        for (SurveyOption option : selectedOptions) {
            SurveyVote vote = new SurveyVote();
            vote.setSurvey(survey);
            vote.setUser(currentUser);
            vote.setOption(option);
            surveyVoteRepository.save(vote);
        }

        return mapResponses(List.of(survey), currentUser, false).get(0);
    }

    @Override
    public SurveyResponseDto updateSurvey(Long surveyId, SurveyUpdateDto dto) {
        User currentUser = requireCurrentUser();
        Survey survey = findSurveyOrThrow(surveyId);

        if (!canManageSurvey(currentUser, survey)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak uprawnień do zarządzania tą ankietą.");
        }

        survey.setTitle(dto.title().trim());
        survey.setDescription(dto.description() == null ? null : dto.description().trim());

        surveyRepository.save(survey);
        return mapResponses(List.of(survey), currentUser, false).get(0);
    }

    @Override
    public SurveyResponseDto updateStatus(Long surveyId, SurveyStatusUpdateDto dto) {
        User currentUser = requireCurrentUser();
        Survey survey = findSurveyOrThrow(surveyId);

        if (!canManageSurvey(currentUser, survey)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak uprawnień do zarządzania tą ankietą.");
        }

        // Wygasla ankieta jest juz zamknieta czasowo - zamiast "zamknij" oferujemy przedluzenie.
        if (isExpired(survey) && Boolean.FALSE.equals(dto.active())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Ankieta jest już wygasła czasowo. Możesz ją przedłużyć.");
        }

        survey.setActive(Boolean.TRUE.equals(dto.active()));
        surveyRepository.save(survey);
        return mapResponses(List.of(survey), currentUser, false).get(0);
    }

    @Override
    public SurveyResponseDto extendSurvey(Long surveyId, SurveyExtendDto dto) {
        User currentUser = requireCurrentUser();
        Survey survey = findSurveyOrThrow(surveyId);

        if (!canManageSurvey(currentUser, survey)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak uprawnień do zarządzania tą ankietą.");
        }

        LocalDateTime newEndsAt = dto.endsAt();
        validateFutureEndsAt(newEndsAt, "Nowa data zakończenia musi być w przyszłości.");

        survey.setEndsAt(newEndsAt);
        // Po przedluzeniu ankieta znow staje sie aktywna.
        survey.setActive(true);

        surveyRepository.save(survey);
        return mapResponses(List.of(survey), currentUser, false).get(0);
    }

    @Override
    public void deleteSurvey(Long surveyId) {
        User currentUser = requireCurrentUser();
        Survey survey = findSurveyOrThrow(surveyId);

        if (!canManageSurvey(currentUser, survey)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak uprawnień do usunięcia tej ankiety.");
        }

        // Usuwanie sekwencyjne minimalizuje ryzyko naruszenia NOT NULL na option_id w glosach.
        surveyVoteRepository.deleteBySurvey_Id(surveyId);
        surveyOptionRepository.deleteBySurvey_Id(surveyId);
        surveyRepository.deleteById(surveyId);
    }

    private Survey findSurveyOrThrow(Long surveyId) {
        return surveyRepository.findDetailedById(surveyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono ankiety."));
    }

    private List<SurveyResponseDto> mapResponses(List<Survey> surveys, User currentUser, boolean publicView) {
        if (surveys.isEmpty()) {
            return List.of();
        }

        List<Long> surveyIds = surveys.stream().map(Survey::getId).toList();
        Map<Long, Long> totalBySurvey = toCountMap(surveyVoteRepository.countVotesBySurveyIds(surveyIds));
        Map<Long, Long> votesByOption = toCountMap(surveyVoteRepository.countVotesByOptionIds(surveyIds));

        Map<Long, List<Long>> selectedOptionsBySurvey = new HashMap<>();
        if (currentUser != null) {
            for (Object[] row : surveyVoteRepository.findUserVotesForSurveys(currentUser.getId(), surveyIds)) {
                Long sId = (Long) row[0];
                Long oId = (Long) row[1];
                selectedOptionsBySurvey.computeIfAbsent(sId, k -> new ArrayList<>()).add(oId);
            }
        }

        List<SurveyResponseDto> result = new ArrayList<>();
        for (Survey survey : surveys) {
            long totalVotes = totalBySurvey.getOrDefault(survey.getId(), 0L);
            List<Long> selectedOptionIds = selectedOptionsBySurvey.getOrDefault(survey.getId(), List.of());
            boolean hasVoted = !selectedOptionIds.isEmpty();
            boolean expired = isExpired(survey);
            boolean canManage = currentUser != null && canManageSurvey(currentUser, survey);
            boolean canVote = !publicView && currentUser != null && canAccessSurvey(currentUser, survey)
                    && isSurveyOpen(survey) && !hasVoted;

            List<SurveyOptionResultDto> optionDtos = survey.getOptions().stream()
                    .map(option -> {
                        long optionVotes = votesByOption.getOrDefault(option.getId(), 0L);
                        double percentage = totalVotes == 0 ? 0.0 : Math.round((optionVotes * 1000.0) / totalVotes) / 10.0;
                        return new SurveyOptionResultDto(
                                option.getId(),
                                option.getText(),
                                optionVotes,
                                percentage,
                                selectedOptionIds.contains(option.getId()));
                    })
                    .toList();

            result.add(new SurveyResponseDto(
                    survey.getId(),
                    survey.getTitle(),
                    survey.getDescription(),
                    survey.getAuthor().getId(),
                    survey.getAuthor().getFirstName(),
                    survey.getAuthor().getLastName(),
                    survey.getAuthor().getRole(),
                    survey.getTargetGroup() != null ? survey.getTargetGroup().getId() : null,
                    survey.isGlobalScope() ? "Wszystkie grupy" : (survey.getTargetGroup() != null ? survey.getTargetGroup().getName() : "-"),
                    survey.isGlobalScope(),
                    survey.isActive(),
                    expired,
                    survey.getEndsAt(),
                    survey.getCreatedAt(),
                    survey.getUpdatedAt(),
                    totalVotes,
                    hasVoted,
                    selectedOptionIds,
                    survey.isMultipleChoice(),
                    canManage,
                    canVote,
                    optionDtos));
        }

        return result;
    }

    private Map<Long, Long> toCountMap(List<Object[]> rows) {
        Map<Long, Long> result = new HashMap<>();
        for (Object[] row : rows) {
            result.put((Long) row[0], (Long) row[1]);
        }
        return result;
    }

    private boolean canAccessSurvey(User user, Survey survey) {
        if (survey.isGlobalScope()) {
            return true;
        }
        if (isAdmin(normalizeRole(user))) {
            return true;
        }
        return user.getStudentGroup() != null
                && survey.getTargetGroup() != null
                && Objects.equals(user.getStudentGroup().getId(), survey.getTargetGroup().getId());
    }

    private boolean canManageSurvey(User user, Survey survey) {
        return isAdmin(normalizeRole(user)) || Objects.equals(user.getId(), survey.getAuthor().getId());
    }

    private boolean isSurveyOpen(Survey survey) {
        return survey.isActive() && !isExpired(survey);
    }

    private boolean isExpired(Survey survey) {
        return survey.getEndsAt() != null && !survey.getEndsAt().isAfter(LocalDateTime.now());
    }

    private void validateFutureEndsAt(LocalDateTime endsAt, String message) {
        if (endsAt != null && !endsAt.isAfter(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
    }

    private List<String> normalizeOptions(List<String> options) {
        if (options == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Podaj minimum dwie odpowiedzi.");
        }

        List<String> cleaned = options.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .toList();

        if (cleaned.size() < 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ankieta musi mieć co najmniej 2 odpowiedzi.");
        }
        if (cleaned.size() > 12) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ankieta może mieć maksymalnie 12 odpowiedzi.");
        }

        Set<String> unique = new HashSet<>();
        for (String option : cleaned) {
            String key = option.toLowerCase();
            if (!unique.add(key)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Odpowiedzi w ankiecie muszą być unikalne.");
            }
        }
        return cleaned;
    }

    private User requireCurrentUser() {
        User user = findCurrentUserOptional();
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Wymagane logowanie.");
        }
        return user;
    }

    private User findCurrentUserOptional() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getName())) {
            return null;
        }

        String email = authentication.getName();
        return userRepository.findByEmail(email).orElse(null);
    }

    private String normalizeRole(User user) {
        if (user == null || user.getRole() == null) {
            return "";
        }
        return user.getRole().toUpperCase().replace("ROLE_", "");
    }

    private boolean isAdmin(String role) {
        return "ADMIN".equals(role);
    }

    private boolean isStarosta(String role) {
        return "STAROSTA".equals(role);
    }

    @EventListener
    @Transactional
    public void onUserDeleted(UserDeletedEvent event) {
        Long userId = event.getUser().getId();
        
        // 1. Usunięcie oddanych głosów użytkownika
        entityManager.createQuery("DELETE FROM SurveyVote v WHERE v.user.id = :userId")
                .setParameter("userId", userId)
                .executeUpdate();

        // 2. Usunięcie ankiet (i kaskadowo ich opcji/głosów) utworzonych przez użytkownika (np. starostę)
        List<Long> surveyIds = entityManager.createQuery("SELECT s.id FROM Survey s WHERE s.author.id = :userId", Long.class)
                .setParameter("userId", userId)
                .getResultList();

        for (Long id : surveyIds) {
            surveyVoteRepository.deleteBySurvey_Id(id);
            surveyOptionRepository.deleteBySurvey_Id(id);
            surveyRepository.deleteById(id);
        }
    }
}









