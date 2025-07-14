import React, { useMemo } from "react";
import { HistoryOutlined } from "@ant-design/icons";
import { Table } from "antd";
import { isEqual } from "lodash";
import { Sparklines, SparklinesLine, SparklinesSpots } from "react-sparklines";
import HistoryTable from "./HistoryTable";
import EditableCell from "./EditableCell";
import { store, uiText } from "../lib";

const RawDataTable = ({
  updateCell,
  resetCell,
  dataLoading,
  isEditable,
  resetButton,
  expanded,
  questions = [],
}) => {
  const { language } = store.useState((s) => s);
  const { active: activeLang } = language;
  const text = useMemo(() => {
    return uiText[activeLang];
  }, [activeLang]);

  const defaultCols = [
    {
      title: text?.questionCol,
      dataIndex: null,
      width: "50%",
      render: (_, row) => (row?.short_label ? row.short_label : row.label),
    },
    {
      title: text?.responseCol,
      render: (row) => (
        <EditableCell
          record={row}
          parentId={expanded.id}
          updateCell={updateCell}
          resetCell={resetCell}
          disabled={!!dataLoading}
          readonly={!isEditable}
          resetButton={resetButton}
        />
      ),
      width: "25%",
    },
  ];

  const columns = expanded?.parent
    ? [
        ...defaultCols,
        {
          title: text?.lastResponseCol,
          render: (row) => (
            <EditableCell
              record={row}
              lastValue={true}
              parentId={expanded.id}
              updateCell={updateCell}
              resetCell={resetCell}
              disabled={true}
              readonly={true}
            />
          ),
          width: "25%",
        },
        {
          title: "Overview",
          dataIndex: "overview",
          key: "overview",
          render: (overview) =>
            overview && Array.isArray(overview) ? (
              <Sparklines
                data={overview}
                limit={4}
                width={160}
                height={50}
                margin={4}
              >
                <SparklinesLine color="blue" />
                <SparklinesSpots />
              </Sparklines>
            ) : null,
        },
      ]
    : defaultCols;

  return (
    <Table
      pagination={false}
      dataSource={questions}
      rowClassName={(row) =>
        (row.newValue || row.newValue === 0) &&
        !isEqual(row.newValue, row.value)
          ? "row-edited"
          : "row-normal"
      }
      rowKey="id"
      columns={[...columns, Table.EXPAND_COLUMN]}
      expandable={{
        expandIcon: ({ onExpand, record }) => {
          if (!record?.history) {
            return "";
          }
          return (
            <HistoryOutlined
              className="expand-icon"
              onClick={(e) => onExpand(record, e)}
            />
          );
        },
        expandedRowRender: (record) => <HistoryTable record={record} />,
        rowExpandable: (record) => record?.history,
      }}
    />
  );
};

export default RawDataTable;
