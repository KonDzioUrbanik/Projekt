package com.pansgroup.projectbackend.module.survey;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SurveyVoteRepository extends JpaRepository<SurveyVote, Long> {

    List<SurveyVote> findBySurvey_IdAndUser_Id(Long surveyId, Long userId);

    long deleteBySurvey_Id(Long surveyId);

    @Query("""
            select v.survey.id, count(distinct v.user.id)
            from SurveyVote v
            where v.survey.id in :surveyIds
            group by v.survey.id
            """)
    List<Object[]> countVotesBySurveyIds(@Param("surveyIds") List<Long> surveyIds);

    @Query("""
            select v.option.id, count(v)
            from SurveyVote v
            where v.survey.id in :surveyIds
            group by v.option.id
            """)
    List<Object[]> countVotesByOptionIds(@Param("surveyIds") List<Long> surveyIds);

    @Query("""
            select v.survey.id, v.option.id
            from SurveyVote v
            where v.user.id = :userId and v.survey.id in :surveyIds
            """)
    List<Object[]> findUserVotesForSurveys(@Param("userId") Long userId, @Param("surveyIds") List<Long> surveyIds);
}

