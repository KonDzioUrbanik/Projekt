package com.pansgroup.projectbackend.module.survey;

import com.pansgroup.projectbackend.module.survey.dto.SurveyCreateDto;
import com.pansgroup.projectbackend.module.survey.dto.SurveyExtendDto;
import com.pansgroup.projectbackend.module.survey.dto.SurveyResponseDto;
import com.pansgroup.projectbackend.module.survey.dto.SurveyStatusUpdateDto;
import com.pansgroup.projectbackend.module.survey.dto.SurveyUpdateDto;
import com.pansgroup.projectbackend.module.survey.dto.SurveyVoteRequestDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/surveys")
public class SurveyController {

    private final SurveyService surveyService;

    public SurveyController(SurveyService surveyService) {
        this.surveyService = surveyService;
    }

    @GetMapping
    public List<SurveyResponseDto> list() {
        return surveyService.listVisibleSurveys();
    }

    @GetMapping("/{surveyId}")
    public SurveyResponseDto get(@PathVariable Long surveyId) {
        return surveyService.getSurveyForCurrentUser(surveyId);
    }

    @GetMapping("/{surveyId}/results")
    public SurveyResponseDto publicResults(@PathVariable Long surveyId) {
        return surveyService.getSurveyPublicResults(surveyId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SurveyResponseDto create(@Valid @RequestBody SurveyCreateDto dto) {
        return surveyService.createSurvey(dto);
    }

    @PostMapping("/{surveyId}/vote")
    public SurveyResponseDto vote(@PathVariable Long surveyId, @Valid @RequestBody SurveyVoteRequestDto dto) {
        return surveyService.vote(surveyId, dto);
    }

    @PutMapping("/{surveyId}")
    public SurveyResponseDto update(@PathVariable Long surveyId, @Valid @RequestBody SurveyUpdateDto dto) {
        return surveyService.updateSurvey(surveyId, dto);
    }

    @PatchMapping("/{surveyId}/status")
    public SurveyResponseDto updateStatus(@PathVariable Long surveyId, @Valid @RequestBody SurveyStatusUpdateDto dto) {
        return surveyService.updateStatus(surveyId, dto);
    }

    @PatchMapping("/{surveyId}/extend")
    public SurveyResponseDto extend(@PathVariable Long surveyId, @Valid @RequestBody SurveyExtendDto dto) {
        return surveyService.extendSurvey(surveyId, dto);
    }

    @DeleteMapping("/{surveyId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long surveyId) {
        surveyService.deleteSurvey(surveyId);
    }
}

