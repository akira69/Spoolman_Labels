import { EditOutlined, EyeOutlined, FilterOutlined, PlusSquareOutlined } from "@ant-design/icons";
import { List, useTable } from "@refinedev/antd";
import { useInvalidate, useNavigation, useTranslate } from "@refinedev/core";
import { Button, Dropdown } from "antd";
import { ColumnType } from "antd/es/table";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  type Action,
  ActionsColumn,
  CustomFieldColumn,
  DateColumn,
  FilteredQueryColumn,
  NumberColumn,
  RichColumn,
  SortedColumn,
} from "../../components/column";
import { useLiveify } from "../../components/liveify";
import { useSpoolmanVendorExternalIds, useSpoolmanVendors } from "../../components/otherModels";
import ResizableTable from "../../components/resizableTable";
import VendorLogo from "../../components/vendorLogo";
import { buildFormulaValues, formatFormulaValue, getFormulaFieldsForSurface } from "../../utils/formulaFields";
import { hasMeaningfulFilters, removeUndefined } from "../../utils/filtering";
import { FormulaFieldSurface, EntityType, useGetDerivedFields, useGetFields } from "../../utils/queryFields";
import { TableState, useInitialTableState, useSavedState, useStoreInitialState } from "../../utils/saveload";
import { IVendor } from "./model";

dayjs.extend(utc);

const namespace = "vendorList-v2";

const allColumns: string[] = ["id", "logo", "name", "registered", "external_id", "comment", "empty_spool_weight"];

