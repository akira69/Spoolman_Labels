import { CopyOutlined, DeleteOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { useTranslate } from "@refinedev/core";
import { Button, Flex, Form, Grid, Input, Modal, Popconfirm, Select, Typography, message } from "antd";
import { Table } from "antd";
import TextArea from "antd/es/input/TextArea";
import { useState } from "react";
import { Link } from "react-router";
import { v4 as uuidv4 } from "uuid";
import { EntityType, FieldType, useGetFields } from "../../utils/queryFields";
import { useGetSetting } from "../../utils/querySettings";
import { useSavedState } from "../../utils/saveload";
import { useGetFilamentsByIds } from "../filaments/functions";
import { IFilament } from "../filaments/model";
import {
  SpoolQRCodePrintSettings,
  renderLabelContents,
  useGetPrintSettings as useGetPrintPresets,
  useSetPrintSettings as useSetPrintPresets,
} from "./printing";
import QRCodePrintingDialog from "./qrCodePrintingDialog";

const { Text } = Typography;

interface FilamentQRCodePrintingDialogProps {
  filamentIds: number[];
}

const DATETIME_MODIFIERS = [
  "|date",
  "|time",
  "|date_local",
  "|time_local",
  "|datetime_short",
  "|datetime_short_local",
] as const;

const NUMBER_MODIFIERS = ["|round", "|fixed1", "|fixed2"] as const;
const DATE_ORDER_SUFFIXES = [":ymd", ":mdy", ":dmy"] as const;

type TemplateModifierType = "datetime" | "number";

interface TemplateTagRow {
  tag: string;
  modifierType?: TemplateModifierType;
}

interface TemplateTagTableRow {
  key: string;
  tag: string;
  modifiers: readonly string[];
  dateOrderSuffixes?: readonly string[];
}

function getEstimatedColumnWidth(values: string[], minWidth: number): number {
  const longestValueLength = values.reduce((longest, value) => Math.max(longest, value.length), 0);
  const averageMonospaceCharWidth = 6.8;
  const cellPadding = 28;
  return Math.max(minWidth, Math.ceil(longestValueLength * averageMonospaceCharWidth + cellPadding));
}

function getModifierTypeForField(fieldType: FieldType): TemplateModifierType | undefined {
  if (fieldType === FieldType.datetime) {
    return "datetime";
  }

  if (fieldType === FieldType.integer || fieldType === FieldType.float) {
    return "number";
  }

  return undefined;
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  }
}

