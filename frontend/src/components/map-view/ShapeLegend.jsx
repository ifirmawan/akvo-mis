import React, { useState } from "react";
import { Row, Col } from "antd";
import { config } from "../../lib";

const ShapeLegend = ({ title = "", thresholds = [] }) => {
  const [shapeFilterColor, setShapeFilterColor] = useState(null);
  const colorRange = config.mapConfig.colorRange;

  const onClick = (index) => {
    if (shapeFilterColor === colorRange[index]) {
      setShapeFilterColor(null);
      return;
    }
    setShapeFilterColor(colorRange[index]);
  };

  thresholds = [...thresholds, thresholds[thresholds.length - 1]];

  return (
    <div className="shape-legend">
      <h4>{title}</h4>
      <Row className="legend-wrap">
        {thresholds.map((t, tI) => (
          <Col
            key={tI}
            flex={1}
            className={`legend-item ${
              shapeFilterColor === colorRange[tI] ? "legend-selected" : ""
            }`}
            onClick={() => onClick(tI)}
            style={{ backgroundColor: colorRange[tI] }}
          >
            {tI === 0 && "0 - "}
            {tI >= thresholds.length - 1 && "> "}
            {tI > 0 &&
              tI < thresholds.length - 1 &&
              `${thresholds[tI - 1] + 1} - `}
            {t}
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default ShapeLegend;
