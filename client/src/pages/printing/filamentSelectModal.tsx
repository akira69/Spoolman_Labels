import { useTable } from "@refinedev/antd";
import { CrudFilter } from "@refinedev/core";
import { Button, Checkbox, Col, Dropdown, Input, message, Pagination, Row, Space } from "antd";
import { t } from "i18next";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { FilteredQueryColumn, SortedColumn, SpoolIconColumn } from "../../components/column";
import ResizableTable from "../../components/resizableTable";
import {
  useSpoolmanFilamentNames,
  useSpoolmanMaterials,
  useSpoolmanSpoolCounts,
  useSpoolmanVendors,
} from "../../components/otherModels";
import { removeUndefined } from "../../utils/filtering";
import { TableState, useSavedState } from "../../utils/saveload";
import { IFilament } from "../filaments/model";

interface Props {
  description?: string;
  initialSelectedIds?: number[];
  onExport?: (selectedIds: number[]) => void;
  onPrint?: (selectedIds: number[]) => void;
}

interface IFilamentCollapsed extends IFilament {
  "vendor.name": string | null;
}

function collapseFilament(element: IFilament): IFilamentCollapsed {
  return { ...element, "vendor.name": element.vendor?.name ?? null };
}

const namespace = "filamentSelectModal-v1";
const allColumns: string[] = ["id", "spool_count", "vendor.name", "name", "material"];

function getColumnLabel(columnId: string): string {
  if (columnId === "vendor.name") {
    return t("filament.fields.vendor_name");
  }
  return t(`filament.fields.${columnId.replace(".", "_")}`);
}