export const VendorList = () => {
  const t = useTranslate();
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const extraFields = useGetFields(EntityType.vendor);
  const formulaFields = useGetDerivedFields(EntityType.vendor);

  const initialState = useInitialTableState(namespace);
  // Track formula-column hides separately so newly enabled toggleable fields still default to visible.
  const [hiddenDerivedColumns, setHiddenDerivedColumns] = useSavedState<string[]>(
    `${namespace}-hiddenDerivedColumns`,
    [],
  );

  // Fetch data from the API
  const { tableProps, sorters, setSorters, filters, setFilters, currentPage, pageSize, setCurrentPage } =
    useTable<IVendor>({
      syncWithLocation: false,
      pagination: {
        mode: "server",
        currentPage: initialState.pagination.currentPage,
        pageSize: initialState.pagination.pageSize,
      },
      sorters: {
        mode: "server",
        initial: initialState.sorters,
      },
      filters: {
        mode: "server",
        initial: initialState.filters,
      },
      liveMode: "manual",
      onLiveEvent(event) {
        if (event.type === "created" || event.type === "deleted") {
          // updated is handled by the liveify
          invalidate({
            resource: "vendor",
            invalidates: ["list"],
          });
        }
      },
    });

  // Create state for the columns to show
  const [showColumns, setShowColumns] = useState<string[]>(initialState.showColumns ?? allColumns);
  const logoFilterValue = useMemo(() => {
    const logoFilter = filters.find((filter) => "field" in filter && filter.field === "logo");
    if (!logoFilter || !("value" in logoFilter)) {
      return null;
    }

    return Array.isArray(logoFilter.value)
      ? logoFilter.value.filter((value): value is string => typeof value === "string")
      : typeof logoFilter.value === "string"
        ? [logoFilter.value]
        : null;
  }, [filters]);

  // Store state in local storage
  const tableState: TableState = {
    sorters,
    filters,
    pagination: { currentPage, pageSize },
    showColumns,
  };
  useStoreInitialState(namespace, tableState);

  // Collapse the dataSource to a mutable list
  const queryDataSource: IVendor[] = useMemo(() => {
    return (tableProps.dataSource || []).map((record) => ({ ...record }));
  }, [tableProps.dataSource]);
  const liveDataSource = useLiveify(
    "vendor",
    queryDataSource,
    useCallback((record: IVendor) => record, []),
  );
  const listFormulaFields = useMemo(
    () => getFormulaFieldsForSurface(formulaFields.data, FormulaFieldSurface.list),
    [formulaFields.data],
  );
  // All list-surface formula fields are eligible for hide/show in the column picker,
  // so we map every list formula to its derived column key here.
  const toggleableDerivedColumnKeys = useMemo(
    () => listFormulaFields.map((field) => `derived.${field.key}`),
    [listFormulaFields],
  );
  const allColumnsWithExtraFields = useMemo(
    () => [
      ...allColumns,
      ...(extraFields.data?.map((field) => `extra.${field.key}`) ?? []),
      ...toggleableDerivedColumnKeys,
    ],
    [extraFields.data, toggleableDerivedColumnKeys],
  );
  const selectedColumnKeys = useMemo(
    () => [...showColumns, ...toggleableDerivedColumnKeys.filter((key) => !hiddenDerivedColumns.includes(key))],
    [hiddenDerivedColumns, showColumns, toggleableDerivedColumnKeys],
  );
  const dataSource = useMemo<IVendor[]>(
    () =>
      liveDataSource.map((record) => ({
        ...record,
        // Formula values are computed client-side from the fetched row and are not persisted
        // server-side fields, so they update on reload/live row updates and remain display-only.
        derived: buildFormulaValues(record, listFormulaFields),
      })),
    [liveDataSource, listFormulaFields],
  );

  if (tableProps.pagination) {
    tableProps.pagination.showSizeChanger = true;
  }

  const { editUrl, showUrl, cloneUrl } = useNavigation();
  const actions = (record: IVendor): Action[] => [
    { name: t("buttons.show"), icon: <EyeOutlined />, link: showUrl("vendor", record.id) },
    { name: t("buttons.edit"), icon: <EditOutlined />, link: editUrl("vendor", record.id) },
    { name: t("buttons.clone"), icon: <PlusSquareOutlined />, link: cloneUrl("vendor", record.id) },
  ];

  const commonProps = {
    t,
    navigate,
    actions,
    dataSource,
    tableState,
    sorter: true,
  };
  // Ignore empty filter shells so the Clear Filters button only lights up for filters that would affect results.
  const hasActiveFilters = hasMeaningfulFilters(filters);

  const updateColumnSelections = (selectedKeys: string[]) => {
    // Persist core column visibility separately from derived-column visibility so
    // derived keys can be toggled without rewriting the base showColumns state.
    setShowColumns(selectedKeys.filter((key) => !toggleableDerivedColumnKeys.includes(key)));
    setHiddenDerivedColumns(toggleableDerivedColumnKeys.filter((key) => !selectedKeys.includes(key)));
  };

  return (
    <List
      headerButtons={({ defaultButtons }) => (
        <>
          <Button
            type={hasActiveFilters ? "primary" : "default"}
            icon={<FilterOutlined />}
            onClick={() => {
              setFilters([], "replace");
              setSorters([{ field: "id", order: "asc" }]);
              setCurrentPage(1);
            }}
          >
            {t("buttons.clearFilters")}
          </Button>
          <Dropdown
            trigger={["click"]}
            menu={{
              items: allColumnsWithExtraFields.map((column_id) => {
                if (column_id.indexOf("extra.") === 0) {
                  const extraField = extraFields.data?.find((field) => "extra." + field.key === column_id);
                  return {
                    key: column_id,
                    label: extraField?.name ?? column_id,
                  };
                }
                if (column_id.indexOf("derived.") === 0) {
                  const formulaField = listFormulaFields.find((field) => `derived.${field.key}` === column_id);
                  return {
                    key: column_id,
                    label: formulaField?.name ?? column_id,
                  };
                }

                return {
                  key: column_id,
                  label: column_id === "logo" ? t("vendor.fields.logo") : t(`vendor.fields.${column_id}`),
                };
              }),
              selectedKeys: selectedColumnKeys,
              selectable: true,
              multiple: true,
              onDeselect: (keys) => {
                updateColumnSelections(keys.selectedKeys.map(String));
              },
              onSelect: (keys) => {
                updateColumnSelections(keys.selectedKeys.map(String));
              },
            }}
          >
            <Button type="primary" icon={<EditOutlined />}>
              {t("buttons.hideColumns")}
            </Button>
          </Dropdown>
          {defaultButtons}
        </>
      )}
    >
      <ResizableTable
        columnResizeKey="vendor-list-table"
        {...tableProps}
        sticky
        tableLayout="auto"
        scroll={{ x: "max-content" }}
        dataSource={dataSource}
        rowKey="id"
        onChange={(pagination, filters, sorter, extra) => {
          if (tableProps.onChange) {
            tableProps.onChange(pagination, filters, sorter, extra);
          }
        }}
        columns={removeUndefined([
          SortedColumn({
            ...commonProps,
            id: "id",
            i18ncat: "vendor",
            width: 70,
          }),
          showColumns.includes("logo")
            ? {
                title: t("vendor.fields.logo"),
                key: "logo",
                dataIndex: "logo",
                width: 180,
                filterMultiple: false,
                filteredValue: logoFilterValue,
                filters: [
                  { text: t("vendor.logo_filter.has_logo"), value: "has-logo" },
                  { text: t("vendor.logo_filter.no_logo"), value: "no-logo" },
                ],
                render: (_: unknown, record: IVendor) => {
                  const rowActions = actions(record);
                  return (
                    <Dropdown
                      menu={{
                        items: rowActions.map((action) => ({
                          key: action.name,
                          label: action.name,
                          icon: action.icon,
                        })),
                        onClick: (item) => {
                          const action = rowActions.find((candidate) => candidate.name === item.key);
                          if (action?.link) {
                            navigate(action.link);
                          } else {
                            action?.onClick?.();
                          }
                        },
                      }}
                      trigger={["click"]}
                    >
                      <div style={{ cursor: "pointer" }}>
                        <VendorLogo
                          vendor={record}
                          showFallbackText
                          imgStyle={{
                            display: "block",
                            width: "100%",
                            maxWidth: "160px",
                            maxHeight: "24px",
                            objectFit: "contain",
                            objectPosition: "left center",
                          }}
                          fallbackStyle={{
                            width: "100%",
                            fontWeight: 600,
                            fontSize: "12px",
                            lineHeight: 1.2,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        />
                      </div>
                    </Dropdown>
                  );
                },
              }
            : undefined,
          FilteredQueryColumn({
            ...commonProps,
            id: "name",
            i18ncat: "vendor",
            filterValueQuery: useSpoolmanVendors(),
          }),
          DateColumn({
            ...commonProps,
            id: "registered",
            i18ncat: "vendor",
            width: 200,
          }),
          FilteredQueryColumn({
            ...commonProps,
            id: "external_id",
            i18ncat: "vendor",
            filterValueQuery: useSpoolmanVendorExternalIds(),
            width: 160,
          }),
          NumberColumn({
            ...commonProps,
            id: "empty_spool_weight",
            i18ncat: "vendor",
            unit: "g",
            maxDecimals: 0,
            width: 200,
          }),
          ...(extraFields.data?.map((field) => {
            return CustomFieldColumn({
              ...commonProps,
              field,
            });
          }) ?? []),
          ...listFormulaFields.map((field) => {
            const derivedColumnKey = `derived.${field.key}`;
            if (hiddenDerivedColumns.includes(derivedColumnKey)) {
              return undefined;
            }

            return {
              key: derivedColumnKey,
              title: field.name,
              width: 140,
              render: (_: unknown, record: IVendor) =>
                formatFormulaValue((record as IVendor & { derived?: Record<string, unknown> }).derived?.[field.key]),
            } as ColumnType<IVendor>;
          }),
          RichColumn({
            ...commonProps,
            id: "comment",
            i18ncat: "vendor",
          }),
          ActionsColumn<IVendor>(t("table.actions"), actions),
        ])}
      />
    </List>
  );
};

export default VendorList;
