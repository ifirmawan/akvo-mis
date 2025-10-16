import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Text, Icon } from '@rneui/themed';
import styles from '../styles';

const QuestionGroupListItem = ({
  label,
  active,
  completedQuestionGroup,
  hasErrors,
  visited,
  onPress,
}) => {
  // Determine icon and color based on state
  let iconName = 'circle';
  let iconType = 'font-awesome';
  let bgColor = '#d4d4d4'; // Default gray for not visited

  if (completedQuestionGroup) {
    // Completed - green check
    iconName = 'check-circle';
    iconType = 'font-awesome';
    bgColor = '#28a745'; // Green
  } else if (visited && hasErrors) {
    // Visited but has errors - orange/warning
    iconName = 'alert-circle-outline';
    iconType = 'ionicon';
    bgColor = '#ff9800'; // Orange warning
  } else if (visited) {
    // Visited but not completed (no required fields or all filled)
    iconName = 'circle';
    iconType = 'font-awesome';
    bgColor = '#2884bd'; // Blue
  }

  const activeOpacity = active ? styles.questionGroupListItemActive : {};
  const activeName = active ? styles.questionGroupListItemNameActive : {};

  return (
    <TouchableOpacity
      style={{ ...styles.questionGroupListItemWrapper, ...activeOpacity }}
      testID="question-group-list-item-wrapper"
      onPress={onPress}
    >
      <Icon
        testID="icon-mark"
        name={iconName}
        type={iconType}
        color={bgColor}
        style={styles.questionGroupListItemIcon}
      />
      <Text style={{ ...styles.questionGroupListItemName, ...activeName }}>{label}</Text>
    </TouchableOpacity>
  );
};

export default QuestionGroupListItem;
