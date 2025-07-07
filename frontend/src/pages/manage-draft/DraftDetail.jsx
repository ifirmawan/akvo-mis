import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Table, Button, Space, Spin } from "antd";
import { LoadingOutlined, HistoryOutlined } from "@ant-design/icons";
import {
  api,
  QUESTION_TYPES,
  store,
  uiText,
  transformDetailData,
} from "../../lib";
import { HistoryTable, ReadOnlyCell } from "../../components";
import { validateDependency } from "../../util";

const DraftDetail = ({ record }) => {
  const [dataset, setDataset] = useState([]);
  const [loading, setLoading] = useState(false);

  const { language, forms: allForms } = store.useState((s) => s);
  const { active: activeLang } = language;
  const text = useMemo(() => {
    return uiText[activeLang];
  }, [activeLang]);

  const questionGroups = useMemo(() => {
    const formList = window?.forms || allForms || [];
    return formList?.find((f) => f.id === record?.form)?.content
      ?.question_group;
  }, [record?.form, allForms]);

  const fetchData = useCallback(() => {
    if (!record?.id || dataset.length > 0) {
      return;
    }

    setLoading(true);
    api
      .get(`data/${record.id}`)
      .then((res) => {
        const transformedData = transformDetailData(
          res.data,
          questionGroups,
          validateDependency,
          QUESTION_TYPES
        );
        setDataset(transformedData);
      })
      .catch((e) => {
        console.error(e);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [record?.id, dataset.length, questionGroups]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return loading ? (
    <Space style={{ paddingTop: 18, color: "#9e9e9e" }} size="middle">
      <Spin indicator={<LoadingOutlined style={{ color: "#1b91ff" }} spin />} />
      <span>{text.loadingText}</span>
    </Space>
  ) : (
    <div className="data-detail">
      <div>
        {dataset.map((r, rI) => (
          <div className="pending-data-wrapper" key={rI}>
            <h3>{r.label}</h3>
            <Table
              pagination={false}
              dataSource={r.question}
              rowClassName="expandable-row row-normal"
              rowKey="id"
              columns={[
                {
                  title: text?.questionCol,
                  dataIndex: null,
                  width: "50%",
                  render: (_, row) =>
                    row.short_label ? row.short_label : row.label,
                  className: "table-col-question",
                },
                {
                  title: "Response",
                  width: "50%",
                  render: (row) => <ReadOnlyCell record={row} />,
                },
                Table.EXPAND_COLUMN,
              ]}
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
          </div>
        ))}
      </div>

      <div className="data-detail-actions">
        <Space>
          <Button type="danger" shape="round">
            {text.deleteText}
          </Button>
          <Button type="primary" shape="round">
            {text.editButton}
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default DraftDetail;
