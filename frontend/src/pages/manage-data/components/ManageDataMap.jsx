import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Col, Row, Spin } from "antd";
import takeRight from "lodash/takeRight";
import { MapView } from "../../../components";
import { api, store, uiText, geo } from "../../../lib";
const { getBounds } = geo;

const ManageDataMap = () => {
  const [loading, setLoading] = useState(true);
  const [dataset, setDataset] = useState([]);
  const [position, setPosition] = useState(null);
  const selectedForm = store.useState((s) => s.selectedForm);
  const [prevForm, setPrevForm] = useState(selectedForm);
  const { active: activeLang } = store.useState((s) => s.language);
  const text = useMemo(() => {
    return uiText[activeLang];
  }, [activeLang]);

  const fetchData = useCallback(
    async (selectedAdm = []) => {
      try {
        const adm = takeRight(selectedAdm, 1)[0];
        const apiURL = adm?.id
          ? `/maps/geolocation/${selectedForm}?administration=${adm.id}`
          : `/maps/geolocation/${selectedForm}`;
        const { data: apiData } = await api.get(apiURL);
        setDataset(apiData);
        const selected = [{ prop: adm?.level_name, value: adm?.name }];
        const pos = getBounds(selected);
        setPosition(pos);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching geolocation data:", error);
        setDataset([]);
        setLoading(false);
      }
    },
    [selectedForm]
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
        if ((selectedForm && selectedForm !== prevForm) || administration) {
          setPrevForm(selectedForm);
          setLoading(true);
          fetchData(administration);
        }
      }
    );
    return () => unsubscribe();
  }, [fetchData, prevForm, selectedForm]);

  return (
    <div className="manage-data-map">
      {loading ? (
        <Row justify="center" align="middle" style={{ minHeight: 400 }}>
          <Col>
            <Spin tip={text.loadingText} spinning />
          </Col>
        </Row>
      ) : (
        <MapView dataset={dataset} loading={loading} position={position} />
      )}
    </div>
  );
};

export default ManageDataMap;
