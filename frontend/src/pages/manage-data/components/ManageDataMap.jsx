import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Map } from "akvo-charts";
import * as topojson from "topojson-client";
import { api, store, uiText } from "../../../lib";
import { Button, Col, Row, Spin } from "antd";

const getGeoJSONList = (d) => {
  if (!d) {
    return [];
  }
  if (d?.type === "Topology") {
    /**
     * Convert TopoJSON to GeoJSON
     */
    return Object.keys(d.objects).map((kd) =>
      topojson.feature(d, d.objects[kd])
    );
  }
  return [d];
};

const ManageDataMap = () => {
  const [loading, setLoading] = useState(true);
  const [dataset, setDataset] = useState([]);
  const selectedForm = store.useState((s) => s.selectedForm);
  const { active: activeLang } = store.useState((s) => s.language);
  const text = useMemo(() => {
    return uiText[activeLang];
  }, [activeLang]);

  const fetchData = useCallback(async () => {
    try {
      const { data: apiData } = await api.get(
        `/maps/geolocation/${selectedForm}`
      );
      setDataset(apiData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching geolocation data:", error);
      setDataset([]);
      setLoading(false);
    }
  }, [selectedForm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // listen selectForm changes to refetch data
  useEffect(() => {
    const unsubscribe = store.subscribe(
      (state) => state.selectedForm,
      (newForm) => {
        if (newForm) {
          setLoading(true);
          fetchData();
        }
      }
    );
    return () => unsubscribe();
  }, [fetchData]);

  return (
    <div className="manage-data-map">
      {loading ? (
        <Row justify="center" align="middle" style={{ minHeight: 400 }}>
          <Col>
            <Spin tip={text.loadingText} spinning />
          </Col>
        </Row>
      ) : (
        <Map.Container
          tile={{
            url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            maxZoom: 19,
            attribution: "© OpenStreetMap",
          }}
          config={{
            center: [-17.713371, 178.065033],
            zoom: 8,
            height: "100vh",
            width: "100%",
          }}
        >
          {dataset
            ?.filter((d) => d?.point)
            ?.map((d, dx) => (
              <Map.Marker
                latlng={d?.point}
                key={dx}
                icon={{
                  className: "custom-marker",
                  iconSize: [32, 32],
                  html: `<span style="background-color:#febc11; border:2px solid #fff;"/>`,
                }}
              >
                <Button
                  type="link"
                  href={`/control-center/data/${selectedForm}/monitoring/${d.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ padding: 0 }}
                >
                  {d.label}
                </Button>
              </Map.Marker>
            ))}
          {getGeoJSONList(window?.topojson).map((sd, sx) => (
            <Map.GeoJson key={sx} data={sd} mapData={dataset} />
          ))}
        </Map.Container>
      )}
    </div>
  );
};

export default ManageDataMap;
