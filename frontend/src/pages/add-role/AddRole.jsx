import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Row, Col, Form, Button, Input, Select, Checkbox, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  ACCESS_LEVELS_LIST,
  api,
  FEATURE_ACCESS_GROUPS,
  store,
  uiText,
} from "../../lib";
import { Breadcrumbs, DescriptionPanel } from "../../components";

const { useForm } = Form;

const AddRolePage = () => {
  const [loading, setLoading] = useState(true);
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = useForm();

  const { language, levels } = store.useState((s) => s);
  const { active: activeLang } = language;
  const text = useMemo(() => {
    return uiText[activeLang];
  }, [activeLang]);

  const panelTitle = id ? text.editRole : text.addRole;
  const pagePath = [
    {
      title: text.controlCenter,
      link: "/control-center",
    },
    {
      title: text.manageRolesTitle,
      link: "/control-center/roles",
    },
    {
      title: panelTitle,
    },
  ];

  const handleSubmit = async (values) => {
    try {
      const payload = {
        name: values.name,
        description: values.description,
        administration_level: values.administration_level,
        role_access: values.role_access,
      };
      if (id) {
        await api.put(`/role/${id}`, payload);
        message.success(text.roleSuccessUpdated);
      } else {
        await api.post("/roles", payload);
        message.success(text.roleSuccessAdded);
      }
      // Reset form after successful submission
      form.resetFields();
      // Redirect to roles page
      navigate("/control-center/roles");
    } catch (error) {
      console.error("Error saving role:", error);
      message.error(id ? text.roleErrorUpdate : text.roleErrorAdd);
    }
  };

  // Fetch role data if id is present
  const fetchRoleData = useCallback(async () => {
    if (id) {
      try {
        const { data: roleData } = await api.get(`/role/${id}`);

        form.setFieldsValue({
          name: roleData.name,
          description: roleData.description,
          administration_level: roleData.administration_level?.id,
          role_access: roleData.role_access?.map((rc) => rc?.data_access) || [],
        });
        setLoading(false);
      } catch (error) {
        setLoading(false);
        console.error("Failed to fetch role data:", error);
      }
    } else {
      setLoading(false);
    }
  }, [id, form]);

  useEffect(() => {
    fetchRoleData();
  }, [fetchRoleData]);

  return (
    <div>
      <div className="description-container">
        <Row justify="space-between">
          <Col>
            <Breadcrumbs pagePath={pagePath} />
            <DescriptionPanel
              description={text.addRoleDescription}
              title={panelTitle}
            />
          </Col>
        </Row>
      </div>
      <div className="table-section">
        <div className="table-wrapper">
          <Form
            layout="vertical"
            className="add-role-form"
            onFinish={handleSubmit}
            onFinishFailed={(errorInfo) => {
              console.error("Failed to submit form:", errorInfo);
            }}
            autoComplete="off"
            scrollToFirstError={true}
            disabled={loading}
            form={form}
          >
            <Row gutter={24}>
              <Col span={16}>
                <Form.Item
                  label={text.roleName}
                  name="name"
                  rules={[{ required: true, message: text.roleNameRequired }]}
                >
                  <Input placeholder={text.roleNamePlaceholder} />
                </Form.Item>
                <Form.Item
                  label={text.roleAdmLevel}
                  name="administration_level"
                  rules={[
                    { required: true, message: text.roleAdmLevelRequired },
                  ]}
                >
                  <Select
                    placeholder={text.roleAdmLevelPlaceholder}
                    options={levels.map((level) => ({
                      label: level.name,
                      value: level.id,
                    }))}
                  />
                </Form.Item>
                <Form.Item label={text.roleDescription} name="description">
                  <Input.TextArea placeholder={text.roleDescription} rows={4} />
                </Form.Item>
                <Form.Item
                  label={text.formAccess}
                  name="role_access"
                  rules={[{ required: true, message: text.roleAccessRequired }]}
                >
                  <Checkbox.Group>
                    <Row>
                      {ACCESS_LEVELS_LIST.map((access) => (
                        <Col key={access.key}>
                          <Checkbox value={access.key}>{access.value}</Checkbox>
                        </Col>
                      ))}
                    </Row>
                  </Checkbox.Group>
                </Form.Item>
                {FEATURE_ACCESS_GROUPS.map((group) => (
                  <Form.Item
                    key={group.key}
                    label={text[group.textKey]}
                    name={group.key}
                  >
                    <Checkbox.Group>
                      <Row>
                        {group.features.map((feature) => (
                          <Col key={feature.key}>
                            <Checkbox value={feature.value}>
                              {text[feature.textKey]}
                            </Checkbox>
                          </Col>
                        ))}
                      </Row>
                    </Checkbox.Group>
                  </Form.Item>
                ))}
                <Row justify="end">
                  <Button type="primary" htmlType="submit" shape="round">
                    {text.saveButton}
                  </Button>
                </Row>
              </Col>
            </Row>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default AddRolePage;
