import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib";
import { Line } from "akvo-charts";
import "./style.scss";

const chartDefaultConfig = {
  horizontal: false,
  title: "",
  xAxisLabel: "",
  yAxisLabel: "",
  legend: {
    show: true,
    icon: null,
    top: null,
    left: null,
    align: "left",
    orient: "horizontal",
    itemGap: 15,
  },
  textStyle: {
    color: null,
    fontStyle: "normal",
    fontWeight: null,
    fontFamily: "Arial",
    fontSize: null,
  },
  itemStyle: {
    color: null,
    borderColor: "#fff",
    borderWidth: 1,
    borderType: null,
    opacity: 0.6,
  },
  color: [],
};

const MonitoringOverview = ({ question, date }) => {
  const [data, setData] = useState([]);
  const { parentId } = useParams();
  const chartConfig = useMemo(() => {
    if (!question) {
      return chartDefaultConfig;
    }
    return {
      ...chartDefaultConfig,
      title: question.name,
      xAxisLabel: date?.name || "Date Submitted",
      yAxisLabel: question.name || "",
    };
  }, [question, date]);

  useEffect(() => {
    if (!parentId || !question) {
      return;
    }
    let url = `/visualization/monitoring-stats?parent_id=${parentId}&question_id=${question.id}`;
    if (date?.id) {
      url += `&question_date=${date.id}`;
    }
    api
      .get(url)
      .then((response) => {
        setData(response.data);
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
      });
  }, [parentId, question, date]);

  return (
    <div
      style={{ width: "100%", height: "100%" }}
      className="monitoring-overview"
    >
      <Line config={chartConfig} data={data} />
    </div>
  );
};
export default MonitoringOverview;
