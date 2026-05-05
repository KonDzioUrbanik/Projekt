package com.pansgroup.projectbackend.module.survey;

import com.pansgroup.projectbackend.module.survey.dto.SurveyCreateDto;
import com.pansgroup.projectbackend.module.survey.dto.SurveyExtendDto;
import com.pansgroup.projectbackend.module.survey.dto.SurveyResponseDto;
import com.pansgroup.projectbackend.module.survey.dto.SurveyStatusUpdateDto;
import com.pansgroup.projectbackend.module.survey.dto.SurveyUpdateDto;
import com.pansgroup.projectbackend.module.survey.dto.SurveyVoteRequestDto;

import java.util.List;

public interface SurveyService {

    List<SurveyResponseDto> listVisibleSurveys();

    SurveyResponseDto getSurveyForCurrentUser(Long surveyId);

    SurveyResponseDto getSurveyPublicResults(Long surveyId);

    SurveyResponseDto createSurvey(SurveyCreateDto dto);

    SurveyResponseDto vote(Long surveyId, SurveyVoteRequestDto dto);

    SurveyResponseDto updateStatus(Long surveyId, SurveyStatusUpdateDto dto);

    SurveyResponseDto updateSurvey(Long surveyId, SurveyUpdateDto dto);

    SurveyResponseDto extendSurvey(Long surveyId, SurveyExtendDto dto);

    void deleteSurvey(Long surveyId);
}
