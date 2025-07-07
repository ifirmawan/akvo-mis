import React, { useState, useEffect, useMemo, useCallback } from "react";
import "./style.scss";
import {
  Row,
  Col,
  Divider,
  Table,
  ConfigProvider,
  Empty,
  Button,
  Space,
  Select,
} from "antd";
import { useNavigate } from "react-router-dom";
import {
  DownCircleOutlined,
  LeftCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";

import { api, store, uiText } from "../../lib";
import {
  AdministrationDropdown,
  Breadcrumbs,
  DescriptionPanel,
  RemoveFiltersButton,
} from "../../components";
import FormDropdown from "../../components/filters/FormDropdown";
import DraftDetail from "./DraftDetail";

const ManageDraft = () => {
  const [loading, setLoading] = useState(false);
  const [dataset, setDataset] = useState([]);
  const [query, setQuery] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [updateRecord, setUpdateRecord] = useState(true);
  const [activeFilter, setActiveFilter] = useState(null);
  const [childForm, setChildForm] = useState(null);

  const navigate = useNavigate();

  const formIdFromUrl = new URLSearchParams(window.location.search).get(
    "form_id"
  );

  const { language, administration, selectedForm, user } = store.useState(
    (s) => s
  );
  const { active: activeLang } = language;
  const text = useMemo(() => {
    return uiText[activeLang];
  }, [activeLang]);

  const selectedAdministration = useMemo(() => {
    return administration?.[administration.length - 1];
  }, [administration]);

  const isAdministrationLoaded = useMemo(() => {
    return (
      selectedAdministration?.id === user?.administration?.id ||
      administration?.length > 1
    );
  }, [selectedAdministration, administration, user?.administration?.id]);

  const childrenForms = useMemo(() => {
    return window?.forms?.filter((f) => f?.content?.parent === selectedForm);
  }, [selectedForm]);

  const goToAddForm = () => {
    navigate(`/control-center/data/draft/${selectedForm}`, {
      state: { formId: selectedForm },
    });
  };

  const handleChange = (e) => {
    setUpdateRecord(true);
    setCurrentPage(e.current);
  };

  const fetchData = useCallback(() => {
    const formId = formIdFromUrl || selectedForm;
    if (formIdFromUrl) {
      store.update((s) => {
        s.selectedForm = parseInt(formIdFromUrl, 10);
      });
    }
    if (formId && isAdministrationLoaded && updateRecord) {
      setUpdateRecord(false);
      setLoading(true);
      let url = `/draft-submissions/${formId}/?page=${currentPage}`;
      if (selectedAdministration?.id) {
        url += `&administration=${selectedAdministration.id}`;
      }
      api
        .get(url)
        .then((res) => {
          setDataset(res.data.data);
          setTotalCount(res.data.total);
          if (res.data.total < currentPage) {
            setCurrentPage(1);
          }
          setLoading(false);
        })
        .catch(() => {
          setDataset([]);
          setTotalCount(0);
          setLoading(false);
        });
    }
  }, [
    selectedForm,
    selectedAdministration,
    currentPage,
    isAdministrationLoaded,
    updateRecord,
    formIdFromUrl,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (isAdministrationLoaded && activeFilter !== selectedAdministration?.id) {
      setActiveFilter(selectedAdministration.id);
      if (!updateRecord) {
        setCurrentPage(1);
        setUpdateRecord(true);
      }
    }
  }, [
    activeFilter,
    selectedAdministration,
    isAdministrationLoaded,
    updateRecord,
  ]);

  useEffect(() => {
    const unsubscribe = store.subscribe(
      (s) => s.selectedForm,
      () => {
        setUpdateRecord(true);
      }
    );
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div id="manage-draft">
      <div className="description-container">
        <Row justify="space-between">
          <Col>
            <Breadcrumbs
              pagePath={[
                {
                  title: text.controlCenter,
                  link: "/control-center",
                },
                {
                  title: text.manageDraftTitle,
                },
              ]}
            />
            <DescriptionPanel
              description={text.manageDraftText}
              title={text.manageDataTitle}
            />
          </Col>
        </Row>
      </div>

      <div className="table-section">
        <div className="table-wrapper">
          <Space direction="vertical" style={{ width: "100%" }} size="middle">
            <Row>
              <Col flex={1}>
                <Space>
                  <FormDropdown
                    loading={loading}
                    width="100%"
                    style={{ minWidth: 300 }}
                  />
                  <Select
                    value={childForm}
                    onChange={(value) => {
                      setChildForm(value);
                      setQuery("");
                      setUpdateRecord(true);
                      setCurrentPage(1);
                    }}
                    fieldNames={{ label: "name", value: "id" }}
                    options={childrenForms}
                    placeholder={text.selectFormPlaceholder}
                    style={{ width: "100%", minWidth: 300 }}
                    allowClear
                  />
                </Space>
              </Col>
              <Col>
                <Button
                  shape="round"
                  icon={<PlusOutlined />}
                  type="primary"
                  onClick={goToAddForm}
                >
                  {text.addNewButton}
                </Button>
              </Col>
            </Row>
            <Row>
              <Col>
                <Space>
                  <AdministrationDropdown loading={loading} />
                  <RemoveFiltersButton />
                </Space>
              </Col>
            </Row>
          </Space>
          <Divider />
          <div
            style={{ padding: 0, minHeight: "40vh" }}
            bodystyle={{ padding: 0 }}
          >
            <ConfigProvider
              renderEmpty={() => (
                <Empty
                  description={
                    selectedForm ? text.noFormText : text.noFormSelectedText
                  }
                />
              )}
            >
              <Table
                columns={[
                  {
                    title: "Last Updated",
                    dataIndex: "updated",
                    render: (cell, row) => cell || row.created,
                  },
                  {
                    title: "Name",
                    dataIndex: "name",
                    key: "name",
                    filtered: true,
                    filteredValue: query.trim() === "" ? [] : [query],
                    onFilter: (value, filters) =>
                      filters.name.toLowerCase().includes(value.toLowerCase()),
                  },
                  {
                    title: "Region",
                    dataIndex: "administration",
                  },
                  Table.EXPAND_COLUMN,
                ]}
                expandable={{
                  expandedRowRender: (record) => (
                    <DraftDetail record={record} />
                  ),
                  expandIcon: ({ expanded, onExpand, record }) =>
                    expanded ? (
                      <DownCircleOutlined
                        onClick={(e) => onExpand(record, e)}
                        style={{ color: "#1651B6", fontSize: "19px" }}
                      />
                    ) : (
                      <LeftCircleOutlined
                        onClick={(e) => onExpand(record, e)}
                        style={{ color: "#1651B6", fontSize: "19px" }}
                      />
                    ),
                }}
                dataSource={dataset}
                loading={loading}
                onChange={handleChange}
                pagination={{
                  current: currentPage,
                  total: totalCount,
                  pageSize: 10,
                  showSizeChanger: false,
                  showTotal: (total, range) =>
                    `Results: ${range[0]} - ${range[1]} of ${total} data`,
                }}
                rowClassName="row-normal sticky"
                rowKey="id"
                expandRowByClick
              />
            </ConfigProvider>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ManageDraft);