const FilamentQRCodePrintingDialog = ({ filamentIds }: FilamentQRCodePrintingDialogProps) => {
  const t = useTranslate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const baseUrlSetting = useGetSetting("base_url");
  const baseUrlRoot =
    baseUrlSetting.data?.value !== undefined && JSON.parse(baseUrlSetting.data?.value) !== ""
      ? JSON.parse(baseUrlSetting.data?.value)
      : window.location.origin;
  const [messageApi, contextHolder] = message.useMessage();
  const [useHTTPUrl, setUseHTTPUrl] = useSavedState("print-useHTTPUrl-filament", false);

  const itemQueries = useGetFilamentsByIds(filamentIds);
  const items = itemQueries.map((itemQuery) => itemQuery.data ?? null).filter((item) => item !== null) as IFilament[];

  const [selectedPresetState, setSelectedPresetState] = useSavedState<string | undefined>(
    "selectedPresetFilament",
    undefined,
  );

  const [localPresets, setLocalPresets] = useState<SpoolQRCodePrintSettings[] | undefined>();
  const remotePresets = useGetPrintPresets("print_presets_filament");
  const setRemotePresets = useSetPrintPresets("print_presets_filament");

  const localOrRemotePresets = localPresets ?? remotePresets;

  const savePresetsRemote = () => {
    if (!localPresets) return;
    setRemotePresets(localPresets);
  };

  const addNewPreset = () => {
    if (!localOrRemotePresets) return;
    const newId = uuidv4();
    const newPreset = {
      labelSettings: {
        printSettings: {
          id: newId,
          name: t("printing.generic.newSetting"),
        },
      },
    };
    setLocalPresets([...localOrRemotePresets, newPreset]);
    setSelectedPresetState(newId);
    return newPreset;
  };
  const duplicateCurrentPreset = () => {
    if (!localOrRemotePresets) return;
    const newPreset = {
      ...curPreset,
      labelSettings: { ...curPreset.labelSettings, printSettings: { ...curPreset.labelSettings.printSettings } },
    };
    newPreset.labelSettings.printSettings.id = uuidv4();
    setLocalPresets([...localOrRemotePresets, newPreset]);
    setSelectedPresetState(newPreset.labelSettings.printSettings.id);
  };
  const updateCurrentPreset = (newSettings: SpoolQRCodePrintSettings) => {
    if (!localOrRemotePresets) return;
    setLocalPresets(
      localOrRemotePresets.map((presets) =>
        presets.labelSettings.printSettings.id === newSettings.labelSettings.printSettings.id ? newSettings : presets,
      ),
    );
  };
  const deleteCurrentPreset = () => {
    if (!localOrRemotePresets) return;
    setLocalPresets(
      localOrRemotePresets.filter((qPreset) => qPreset.labelSettings.printSettings.id !== selectedPresetState),
    );
    setSelectedPresetState(undefined);
  };

  let curPreset: SpoolQRCodePrintSettings;
  if (localOrRemotePresets === undefined) {
    curPreset = {
      labelSettings: {
        printSettings: {
          id: "TEMP",
          name: t("printing.generic.newSetting"),
        },
      },
    };
  } else if (localOrRemotePresets.length === 0) {
    const newSetting = addNewPreset();
    if (!newSetting) {
      console.error("Error adding new setting, this should never happen");
      return;
    }
    localOrRemotePresets.push(newSetting);
    curPreset = newSetting;
  } else if (!selectedPresetState) {
    curPreset = localOrRemotePresets[0];
    setSelectedPresetState(localOrRemotePresets[0].labelSettings.printSettings.id);
  } else {
    const foundSetting = localOrRemotePresets.find(
      (settings) => settings.labelSettings.printSettings.id === selectedPresetState,
    );
    if (foundSetting) {
      curPreset = foundSetting;
    } else {
      curPreset = localOrRemotePresets[0];
      setSelectedPresetState(localOrRemotePresets[0].labelSettings.printSettings.id);
    }
  }

  const [templateHelpOpen, setTemplateHelpOpen] = useState(false);
  const [hoveredCopyValue, setHoveredCopyValue] = useState<string | null>(null);
  const template =
    curPreset.template ??
    `**{vendor.name} - {name}
#{id} - {material}**
{Diameter: {diameter} mm}
{Weight: {weight} g}
{Spool Weight: {spool_weight} g}
{ET: {settings_extruder_temp} °C}
{BT: {settings_bed_temp} °C}
{Article: {article_number}}
{{comment}}
{comment}
{vendor.comment}`;

  const filamentTags: TemplateTagRow[] = [
    { tag: "id" },
    { tag: "registered", modifierType: "datetime" },
    { tag: "name" },
    { tag: "material" },
    { tag: "price", modifierType: "number" },
    { tag: "density", modifierType: "number" },
    { tag: "diameter", modifierType: "number" },
    { tag: "weight", modifierType: "number" },
    { tag: "spool_weight", modifierType: "number" },
    { tag: "article_number" },
    { tag: "comment" },
    { tag: "settings_extruder_temp", modifierType: "number" },
    { tag: "settings_bed_temp", modifierType: "number" },
    { tag: "color_hex" },
    { tag: "multi_color_hexes" },
    { tag: "multi_color_direction" },
    { tag: "external_id" },
  ];
  const filamentFields = useGetFields(EntityType.filament);
  if (filamentFields.data !== undefined) {
    filamentFields.data.forEach((field) => {
      filamentTags.push({ tag: `extra.${field.key}`, modifierType: getModifierTypeForField(field.field_type) });
    });
  }

  const vendorTags: TemplateTagRow[] = [
    { tag: "vendor.id" },
    { tag: "vendor.registered", modifierType: "datetime" },
    { tag: "vendor.name" },
    { tag: "vendor.comment" },
    { tag: "vendor.empty_spool_weight", modifierType: "number" },
    { tag: "vendor.external_id" },
  ];
  const vendorFields = useGetFields(EntityType.vendor);
  if (vendorFields.data !== undefined) {
    vendorFields.data.forEach((field) => {
      vendorTags.push({ tag: `vendor.extra.${field.key}`, modifierType: getModifierTypeForField(field.field_type) });
    });
  }

  const templateTags: TemplateTagTableRow[] = [...filamentTags, ...vendorTags].map((tagRow) => ({
    key: tagRow.tag,
    tag: tagRow.tag,
    modifiers:
      tagRow.modifierType === "datetime"
        ? DATETIME_MODIFIERS
        : tagRow.modifierType === "number"
          ? NUMBER_MODIFIERS
          : [],
    dateOrderSuffixes: tagRow.modifierType === "datetime" ? DATE_ORDER_SUFFIXES : undefined,
  }));

  const tagColumnWidth = getEstimatedColumnWidth(
    templateTags.map((tagRow) => tagRow.tag),
    180,
  );
  const modifierColumnWidth = getEstimatedColumnWidth(
    templateTags.flatMap((tagRow) => {
      if (tagRow.modifiers.length === 0) {
        return [t("printing.qrcode.templateTagDialog.modifiers.none")];
      }
      const samples = [tagRow.modifiers.join(", ")];
      if (tagRow.dateOrderSuffixes) {
        samples.push(
          `${t("printing.qrcode.templateTagDialog.modifiers.dateOrderPrefix")} ${tagRow.dateOrderSuffixes.join(", ")}`,
        );
      }
      return samples;
    }),
    220,
  );
  const tableScrollWidth = tagColumnWidth + modifierColumnWidth;
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1366;
  const desktopMaxDialogWidth = Math.floor(viewportWidth * 0.94);
  const desktopDialogWidth = Math.min(desktopMaxDialogWidth, tableScrollWidth + 64);
  const dialogWidth = isMobile ? "96vw" : desktopDialogWidth;
  const contentWidthForTable = isMobile ? tableScrollWidth : desktopDialogWidth - 32;
  const enableHorizontalTableScroll = isMobile || tableScrollWidth > contentWidthForTable;

  const closeTemplateHelp = () => {
    setTemplateHelpOpen(false);
    setHoveredCopyValue(null);
  };

  const handleCopyValue = async (value: string) => {
    const copied = await copyTextToClipboard(value);
    if (!copied) {
      messageApi.error(t("printing.qrcode.templateTagDialog.copyError"));
      return;
    }
    messageApi.success(t("printing.qrcode.templateTagDialog.copySuccess", { value }));
    closeTemplateHelp();
  };

  return (
    <>
      {contextHolder}
      <QRCodePrintingDialog
        printSettings={curPreset.labelSettings}
        setPrintSettings={(newSettings) => {
          updateCurrentPreset({ ...curPreset, labelSettings: newSettings });
        }}
        baseUrlRoot={baseUrlRoot}
        useHTTPUrl={useHTTPUrl}
        setUseHTTPUrl={setUseHTTPUrl}
        previewValues={{
          default: "WEB+SPOOLMAN:F-{id}",
          url: `${baseUrlRoot}/filament/show/{id}`,
        }}
        extraSettingsStart={
          <>
            <Form.Item label={t("printing.generic.settings")}>
              <Flex gap={8}>
                <Select
                  value={selectedPresetState}
                  onChange={(value) => {
                    setSelectedPresetState(value);
                  }}
                  options={
                    localOrRemotePresets &&
                    localOrRemotePresets.map((settings) => ({
                      label: settings.labelSettings.printSettings?.name || t("printing.generic.defaultSettings"),
                      value: settings.labelSettings.printSettings.id,
                    }))
                  }
                ></Select>
                <Button
                  style={{ width: "3em" }}
                  icon={<PlusOutlined />}
                  title={t("printing.generic.addSettings")}
                  onClick={addNewPreset}
                />
                <Button
                  style={{ width: "3em" }}
                  icon={<CopyOutlined />}
                  title={t("printing.generic.duplicateSettings")}
                  onClick={duplicateCurrentPreset}
                />
                {localOrRemotePresets && localOrRemotePresets.length > 1 && (
                  <Popconfirm
                    title={t("printing.generic.deleteSettings")}
                    description={t("printing.generic.deleteSettingsConfirm")}
                    onConfirm={deleteCurrentPreset}
                    okText={t("buttons.delete")}
                    cancelText={t("buttons.cancel")}
                  >
                    <Button
                      style={{ width: "3em" }}
                      danger
                      icon={<DeleteOutlined />}
                      title={t("printing.generic.deleteSettings")}
                    />
                  </Popconfirm>
                )}
              </Flex>
            </Form.Item>
            <Form.Item label={t("printing.generic.settingsName")}>
              <Input
                value={curPreset.labelSettings.printSettings?.name}
                onChange={(e) => {
                  // Triple-spread: name is 3 levels deep; each level must be copied to
                  // avoid mutating the preset array element referenced by curPreset.
                  updateCurrentPreset({
                    ...curPreset,
                    labelSettings: {
                      ...curPreset.labelSettings,
                      printSettings: { ...curPreset.labelSettings.printSettings, name: e.target.value },
                    },
                  });
                }}
              />
            </Form.Item>
          </>
        }
        items={items.map((filament) => ({
          value: useHTTPUrl ? `${baseUrlRoot}/filament/show/${filament.id}` : `WEB+SPOOLMAN:F-${filament.id}`,
          label: (
            <p
              style={{
                padding: "1mm 1mm 1mm 0",
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {renderLabelContents(template, filament)}
            </p>
          ),
          errorLevel: "H",
        }))}
        extraSettings={
          <>
            <Form.Item label={t("printing.qrcode.template")}>
              <TextArea
                value={template}
                rows={8}
                onChange={(newValue) => {
                  updateCurrentPreset({ ...curPreset, template: newValue.target.value });
                }}
              />
            </Form.Item>
            <Modal
              title={
                <div>
                  <div>{t("printing.qrcode.templateTagDialog.title")}</div>
                  <Text type="secondary" style={{ fontSize: 12, fontWeight: "normal" }}>
                    {t("printing.qrcode.templateTagDialog.copyHint")}
                  </Text>
                </div>
              }
              open={templateHelpOpen}
              footer={null}
              width={dialogWidth}
              onCancel={closeTemplateHelp}
            >
              <Table
                size="small"
                pagination={false}
                scroll={{ x: enableHorizontalTableScroll ? tableScrollWidth : undefined, y: isMobile ? 360 : 400 }}
                rowKey="key"
                columns={[
                  {
                    title: t("printing.qrcode.templateTagDialog.columns.tag"),
                    dataIndex: "tag",
                    width: tagColumnWidth,
                    onCell: () => ({ style: { whiteSpace: "nowrap" } }),
                    render: (tag: string) => (
                      <Text
                        code
                        style={{ whiteSpace: "nowrap", fontSize: 12, cursor: "pointer" }}
                        onMouseEnter={() => setHoveredCopyValue(`{${tag}}`)}
                        onMouseLeave={() => setHoveredCopyValue(null)}
                        onClick={() => void handleCopyValue(`{${tag}}`)}
                      >
                        {tag}
                      </Text>
                    ),
                  },
                  {
                    title: t("printing.qrcode.templateTagDialog.columns.modifiers"),
                    dataIndex: "modifiers",
                    width: modifierColumnWidth,
                    onCell: () => ({ style: { whiteSpace: "nowrap" } }),
                    render: (modifiers: readonly string[], row: TemplateTagTableRow) =>
                      modifiers.length > 0 ? (
                        <div>
                          <Flex gap={6} wrap="wrap">
                            {modifiers.map((modifier) => {
                              const copyValue = `{${row.tag}${modifier}}`;
                              return (
                                <Text
                                  key={`${row.key}-${modifier}`}
                                  code
                                  style={{ whiteSpace: "nowrap", fontSize: 12, cursor: "pointer" }}
                                  onMouseEnter={() => setHoveredCopyValue(copyValue)}
                                  onMouseLeave={() => setHoveredCopyValue(null)}
                                  onClick={() => void handleCopyValue(copyValue)}
                                >
                                  {modifier}
                                </Text>
                              );
                            })}
                          </Flex>
                          {row.dateOrderSuffixes && (
                            <Text type="secondary" style={{ display: "block", fontSize: 11, marginTop: 4 }}>
                              {t("printing.qrcode.templateTagDialog.modifiers.dateOrderPrefix")}{" "}
                              {row.dateOrderSuffixes.join(", ")}
                            </Text>
                          )}
                        </div>
                      ) : (
                        <Text code style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                          {t("printing.qrcode.templateTagDialog.modifiers.none")}
                        </Text>
                      ),
                  },
                ]}
                dataSource={templateTags}
              />
              <Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 11 }}>
                {hoveredCopyValue
                  ? `${t("printing.qrcode.templateTagDialog.hoverCopyPrefix")} `
                  : t("printing.qrcode.templateTagDialog.hoverHint")}
                {hoveredCopyValue && (
                  <>
                    <Text code style={{ fontSize: 11 }}>
                      {hoveredCopyValue}
                    </Text>{" "}
                    {t("printing.qrcode.templateTagDialog.hoverCopySuffix")}
                  </>
                )}
              </Text>
            </Modal>
            <div>
              <Text type="secondary" style={{ display: "block", fontSize: 12, lineHeight: 1.6 }}>
                {t("printing.qrcode.templateHelpFilament")}
              </Text>
              <Flex gap={8} wrap="wrap" style={{ marginTop: 6 }}>
                <Button size="small" onClick={() => setTemplateHelpOpen(true)}>
                  {t("printing.qrcode.templateTagButton")}
                </Button>
                <Link to="/help#template-syntax">
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t("printing.qrcode.templateHelpLink")}
                  </Text>
                </Link>
              </Flex>
            </div>
          </>
        }
        extraButtons={
          <Button
            type="primary"
            size="large"
            icon={<SaveOutlined />}
            onClick={() => {
              savePresetsRemote();
              messageApi.success(t("notifications.saveSuccessful"));
            }}
          >
            {t("printing.generic.saveSetting")}
          </Button>
        }
      />
    </>
  );
};

export default FilamentQRCodePrintingDialog;
