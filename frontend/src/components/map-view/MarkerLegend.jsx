import React, { useState } from "react";
import { Space } from "antd";

const MarkerLegend = ({ title = "", options = [], onClick = () => {} }) => {
  const [activeOption, setActiveOption] = useState(null);

  const handleOnClick = (option) => {
    setActiveOption(option);
    onClick(option);
  };

  return (
    <div className="marker-legend">
      <h4>{title}</h4>
      <Space
        direction="horizontal"
        align="center"
        wrap={true}
        size={[16, 0]}
        style={{ justifyContent: "center" }}
      >
        {options.map((sO, sI) => (
          <div
            key={sI}
            className="legend-item"
            onClick={() => handleOnClick(sO)}
          >
            <Space direction="horizontal" align="top">
              <div
                className="circle-legend"
                style={{ backgroundColor: sO?.color }}
              />
              <span
                style={{
                  fontWeight: activeOption?.id === sO.id ? "600" : "400",
                }}
              >
                {sO?.label}
              </span>
            </Space>
          </div>
        ))}
      </Space>
    </div>
  );
};

export default MarkerLegend;
