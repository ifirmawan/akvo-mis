import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button, Col, Row, Spin } from "antd";
import { Map } from "akvo-charts";
import takeRight from "lodash/takeRight";
import { api, store, uiText } from "../../../lib";
import { getBounds } from "../../../util";

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

  const mapInstance = useRef(null);

  const disableScrollWheelZoom = useCallback(() => {
    const map = mapInstance.current?.getMap();
    if (map) {
      map.scrollWheelZoom.disable();
    }
  }, []);

  const fitToBounds = useCallback(() => {
    if (mapInstance.current && position?.bbox && !loading) {
      const map = mapInstance.current.getMap();
      if (map) {
        map.fitBounds(position.bbox);
      }
    }
  }, [position, loading]);

  useEffect(() => {
    fitToBounds();
  }, [fitToBounds]);

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
        disableScrollWheelZoom();
      } catch (error) {
        console.error("Error fetching geolocation data:", error);
        setDataset([]);
        setLoading(false);
      }
    },
    [selectedForm, disableScrollWheelZoom]
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
        <Map.Container
          tile={{
            url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            maxZoom: 19,
            attribution: "© OpenStreetMap",
          }}
          config={{
            center: [-17.713371, 179.065033],
            zoom: 8,
            height: "100vh",
            width: "100%",
          }}
          ref={(el) => {
            mapInstance.current = el;
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
          {Map.getGeoJSONList(window?.topojson).map((sd, sx) => (
            <Map.GeoJson
              key={sx}
              data={sd}
              mapData={dataset}
              onClick={({ target }) => {
                mapInstance.current?.getMap()?.fitBounds(target._bounds);
              }}
            />
          ))}
        </Map.Container>
      )}
    </div>
  );
};

export default ManageDataMap;
