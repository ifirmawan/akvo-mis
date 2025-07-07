import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { Webform } from "akvo-react-form";
import "akvo-react-form/dist/index.css";
import "./style.scss";
import { useParams } from "react-router-dom";
import { Row, Col, Space, Progress } from "antd";
import {
  api,
  QUESTION_TYPES,
  store,
  uiText,
  processFileUploads,
  processEntityCascades,
  processRepeatableQuestions,
  transformValue,
} from "../../lib";
import { pick, isEmpty } from "lodash";
import { PageLoader, Breadcrumbs, DescriptionPanel } from "../../components";
import { useNotification } from "../../util/hooks";
import moment from "moment";

const ManageDraftForm = () => {
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState({});
  const [percentage, setPercentage] = useState(0);
  const [submit, setSubmit] = useState(false);
  const [hiddenQIds, setHiddenQIds] = useState([]);

  const { language, initialValue, user: authUser } = store.useState((s) => s);
  const { active: activeLang } = language;
  const text = useMemo(() => {
    return uiText[activeLang];
  }, [activeLang]);

  const webformRef = useRef();
  const { formId, uuid } = useParams();
  const { notify } = useNotification();

  const submitFormData = async ({ datapoint, ...values }, refreshForm) => {
    // Get non-repeatable questions
    const nonRepeatableQuestions = forms.question_group
      .filter((group) => !group?.repeatable)
      .flatMap((group) => group.question);

    // Get repeatable questions
    const repeatableQuestions = forms.question_group
      .filter((group) => group?.repeatable)
      .flatMap((group) => group.question);

    // Validate required fields
    const questionIds = Object.keys(values).map((id) => parseInt(id, 10));
    const requiredQuestions = nonRepeatableQuestions.filter(
      (q) => questionIds.includes(q?.id) && q.required
    );

    const hasEmptyRequired = requiredQuestions.some((q) => {
      const questionValue = values[q.id];
      const isEmptyValue =
        questionValue === null ||
        typeof questionValue === "undefined" ||
        (typeof questionValue === "string" && questionValue.trim() === "");

      if (isEmptyValue) {
        webformRef.current.setFields([
          {
            name: q.id,
            errors: [text.requiredError.replace("{{field}}", q.label)],
          },
        ]);
        return true;
      }
      return false;
    });

    if (hasEmptyRequired) {
      setSubmit(false);
      return;
    }

    setSubmit(true);

    // Process non-repeatable File Uploads
    values = await processFileUploads(nonRepeatableQuestions, values);
    if (!values) {
      return; // Upload failed, function already showed error
    }
    // Process repeatable File Uploads
    values = await processFileUploads(repeatableQuestions, values);
    if (!values) {
      return; // Upload failed, function already showed error
    }

    // Process entity cascade questions
    values = await processEntityCascades(nonRepeatableQuestions, values);

    // Build answers array for non-repeatable questions
    const answers = Object.entries(values)
      .filter(([key, val]) => {
        // Skip keys that look like repeatable questions (contain a hyphen)
        if (key.includes("-")) {
          return false;
        }

        const questionId = parseInt(key, 10);
        const question = nonRepeatableQuestions?.find(
          (q) => q.id === questionId
        );
        if (!question) {
          return false;
        }

        if (question?.type === QUESTION_TYPES.date) {
          return typeof val !== "undefined" && moment(val).isValid();
        }

        // Skip hidden questions
        if (hiddenQIds.includes(questionId)) {
          return false;
        }

        // Skip empty non-required fields
        if (
          !question?.required &&
          (val === null ||
            typeof val === "undefined" ||
            (typeof val === "string" && val.trim() === ""))
        ) {
          return false;
        }

        return !isNaN(key);
      })
      .map(([key, val]) => {
        const questionId = parseInt(key, 10);
        const question = nonRepeatableQuestions.find(
          (q) => q.id === questionId
        );
        return transformValue(question, val, true);
      });

    // Process repeatable questions and add them to answers
    const repeatableAnswers = processRepeatableQuestions(
      values,
      repeatableQuestions
    );

    // Combine both answer sets
    const allAnswers = [...answers, ...repeatableAnswers];

    // Create datapoint name from meta fields or use default
    const names = allAnswers
      .filter(
        (x) =>
          x.meta &&
          ![
            QUESTION_TYPES.geo,
            QUESTION_TYPES.administration,
            QUESTION_TYPES.cascade,
          ].includes(x.type)
      )
      .map((x) => x.value)
      .flat()
      .join(" - ");

    const geo = allAnswers.find(
      (x) => x.type === QUESTION_TYPES.geo && x.meta
    )?.value;

    const administration = allAnswers.find(
      (x) => x.type === QUESTION_TYPES.administration
    )?.value;

    const datapointName = names.length
      ? datapoint?.name
        ? `${datapoint.name} - ${names}`
        : names
      : `${authUser.administration.name} - ${moment().format("MMM YYYY")}`;

    const dataPayload = {
      administration: administration
        ? Array.isArray(administration)
          ? administration[administration.length - 1]
          : administration
        : authUser.administration.id,
      name: datapointName,
      geo: geo || null,
      ...(uuid && { uuid }),
    };

    const payload = {
      data: dataPayload,
      answer: allAnswers.map((x) => pick(x, ["question", "value", "index"])),
    };

    if (uuid) {
      window?.localStorage?.setItem("submitted", uuid);
    }

    try {
      await api.post(`draft-submissions/${formId}`, payload);
      if (uuid) {
        store.update((s) => {
          s.initialValue = [];
        });
      }
      if (refreshForm) {
        refreshForm();
      }
      setHiddenQIds([]);
    } catch (error) {
      notify({
        type: "error",
        message: text.errorSomething,
      });
    } finally {
      setTimeout(() => setSubmit(false), 2000);
    }
  };

  const onFinishFailed = ({ errorFields }) => {
    if (errorFields.length) {
      notify({
        type: "error",
        message: text.errorMandatoryFields,
      });
    }
  };

  const onChange = ({ progress }) => {
    setPercentage(progress.toFixed(0));
  };

  const fetchForm = useCallback(async () => {
    try {
      const { data: apiData } = await api.get(`/form/web/${formId}`);
      const questionGroups = apiData.question_group.map((qg) => {
        const questions = qg.question
          .map((q) => {
            let qVal = { ...q, required: false };

            if (q?.extra) {
              delete qVal.extra;
              qVal = {
                ...qVal,
                ...q.extra,
              };
              if (q.extra?.allowOther) {
                qVal = {
                  ...qVal,
                  allowOtherText: "Enter any OTHER value",
                };
              }
              if (qVal?.type === "entity") {
                qVal = {
                  ...qVal,
                  type: QUESTION_TYPES.cascade,
                  extra: q?.extra,
                };
              }
            }
            return qVal;
          })
          .filter((x) => !x?.hidden);
        return {
          ...qg,
          question: questions,
          repeatText: qg?.repeat_text,
        };
      });
      setForms({ ...apiData, question_group: questionGroups });
      setLoading(false);
    } catch (error) {
      console.error("Error fetching form:", error);
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    fetchForm();
  }, [fetchForm]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  return (
    <div id="form">
      <div className="description-container">
        <Row justify="center" gutter={[16, 16]}>
          <Col span={24} className="webform">
            <Space>
              <Breadcrumbs
                pagePath={[
                  {
                    title: text.controlCenter,
                    link: "/control-center",
                  },
                  {
                    title: text.manageDraftTitle,
                    link: "/control-center/data/draft",
                  },
                  {
                    title: forms.name,
                  },
                ]}
                description={text.draftFormDescription}
              />
            </Space>
            <DescriptionPanel description={text.draftFormDescription} />
          </Col>
        </Row>
      </div>

      <div className="table-section">
        <div className="table-wrapper">
          {loading || isEmpty(forms) ? (
            <PageLoader message={text.fetchingForm} />
          ) : (
            <Webform
              formRef={webformRef}
              forms={forms}
              onFinish={submitFormData}
              onCompleteFailed={onFinishFailed}
              onChange={onChange}
              submitButtonSetting={{ loading: submit }}
              languagesDropdownSetting={{
                showLanguageDropdown: false,
              }}
              initialValue={initialValue}
            />
          )}
          <Progress className="progress-bar" percent={percentage} />
        </div>
      </div>
    </div>
  );
};

export default ManageDraftForm;
