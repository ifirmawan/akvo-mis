import React, { useState, useMemo, useCallback } from "react";
import "./style.scss";
import {
  Row,
  Col,
  Space,
  Button,
  Dropdown,
  Checkbox,
  Badge,
  Tooltip,
} from "antd";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AdministrationDropdown from "./AdministrationDropdown";
import FormDropdown from "./FormDropdown.js";
import { useNotification } from "../../util/hooks";
import { api, store, uiText } from "../../lib";
import { takeRight } from "lodash";
import RemoveFiltersButton from "./RemoveFiltersButton";
import AdvancedFilters from "./AdvancedFilters";
import {
  PlusOutlined,
  DownloadOutlined,
  UploadOutlined,
  FileWordOutlined,
  DownOutlined,
} from "@ant-design/icons";
import { Can } from "../can/index.js";

const DataFilters = ({
  loading,
  showAdm = true,
  resetFilter = true,
  selectedRowKeys = [],
}) => {
  const {
    user: authUser,
    selectedForm,
    loadingForm,
    administration,
    showAdvancedFilters,
  } = store.useState((s) => s);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { notify } = useNotification();
  const [exporting, setExporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedChildForms, setSelectedChildForms] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isUserHasForms = authUser?.is_superuser || authUser?.forms?.length || 0;
  const language = store.useState((s) => s.language);
  const { active: activeLang } = language;

  const text = useMemo(() => {
    return uiText[activeLang];
  }, [activeLang]);

  const childForms = useMemo(() => {
    return window.forms?.filter((f) => f?.content?.parent === selectedForm);
  }, [selectedForm]);

  const exportGenerate = ({ key }) => {
    setExporting(true);
    const adm_id = takeRight(administration, 1)[0]?.id;
    api
      .get(
        `download/generate?form_id=${selectedForm}&administration_id=${adm_id}&type=${key}`
      )
      .then(() => {
        notify({
          type: "success",
          message: `Data exported successfully`,
        });
        setExporting(false);
        navigate("/downloads");
      })
      .catch(() => {
        notify({
          type: "error",
          message: "Export failed",
        });
        setExporting(false);
      });
  };

  const exportDataReport = useCallback(async () => {
    setDownloading(true);
    try {
      // Create parameters list URL for selection_ids based on selectedRowKeys
      const selectionIds = selectedRowKeys
        .map((id) => `selection_ids=${id}`)
        .join("&");
      const childFormIds = selectedChildForms
        .map((id) => `child_form_ids=${id}`)
        .join("&");
      // If no child forms are selected, use the selected form
      let apiURL = `/download/datapoint-report?form_id=${selectedForm}&${selectionIds}`;
      if (selectedChildForms.length) {
        apiURL += `&${childFormIds}`;
      }
      await api.get(apiURL);
      setDownloading(false);
      setDropdownOpen(false); // Close dropdown after successful download
      notify({
        type: "success",
        message: text.downloadReportSuccess,
      });
      navigate("/downloads");
    } catch (error) {
      setDownloading(false);
      setDropdownOpen(false); // Close dropdown even on error
      notify({
        type: "error",
        message: text.downloadReportError,
      });
    }
  }, [
    selectedRowKeys,
    selectedChildForms,
    notify,
    selectedForm,
    text.downloadReportError,
    text.downloadReportSuccess,
    navigate,
  ]);

  const goToAddForm = () => {
    /***
     * reset initial value
     */
    store.update((s) => {
      s.initialValue = [];
    });
    navigate(`/control-center/form/${selectedForm}`);
  };

  const downloadTypes = [
    {
      key: "all",
      label: text.allData,
      onClick: (param) => {
        exportGenerate(param);
      },
    },
    {
      key: "recent",
      label: text.latestData,
      onClick: (param) => {
        exportGenerate(param);
      },
    },
  ];

  const childFormMenuItems = useMemo(() => {
    const formItems = childForms.map((form) => ({
      key: form.id,
      label: (
        <Checkbox
          checked={selectedChildForms.includes(form.id)}
          onChange={(e) => {
            const { checked } = e.target;
            if (checked) {
              setSelectedChildForms([...selectedChildForms, form.id]);
            } else {
              setSelectedChildForms(
                selectedChildForms.filter((id) => id !== form.id)
              );
            }
          }}
        >
          {form.content.name}
        </Checkbox>
      ),
    }));

    const menuItems = [];

    if (childForms.length > 0) {
      menuItems.push(
        {
          key: "header",
          label: (
            <div
              style={{ fontWeight: 500, color: "#262626", padding: "4px 0" }}
            >
              {text.selectChildForms}
            </div>
          ),
          disabled: true,
        },
        ...formItems,
        {
          key: "divider",
          type: "divider",
        }
      );
    }

    // Add footer menu with download button
    menuItems.push({
      key: "download-footer",
      label: (
        <Button
          type="primary"
          icon={<FileWordOutlined />}
          loading={downloading}
          onClick={exportDataReport}
          disabled={!selectedRowKeys?.length}
          style={{ width: "100%" }}
        >
          {text.downloadReport}
        </Button>
      ),
      disabled: true,
    });

    return menuItems;
  }, [
    childForms,
    selectedChildForms,
    downloading,
    selectedRowKeys,
    text.downloadReport,
    text.selectChildForms,
    exportDataReport,
  ]);

  return (
    <>
      <Row style={{ marginBottom: "16px" }}>
        <Col flex={1}>
          <Space>
            <FormDropdown
              loading={loading}
              width="100%"
              style={{ minWidth: 300 }}
            />
            {/* <AdvancedFiltersButton /> */}
          </Space>
        </Col>
        <Col>
          <Space>
            <Can I="upload" a="data">
              <Link to="/control-center/data/upload">
                <Button shape="round" icon={<UploadOutlined />}>
                  {text.bulkUpload}
                </Button>
              </Link>
            </Can>
            {pathname === "/control-center/data" && (
              <Space>
                {selectedRowKeys.length === 0 ? (
                  <Tooltip
                    title={text.selectRowsToDownload}
                    trigger="hover"
                    placement="top"
                  >
                    <Button shape="round" icon={<FileWordOutlined />} disabled>
                      {text.downloadReport}
                    </Button>
                  </Tooltip>
                ) : (
                  <Dropdown
                    trigger={["click"]}
                    placement="bottomLeft"
                    open={dropdownOpen}
                    onOpenChange={setDropdownOpen}
                    menu={{
                      items: childFormMenuItems,
                      style: { minWidth: "200px" },
                    }}
                    disabled={!selectedRowKeys.length}
                  >
                    <Badge count={selectedRowKeys.length}>
                      <Button
                        shape="round"
                        icon={<FileWordOutlined />}
                        loading={downloading}
                        disabled={!selectedRowKeys.length}
                      >
                        {text.downloadReport} <DownOutlined />
                      </Button>
                    </Badge>
                  </Dropdown>
                )}
              </Space>
            )}
            {pathname === "/control-center/data" && (
              <Can I="create" a="downloads">
                <Dropdown
                  menu={{ items: downloadTypes }}
                  placement="bottomRight"
                >
                  <Button
                    icon={<DownloadOutlined />}
                    shape="round"
                    loading={exporting}
                  >
                    {text.download}
                  </Button>
                </Dropdown>
              </Can>
            )}
            <Can I="manage" a="submissions">
              <Button
                shape="round"
                icon={<PlusOutlined />}
                type="primary"
                disabled={!isUserHasForms}
                onClick={goToAddForm}
              >
                {text.addNewButton}
              </Button>
            </Can>
          </Space>
        </Col>
      </Row>
      <Row>
        <Col>
          <Space>
            {showAdm && (
              <AdministrationDropdown loading={loading || loadingForm} />
            )}
            {resetFilter && <RemoveFiltersButton />}
          </Space>
        </Col>
      </Row>
      {showAdvancedFilters && <AdvancedFilters />}
    </>
  );
};

export default React.memo(DataFilters);
