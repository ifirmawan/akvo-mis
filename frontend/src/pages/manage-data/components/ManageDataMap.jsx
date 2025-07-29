import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Col, Row, Spin, Select, Space } from "antd";
import takeRight from "lodash/takeRight";
import { MapView } from "../../../components";
import { api, store, uiText, geo, QUESTION_TYPES, config } from "../../../lib";
import MapMarkerLegend from "./MapMarkerLegend";
const { getBounds } = geo;

const ManageDataMap = () => {
  const [loading, setLoading] = useState(true);
  const [dataset, setDataset] = useState([]);
  const [position, setPosition] = useState(null);
  const selectedForm = store.useState((s) => s.selectedForm);
  const [prevForm, setPrevForm] = useState(selectedForm);
  const [legendOptions, setLegendOptions] = useState([]);
  const [legendTitle, setLegendTitle] = useState(null);
  const [activeQuestion, setActiveQuestion] = useState(null);

  const { active: activeLang } = store.useState((s) => s.language);
  const text = useMemo(() => {
    return uiText[activeLang];
  }, [activeLang]);

  const mapForms = useMemo(() => {
    return window?.forms?.filter((f) => f.content?.parent === selectedForm);
  }, [selectedForm]);
  const [mapForm, setMapForm] = useState(mapForms?.[0]?.id);

  const mapQuestions = useMemo(() => {
    const f = window?.forms?.find((f) => f.id === mapForm);
    return f?.content?.question_group
      ?.map((qg) => ({
        label: qg?.label,
        options: qg?.question
          ?.filter((q) =>
            [
              QUESTION_TYPES.number,
              QUESTION_TYPES.option,
              QUESTION_TYPES.multiple_option,
            ].includes(q?.type)
          )
          ?.map((q) => ({
            label: q?.label,
            value: q?.id,
            type: q?.type,
          })),
      }))
      ?.filter((qg) => qg?.options?.length > 0);
  }, [mapForm]);

  const fetchStats = useCallback(
    async (questionId, questionType) => {
      try {
        const apiURL = `/visualization/formdata-stats/${mapForm}?question_id=${questionId}`;
        const { data: apiData } = await api.get(apiURL);
        if (apiData?.options?.length === 0) {
          /**
           * Handle case where no options are available for the question
           * This can happen for questions like number or text where options are not defined
           * In this case, we will just set the dataset with the data from apiData
           * and reset the legend options and title
           */
          const _dataset = dataset.map((d) => {
            const item = apiData?.data?.find((a) => a.id === d.id);
            return {
              ...d,
              ...item,
            };
          });
          setDataset(_dataset);
          setLoading(true);
          setTimeout(() => {
            setLoading(false);
          }, 500);
        } else {
          /**
           * Handle case where options are available for the question
           * This can happen for questions like option or multiple_option where options are defined
           * In this case, we will set the legend options and dataset with the data from apiData
           * and reset the legend title
           * The options will have a color assigned from the config or default to transparent
           * The dataset will have the values mapped to the options
           * and the color assigned from the options
           * If the question is multiple_option, we will group the data by id
           * and map the values to the options
           * If the question is single option, we will just map the value to the option
           * The color will be assigned from the options
           * or default to transparent if not available.
           */
          const options = apiData?.options?.map((o, ox) => ({
            ...o,
            color:
              o?.color ||
              config.mapConfig.markerColorRange?.[ox] ||
              "transparent",
          }));
          setLegendOptions(options);
          const _dataset = dataset.map((d) => {
            if (questionType === QUESTION_TYPES.multiple_option) {
              const groupedData = apiData?.data?.reduce((acc, item) => {
                item?.id in acc
                  ? acc[item.id].push(item)
                  : (acc[item.id] = [item]);
                return acc;
              }, {});
              return {
                ...d,
                values: groupedData?.[d?.id]?.map((item) => {
                  const option = options?.find((o) => o?.id === item?.value);
                  return {
                    color: option?.color || "transparent",
                    value: option?.label,
                  };
                }),
              };
            }
            const optionID = apiData?.data?.find(
              (item) => item?.id === d?.id
            )?.value;
            const option = options?.find((o) => o?.id === optionID);
            return {
              ...d,
              values: null, // Reset values for single option questions
              color: option?.color || "transparent",
              value: option?.label || d?.value,
            };
          });
          setDataset(_dataset);
          setLoading(true);
          setTimeout(() => {
            setLoading(false);
          }, 500);
        }
      } catch (error) {
        console.error("Error fetching geolocation stats:", error);
      }
    },
    [mapForm, dataset]
  );

  const onMapFormChange = (value) => {
    setMapForm(value);
    setActiveQuestion(null);
    setLegendOptions([]);
    setLegendTitle(null);
    setDataset(
      dataset.map((d) => ({ ...d, color: null, value: null, values: null }))
    );
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 500);
  };

  const onQuestionChange = async (value) => {
    const q = mapQuestions
      ?.flatMap((m) => m?.options)
      ?.find((q) => q?.value === value);
    setLegendTitle(q?.label);
    setActiveQuestion(value);
    await fetchStats(value, q?.type);
  };

  const fetchData = useCallback(
    async (selectedAdm = [], formChanges = false) => {
      try {
        if (selectedAdm?.length === 0 && dataset?.length > 0 && !formChanges) {
          // If no administration is selected, we can skip fetching data
          return;
        }
        const adm = takeRight(selectedAdm, 1)[0];
        const apiURL = adm?.id
          ? `/maps/geolocation/${selectedForm}?administration=${adm.id}`
          : `/maps/geolocation/${selectedForm}`;
        const { data: apiData } = await api.get(apiURL);
        if (dataset?.length > 0 && !formChanges) {
          const _dataset = dataset.map((d) => {
            const item = apiData?.find((a) => a.id === d.id);
            if (item) {
              return {
                ...d,
                hidden: false,
              };
            }
            return {
              ...d,
              hidden: true,
            };
          });
          setDataset(_dataset);
        } else {
          setDataset(
            apiData?.map((d) => ({
              ...d,
              hidden: false,
            }))
          );
        }
        const selected = [{ prop: adm?.level_name, value: adm?.name }];
        const pos = getBounds(selected);
        setPosition(pos);
        setLoading(false);
      } catch (error) {
        setDataset([]);
        setLoading(false);
      }
    },
    [selectedForm, dataset]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // listen selectForm changes to refetch data
  useEffect(() => {
    const unsubscribe = store.subscribe(
      ({ selectedForm, administration }) => ({ selectedForm, administration }),
      ({ selectedForm, administration }) => {
        // Only trigger loading if selectedForm actually changed
        const isFormChanged = selectedForm && selectedForm !== prevForm;
        if (isFormChanged) {
          setDataset([]);
          setMapForm(null);
          setActiveQuestion(null);
          setLegendOptions([]);
          setLegendTitle(null);
        }
        if (isFormChanged || administration) {
          setPrevForm(selectedForm);
          setLoading(true);
          fetchData(administration, isFormChanged);
        }
      }
    );
    return () => unsubscribe();
  }, [fetchData, prevForm, selectedForm]);

  return loading ? (
    <Row justify="center" align="middle" style={{ minHeight: 400 }}>
      <Col>
        <Spin tip={text.loadingText} spinning />
      </Col>
    </Row>
  ) : (
    <div className="manage-data-map">
      <div className="map-filter">
        <Space direction="vertical" size="middle">
          <Select
            className="select-form"
            fieldNames={{ label: "name", value: "id" }}
            options={mapForms}
            placeholder={text.selectMonitoringFormPlaceholder}
            style={{ minWidth: 320 }}
            value={mapForm}
            onChange={onMapFormChange}
          />
          <Select
            className="select-question"
            options={mapQuestions}
            placeholder={text.selectQuestionPlaceholder}
            style={{ minWidth: 320 }}
            value={activeQuestion}
            onChange={onQuestionChange}
          />
        </Space>
      </div>
      <MapView
        dataset={dataset?.filter((d) => !d.hidden)}
        loading={loading}
        position={position}
      />
      <MapMarkerLegend title={legendTitle} options={legendOptions} />
    </div>
  );
};

export default ManageDataMap;
