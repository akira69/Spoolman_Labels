import { CopyOutlined, DeleteOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { useTranslate } from "@refinedev/core";
import { Button, Flex, Form, Input, Modal, Popconfirm, Select, Table, Typography, message } from "antd";
import TextArea from "antd/es/input/TextArea";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { EntityType, useGetFields } from "../../utils/queryFields";
import { useGetSetting } from "../../utils/querySettings";
import { useSavedState } from "../../utils/saveload";
import { useGetSpoolsByIds } from "../spools/functions";
import { ISpool } from "../spools/model";
import {
  SpoolQRCodePrintSettings,
  renderLabelContents,
  renderTemplateText,
  useGetPrintSettings as useGetPrintPresets,
  useSetPrintSettings as useSetPrintPresets,
} from "./printing";
import QRCodeExportDialog from "./qrCodeExportDialog";

const { Text } = Typography;

interface SpoolQRCodeExportDialog {
  spoolIds: number[];
}

const SpoolQRCodeExportDialog = ({ spoolIds }: SpoolQRCodeExportDialog) => {
  const t = useTranslate();
  const currentPresetType = "spool";
  const otherPresetType = "filament";
  const defaultPresetName = t("printing.generic.defaultSettings");
  const isDefaultPresetName = (name?: string) => {
    const normalizedName = (name ?? "").trim().toLowerCase();
    const normalizedDefault = defaultPresetName.trim().toLowerCase();
    return normalizedName === normalizedDefault || normalizedName === "default";
  };
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const getNextPresetName = (baseName: string, presets: SpoolQRCodePrintSettings[]) => {
    const trimmedBaseName = baseName.trim() || defaultPresetName;
    const normalizedBaseName = trimmedBaseName.replace(/-\d{2}$/u, "");
    const suffixPattern = new RegExp(`^${escapeRegExp(normalizedBaseName)}-(\\d{2})$`, "u");
    let maxSuffix = 0;
    for (const preset of presets) {
      const presetName = (preset.labelSettings.printSettings?.name ?? "").trim();
      const match = presetName.match(suffixPattern);
      if (!match) continue;
      maxSuffix = Math.max(maxSuffix, Number.parseInt(match[1], 10));
    }
    return `${normalizedBaseName}-${String(maxSuffix + 1).padStart(2, "0")}`;
  };
  const buildNewPreset = (id: string, name: string, sourcePreset?: SpoolQRCodePrintSettings): SpoolQRCodePrintSettings => {
    const copiedSourcePrintSettings = sourcePreset?.labelSettings?.printSettings ?? {};
    return {
      ...sourcePreset,
      labelSettings: {
        ...sourcePreset?.labelSettings,
        printSettings: {
          ...copiedSourcePrintSettings,
          id,
          name,
        },
      },
    };
  };

  const toPresetValue = (type: "spool" | "filament", id: string) => `${type}:${id}`;
  const parsePresetValue = (value?: string): { type: "spool" | "filament"; id: string } | undefined => {
    if (!value) return undefined;
    const separatorIndex = value.indexOf(":");
    if (separatorIndex < 0) return { type: currentPresetType, id: value };
    const type = value.slice(0, separatorIndex);
    const id = value.slice(separatorIndex + 1);
    if ((type === currentPresetType || type === otherPresetType) && id) {
      return { type, id };
    }
    return undefined;
  };

  const baseUrlSetting = useGetSetting("base_url");
  const baseUrlRoot =
    baseUrlSetting.data?.value !== undefined && JSON.parse(baseUrlSetting.data?.value) !== ""
      ? JSON.parse(baseUrlSetting.data?.value)
      : window.location.origin;
  const [messageApi, contextHolder] = message.useMessage();
  const [useHTTPUrl, setUseHTTPUrl] = useSavedState("export-useHTTPUrl", false);

  const itemQueries = useGetSpoolsByIds(spoolIds);
  const items = itemQueries
    .map((itemQuery) => {
      return itemQuery.data ?? null;
    })
    .filter((item) => item !== null) as ISpool[];

  const [selectedPresetState, setSelectedPresetState] = useSavedState<string | undefined>(
    "selectedImagePresetSpool",
    undefined,
  );

  const [localCurrentPresets, setLocalCurrentPresets] = useState<SpoolQRCodePrintSettings[] | undefined>();
  const remoteSpoolPresets = useGetPrintPresets("image_presets");
  const remoteFilamentPresets = useGetPrintPresets("image_presets_filament");
  const setRemoteSpoolPresets = useSetPrintPresets("image_presets");

  const currentPresets = localCurrentPresets ?? remoteSpoolPresets;
  const otherPresets = remoteFilamentPresets ?? [];

  const savePresetsRemote = async () => {
    if (!localCurrentPresets) return;
    await setRemoteSpoolPresets(localCurrentPresets);
    setLocalCurrentPresets(undefined);
  };

  const getSelectedPreset = () => {
    const parsed = parsePresetValue(selectedPresetState);
    if (!parsed) return undefined;
    if (parsed.type === currentPresetType) {
      return currentPresets?.find((settings) => settings.labelSettings.printSettings.id === parsed.id);
    }
    return otherPresets.find((settings) => settings.labelSettings.printSettings.id === parsed.id);
  };

  const promotePresetToCurrentType = (preset: SpoolQRCodePrintSettings): SpoolQRCodePrintSettings | undefined => {
    if (!currentPresets) return;
    const promotedPreset: SpoolQRCodePrintSettings = {
      ...preset,
      labelSettings: {
        ...preset.labelSettings,
        printSettings: {
          ...preset.labelSettings.printSettings,
          id: uuidv4(),
        },
      },
    };
    const nextPresets = [...currentPresets, promotedPreset];
    setLocalCurrentPresets(nextPresets);
    setSelectedPresetState(toPresetValue(currentPresetType, promotedPreset.labelSettings.printSettings.id));
    return promotedPreset;
  };

  const addNewPreset = () => {
    if (!currentPresets) return;
    const newId = uuidv4();
    const selectedPreset = getSelectedPreset();
    const basePresetName = selectedPreset?.labelSettings.printSettings?.name ?? defaultPresetName;
    const nextPresetName = getNextPresetName(basePresetName, currentPresets);
    const newPreset = buildNewPreset(newId, nextPresetName, selectedPreset);
    setLocalCurrentPresets([...currentPresets, newPreset]);
    setSelectedPresetState(toPresetValue(currentPresetType, newId));
    return newPreset;
  };
  const duplicateCurrentPreset = () => {
    if (!currentPresets) return;
    const newPreset = {
      ...curPreset,
      labelSettings: { ...curPreset.labelSettings, printSettings: { ...curPreset.labelSettings.printSettings } },
    };
    newPreset.labelSettings.printSettings.id = uuidv4();
    setLocalCurrentPresets([...currentPresets, newPreset]);
    setSelectedPresetState(toPresetValue(currentPresetType, newPreset.labelSettings.printSettings.id));
  };
  const updateCurrentPreset = (newSettings: SpoolQRCodePrintSettings) => {
    if (!currentPresets) return;
    const parsed = parsePresetValue(selectedPresetState);
    if (!parsed || parsed.type !== currentPresetType) {
      promotePresetToCurrentType(newSettings);
      return;
    }

    let foundPreset = false;
    const nextPresets = currentPresets.map((presets) => {
      if (presets.labelSettings.printSettings.id === parsed.id) {
        foundPreset = true;
        return newSettings;
      }
      return presets;
    });
    setLocalCurrentPresets(nextPresets);
    if (!foundPreset) {
      promotePresetToCurrentType(newSettings);
    }
  };
  const deleteCurrentPreset = () => {
    if (!currentPresets) return;
    const parsed = parsePresetValue(selectedPresetState);
    if (!parsed || parsed.type !== currentPresetType) return;
    setLocalCurrentPresets(
      currentPresets.filter((qPreset) => qPreset.labelSettings.printSettings.id !== parsed.id),
    );
    setSelectedPresetState(undefined);
  };

  let curPreset: SpoolQRCodePrintSettings;
  if (currentPresets === undefined) {
    curPreset = {
      labelSettings: {
        printSettings: {
          id: "TEMP",
          name: defaultPresetName,
        },
      },
    };
  } else {
    if (currentPresets.length === 0) {
      const defaultId = uuidv4();
      const defaultPreset = buildNewPreset(defaultId, defaultPresetName);
      setLocalCurrentPresets([defaultPreset]);
      setSelectedPresetState(toPresetValue(currentPresetType, defaultId));
      curPreset = defaultPreset;
    } else {
      const parsedSelectedPreset = parsePresetValue(selectedPresetState);
      if (parsedSelectedPreset && parsedSelectedPreset.type === otherPresetType) {
        const importedPreset = otherPresets.find(
          (settings) => settings.labelSettings.printSettings.id === parsedSelectedPreset.id,
        );
        if (importedPreset) {
          curPreset = {
            ...importedPreset,
            labelSettings: {
              ...importedPreset.labelSettings,
              printSettings: { ...importedPreset.labelSettings.printSettings },
            },
          };
        } else {
          const preferredPreset =
            currentPresets.find((settings) => isDefaultPresetName(settings.labelSettings.printSettings?.name)) ??
            currentPresets[0];
          curPreset = preferredPreset;
          setSelectedPresetState(toPresetValue(currentPresetType, preferredPreset.labelSettings.printSettings.id));
        }
      } else if (parsedSelectedPreset) {
        const foundSetting = currentPresets.find(
          (settings) => settings.labelSettings.printSettings.id === parsedSelectedPreset.id,
        );
        if (foundSetting) {
          curPreset = foundSetting;
        } else {
          const preferredPreset =
            currentPresets.find((settings) => isDefaultPresetName(settings.labelSettings.printSettings?.name)) ??
            currentPresets[0];
          curPreset = preferredPreset;
          setSelectedPresetState(toPresetValue(currentPresetType, preferredPreset.labelSettings.printSettings.id));
        }
      } else {
        const preferredPreset =
          currentPresets.find((settings) => isDefaultPresetName(settings.labelSettings.printSettings?.name)) ??
          currentPresets[0];
        curPreset = preferredPreset;
        setSelectedPresetState(toPresetValue(currentPresetType, preferredPreset.labelSettings.printSettings.id));
      }
    }
  }

  const hasUnsavedChanges =
    localCurrentPresets !== undefined && JSON.stringify(localCurrentPresets) !== JSON.stringify(remoteSpoolPresets ?? []);

  const [templateHelpOpen, setTemplateHelpOpen] = useState(false);
  const titleTemplate = curPreset.titleTemplate ?? `==**{filament.name}**== {filament.color_hex}`;
  const infoTemplate =
    curPreset.template ??
    `{filament.material} ({filament.article_number})
Spool ID: #{id}
Spool Weight: {filament.spool_weight} g
{ET: {filament.settings_extruder_temp} °C}
{BT: {filament.settings_bed_temp} °C}
{Lot Nr: {lot_nr}}
{{comment}}
{filament.comment}
{filament.vendor.comment}`;
  const filenameTemplate =
    curPreset.filenameTemplate ?? `{filament.vendor.name}-{filament.material}-{filament.name}-{id}`;

  const spoolTags = [
    { tag: "id" },
    { tag: "registered" },
    { tag: "first_used" },
    { tag: "last_used" },
    { tag: "price" },
    { tag: "initial_weight" },
    { tag: "spool_weight" },
    { tag: "remaining_weight" },
    { tag: "used_weight" },
    { tag: "remaining_length" },
    { tag: "used_length" },
    { tag: "location" },
    { tag: "lot_nr" },
    { tag: "comment" },
    { tag: "archived" },
  ];
  const spoolFields = useGetFields(EntityType.spool);
  if (spoolFields.data !== undefined) {
    spoolFields.data.forEach((field) => {
      spoolTags.push({ tag: `extra.${field.key}` });
    });
  }
  const filamentTags = [
    { tag: "filament.id" },
    { tag: "filament.registered" },
    { tag: "filament.name" },
    { tag: "filament.material" },
    { tag: "filament.price" },
    { tag: "filament.density" },
    { tag: "filament.diameter" },
    { tag: "filament.weight" },
    { tag: "filament.spool_weight" },
    { tag: "filament.article_number" },
    { tag: "filament.comment" },
    { tag: "filament.settings_extruder_temp" },
    { tag: "filament.settings_bed_temp" },
    { tag: "filament.color_hex" },
    { tag: "filament.multi_color_hexes" },
    { tag: "filament.multi_color_direction" },
    { tag: "filament.external_id" },
  ];
  const filamentFields = useGetFields(EntityType.filament);
  if (filamentFields.data !== undefined) {
    filamentFields.data.forEach((field) => {
      filamentTags.push({ tag: `filament.extra.${field.key}` });
    });
  }
  const vendorTags = [
    { tag: "filament.vendor.id" },
    { tag: "filament.vendor.registered" },
    { tag: "filament.vendor.name" },
    { tag: "filament.vendor.comment" },
    { tag: "filament.vendor.empty_spool_weight" },
    { tag: "filament.vendor.external_id" },
  ];
  const vendorFields = useGetFields(EntityType.vendor);
  if (vendorFields.data !== undefined) {
    vendorFields.data.forEach((field) => {
      vendorTags.push({ tag: `filament.vendor.extra.${field.key}` });
    });
  }

  const templateTags = [...spoolTags, ...filamentTags, ...vendorTags];

  return (
    <>
      {contextHolder}
      <QRCodeExportDialog
        printSettings={curPreset.labelSettings}
        setPrintSettings={(newSettings) => {
          curPreset.labelSettings = newSettings;
          updateCurrentPreset(curPreset);
        }}
        baseUrlRoot={baseUrlRoot}
        useHTTPUrl={useHTTPUrl}
        setUseHTTPUrl={setUseHTTPUrl}
        previewValues={{
          default: "WEB+SPOOLMAN:S-{id}",
          url: `${baseUrlRoot}/spool/show/{id}`,
        }}
        zipFileTypeName="spool"
        extraSettingsStart={
          <>
            <Form.Item label={t("printing.generic.spoolImagePresets")}>
              <Flex gap={8}>
                <Select
                  value={
                    selectedPresetState
                      ? selectedPresetState.includes(":")
                        ? selectedPresetState
                        : toPresetValue(currentPresetType, selectedPresetState)
                      : undefined
                  }
                  onChange={(value) => {
                    const parsed = parsePresetValue(value);
                    if (!parsed) return;
                    setSelectedPresetState(value);
                  }}
                  options={
                    currentPresets
                      ? [
                          {
                            label: t("printing.generic.spoolImagePresets"),
                            options: currentPresets.map((settings) => ({
                              label: settings.labelSettings.printSettings?.name || t("printing.generic.defaultSettings"),
                              value: toPresetValue(currentPresetType, settings.labelSettings.printSettings.id),
                            })),
                          },
                          {
                            label: t("printing.generic.filamentImagePresets"),
                            options: otherPresets.map((settings) => ({
                              label: settings.labelSettings.printSettings?.name || t("printing.generic.defaultSettings"),
                              value: toPresetValue(otherPresetType, settings.labelSettings.printSettings.id),
                            })),
                          },
                        ]
                      : []
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
                {currentPresets && currentPresets.length > 1 && (
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
                  curPreset.labelSettings.printSettings.name = e.target.value;
                  updateCurrentPreset(curPreset);
                }}
              />
            </Form.Item>
          </>
        }
        items={items.map((spool) => ({
          value: useHTTPUrl ? `${baseUrlRoot}/spool/show/${spool.id}` : `WEB+SPOOLMAN:S-${spool.id}`,
          amlName: renderTemplateText(filenameTemplate, spool),
          vendor: spool.filament.vendor,
          title: <>{renderLabelContents(titleTemplate, spool)}</>,
          label: <>{renderLabelContents(infoTemplate, spool)}</>,
          errorLevel: "H",
        }))}
        extraExportSettings={
          <Form.Item label={t("printing.qrcode.filenameTemplate")} tooltip={t("printing.qrcode.filenameTemplateTooltipSpool")}>
            <Input
              value={filenameTemplate}
              onChange={(newValue) => {
                curPreset.filenameTemplate = newValue.target.value;
                updateCurrentPreset(curPreset);
              }}
            />
          </Form.Item>
        }
        extraTitleSettings={
          <Form.Item label={t("printing.qrcode.titleTemplate")} tooltip={t("printing.qrcode.titleTemplateTooltipSpool")}>
            <TextArea
              value={titleTemplate}
              rows={4}
              onChange={(newValue) => {
                curPreset.titleTemplate = newValue.target.value;
                updateCurrentPreset(curPreset);
              }}
            />
          </Form.Item>
        }
        extraInfoSettings={
          <>
            <Form.Item label={t("printing.qrcode.infoTemplate")}>
              <TextArea
                value={infoTemplate}
                rows={8}
                onChange={(newValue) => {
                  curPreset.template = newValue.target.value;
                  updateCurrentPreset(curPreset);
                }}
              />
            </Form.Item>
            <Modal open={templateHelpOpen} footer={null} onCancel={() => setTemplateHelpOpen(false)}>
              <Table
                size="small"
                showHeader={false}
                pagination={false}
                scroll={{ y: 400 }}
                columns={[{ dataIndex: "tag" }]}
                dataSource={templateTags}
              />
            </Modal>
            <Text type="secondary">
              {t("printing.qrcode.templateHelp")}{" "}
              <Button size="small" onClick={() => setTemplateHelpOpen(true)}>
                {t("actions.show")}
              </Button>
            </Text>
          </>
        }
        extraButtons={
          <>
            <Button
              type={hasUnsavedChanges ? "primary" : "default"}
              size="large"
              icon={<SaveOutlined />}
              disabled={!hasUnsavedChanges}
              onClick={async () => {
                try {
                  await savePresetsRemote();
                  messageApi.success(t("notifications.saveSuccessful"));
                } catch (error) {
                  messageApi.error(error instanceof Error ? error.message : "Save failed");
                }
              }}
            >
              {t("printing.generic.savePreset")}
            </Button>
          </>
        }
      />
    </>
  );
};

export default SpoolQRCodeExportDialog;
