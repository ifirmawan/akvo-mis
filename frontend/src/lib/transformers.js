import moment from "moment";
import { QUESTION_TYPES } from "./constants";

export const transformRawData = (questionGroups = [], answers = []) => {
  const data = questionGroups
    .map((qg) => {
      if (qg?.repeatable) {
        const requiredQuestion = qg.question.find((q) => q.required);
        const totalRepeat =
          answers.filter((d) => d.question === requiredQuestion?.id)?.length ||
          1;
        return Array.from({ length: totalRepeat }, (_, i) => ({
          ...qg,
          id: `${qg.id}-${i}`,
          label: `${qg.label} #${i + 1}`,
          question: qg.question.map((q) => {
            const findValue = answers.find(
              (d) => d.question === q.id && d.index === i
            )?.value;
            const findOldValue = answers.find(
              (d) => d.question === q.id && d.index === i
            )?.last_value;
            const historyValue =
              answers.find((d) => d.question === q.id && d.index === i)
                ?.history || false;
            return {
              ...q,
              value: findValue || findValue === 0 ? findValue : null,
              lastValue:
                findOldValue || findOldValue === 0 ? findOldValue : null,
              history: historyValue,
            };
          }),
        }));
      }
      return [
        {
          ...qg,
          question: qg.question.map((q) => {
            const findValue = answers.find((d) => d.question === q.id)?.value;
            const findOldValue = answers.find(
              (d) => d.question === q.id
            )?.last_value;
            const historyValue =
              answers.find((d) => d.question === q.id)?.history || false;
            return {
              ...q,
              value: findValue || findValue === 0 ? findValue : null,
              lastValue:
                findOldValue || findOldValue === 0 ? findOldValue : null,
              history: historyValue,
            };
          }),
        },
      ];
    })
    .flat();
  return data;
};

export const transformValue = (question, value, forApi = false, index = 0) => {
  // Type can be either a string or an object with type property
  const type = typeof question === "string" ? question : question?.type;
  let transformedValue = value;

  // Handle option type values
  if (type === QUESTION_TYPES.option) {
    if (forApi) {
      // For API submission - always return as array
      transformedValue = Array.isArray(value) ? value : [value];
    } else {
      // For UI display - extract first value from array if it exists
      transformedValue =
        Array.isArray(value) && value.length ? value[0] : value;
    }
  }

  // Handle geo type values
  if (type === QUESTION_TYPES.geo) {
    if (forApi && typeof value === "object") {
      // For API submission - convert {lat, lng} to array
      transformedValue = [value.lat, value.lng];
    }
    if (!forApi && Array.isArray(value) && value.length === 2) {
      // For UI display - convert array to {lat, lng} object
      const [lat, lng] = value;
      transformedValue = { lat, lng };
    }
  }

  // Handle cascade type values
  if (
    type === QUESTION_TYPES.cascade &&
    !forApi &&
    typeof question === "object" &&
    !question.extra &&
    Array.isArray(value)
  ) {
    // For UI display - take last cascaded value
    transformedValue = value.slice(-1)[0];
  }

  if (type === QUESTION_TYPES.cascade && forApi && Array.isArray(value)) {
    // For API submission - take last value from array
    transformedValue = value.slice(-1)[0];
  }

  // Handle date type values
  if (type === QUESTION_TYPES.date && typeof value === "string" && !forApi) {
    // For UI display - convert string to moment object
    transformedValue = moment(value);
  }

  // Default case - handle undefined values
  if (typeof transformedValue === "undefined" && !forApi) {
    transformedValue = "";
  }

  // For API submission, return an object with metadata
  if (forApi && typeof question === "object") {
    return {
      question: question.id,
      type:
        question?.source?.file === "administrator.sqlite"
          ? QUESTION_TYPES.administration
          : question.type,
      value: transformedValue,
      meta: question.meta,
      index: index, // Include index for repeatable questions
    };
  }

  // For UI display or when question is just a type string, return only the transformed value
  return transformedValue;
};

/**
 * Process repeatable question groups by creating instances based on response data
 */
export const processRepeatableGroup = (
  qg,
  responseData,
  validateDependency,
  QUESTION_TYPES
) => {
  const transformedGroups = [];

  // Find how many instances of each question exist
  const questionOccurrences = {};
  qg.question.forEach((q) => {
    const responses = responseData.filter((r) => r.question === q.id);
    questionOccurrences[q.id] = responses.length;
  });

  // Find the maximum count of responses for any question in this group
  const maxCount = Math.max(...Object.values(questionOccurrences), 0);

  // Create copies of the question group for each response instance
  for (let i = 0; i < maxCount; i++) {
    const questionGroupCopy = {
      ...qg,
      label: `${qg.label} #${i + 1}`,
    };

    questionGroupCopy.question = qg.question
      .filter((q) => {
        if (q?.dependency) {
          const isValid = q.dependency.some((d) => {
            const value = responseData.filter((r) => r.question === d.id)?.[i]
              ?.value;
            return validateDependency(d, value);
          });
          return isValid;
        }
        return q;
      })
      .map((q) => {
        // Get all responses for this question
        const responses = responseData.filter((r) => r.question === q.id);

        // Get the response for the current instance (i) or fallback
        let response = responses?.find((r) => r?.index === i);
        if (q?.dependency) {
          response = responses?.[i] ||
            responses?.[0] || {
              value: null,
              history: false,
            };
        }
        if (q?.type === QUESTION_TYPES.attachment) {
          response = responses.find((r) => r.value?.includes(`${q.id}-${i}`));
        }

        return {
          ...q,
          id: i > 0 ? `${q.id}-${i}` : q.id, // Add suffix for duplicate questions
          value: response?.value,
          history: response?.history || false,
          ...(typeof response?.last_value !== "undefined" && {
            lastValue: response.last_value,
          }),
        };
      });

    transformedGroups.push(questionGroupCopy);
  }

  return transformedGroups;
};

/**
 * Process non-repeatable question groups
 */
export const processNonRepeatableGroup = (qg, responseData) => {
  return {
    ...qg,
    question: qg.question.flatMap((q) =>
      responseData
        .filter((r) => r.question === q.id)
        .map((d, dx) => ({
          ...q,
          id: dx ? `${q.id}-${dx}` : q.id,
          value: d?.value,
          history: d?.history || false,
          ...(typeof d?.last_value !== "undefined" && {
            lastValue: d.last_value,
          }),
        }))
    ),
  };
};

/**
 * Transform API response data into the format expected by detail components
 */
export const transformDetailData = (
  responseData,
  questionGroups,
  validateDependency,
  QUESTION_TYPES
) => {
  const transformedData = [];

  questionGroups?.forEach((qg) => {
    if (qg?.repeatable) {
      // Process repeatable groups
      const repeatableGroups = processRepeatableGroup(
        qg,
        responseData,
        validateDependency,
        QUESTION_TYPES
      );
      transformedData.push(...repeatableGroups);
    } else {
      // Process non-repeatable groups
      const nonRepeatableGroup = processNonRepeatableGroup(qg, responseData);
      transformedData.push(nonRepeatableGroup);
    }
  });

  return transformedData;
};
