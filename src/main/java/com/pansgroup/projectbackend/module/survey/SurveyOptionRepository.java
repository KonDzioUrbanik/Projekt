package com.pansgroup.projectbackend.module.survey;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SurveyOptionRepository extends JpaRepository<SurveyOption, Long> {

    long deleteBySurvey_Id(Long surveyId);
}

