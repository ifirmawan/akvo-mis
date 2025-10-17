/* eslint-disable react/jsx-props-no-spreading */
import React, { useRef, useState, useMemo } from 'react';
import { View } from 'react-native';
import { KeyboardAwareFlatList } from 'react-native-keyboard-aware-scroll-view';

import QuestionField from './QuestionField';
import { FieldGroupHeader, RepeatSection } from '../support';
import { FormState } from '../../store';
import styles from '../styles';

const QuestionGroup = ({ index, group, activeQuestions, dependantQuestions = [] }) => {
  const values = FormState.useState((s) => s.currentValues);
  const listRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);

  // Prepare data for FlatList - works for both repeatable and non-repeatable groups
  const flatListData = useMemo(() => {
    if (group?.repeatable && group.sections) {
      // For repeatable groups, transform sections into a flat array with section headers
      return group.sections.flatMap((section, sectionIndex) => {
        // Add a header item for repeat sections after the first one
        const sectionItems = [];
        if (section.repeatIndex > 0) {
          sectionItems.push({
            type: 'header',
            repeatIndex: section.repeatIndex,
            id: `header-${section.repeatIndex}`,
          });
        }

        // Add the questions for this section
        return [
          ...sectionItems,
          ...section.data.map((item) => ({
            ...item,
            sectionIndex,
            sectionData: section.data,
          })),
        ];
      });
    }

    // For non-repeatable groups, just use the filtered questions
    // Filter out null/undefined before accessing properties
    return (
      activeQuestions?.filter(
        (q) => q && (q.group_id === group?.id || q.group_name === group?.name),
      ) || []
    );
  }, [group, activeQuestions]);

  // Handle onChange for all questions
  const handleOnChange = (id, value) => {
    // Handle dependencies with dependantQuestions
    FormState.update((s) => {
      s.currentValues = { ...s.currentValues, [id]: value };
    });
  };

  const handleContentSizeChange = (width, height) => {
    setContentHeight(height);
  };

  // Render item for FlatList - handles both question items and section headers
  const renderItem = ({ item }, isRepeatable = false) => {
    if (item.type === 'header') {
      return <RepeatSection group={group} repeatIndex={item.repeatIndex} />;
    }

    // For question items
    const fieldValue = values?.[item.id];
    const groupQuestions = isRepeatable ? item.sectionData : activeQuestions;
    return (
      <View key={`question-${item.id}`} style={styles.questionContainer}>
        <QuestionField
          keyform={item.id}
          field={item}
          onChange={handleOnChange}
          value={fieldValue}
          questions={groupQuestions}
        />
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <FieldGroupHeader index={index} {...group} />
      <View style={{ flex: 1, height: contentHeight || 'auto' }}>
        <KeyboardAwareFlatList
          ref={listRef}
          data={flatListData}
          keyExtractor={(item) => `${item?.type || 'question'}-${item?.id || Math.random()}`}
          onContentSizeChange={handleContentSizeChange}
          contentContainerStyle={{ paddingBottom: group?.repeatable ? 124 : 48 }}
          renderItem={(itemProps) => renderItem(itemProps, group?.repeatable)}
          extraData={[group, values, activeQuestions, dependantQuestions]}
          removeClippedSubviews={false}
          enableOnAndroid
          enableAutomaticScroll
          keyboardShouldPersistTaps="handled"
          keyboardOpeningTime={0}
          extraHeight={124}
          extraScrollHeight={180}
        />
      </View>
    </View>
  );
};

export default QuestionGroup;
