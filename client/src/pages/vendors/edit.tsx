import { Edit, useForm } from "@refinedev/antd";
import { HttpError, useTranslate } from "@refinedev/core";
import { CloseCircleOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import {
  Alert,
  AutoComplete,
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Tooltip,
  message,
  Typography,
} from "antd";
import TextArea from "antd/es/input/TextArea";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { ExtraFieldFormItem, ParsedExtras, StringifiedExtras } from "../../components/extraFields";
import { useVendorLogoManifest } from "../../components/otherModels";
import VendorLogo from "../../components/vendorLogo";
import { EntityType, useGetFields } from "../../utils/queryFields";
import { getAPIURL } from "../../utils/url";
import { suggestVendorLogoOptions, suggestVendorLogoPaths } from "../../utils/vendorLogo";
import { IVendor, IVendorParsedExtras } from "./model";

/*
The API returns the extra fields as JSON values, but we need to parse them into their real types
in order for Ant design's form to work properly. ParsedExtras does this for us.
We also need to stringify them again before sending them back to the API, which is done by overriding
the form's onFinish method. Form.Item's normalize should do this, but it doesn't seem to work.
*/

export const VendorEdit = () => {
  const { Text } = Typography;
  const t = useTranslate();
  const [messageApi, contextHolder] = message.useMessage();
  const [hasChanged, setHasChanged] = useState(false);
  const [allowAutoSuggest, setAllowAutoSuggest] = useState(true);
  const [isSyncingLogoPack, setIsSyncingLogoPack] = useState(false);
  const [savedComparableState, setSavedComparableState] = useState<string | null>(null);
  const extraFields = useGetFields(EntityType.vendor);
  const logoManifest = useVendorLogoManifest();

  const { formProps, saveButtonProps } = useForm<IVendor, HttpError, IVendor, IVendor>({
    liveMode: "manual",
    redirect: false,
    onLiveEvent() {
      // Warn the user if the vendor has been updated since the form was opened
      messageApi.warning(t("vendor.form.vendor_updated"));
      setHasChanged(true);
    },
    onMutationSuccess: () => {
      if (watchedComparableState) {
        setSavedComparableState(watchedComparableState);
      }
    },
  });

  // Parse the extra fields from string values into real types
  if (formProps.initialValues) {
    formProps.initialValues = ParsedExtras(formProps.initialValues);
  }

  // Override the form's onFinish method to stringify the extra fields
  const originalOnFinish = formProps.onFinish;
  formProps.onFinish = (allValues: IVendorParsedExtras) => {
    if (allValues !== undefined && allValues !== null) {
      const cleanedValues: IVendorParsedExtras = {
        ...allValues,
        extra: { ...(allValues.extra ?? {}) },
      };
      for (const key of ["logo_url", "print_logo_url"]) {
        const rawValue = cleanedValues.extra?.[key];
        if (typeof rawValue !== "string") {
          delete cleanedValues.extra?.[key];
          continue;
        }
        const trimmedValue = rawValue.trim();
        if (trimmedValue === "") {
          delete cleanedValues.extra?.[key];
          continue;
        }
        cleanedValues.extra![key] = trimmedValue;
      }
      // Lot of stupidity here to make types work
      const stringifiedAllValues = StringifiedExtras<IVendorParsedExtras>(cleanedValues);
      originalOnFinish?.({
        extra: {},
        ...stringifiedAllValues,
      });
    }
  };

  const watchedAllValues = Form.useWatch([], formProps.form);
  const watchedName = Form.useWatch(["name"], formProps.form);
  const watchedExtra = Form.useWatch(["extra"], formProps.form) as { [key: string]: unknown } | undefined;
  const logoUrlValue = typeof watchedExtra?.logo_url === "string" ? watchedExtra.logo_url.trim() : "";
  const printLogoUrlValue = typeof watchedExtra?.print_logo_url === "string" ? watchedExtra.print_logo_url.trim() : "";
  const hasCustomWebLogo = logoUrlValue !== "";
  const hasCustomPrintLogo = printLogoUrlValue !== "";
  const logoPreviewVendor: IVendor = {
    id: 0,
    registered: "",
    name: watchedName ?? "",
    extra: {
      logo_url: typeof watchedExtra?.logo_url === "string" ? watchedExtra.logo_url : "",
      print_logo_url: typeof watchedExtra?.print_logo_url === "string" ? watchedExtra.print_logo_url : "",
    },
  };
  const webLogoOptions = (logoManifest.data?.web_files ?? []).map((value) => ({ value }));
  const printLogoOptions = (logoManifest.data?.print_files ?? []).map((value) => ({ value }));
  const logoUrlLabel = (
    <>
      {t("vendor.fields.logo_url")}{" "}
      <Tooltip title={t("vendor.fields_help.logo_url")}>
        <QuestionCircleOutlined />
      </Tooltip>
    </>
  );
  const printLogoUrlLabel = (
    <>
      {t("vendor.fields.print_logo_url")}{" "}
      <Tooltip title={t("vendor.fields_help.print_logo_url")}>
        <QuestionCircleOutlined />
      </Tooltip>
    </>
  );
  const webSuggestions =
    watchedName && logoManifest.data ? suggestVendorLogoOptions(watchedName, logoManifest.data, "web") : [];
  const printSuggestions =
    watchedName && logoManifest.data ? suggestVendorLogoOptions(watchedName, logoManifest.data, "print") : [];
  const autoSuggestedPaths = useMemo(() => {
    if (!watchedName || !logoManifest.data) {
      return { webPath: undefined, printPath: undefined };
    }
    return suggestVendorLogoPaths(watchedName, logoManifest.data);
  }, [watchedName, logoManifest.data]);
  const hasAutoWebLogo = !!autoSuggestedPaths.webPath && logoUrlValue === autoSuggestedPaths.webPath;
  const hasAutoPrintLogo = !!autoSuggestedPaths.printPath && printLogoUrlValue === autoSuggestedPaths.printPath;
  const noneOptionValue = "__none__";
  const clearLogoField = (field: "logo_url" | "print_logo_url") => {
    setAllowAutoSuggest(false);
    formProps.form?.setFieldValue(["extra", field], "");
  };

  const normalizeForCompare = (value: unknown): unknown => {
    if (dayjs.isDayjs(value)) {
      return value.toISOString();
    }
    if (Array.isArray(value)) {
      return value.map(normalizeForCompare);
    }
    if (value && typeof value === "object") {
      const objValue = value as Record<string, unknown>;
      return Object.keys(objValue)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          const normalizedValue = normalizeForCompare(objValue[key]);
          if (normalizedValue !== undefined) {
            acc[key] = normalizedValue;
          }
          return acc;
        }, {});
    }
    return value;
  };

  const toComparableState = (value: unknown): string => {
    const normalized = normalizeForCompare(value) as Record<string, unknown> | undefined;
    const normalizedExtra = { ...(normalized?.extra as Record<string, unknown> | undefined) };
    const normalizeLogoValue = (logoValue: unknown): string | undefined => {
      if (typeof logoValue !== "string") {
        return undefined;
      }
      const trimmed = logoValue.trim();
      return trimmed === "" ? undefined : trimmed;
    };
    const cleanedLogo = normalizeLogoValue(normalizedExtra.logo_url);
    const cleanedPrintLogo = normalizeLogoValue(normalizedExtra.print_logo_url);
    if (cleanedLogo === undefined) {
      delete normalizedExtra.logo_url;
    } else {
      normalizedExtra.logo_url = cleanedLogo;
    }
    if (cleanedPrintLogo === undefined) {
      delete normalizedExtra.print_logo_url;
    } else {
      normalizedExtra.print_logo_url = cleanedPrintLogo;
    }

    return JSON.stringify({
      name: normalized?.name ?? "",
      comment: normalized?.comment ?? "",
      empty_spool_weight: normalized?.empty_spool_weight ?? null,
      external_id: normalized?.external_id ?? "",
      extra: normalizedExtra,
    });
  };

  const initialComparableState = useMemo(() => {
    if (!formProps.initialValues) {
      return null;
    }
    return toComparableState(formProps.initialValues);
  }, [formProps.initialValues]);

  useEffect(() => {
    if (initialComparableState !== null) {
      setSavedComparableState(initialComparableState);
    }
  }, [initialComparableState]);

  const watchedComparableState = useMemo(() => {
    if (!watchedAllValues) {
      return null;
    }
    return toComparableState(watchedAllValues);
  }, [watchedAllValues]);

  const hasFormChanges = useMemo(() => {
    if (!savedComparableState || !watchedComparableState) {
      return false;
    }
    return savedComparableState !== watchedComparableState;
  }, [savedComparableState, watchedComparableState]);

  const syncLogoPackFromGithub = async () => {
    setIsSyncingLogoPack(true);
    try {
      const response = await fetch(getAPIURL() + "/vendor/logo-pack/sync-from-github", {
        method: "POST",
      });
      const body = (await response.json()) as {
        updated?: boolean;
        web_logo_count?: number;
        print_logo_count?: number;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(body.message ?? t("settings.general.logo_sync.github_load_error"));
      }

      await logoManifest.refetch();

      messageApi.success(
        body.updated
          ? t("settings.general.logo_sync.github_done_updated", {
              web: body.web_logo_count ?? 0,
              print: body.print_logo_count ?? 0,
            })
          : t("settings.general.logo_sync.github_done_no_changes", {
              web: body.web_logo_count ?? 0,
              print: body.print_logo_count ?? 0,
            }),
      );
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : t("settings.general.logo_sync.github_load_error"));
    } finally {
      setIsSyncingLogoPack(false);
    }
  };

  useEffect(() => {
    if (!allowAutoSuggest || !watchedName || !logoManifest.data || !formProps.form) {
      return;
    }
    if (hasCustomWebLogo && hasCustomPrintLogo) {
      return;
    }
    if (!hasCustomWebLogo && autoSuggestedPaths.webPath && logoUrlValue !== autoSuggestedPaths.webPath) {
      formProps.form.setFieldValue(["extra", "logo_url"], autoSuggestedPaths.webPath);
    }
    if (
      !hasCustomPrintLogo &&
      autoSuggestedPaths.printPath &&
      printLogoUrlValue !== autoSuggestedPaths.printPath
    ) {
      formProps.form.setFieldValue(["extra", "print_logo_url"], autoSuggestedPaths.printPath);
    }
  }, [
    allowAutoSuggest,
    watchedName,
    logoManifest.data,
    hasCustomWebLogo,
    hasCustomPrintLogo,
    autoSuggestedPaths.webPath,
    autoSuggestedPaths.printPath,
    logoUrlValue,
    printLogoUrlValue,
    formProps.form,
  ]);

  const saveButtonState = {
    ...saveButtonProps,
    type: hasFormChanges ? ("primary" as const) : ("default" as const),
    disabled: saveButtonProps.disabled || !hasFormChanges,
  };
  const registeredDisplay = formProps.initialValues?.registered
    ? dayjs(formProps.initialValues.registered).format("YYYY-MM-DD HH:mm:ss")
    : "-";

  return (
    <Edit
      saveButtonProps={saveButtonState}
      footerButtons={({ defaultButtons }) => (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            right: 92,
            zIndex: 1200,
            display: "flex",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 10,
            background: "rgba(17, 17, 17, 0.88)",
            backdropFilter: "blur(4px)",
          }}
        >
          {defaultButtons}
        </div>
      )}
    >
      {contextHolder}
      <Form {...formProps} layout="vertical">
        <Row gutter={16} align="top">
          <Col xs={24} lg={15}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>{`${t("vendor.fields.id")}: ${formProps.initialValues?.id ?? "-"}`}</Text>
              <Text type="secondary" style={{ marginLeft: 16 }}>
                {`${t("vendor.fields.registered")} ${registeredDisplay}`}
              </Text>
            </div>
            <Form.Item
              label={t("vendor.fields.name")}
              name={["name"]}
              rules={[
                {
                  required: true,
                },
              ]}
            >
              <Input maxLength={64} />
            </Form.Item>
            <Form.Item
              label={t("vendor.fields.empty_spool_weight")}
              help={t("vendor.fields_help.empty_spool_weight")}
              name={["empty_spool_weight"]}
              rules={[
                {
                  required: false,
                  type: "number",
                  min: 0,
                },
              ]}
            >
              <InputNumber addonAfter="g" precision={1} />
            </Form.Item>
            <Form.Item
              label={t("vendor.fields.external_id")}
              name={["external_id"]}
              rules={[
                {
                  required: false,
                },
              ]}
            >
              <Input maxLength={64} />
            </Form.Item>
            <Form.Item
              label={t("vendor.fields.comment")}
              name={["comment"]}
              rules={[
                {
                  required: false,
                },
              ]}
            >
              <TextArea maxLength={1024} />
            </Form.Item>
            <Typography.Title level={5}>{t("settings.extra_fields.tab")}</Typography.Title>
            {extraFields.data?.map((field, index) => (
              <ExtraFieldFormItem key={index} field={field} />
            ))}
          </Col>
          <Col xs={24} lg={9}>
            <Form.Item label={logoUrlLabel}>
              <Space.Compact style={{ width: "100%" }}>
                <Form.Item
                  name={["extra", "logo_url"]}
                  noStyle
                  rules={[
                    {
                      required: false,
                      type: "string",
                    },
                  ]}
                >
                  <AutoComplete
                    style={{ width: "100%" }}
                    options={webLogoOptions}
                    placeholder="/vendor-logos/web/vendor.png"
                    onChange={() => setAllowAutoSuggest(false)}
                  />
                </Form.Item>
                <Tooltip title={t("vendor.buttons.clear_logo_url")}>
                  <Button htmlType="button" icon={<CloseCircleOutlined />} onClick={() => clearLogoField("logo_url")} />
                </Tooltip>
              </Space.Compact>
            </Form.Item>
            <Form.Item label={t("vendor.fields.logo_suggestions")} style={{ marginTop: -8 }}>
              <Select
                value={undefined}
                placeholder={t("vendor.fields.logo_suggestions_placeholder")}
                onChange={(value) => {
                  setAllowAutoSuggest(false);
                  formProps.form?.setFieldValue(["extra", "logo_url"], value === noneOptionValue ? "" : value);
                }}
                options={[
                  { label: t("vendor.fields.logo_suggestions_none"), value: noneOptionValue },
                  ...webSuggestions.map((value) => ({ label: value, value })),
                ]}
              />
            </Form.Item>
            <Form.Item
              label={
                <>
                  {t("vendor.fields.logo_preview")}
                  {hasAutoWebLogo && (
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      {t("vendor.form.logo_preview_auto_notice")}
                    </Text>
                  )}
                  {!hasCustomWebLogo && !hasAutoWebLogo && (
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      {t("vendor.form.logo_preview_default_notice")}
                    </Text>
                  )}
                </>
              }
            >
              <div
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 8,
                  padding: 8,
                  border: "1px solid #d9d9d9",
                }}
              >
                <VendorLogo
                  vendor={logoPreviewVendor}
                  showFallbackText
                  imgStyle={{
                    display: "block",
                    width: "100%",
                    maxHeight: "56px",
                    objectFit: "contain",
                    objectPosition: "left center",
                  }}
                  fallbackStyle={{
                    width: "100%",
                    fontWeight: 700,
                    fontSize: "20px",
                    lineHeight: 1.1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: "#111",
                  }}
                />
              </div>
            </Form.Item>
            <Form.Item label={printLogoUrlLabel}>
              <Space.Compact style={{ width: "100%" }}>
                <Form.Item
                  name={["extra", "print_logo_url"]}
                  noStyle
                  rules={[
                    {
                      required: false,
                      type: "string",
                    },
                  ]}
                >
                  <AutoComplete
                    style={{ width: "100%" }}
                    options={printLogoOptions}
                    placeholder="/vendor-logos/print/vendor.png"
                    onChange={() => setAllowAutoSuggest(false)}
                  />
                </Form.Item>
                <Tooltip title={t("vendor.buttons.clear_logo_url")}>
                  <Button
                    htmlType="button"
                    icon={<CloseCircleOutlined />}
                    onClick={() => clearLogoField("print_logo_url")}
                  />
                </Tooltip>
              </Space.Compact>
            </Form.Item>
            <Form.Item label={t("vendor.fields.print_logo_suggestions")} style={{ marginTop: -8 }}>
              <Select
                value={undefined}
                placeholder={t("vendor.fields.logo_suggestions_placeholder")}
                onChange={(value) => {
                  setAllowAutoSuggest(false);
                  formProps.form?.setFieldValue(["extra", "print_logo_url"], value === noneOptionValue ? "" : value);
                }}
                options={[
                  { label: t("vendor.fields.logo_suggestions_none"), value: noneOptionValue },
                  ...printSuggestions.map((value) => ({ label: value, value })),
                ]}
              />
            </Form.Item>
            <Form.Item
              label={
                <>
                  {t("vendor.fields.print_logo_preview")}
                  {hasAutoPrintLogo && (
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      {t("vendor.form.logo_preview_auto_notice")}
                    </Text>
                  )}
                  {!hasCustomPrintLogo && !hasAutoPrintLogo && (
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      {t("vendor.form.logo_preview_default_notice")}
                    </Text>
                  )}
                </>
              }
            >
              <div
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 8,
                  padding: 8,
                  border: "1px solid #d9d9d9",
                }}
              >
                <VendorLogo
                  vendor={logoPreviewVendor}
                  usePrintLogo
                  showFallbackText
                  imgStyle={{
                    display: "block",
                    width: "100%",
                    maxHeight: "56px",
                    objectFit: "contain",
                    objectPosition: "left center",
                  }}
                  fallbackStyle={{
                    width: "100%",
                    fontWeight: 700,
                    fontSize: "20px",
                    lineHeight: 1.1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: "#111",
                  }}
                />
              </div>
            </Form.Item>
            <Form.Item>
              <Tooltip title={t("settings.general.logo_sync.github_description")}>
                <Button onClick={() => void syncLogoPackFromGithub()} loading={isSyncingLogoPack}>
                  {t("settings.general.logo_sync.github_button")}
                </Button>
              </Tooltip>
            </Form.Item>
          </Col>
        </Row>
      </Form>
      {hasChanged && <Alert description={t("vendor.form.vendor_updated")} type="warning" showIcon />}
    </Edit>
  );
};

export default VendorEdit;
