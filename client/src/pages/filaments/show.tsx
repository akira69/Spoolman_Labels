import { Show, TextField } from "@refinedev/antd";
import { useShow, useTranslate } from "@refinedev/core";
import { PrinterOutlined } from "@ant-design/icons";
import { Button, Col, Row, Typography } from "antd";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useNavigate } from "react-router";
import { ExtraFieldDisplay } from "../../components/extraFields";
import ColorHexPreview from "../../components/colorHexPreview";
import { NumberFieldUnit } from "../../components/numberField";
import VendorLogo from "../../components/vendorLogo";
import { enrichText } from "../../utils/parsing";
import { EntityType, useGetFields } from "../../utils/queryFields";
import { useCurrencyFormatter } from "../../utils/settings";
import { getBasePath, stripBasePath } from "../../utils/url";
import { IFilament } from "./model";
dayjs.extend(utc);

const { Text, Title } = Typography;

export const FilamentShow = () => {
  const t = useTranslate();
  const navigate = useNavigate();
  const extraFields = useGetFields(EntityType.filament);
  const currencyFormatter = useCurrencyFormatter();
  const { query } = useShow<IFilament>({
    liveMode: "auto",
  });
  const { data, isLoading } = query;

  const record = data?.data;
  const multiColorLabel =
    record?.multi_color_hexes && record.multi_color_direction === "longitudinal"
      ? "Longitudinal Multi"
      : record?.multi_color_hexes
      ? "Coextruded Multi"
      : null;

  const formatTitle = (item: IFilament) => {
    let vendorPrefix = "";
    if (item.vendor) {
      vendorPrefix = `${item.vendor.name} - `;
    }
    return t("filament.titles.show_title", {
      id: item.id,
      name: vendorPrefix + item.name,
      interpolation: { escapeValue: false },
    });
  };

  const gotoVendor = (): undefined => {
    const URL = `/vendor/show/${record?.vendor?.id}`;
    navigate(URL);
  };

  const gotoSpools = (): undefined => {
    const URL = `/spool#filters=[{"field":"filament.id","operator":"in","value":[${record?.id}]}]`;
    navigate(URL);
  };

  return (
    <Show
      isLoading={isLoading}
      title={record ? formatTitle(record) : ""}
      headerButtons={({ defaultButtons }) => (
        <>
          <Button type="primary" onClick={gotoSpools}>
            {t("filament.fields.spools")}
          </Button>
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            href={
              getBasePath() +
              "/filament/labels?filaments=" +
              record?.id +
              "&return=" +
              encodeURIComponent(stripBasePath(window.location.pathname))
            }
          >
            {t("printing.qrcode.selectButton")}
          </Button>
          {defaultButtons}
        </>
      )}
    >
      <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
        {`${t("filament.fields.registered")} ${
          record?.registered ? dayjs.utc(record.registered).local().format("YYYY-MM-DD HH:mm:ss") : "-"
        }`}
      </Text>
      <Row gutter={[24, 16]} align="top">
        <Col xs={24} lg={16}>
          <Title level={5}>{t("filament.fields.name")}</Title>
          <TextField value={record?.name} />
          <Title level={5}>{t("filament.fields.material")}</Title>
          <TextField value={record?.material} />
          <Title level={5}>{t("filament.fields.color_hex")}</Title>
          {multiColorLabel && (
            <Text type="secondary" style={{ display: "block", marginTop: -10, marginBottom: 8 }}>
              {multiColorLabel}
            </Text>
          )}
          <ColorHexPreview
            colorHex={record?.color_hex}
            multiColorHexes={record?.multi_color_hexes}
            multiColorDirection={record?.multi_color_direction}
          />
        </Col>
        <Col xs={24} lg={8}>
          <div>
            <strong>{t("filament.fields.vendor")}:</strong>{" "}
            {record?.vendor?.id ? (
              <button className="app-link-button" onClick={gotoVendor}>
                {record.vendor.name}
              </button>
            ) : (
              <span>{record?.vendor?.name ?? "-"}</span>
            )}
          </div>
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: 8,
              padding: 8,
              border: "1px solid #d9d9d9",
              marginTop: 8,
            }}
          >
            <VendorLogo
              vendor={record?.vendor}
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
        </Col>
      </Row>
      <Title level={5}>{t("filament.fields.price")}</Title>
      <TextField value={record?.price ? currencyFormatter.format(record.price) : ""} />
      <Title level={5}>{t("filament.fields.density")}</Title>
      <NumberFieldUnit
        value={record?.density ?? ""}
        unit="g/cm³"
        options={{
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        }}
      />
      <Title level={5}>{t("filament.fields.diameter")}</Title>
      <NumberFieldUnit
        value={record?.diameter ?? ""}
        unit="mm"
        options={{
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        }}
      />
      <Title level={5}>{t("filament.fields.weight")}</Title>
      <NumberFieldUnit
        value={record?.weight ?? ""}
        unit="g"
        options={{
          maximumFractionDigits: 1,
          minimumFractionDigits: 1,
        }}
      />
      <Title level={5}>{t("filament.fields.spool_weight")}</Title>
      <NumberFieldUnit
        value={record?.spool_weight ?? ""}
        unit="g"
        options={{
          maximumFractionDigits: 1,
          minimumFractionDigits: 1,
        }}
      />
      <Title level={5}>{t("filament.fields.settings_extruder_temp")}</Title>
      {!record?.settings_extruder_temp ? (
        <TextField value="Not Set" />
      ) : (
        <NumberFieldUnit value={record?.settings_extruder_temp ?? ""} unit="°C" />
      )}
      <Title level={5}>{t("filament.fields.settings_bed_temp")}</Title>
      {!record?.settings_bed_temp ? (
        <TextField value="Not Set" />
      ) : (
        <NumberFieldUnit value={record?.settings_bed_temp ?? ""} unit="°C" />
      )}
      <Title level={5}>{t("filament.fields.article_number")}</Title>
      <TextField value={record?.article_number} />
      <Title level={5}>{t("filament.fields.external_id")}</Title>
      <TextField value={record?.external_id} />
      <Title level={5}>{t("filament.fields.comment")}</Title>
      <TextField value={enrichText(record?.comment)} />
      <Title level={4}>{t("settings.extra_fields.tab")}</Title>
      {extraFields?.data?.map((field, index) => (
        <ExtraFieldDisplay key={index} field={field} value={record?.extra[field.key]} />
      ))}
    </Show>
  );
};

export default FilamentShow;
