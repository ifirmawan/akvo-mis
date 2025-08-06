import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./style.scss";
import { Row, Col, Space, Input, Select, Checkbox } from "antd";
import { store, config, api, uiText } from "../../lib";
import AdministrationDropdown from "./AdministrationDropdown";
import RemoveFiltersButton from "./RemoveFiltersButton";

const { Search } = Input;
const { Option } = Select;

const UserFilters = ({ fetchData, pending, setPending, loading, button }) => {
  const {
    filters,
    language,
    user: authUser,
  } = store.useState((state) => state);
  const { trained, role, organisation, query } = filters;

  const { trainedStatus } = config;

  const [organisations, setOrganisations] = useState([]);
  const [roles, setRoles] = useState([]);

  const { active: activeLang } = language;
  const text = useMemo(() => {
    return uiText[activeLang];
  }, [activeLang]);

  const maxRoleLevel = useMemo(() => {
    return authUser?.is_superuser
      ? authUser.administration?.level
      : authUser?.roles?.length
      ? Math.min(...authUser.roles.map((r) => r?.administration?.level))
      : null;
  }, [authUser]);

  const fetchRoles = useCallback(async () => {
    try {
      const { data: apiData } = await api.get("/user/roles");
      setRoles(apiData?.filter((r) => r?.level >= maxRoleLevel));
    } catch (error) {
      console.error("Failed to fetch roles:", error);
    }
  }, [maxRoleLevel]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    api.get("organisations").then((res) => {
      setOrganisations(res.data);
    });
  }, [setOrganisations]);

  return (
    <>
      <Row justify="space-between" style={{ paddingBottom: "10px" }}>
        <Col>
          <Search
            placeholder="Search..."
            value={query}
            onChange={(e) => {
              store.update((s) => {
                s.filters.query = e.target.value;
              });
            }}
            onSearch={(e) => {
              fetchData(e);
            }}
            style={{ width: 260, marginRight: "1rem" }}
            loading={loading && !!query}
            allowClear
          />
          <Space>
            <Select
              placeholder="Organization"
              getPopupContainer={(trigger) => trigger.parentNode}
              style={{ width: 160 }}
              value={organisation}
              onChange={(e) => {
                store.update((s) => {
                  s.filters.organisation = e;
                });
              }}
              className="custom-select"
              allowClear
            >
              {organisations?.map((o, oi) => (
                <Option key={`org-${oi}`} value={o.id}>
                  {o.name}
                </Option>
              ))}
            </Select>
            <Select
              placeholder="Trained Status"
              getPopupContainer={(trigger) => trigger.parentNode}
              style={{ width: 160 }}
              value={trained}
              onChange={(e) => {
                store.update((s) => {
                  s.filters.trained = e;
                });
              }}
              allowClear
              className="custom-select"
            >
              {trainedStatus.map((t, ti) => (
                <Option key={ti} value={t.value}>
                  {t.label}
                </Option>
              ))}
            </Select>
            <Select
              placeholder="Role"
              getPopupContainer={(trigger) => trigger.parentNode}
              style={{ width: 160 }}
              value={role}
              onChange={(e) => {
                store.update((s) => {
                  s.filters.role = e;
                });
              }}
              options={roles}
              optionFilterProp="label"
              filterOption={(input, option) =>
                option.label.toLowerCase().includes(input.toLowerCase())
              }
              className="custom-select"
              allowClear
              showSearch
            />
          </Space>
        </Col>
        <Col>{button}</Col>
      </Row>
      <Row>
        <Col span={20}>
          <Space>
            <AdministrationDropdown
              loading={loading}
              maxLevel={4}
              persist={true}
            />
            <RemoveFiltersButton
              extra={(s) => {
                s.filters = {
                  trained: null,
                  role: null,
                  organisation: null,
                  query: null,
                };
              }}
            />
          </Space>
        </Col>
        <Col span={4} align="right">
          <Checkbox
            onChange={() => {
              setPending(!pending);
            }}
            disabled={loading}
            checked={pending}
          >
            {text.showPendingUsers}
          </Checkbox>
        </Col>
      </Row>
    </>
  );
};

export default React.memo(UserFilters);
