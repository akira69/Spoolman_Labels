import { Edit, useForm } from "@refinedev/antd";
import { HttpError, useTranslate } from "@refinedev/core";
import { Alert, AutoComplete, Col, DatePicker, Form, Input, InputNumber, Row, message, Typography } from "antd";
import TextArea from "antd/es/input/TextArea";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { ExtraFieldFormItem, ParsedExtras, StringifiedExtras } from "../../components/extraFields";
import { useVendorLogoManifest } from "../../components/otherModels";
import VendorLogo from "../../components/vendorLogo";
import { EntityType, useGetFields } from "../../utils/queryFields";
import { suggestVendorLogoPaths } from "../../utils/vendorLogo";
import { IVendor, IVendorParsedExtras } from "./model";

/*
The API returns the extra fields as JSON values, but we need to parse them into their real types
in order for Ant design's form to work properly. ParsedExtras does this for us.
We also need to stringify them again before sending them back to the API, which is done by overriding
the form's onFinish method. Form.Item's normalize should do this, but it doesn't seem to work.
*/

export const VendorEdit = () => {
  const t = useTranslate();
  const [messageApi, contextHolder] = message.useMessage();
  const [hasChanged, setHasChanged] = useState(false);
  const extraFields = useGetFields(EntityType.vendor);
  const logoManifest = useVendorLogoManifest();

  const { formProps, saveButtonProps } = useForm<IVendor, HttpError, IVendor, IVendor>({
    liveMode: "manual",
    onLiveEvent() {
      // Warn the user if the vendor has been updated since the form was opened
      messageApi.warning(t("vendor.form.vendor_updated"));
      setHasChanged(true);
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
      // Lot of stupidity here to make types work
      const stringifiedAllValues = StringifiedExtras<IVendorParsedExtras>(allValues);
      originalOnFinish?.({
        extra: {},
        ...stringifiedAllValues,
      });
    }
  };

  const watchedName = Form.useWatch(["name"], formProps.form);
  const watchedExtra = Form.useWatch(["extra"], formProps.form) as { [key: string]: unknown } | undefined;
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

  useEffect(() => {
    if (!watchedName || !logoManifest.data || !formProps.form) {
      return;
    }

    const existingLogo = typeof watchedExtra?.logo_url === "string" ? watchedExtra.logo_url.trim() : "";
    const existingPrintLogo = typeof watchedExtra?.print_logo_url === "string" ? watchedExtra.print_logo_url.trim() : "";
    if (existingLogo && existingPrintLogo) {
      return;
    }

    const { webPath, printPath } = suggestVendorLogoPaths(watchedName, logoManifest.data);
    if (!webPath && !printPath) {
      return;
    }

    if (!existingLogo && webPath) {
      formProps.form.setFieldValue(["extra", "logo_url"], webPath);
    }
    if (!existingPrintLogo && printPath) {
      formProps.form.setFieldValue(["extra", "print_logo_url"], printPath);
    }
  }, [watchedName, watchedExtra?.logo_url, watchedExtra?.print_logo_url, logoManifest.data, formProps.form]);

  return (
    <Edit saveButtonProps={saveButtonProps}>
      {contextHolder}
      <Form {...formProps} layout="vertical">
        <Row gutter={16} align="top">
          <Col xs={24} lg={15}>
            <Form.Item
              label={t("vendor.fields.id")}
              name={["id"]}
              rules={[
                {
                  required: true,
                },
              ]}
            >
              <Input readOnly disabled style={{ maxWidth: 240 }} />
            </Form.Item>
            <Form.Item
              label={t("vendor.fields.registered")}
              name={["registered"]}
              rules={[
                {
                  required: true,
                },
              ]}
              getValueProps={(value) => ({
                value: value ? dayjs(value) : undefined,
              })}
            >
              <DatePicker disabled showTime format="YYYY-MM-DD HH:mm:ss" />
            </Form.Item>
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
          </Col>
          <Col xs={24} lg={9}>
            <Form.Item
              label={t("vendor.fields.logo_url")}
              help={t("vendor.fields_help.logo_url")}
              name={["extra", "logo_url"]}
              rules={[
                {
                  required: false,
                  type: "string",
                },
              ]}
            >
              <AutoComplete options={webLogoOptions} placeholder="/vendor-logos/web/vendor.png" />
            </Form.Item>
            <Form.Item label={t("vendor.fields.logo_preview")}>
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
            <Form.Item
              label={t("vendor.fields.print_logo_url")}
              help={t("vendor.fields_help.print_logo_url")}
              name={["extra", "print_logo_url"]}
              rules={[
                {
                  required: false,
                  type: "string",
                },
              ]}
            >
              <AutoComplete options={printLogoOptions} placeholder="/vendor-logos/print/vendor.png" />
            </Form.Item>
            <Form.Item label={t("vendor.fields.print_logo_preview")}>
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
          </Col>
        </Row>
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
        <Typography.Title level={5}>{t("settings.extra_fields.tab")}</Typography.Title>
        {extraFields.data?.map((field, index) => (
          <ExtraFieldFormItem key={index} field={field} />
        ))}
      </Form>
      {hasChanged && <Alert description={t("vendor.form.vendor_updated")} type="warning" showIcon />}
    </Edit>
  );
};

export default VendorEdit;
