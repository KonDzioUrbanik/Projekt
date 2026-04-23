package com.pansgroup.projectbackend.module.survey;

import com.pansgroup.projectbackend.module.student.StudentGroup;
import com.pansgroup.projectbackend.module.student.StudentGroupRepository;
import com.pansgroup.projectbackend.module.survey.dto.SurveyCreateDto;
import com.pansgroup.projectbackend.module.survey.dto.SurveyOptionResultDto;
import com.pansgroup.projectbackend.module.survey.dto.SurveyResponseDto;
import com.pansgroup.projectbackend.module.survey.dto.SurveyStatusUpdateDto;
import com.pansgroup.projectbackend.module.survey.dto.SurveyVoteRequestDto;
import com.pansgroup.projectbackend.module.survey.dto.SurveyExtendDto;
import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

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
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak dostepu do tej ankiety.");
        }

        return mapResponses(List.of(survey), currentUser, false).get(0);
    }

    @Override
    @Transactional
    public SurveyResponseDto getSurveyPublicResults(Long surveyId) {
        Survey survey = findSurveyOrThrow(surveyId);
        User currentUser = findCurrentUserOptional();
        return mapResponses(List.of(survey), currentUser, true).get(0);
    }

    @Override
    public SurveyResponseDto createSurvey(SurveyCreateDto dto) {
        User currentUser = requireCurrentUser();
        String role = normalizeRole(currentUser);

        if (!isAdmin(role) && !isStarosta(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak uprawnien do tworzenia ankiet.");
        }

        List<String> cleanedOptions = normalizeOptions(dto.options());
        LocalDateTime endsAt = dto.endsAt();
        validateFutureEndsAt(endsAt, "Data zakonczenia musi byc w przyszlosci.");

        Survey survey = new Survey();
        survey.setTitle(dto.title().trim());
        survey.setDescription(dto.description() == null ? null : dto.description().trim());
        survey.setAuthor(currentUser);
        survey.setActive(true);
        survey.setEndsAt(endsAt);

        if (isAdmin(role)) {
            boolean global = dto.global() == null || dto.global();
            survey.setGlobalScope(global);
            if (!global) {
                Long targetGroupId = dto.targetGroupId();
                if (targetGroupId == null) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Dla ankiety nieglobalnej wybierz grupe docelowa.");
                }
                StudentGroup targetGroup = studentGroupRepository.findById(targetGroupId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nie znaleziono grupy docelowej."));
                survey.setTargetGroup(targetGroup);
            }
        } else {
            StudentGroup ownGroup = currentUser.getStudentGroup();
            if (ownGroup == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Starosta musi miec przypisana grupe, aby tworzyc ankiety.");
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
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak dostepu do tej ankiety.");
        }

        if (!isSurveyOpen(survey)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ta ankieta jest zamknieta.");
        }

        SurveyOption selectedOption = survey.getOptions().stream()
                .filter(option -> Objects.equals(option.getId(), dto.optionId()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Wybrana odpowiedz nie nalezy do ankiety."));

        if (surveyVoteRepository.findBySurvey_IdAndUser_Id(surveyId, currentUser.getId()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Oddales juz glos w tej ankiecie.");
        }

        SurveyVote vote = new SurveyVote();
        vote.setSurvey(survey);
        vote.setUser(currentUser);
        vote.setOption(selectedOption);
        surveyVoteRepository.save(vote);

        return mapResponses(List.of(survey), currentUser, false).get(0);
    }

    @Override
    public SurveyResponseDto updateStatus(Long surveyId, SurveyStatusUpdateDto dto) {
        User currentUser = requireCurrentUser();
        Survey survey = findSurveyOrThrow(surveyId);

        if (!canManageSurvey(currentUser, survey)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak uprawnien do zarzadzania ta ankieta.");
        }

        // Wygasla ankieta jest juz zamknieta czasowo - zamiast "zamknij" oferujemy przedluzenie.
        if (isExpired(survey) && Boolean.FALSE.equals(dto.active())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Ankieta jest juz wygasla czasowo. Mozesz ja przedluzyc.");
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
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak uprawnien do zarzadzania ta ankieta.");
        }

        LocalDateTime newEndsAt = dto.endsAt();
        validateFutureEndsAt(newEndsAt, "Nowa data zakonczenia musi byc w przyszlosci.");

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
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak uprawnien do usuniecia tej ankiety.");
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

        Map<Long, Long> selectedOptionBySurvey = new HashMap<>();
        if (currentUser != null) {
            for (Object[] row : surveyVoteRepository.findUserVotesForSurveys(currentUser.getId(), surveyIds)) {
                selectedOptionBySurvey.put((Long) row[0], (Long) row[1]);
            }
        }

        List<SurveyResponseDto> result = new ArrayList<>();
        for (Survey survey : surveys) {
            long totalVotes = totalBySurvey.getOrDefault(survey.getId(), 0L);
            Long selectedOptionId = selectedOptionBySurvey.get(survey.getId());
            boolean hasVoted = selectedOptionId != null;
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
                                Objects.equals(option.getId(), selectedOptionId));
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
                    selectedOptionId,
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ankieta musi miec co najmniej 2 odpowiedzi.");
        }
        if (cleaned.size() > 12) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ankieta moze miec maksymalnie 12 odpowiedzi.");
        }

        Set<String> unique = new HashSet<>();
        for (String option : cleaned) {
            String key = option.toLowerCase();
            if (!unique.add(key)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Odpowiedzi w ankiecie musza byc unikalne.");
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
}









