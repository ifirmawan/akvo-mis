import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Col, Row, Spin, Select, Space } from "antd";
import { groupBy, sumBy, chain, takeRight } from "lodash";
import { scaleQuantize } from "d3-scale";
import { MapView } from "../../../components";
import { api, store, uiText, geo, QUESTION_TYPES, config } from "../../../lib";
import { color } from "../../../util";
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
  const [isNumeric, setIsNumeric] = useState(false);

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

  const shapeColors = chain(groupBy(dataset, "administration_id"))
    .map((l, lI) => {
      const values = sumBy(l, "administration_id");
      return { name: lI, values };
    })
    .value();

  const domain = shapeColors
    .reduce(
      (acc, curr) => {
        const v = curr.values;
        const [min, max] = acc;
        return [min, v > max ? v : max];
      },
      [0, 0]
    )
    .map((acc, index) => {
      if (index && acc) {
        acc = acc < 10 ? 10 : acc;
        acc = 100 * Math.floor((acc + 50) / 100);
      }
      return acc;
    });

  const colorScale = scaleQuantize()
    .domain(domain)
    .range(config.mapConfig.colorRange);

  const fetchStats = async (questionId, questionType) => {
    try {
      const apiURL = `/visualization/formdata-stats/${mapForm}?question_id=${questionId}`;
      const { data: apiData } = await api.get(apiURL);
      if (apiData?.data?.length === 0) {
        // Hide all markers if no data is available
        const _dataset = dataset.map((d) => ({
          ...d,
          hidden: true,
        }));
        setDataset(_dataset);
        setLoading(true);
        setTimeout(() => {
          setLoading(false);
        }, 500);
        return;
      }
      if (apiData?.options?.length === 0) {
        /**
         * Handle case where no options are available for the question
         * This can happen for questions like number or text where options are not defined
         * In this case, we will just set the dataset with the data from apiData
         * and reset the legend options and title
         */
        setLegendOptions([]);
        const _dataset = dataset.map((d) => {
          const item = apiData?.data?.find((a) => a.id === d.id);
          return {
            ...d,
            ...item,
            hidden: typeof item?.value === "undefined" || item?.value === null,
            color: item?.value <= 0 ? "#FFF" : colorScale(item?.value),
            values: null, // Reset values for numeric questions
          };
        });
        setDataset(_dataset);
        setLoading(true);
        setTimeout(() => {
          setLoading(false);
        }, 500);
      } else {
        // Generate dynamic colors based on the number of options
        const dynamicColors = color.forMarker(apiData?.options?.length);
        const options = apiData?.options?.map((o, ox) => ({
          ...o,
          color: o?.color || dynamicColors[ox],
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
            const dataValues = groupedData?.[d?.id]
              ?.map((item) => {
                const option = options?.find((o) => o?.id === item?.value);
                return {
                  color: option?.color,
                  value: option?.label,
                  hidden:
                    typeof item?.value === "undefined" || item?.value === null,
                };
              })
              ?.filter((v) => !v.hidden);
            return {
              ...d,
              values: dataValues,
              hidden: dataValues.length === 0,
            };
          }
          const optionID = apiData?.data?.find(
            (item) => item?.id === d?.id
          )?.value;
          const option = options?.find((o) => o?.id === optionID);
          return {
            ...d,
            values: null, // Reset values for single option questions
            color: option?.color,
            value: option?.label,
            hidden: typeof optionID === "undefined" || optionID === null,
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
  };

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
    setIsNumeric(q?.type === QUESTION_TYPES.number);
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
        setMapForm(mapForms?.[0]?.id);
        setLoading(false);
      } catch (error) {
        setDataset([]);
        setLoading(false);
      }
    },
    [selectedForm, dataset, mapForms]
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
            onClear={() => {
              onMapFormChange(mapForm);
            }}
            allowClear
          />
        </Space>
      </div>
      <MapView
        dataset={dataset?.filter((d) => !d.hidden)}
        loading={loading}
        position={position}
      />
      {legendOptions.length > 0 && (
        <MapView.MarkerLegend title={legendTitle} options={legendOptions} />
      )}
      {isNumeric && (
        <MapView.ShapeLegend
          title={legendTitle}
          thresholds={colorScale.thresholds()}
        />
      )}
    </div>
  );
};

export default ManageDataMap;
