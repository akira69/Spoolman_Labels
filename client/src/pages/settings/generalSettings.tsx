import { useInvalidate, useTranslate, useUpdate } from "@refinedev/core";
import { Button, Checkbox, Divider, Form, Input, Space, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { useVendorLogoManifest } from "../../components/otherModels";
import { useGetSettings, useSetSetting } from "../../utils/querySettings";
import { getAPIURL } from "../../utils/url";
import { parseExtraString, suggestVendorLogoPaths } from "../../utils/vendorLogo";
import { IVendor } from "../vendors/model";

const { Text, Paragraph, Link } = Typography;

interface LogoPackSyncResponse {
  updated: boolean;
  source_repo: string;
  source_ref: string;
  source_url: string;
  web_logo_count: number;
  print_logo_count: number;
}

export function GeneralSettings() {
  const settings = useGetSettings();
  const setBaseUrl = useSetSetting("base_url");
  const setCurrency = useSetSetting("currency");
  const setRoundPrices = useSetSetting("round_prices");
  const logoManifestQuery = useVendorLogoManifest();
  const invalidate = useInvalidate();
  const { mutateAsync: updateVendor } = useUpdate();
  const [isSyncingLogos, setIsSyncingLogos] = useState(false);
  const [isSyncingLogoPack, setIsSyncingLogoPack] = useState(false);
  const [logoSourceUrl, setLogoSourceUrl] = useState<string>("https://github.com/MarksMakerSpace/filament-profiles");
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const t = useTranslate();

  // Set initial form values
  useEffect(() => {
    if (settings.data) {
      form.setFieldsValue({
        currency: JSON.parse(settings.data.currency.value),
        base_url: JSON.parse(settings.data.base_url.value),
        round_prices: JSON.parse(settings.data.round_prices.value),
      });
    }
  }, [settings.data, form]);

  // Popup message if setSetting is successful
  useEffect(() => {
    if (setCurrency.isSuccess) {
      messageApi.success(t("notifications.saveSuccessful"));
    }
  }, [setCurrency.isSuccess, messageApi, t]);

  // Handle form submit
  const onFinish = (values: { currency: string; base_url: string; round_prices: boolean }) => {
    // Check if the currency has changed
    if (settings.data?.currency.value !== JSON.stringify(values.currency)) {
      setCurrency.mutate(values.currency);
    }
    // Check if the base URL has changed
    if (settings.data?.base_url.value !== JSON.stringify(values.base_url)) {
      setBaseUrl.mutate(values.base_url);
    }

    // Check if the setting to round prices has changed
    if (settings.data?.round_prices.value !== JSON.stringify(values.round_prices)) {
      setRoundPrices.mutate(values.round_prices);
    }
  };

  const syncVendorLogos = async () => {
    const manifest = logoManifestQuery.data;
    if (!manifest) {
      messageApi.warning(t("settings.general.logo_sync.not_ready"));
      return;
    }

    setIsSyncingLogos(true);
    try {
      const response = await fetch(getAPIURL() + "/vendor");
      if (!response.ok) {
        throw new Error(t("settings.general.logo_sync.load_error"));
      }

      const vendors = (await response.json()) as IVendor[];
      let updatedCount = 0;
      let matchedCount = 0;

      for (const vendor of vendors) {
        const { webPath, printPath } = suggestVendorLogoPaths(vendor.name, manifest);
        if (!webPath && !printPath) continue;
        matchedCount += 1;

        const existingLogo = parseExtraString(vendor.extra?.logo_url);
        const existingPrintLogo = parseExtraString(vendor.extra?.print_logo_url);
        if (existingLogo && existingPrintLogo) continue;

        const mergedExtra = { ...(vendor.extra ?? {}) };
        if (!existingLogo && webPath) mergedExtra.logo_url = JSON.stringify(webPath);
        if (!existingPrintLogo && printPath) mergedExtra.print_logo_url = JSON.stringify(printPath);

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
        invalidate({ resource: "vendor", invalidates: ["list"] });
      }

      messageApi.success(
        t("settings.general.logo_sync.done", {
          matched: matchedCount,
          updated: updatedCount,
        }),
      );
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : t("settings.general.logo_sync.load_error"));
    } finally {
      setIsSyncingLogos(false);
    }
  };

  const syncLogoPackFromGithub = async () => {
    setIsSyncingLogoPack(true);
    try {
      const response = await fetch(getAPIURL() + "/vendor/logo-pack/sync-from-github", {
        method: "POST",
      });
      const body = (await response.json()) as LogoPackSyncResponse & { message?: string };

      if (!response.ok) {
        throw new Error(body.message ?? t("settings.general.logo_sync.github_load_error"));
      }

      if (body.source_url) {
        setLogoSourceUrl(body.source_url);
      }

      await logoManifestQuery.refetch();
      messageApi.success(
        body.updated
          ? t("settings.general.logo_sync.github_done_updated", {
              web: body.web_logo_count,
              print: body.print_logo_count,
            })
          : t("settings.general.logo_sync.github_done_no_changes", {
              web: body.web_logo_count,
              print: body.print_logo_count,
            }),
      );
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : t("settings.general.logo_sync.github_load_error"));
    } finally {
      setIsSyncingLogoPack(false);
    }
  };

  return (
    <>
      <Form
        form={form}
        labelCol={{ span: 8 }}
        wrapperCol={{ span: 16 }}
        initialValues={{
          currency: settings.data?.currency.value,
          round_prices: settings.data?.round_prices.value,
          base_url: settings.data?.base_url.value,
        }}
        onFinish={onFinish}
        style={{
          maxWidth: "600px",
          margin: "0 auto",
        }}
      >
        <Form.Item
          label={t("settings.general.currency.label")}
          name="currency"
          rules={[
            {
              required: true,
            },
            {
              pattern: /^[A-Z]{3}$/,
            },
          ]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label={t("settings.general.base_url.label")}
          tooltip={t("settings.general.base_url.tooltip")}
          name="base_url"
          rules={[
            {
              required: false,
            },
            {
              pattern: /^https?:\/\/.+(?<!\/)$/,
            },
          ]}
        >
          <Input placeholder="https://example.com:8000" />
        </Form.Item>

        <Form.Item
          label={t("settings.general.round_prices.label")}
          tooltip={t("settings.general.round_prices.tooltip")}
          name="round_prices"
          valuePropName="checked"
        >
          <Checkbox />
        </Form.Item>

        <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
          <Button type="primary" htmlType="submit" loading={settings.isFetching || setCurrency.isPending}>
            {t("buttons.save")}
          </Button>
        </Form.Item>
      </Form>
      <div
        style={{
          maxWidth: "600px",
          margin: "1.5rem auto 0",
        }}
      >
        <Divider />
        <Space direction="vertical" size={4}>
          <Text strong>{t("settings.general.logo_sync.title")}</Text>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t("settings.general.logo_sync.description")}
          </Paragraph>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t("settings.general.logo_sync.where")}
          </Paragraph>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t("settings.general.logo_sync.scope_note")}
          </Paragraph>
          <Button type="primary" onClick={() => void syncVendorLogos()} loading={isSyncingLogos}>
            {t("settings.general.logo_sync.button")}
          </Button>
          <Divider style={{ margin: "10px 0" }} />
          <Text strong>{t("settings.general.logo_sync.github_title")}</Text>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t("settings.general.logo_sync.github_description")}
          </Paragraph>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t("settings.general.logo_sync.github_source")}{" "}
            <Link href={logoSourceUrl} target="_blank" rel="noreferrer">
              {logoSourceUrl}
            </Link>
          </Paragraph>
          <Button onClick={() => void syncLogoPackFromGithub()} loading={isSyncingLogoPack}>
            {t("settings.general.logo_sync.github_button")}
          </Button>
        </Space>
      </div>
      {contextHolder}
    </>
  );
}
