import React, { useCallback, useEffect, useRef } from "react";
import { Button, Space } from "antd";
import { Map } from "akvo-charts";
import takeRight from "lodash/takeRight";
import { store, geo } from "../../lib";

import {
  ZoomInOutlined,
  ZoomOutOutlined,
  FullscreenOutlined,
} from "@ant-design/icons";
import "./style.scss";

const MapView = ({ dataset, loading, position }) => {
  const selectedForm = store.useState((s) => s.selectedForm);
  const selectedAdm = store.useState((s) => s.administration);

  const mapInstance = useRef(null);
  const defPos = geo.defaultPos();

  const mapStyle = (feature) => {
    const activeAdm = takeRight(selectedAdm, 1)[0];
    return {
      fillColor:
        feature.properties?.[activeAdm?.level_name] === activeAdm?.name
          ? "#01137C"
          : "#D2EDFF",
      color: "#01137C",
      weight: 2,
      opacity: 0.6,
      fillOpacity: 0.7,
    };
  };

  const disableScrollWheelZoom = useCallback(() => {
    const map = mapInstance.current?.getMap();
    if (map && !loading) {
      map.scrollWheelZoom.disable();
      map.zoomControl.remove();
    }
  }, [loading]);

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

  useEffect(() => {
    disableScrollWheelZoom();
  }, [disableScrollWheelZoom]);

  return (
    <div className="map-container">
      <div className="map-buttons">
        <Space size="small" direction="vertical">
          <Button
            type="secondary"
            icon={<FullscreenOutlined />}
            onClick={() => {
              const maps = mapInstance.current.getMap();
              maps.fitBounds(defPos.bbox);
            }}
          />
          <Button
            type="secondary"
            icon={<ZoomOutOutlined />}
            onClick={() => {
              const currentZoom = mapInstance.current.getMap().getZoom() - 1;
              mapInstance.current.getMap().setZoom(currentZoom);
            }}
          />
          <Button
            // disabled={zoomLevel >= mapMaxZoom}
            type="secondary"
            icon={<ZoomInOutlined />}
            onClick={() => {
              const maps = mapInstance.current.getMap();
              const currentZoom = maps.getZoom() + 1;
              maps.setZoom(currentZoom);
            }}
          />
        </Space>
      </div>
      <Map.Container
        tile={geo.tile}
        config={{
          center: [-17.713371, 179.065033],
          zoom: 8,
          height: 600,
          width: "100%",
        }}
        ref={(el) => {
          mapInstance.current = el;
        }}
      >
        {dataset
          ?.filter((d) => d?.geo)
          ?.map((d, dx) => (
            <Map.Marker
              latlng={d.geo}
              key={dx}
              icon={{
                className: "custom-marker",
                iconSize: [32, 32],
                html: `<span style="background-color:${
                  d?.color || "#64A73B"
                }; border:2px solid #fff;"/>`,
              }}
            >
              <a
                href={`/control-center/data/${selectedForm}/monitoring/${d.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: 0 }}
              >
                {d?.values?.map((v) => v?.value).join(", ") ||
                  d?.value ||
                  d.name}
              </a>
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
            style={mapStyle}
          />
        ))}
      </Map.Container>
    </div>
  );
};

export default MapView;
