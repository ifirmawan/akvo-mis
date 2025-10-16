import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Text, Divider } from '@rneui/themed';
import QuestionGroupListItem from './QuestionGroupListItem';
import { onFilterDependency, generateDataPointName } from '../lib';
import styles from '../styles';
import { FormState } from '../../store';

export const checkCompleteQuestionGroup = (form, values) =>
  form.question_group.map((questionGroup) => {
    const filteredQuestions = questionGroup.question.filter((q) => q.required);
    return (
      filteredQuestions
        .map((question) => {
          if (question?.dependency) {
            // Use onFilterDependency instead of modifyDependency
            if (!onFilterDependency(questionGroup, values, question)) {
              return true; // Skip this question for completion check
            }
          }
          if (values?.[question.id] || values?.[question.id] === 0) {
            return true;
          }
          return false;
        })
        .filter((x) => x).length === filteredQuestions.length
    );
  });

export const checkGroupHasErrors = (form, values) =>
  form.question_group.map((questionGroup) => {
    const requiredQuestions = questionGroup.question.filter((q) => q.required);
    const hasUnanswered = requiredQuestions.some((question) => {
      if (question?.dependency) {
        if (!onFilterDependency(questionGroup, values, question)) {
          return false; // Skip dependent questions that don't match
        }
      }
      // Check if the question is unanswered
      const value = values?.[question.id];
      return !value && value !== 0;
    });
    return hasUnanswered;
  });

const QuestionGroupList = ({
  form,
  activeQuestionGroup,
  setActiveQuestionGroup,
  setShowQuestionGroupList,
}) => {
  const selectedForm = FormState.useState((s) => s.form);
  const currentValues = FormState.useState((s) => s.currentValues);
  const visitedQuestionGroup = FormState.useState((s) => s.visitedQuestionGroup);
  const cascades = FormState.useState((s) => s.cascades);
  const forms = selectedForm?.json ? JSON.parse(selectedForm.json) : {};

  const completedQuestionGroup = useMemo(
    () => checkCompleteQuestionGroup(form, currentValues),
    [form, currentValues],
  );

  const groupHasErrors = useMemo(
    () => checkGroupHasErrors(form, currentValues),
    [form, currentValues],
  );

  const handleOnPress = (questionGroupId) => {
    setActiveQuestionGroup(questionGroupId);
    setShowQuestionGroupList(false);
  };

  const dataPointNameText = generateDataPointName(forms, currentValues, cascades)?.dpName;

  return (
    <View style={styles.questionGroupListContainer}>
      <Text style={styles.questionGroupListFormTitle} testID="form-name">
        {form.name}
      </Text>
      <Divider style={styles.divider} />
      {dataPointNameText && (
        <>
          <Text style={styles.questionGroupListDataPointName} testID="datapoint-name">
            {dataPointNameText}
          </Text>
          <Divider style={styles.divider} />
        </>
      )}
      {form.question_group.map((questionGroup, qx) => (
        <QuestionGroupListItem
          key={questionGroup.id}
          label={questionGroup.label}
          active={activeQuestionGroup === questionGroup.id}
          completedQuestionGroup={
            completedQuestionGroup[qx] && visitedQuestionGroup.includes(questionGroup.id)
          }
          hasErrors={groupHasErrors[qx]}
          visited={visitedQuestionGroup.includes(questionGroup.id)}
          onPress={() => handleOnPress(questionGroup.id)}
        />
      ))}
    </View>
  );
};

export default QuestionGroupList;
