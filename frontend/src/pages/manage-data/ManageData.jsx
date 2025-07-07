import React, { useState, useEffect, useMemo, useCallback } from "react";
import "./style.scss";
import { Row, Col, Divider, Table, ConfigProvider, Empty } from "antd";
import { useNavigate } from "react-router-dom";
import { isEmpty, union, xor, without } from "lodash";

import { api, store, uiText } from "../../lib";
import { DataFilters, Breadcrumbs, DescriptionPanel } from "../../components";
import { generateAdvanceFilterURL } from "../../util/filter";

const ManageData = () => {
  const [loading, setLoading] = useState(false);
  const [dataset, setDataset] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [updateRecord, setUpdateRecord] = useState(true);
  const [activeFilter, setActiveFilter] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const navigate = useNavigate();

  // Get form_id from URL as default selectedForm
  const formIdFromUrl = new URLSearchParams(window.location.search).get(
    "form_id"
  );

  const { administration, selectedForm, user } = store.useState(
    (state) => state
  );
  const { language, advancedFilters } = store.useState((s) => s);
  const { active: activeLang } = language;
  const text = useMemo(() => {
    return uiText[activeLang];
  }, [activeLang]);

  const pagePath = [
    {
      title: text.controlCenter,
      link: "/control-center",
    },
    {
      title: text.manageDataTitle,
    },
  ];

  const goToMonitoring = (record) => {
    store.update((s) => {
      s.selectedFormData = record;
    });
    navigate(`/control-center/data/${selectedForm}/monitoring/${record.id}`);
  };

  const selectedAdministration = useMemo(() => {
    return administration?.[administration.length - 1];
  }, [administration]);

  const isAdministrationLoaded = useMemo(() => {
    return (
      selectedAdministration?.id === user?.administration?.id ||
      administration?.length > 1
    );
  }, [selectedAdministration, administration, user?.administration?.id]);

  const columns = [
    {
      title: "Last Updated",
      dataIndex: "updated",
      render: (cell, row) => cell || row.created,
      onCell: (record) => ({
        onClick: () => goToMonitoring(record),
      }),
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      filtered: true,
      onFilter: (value, filters) =>
        filters.name.toLowerCase().includes(value.toLowerCase()),
      onCell: (record) => ({
        onClick: () => goToMonitoring(record),
      }),
    },
    {
      title: "User",
      dataIndex: "created_by",
      onCell: (record) => ({
        onClick: () => goToMonitoring(record),
      }),
    },
    {
      title: "Region",
      dataIndex: "administration",
      onCell: (record) => ({
        onClick: () => goToMonitoring(record),
      }),
    },
  ];

  const handleChange = (e) => {
    setUpdateRecord(true);
    setCurrentPage(e.current);
  };

  const onSelectTableRow = ({ id }) => {
    selectedRowKeys.includes(id)
      ? setSelectedRowKeys(without(selectedRowKeys, id))
      : setSelectedRowKeys([...selectedRowKeys, id]);
  };

  const onSelectAllTableRow = (isSelected) => {
    const hasSelected = !isEmpty(selectedRowKeys);
    const ids = dataset.filter((x) => !x?.disabled).map((x) => x.id);
    if (!isSelected && hasSelected) {
      setSelectedRowKeys(xor(selectedRowKeys, ids));
    }
    if (isSelected && !hasSelected) {
      setSelectedRowKeys(ids);
    }
    if (isSelected && hasSelected) {
      setSelectedRowKeys(union(selectedRowKeys, ids));
    }
  };

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
      let url = `/form-data/${formId}/?page=${currentPage}`;
      if (selectedAdministration?.id) {
        url += `&administration=${selectedAdministration.id}`;
      }
      if (advancedFilters && advancedFilters.length) {
        url = generateAdvanceFilterURL(advancedFilters, url);
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
    advancedFilters,
    updateRecord,
    formIdFromUrl,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    <div id="manageData">
      <div className="description-container">
        <Row justify="space-between">
          <Col>
            <Breadcrumbs pagePath={pagePath} />
            <DescriptionPanel
              description={text.manageDataText}
              title={text.manageDataTitle}
            />
          </Col>
        </Row>
      </div>

      <div className="table-section">
        <div className="table-wrapper">
          <DataFilters
            {...{
              loading,
              selectedRowKeys,
            }}
          />
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
                columns={columns}
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
                rowSelection={{
                  selectedRowKeys: selectedRowKeys,
                  onSelect: onSelectTableRow,
                  onSelectAll: onSelectAllTableRow,
                }}
              />
            </ConfigProvider>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ManageData);