const FilamentSelectModal = ({ description, initialSelectedIds, onExport, onPrint }: Props) => {
  const [selectedItems, setSelectedItems] = useState<number[]>(initialSelectedIds ?? []);
  const [messageApi, contextHolder] = message.useMessage();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
  const [showColumns, setShowColumns] = useSavedState<string[]>(`${namespace}-showColumns`, allColumns);

  const { tableProps, sorters, filters, setFilters, currentPage, pageSize, setCurrentPage, setPageSize } =
    useTable<IFilamentCollapsed>({
      resource: "filament",
      syncWithLocation: false,
      pagination: {
        mode: "server",
        currentPage: 1,
        pageSize: 50,
      },
      sorters: {
        mode: "server",
      },
      filters: {
        mode: "server",
      },
      queryOptions: {
        select(data) {
          return {
            total: data.total,
            data: data.data.map(collapseFilament),
          };
        },
      },
    });

  const tableState: TableState = {
    sorters,
    filters,
    pagination: { currentPage: currentPage, pageSize },
    showColumns,
  };

  const dataSource: IFilamentCollapsed[] = useMemo(
    () => (tableProps.dataSource || []).map((record) => ({ ...record })),
    [tableProps.dataSource],
  );
  const selectedSet = useMemo(() => new Set(selectedItems), [selectedItems]);

  const paginationTotal = tableProps.pagination ? tableProps.pagination.total ?? 0 : 0;
  const handlePageChange = (page: number, nextPageSize?: number) => {
    if (typeof nextPageSize === "number" && nextPageSize !== pageSize) {
      setPageSize(nextPageSize);
    }
    setCurrentPage(page);
  };
  const handlePageSizeChange = (_current: number, size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const applySearchFilter = (nextSearch: string) => {
    const trimmedSearch = nextSearch.trim();
    const nextFilters: CrudFilter[] = [];
    (filters ?? []).forEach((filter) => {
      if ("field" in filter && filter.field !== "search") {
        nextFilters.push(filter);
      }
    });
    if (trimmedSearch.length > 0) {
      nextFilters.push({
        field: "search",
        operator: "contains",
        value: [trimmedSearch],
      });
    }
    setFilters(nextFilters, "replace");
    setCurrentPage(1);
  };

  const selectUnselectFiltered = (select: boolean) => {
    setSelectedItems((prevSelected) => {
      const nextSelected = new Set(prevSelected);
      dataSource.forEach((filament) => {
        if (select) {
          nextSelected.add(filament.id);
        } else {
          nextSelected.delete(filament.id);
        }
      });
      return Array.from(nextSelected);
    });
  };

  const handleSelectItem = (item: number) => {
    setSelectedItems((prevSelected) =>
      prevSelected.includes(item) ? prevSelected.filter((selected) => selected !== item) : [...prevSelected, item],
    );
  };

  const isAllFilteredSelected = dataSource.every((filament) => selectedSet.has(filament.id));
  const isSomeButNotAllFilteredSelected =
    dataSource.some((filament) => selectedSet.has(filament.id)) && !isAllFilteredSelected;

  const commonProps = {
    t,
    navigate,
    dataSource,
    tableState,
    sorter: true,
  };

  return (
    <>
      {contextHolder}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", height: "100%" }}>
        {(description || tableProps.pagination) && (
          <Row gutter={[12, 8]} align="middle" style={{ marginBottom: 8 }}>
            <Col flex="auto">{description && <div style={{ margin: 0 }}>{description}</div>}</Col>
            {tableProps.pagination && (
              <Col flex="none">
                <Pagination
                  size="small"
                  current={currentPage}
                  pageSize={pageSize}
                  total={paginationTotal}
                  showSizeChanger
                  pageSizeOptions={["25", "50", "100", "200"]}
                  showQuickJumper
                  onChange={handlePageChange}
                  onShowSizeChange={handlePageSizeChange}
                />
              </Col>
            )}
          </Row>
        )}
        <Row gutter={[12, 8]} style={{ marginBottom: 8 }}>
          <Col span={24}>
            <Input.Search
              placeholder={t("printing.filamentSelect.searchPlaceholder")}
              value={searchValue}
              allowClear
              enterButton
              onChange={(event) => {
                const value = event.target.value;
                setSearchValue(value);
                if (value === "") {
                  applySearchFilter("");
                }
              }}
              onSearch={(value) => {
                setSearchValue(value);
                applySearchFilter(value);
              }}
            />
          </Col>
        </Row>
        <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 8 }}>
          <Col flex="none">
            <Button
              onClick={() => {
                setSearchValue("");
                setFilters([], "replace");
                setCurrentPage(1);
              }}
            >
              {t("buttons.clearFilters")}
            </Button>
          </Col>
          <Col flex="none">
            <Dropdown
              trigger={["click"]}
              menu={{
                items: allColumns.map((columnId) => ({
                  key: columnId,
                  label: getColumnLabel(columnId),
                })),
                selectedKeys: showColumns,
                selectable: true,
                multiple: true,
                onDeselect: (info) => {
                  setShowColumns(info.selectedKeys as string[]);
                },
                onSelect: (info) => {
                  setShowColumns(info.selectedKeys as string[]);
                },
              }}
            >
              <Button>{t("buttons.hideColumns")}</Button>
            </Dropdown>
          </Col>
          <Col flex="auto">
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <Checkbox
                checked={isAllFilteredSelected}
                indeterminate={isSomeButNotAllFilteredSelected}
                onChange={(e) => {
                  selectUnselectFiltered(e.target.checked);
                }}
              >
                {t("printing.filamentSelect.selectAll")}
              </Checkbox>
              <div style={{ minWidth: 140, textAlign: "right" }}>
                {t("printing.filamentSelect.selectedTotal", {
                  count: selectedItems.length,
                })}
              </div>
              <Space>
                {onPrint && (
                  <Button
                    type="primary"
                    onClick={() => {
                      if (selectedItems.length === 0) {
                        messageApi.open({
                          type: "error",
                          content: t("printing.filamentSelect.noFilamentsSelected"),
                        });
                        return;
                      }
                      onPrint(selectedItems);
                    }}
                  >
                    {t("printing.qrcode.button")}
                  </Button>
                )}
                {onExport && (
                  <Button
                    type="primary"
                    onClick={() => {
                      if (selectedItems.length === 0) {
                        messageApi.open({
                          type: "error",
                          content: t("printing.filamentSelect.noFilamentsSelected"),
                        });
                        return;
                      }
                      onExport(selectedItems);
                    }}
                  >
                    {t("printing.qrcode.exportButton")}
                  </Button>
                )}
              </Space>
            </div>
          </Col>
        </Row>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResizableTable
            columnResizeKey="filament-select-modal-table"
            {...tableProps}
            rowKey="id"
            tableLayout="fixed"
            pagination={false}
            dataSource={dataSource}
            scroll={{ y: "calc(100vh - 360px)", x: "max-content" }}
            columns={removeUndefined([
              {
                width: 48,
                render: (_, item: IFilament) => (
                  <Checkbox checked={selectedSet.has(item.id)} onChange={() => handleSelectItem(item.id)} />
                ),
              },
              SortedColumn({
                ...commonProps,
                id: "id",
                i18ncat: "filament",
                width: 70,
              }),
              FilteredQueryColumn({
                ...commonProps,
                id: "spool_count",
                dataId: "spool_count",
                i18ncat: "filament",
                width: 120,
                includeEmptyFilter: false,
                filterValueQuery: useSpoolmanSpoolCounts(),
                transform: (value) => value ?? 0,
              }),
              FilteredQueryColumn({
                ...commonProps,
                id: "vendor.name",
                i18nkey: "filament.fields.vendor_name",
                width: 200,
                filterValueQuery: useSpoolmanVendors(),
              }),
              SpoolIconColumn({
                ...commonProps,
                id: "name",
                i18ncat: "filament",
                width: 360,
                color: (record: IFilamentCollapsed) =>
                  record.multi_color_hexes
                    ? {
                        colors: record.multi_color_hexes.split(","),
                        vertical: record.multi_color_direction === "longitudinal",
                      }
                    : record.color_hex,
                filterValueQuery: useSpoolmanFilamentNames(),
              }),
              FilteredQueryColumn({
                ...commonProps,
                id: "material",
                i18ncat: "filament",
                width: 140,
                filterValueQuery: useSpoolmanMaterials(),
              }),
            ])}
          />
        </div>
      </div>
    </>
  );
};

export default FilamentSelectModal;
