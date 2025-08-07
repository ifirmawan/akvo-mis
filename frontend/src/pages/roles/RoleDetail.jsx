import React, { useMemo } from "react";
import { Row, Col, Table, Button, Space, Divider, Tag } from "antd";
import { Link } from "react-router-dom";
import groupBy from "lodash/groupBy";
import { store, uiText } from "../../lib";

const RoleDetail = ({ record, onDelete, deleting }) => {
  const { language } = store.useState((s) => s);
  const { active: activeLang } = language;
  const text = useMemo(() => {
    return uiText[activeLang];
  }, [activeLang]);

  const columns = [
    {
      title: "Field",
      dataIndex: "field",
      key: "field",
      width: "50%",
    },
    {
      title: "Value",
      dataIndex: "value",
      key: "value",
    },
  ];

  return (
    <div>
      <Row justify="center" key="top">
        <Col span={20}>
          <Table
            columns={columns}
            className="table-child"
            dataSource={[
              {
                key: "name",
                field: text.roleName,
                value: record?.name,
              },
              {
                key: "description",
                field: text.roleDescription,
                value: record?.description || "-",
              },
              {
                key: "administration_level",
                field: text.roleAdmLevel,
                value: record?.administration_level?.name || "-",
              },
              {
                key: "role_access",
                field: text.roleAccess,
                value: (
                  <div>
                    {record?.role_access.map((item) => (
                      <Tag key={item.id} className="role-access-item">
                        {item.data_access_name}
                      </Tag>
                    ))}
                  </div>
                ),
              },
              {
                key: "role_features",
                field: text.roleFeatures,
                value: (
                  <div>
                    {/** record.role_features group by type and show all access_name as tag  */}
                    {Object.entries(groupBy(record.role_features, "type")).map(
                      ([type, features]) => (
                        <div key={type} className="role-feature-group">
                          <strong>{features[0].type_name}:</strong>
                          {features.map((access) => (
                            <Tag key={access.id} className="role-feature-item">
                              {access.access_name}
                            </Tag>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                ),
              },
              {
                key: "total_users",
                field: text.roleTotalUsers,
                value: record?.total_users || 0,
              },
            ]}
            pagination={false}
          />
        </Col>
        <Divider />
      </Row>
      <div>
        <Space>
          <Link to={`/control-center/roles/${record.id}`}>
            <Button type="primary" shape="round">
              {text.editButton}
            </Button>
          </Link>
          <Button
            danger
            loading={deleting}
            onClick={() => onDelete(record)}
            shape="round"
          >
            {text.deleteText}
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default RoleDetail;
