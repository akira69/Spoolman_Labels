import { EditOutlined, EyeOutlined, FilterOutlined, PlusSquareOutlined, SyncOutlined } from "@ant-design/icons";
import { List, useTable } from "@refinedev/antd";
import { useInvalidate, useNavigation, useTranslate, useUpdate } from "@refinedev/core";
import { Button, Dropdown, Table, message } from "antd";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ActionsColumn,
  CustomFieldColumn,
  DateColumn,
  FilteredQueryColumn,
  NumberColumn,
  RichColumn,
  SortedColumn,
} from "../../components/column";
import { useLiveify } from "../../components/liveify";
import VendorLogo from "../../components/vendorLogo";
import { useSpoolmanVendorExternalIds, useSpoolmanVendors, useVendorLogoManifest } from "../../components/otherModels";
import { removeUndefined } from "../../utils/filtering";
import { EntityType, useGetFields } from "../../utils/queryFields";
import { TableState, useInitialTableState, useStoreInitialState } from "../../utils/saveload";
import { getAPIURL } from "../../utils/url";
import { parseExtraString, suggestVendorLogoPaths } from "../../utils/vendorLogo";
import { IVendor } from "./model";

dayjs.extend(utc);

const namespace = "vendorList-v2";

const allColumns: string[] = ["id", "logo", "name", "registered", "external_id", "comment", "empty_spool_weight"];

export const VendorList = () => {
  const t = useTranslate();
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const extraFields = useGetFields(EntityType.vendor);
  const logoManifestQuery = useVendorLogoManifest();
  const [messageApi, contextHolder] = message.useMessage();
  const { mutateAsync: updateVendor } = useUpdate();
  const [hasAutoSynced, setHasAutoSynced] = useState(false);

  const allColumnsWithExtraFields = [...allColumns, ...(extraFields.data?.map((field) => "extra." + field.key) ?? [])];

  // Load initial state
  const initialState = useInitialTableState(namespace);

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
  const dataSource = useLiveify(
    "vendor",
    queryDataSource,
    useCallback((record: IVendor) => record, []),
  );

  if (tableProps.pagination) {
    tableProps.pagination.showSizeChanger = true;
  }

  const { editUrl, showUrl, cloneUrl } = useNavigation();
  const actions = (record: IVendor) => [
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

  const syncVendorLogos = useCallback(
    async (showToast: boolean) => {
      const manifest = logoManifestQuery.data;
      if (!manifest) {
        if (showToast) {
          messageApi.warning("Logo manifest is not available yet.");
        }
        return;
      }

      const response = await fetch(getAPIURL() + "/vendor");
      if (!response.ok) {
        if (showToast) {
          messageApi.error("Could not load manufacturers for logo sync.");
        }
        return;
      }
      const vendors = (await response.json()) as IVendor[];

      let updatedCount = 0;
      let matchedCount = 0;
      for (const vendor of vendors) {
        const { webPath, printPath } = suggestVendorLogoPaths(vendor.name, manifest);
        if (!webPath && !printPath) {
          continue;
        }
        matchedCount += 1;

        const existingLogo = parseExtraString(vendor.extra?.logo_url);
        const existingPrintLogo = parseExtraString(vendor.extra?.print_logo_url);
        if (existingLogo && existingPrintLogo) {
          continue;
        }

        const mergedExtra = { ...(vendor.extra ?? {}) };
        if (!existingLogo && webPath) {
          mergedExtra.logo_url = JSON.stringify(webPath);
        }
        if (!existingPrintLogo && printPath) {
          mergedExtra.print_logo_url = JSON.stringify(printPath);
        }

        if (mergedExtra.logo_url === vendor.extra?.logo_url && mergedExtra.print_logo_url === vendor.extra?.print_logo_url) {
          continue;
        }

        await updateVendor({
          resource: "vendor",
          id: vendor.id,
          values: { ...vendor, extra: mergedExtra },
        });
        updatedCount += 1;
      }

      if (updatedCount > 0) {
        invalidate({
          resource: "vendor",
          invalidates: ["list"],
        });
      }
      if (showToast) {
        messageApi.success(`Logo sync complete. Matched ${matchedCount}, updated ${updatedCount}.`);
      }
    },
    [logoManifestQuery.data, messageApi, updateVendor, invalidate],
  );

  useEffect(() => {
    if (hasAutoSynced || !logoManifestQuery.data) {
      return;
    }
    setHasAutoSynced(true);
    void syncVendorLogos(false);
  }, [hasAutoSynced, logoManifestQuery.data, syncVendorLogos]);

  return (
    <List
      headerButtons={({ defaultButtons }) => (
        <>
          <Button
            type="primary"
            icon={<SyncOutlined />}
            onClick={() => void syncVendorLogos(true)}
          >
            {t("vendor.buttons.sync_logos")}
          </Button>
          <Button
            type="primary"
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

                return {
                  key: column_id,
                  label:
                    column_id === "logo"
                      ? t("vendor.fields.logo")
                      : t(`vendor.fields.${column_id}`),
                };
              }),
              selectedKeys: showColumns,
              selectable: true,
              multiple: true,
              onDeselect: (keys) => {
                setShowColumns(keys.selectedKeys);
              },
              onSelect: (keys) => {
                setShowColumns(keys.selectedKeys);
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
      {contextHolder}
      <Table
        {...tableProps}
        sticky
        tableLayout="auto"
        scroll={{ x: "max-content" }}
        dataSource={dataSource}
        rowKey="id"
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
                width: 180,
                render: (_: unknown, record: IVendor) => (
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
                ),
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
