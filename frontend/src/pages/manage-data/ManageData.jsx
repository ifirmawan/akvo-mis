import React, { useState, useMemo } from "react";
import { Row, Col, Divider, Tabs } from "antd";

import { store, uiText } from "../../lib";
import { DataFilters, Breadcrumbs, DescriptionPanel } from "../../components";
import { ManageDataMap, ManageDataTable } from "./components";

const { TabPane } = Tabs;

import "./style.scss";

const ManageData = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const { language } = store.useState((s) => s);
  const { active: activeLang } = language;
  const text = useMemo(() => {
    return uiText[activeLang];
  }, [activeLang]);
  // Get form_id from URL as default selectedForm
  const formIdFromUrl = new URLSearchParams(window.location.search).get(
    "form_id"
  );

  return (
    <div id="manageData">
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
                  title: text.manageDataTitle,
                },
              ]}
            />
            <DescriptionPanel
              description={text.manageDataText}
              title={text.manageDataTitle}
            />
          </Col>
        </Row>
      </div>

      <div className="table-section">
        <div className="table-wrapper">
          <DataFilters selectedRowKeys={selectedRowKeys} />
          <Divider style={{ marginBottom: 8 }} />
          <div
            style={{ padding: 0, minHeight: "40vh" }}
            bodystyle={{ padding: 0 }}
          >
            <Tabs className="manage-data-tab">
              <TabPane tab={text.manageDataTabList} key="data-list">
                <ManageDataTable
                  {...{
                    formIdFromUrl,
                    selectedRowKeys,
                    setSelectedRowKeys,
                  }}
                />
              </TabPane>
              <TabPane tab={text.manageDataTabMap} key="data-map">
                <ManageDataMap />
              </TabPane>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ManageData);
