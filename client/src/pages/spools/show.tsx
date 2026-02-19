import { InboxOutlined, PrinterOutlined, ToTopOutlined, ToolOutlined } from "@ant-design/icons";
import { DateField, Show, TextField } from "@refinedev/antd";
import { useInvalidate, useShow, useTranslate } from "@refinedev/core";
import { Button, Col, Modal, Row, Typography } from "antd";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { ExtraFieldDisplay } from "../../components/extraFields";
import ColorHexPreview from "../../components/colorHexPreview";
import { NumberFieldUnit } from "../../components/numberField";
import VendorLogo from "../../components/vendorLogo";
import { enrichText } from "../../utils/parsing";
import { EntityType, useGetFields } from "../../utils/queryFields";
import { useCurrencyFormatter } from "../../utils/settings";
import { getBasePath, stripBasePath } from "../../utils/url";
import { IFilament } from "../filaments/model";
import { setSpoolArchived, useSpoolAdjustModal } from "./functions";
import { ISpool } from "./model";

dayjs.extend(utc);

const { Text, Title } = Typography;
const { confirm } = Modal;

export const SpoolShow = () => {
  const t = useTranslate();
  const extraFields = useGetFields(EntityType.spool);
  const currencyFormatter = useCurrencyFormatter();
  const invalidate = useInvalidate();

  const { query } = useShow<ISpool>({
    liveMode: "auto",
  });
  const { data, isLoading } = query;

  const record = data?.data;

  const spoolPrice = (item?: ISpool) => {
    const price = item?.price ?? item?.filament.price;
    if (price === undefined) {
      return "";
    }
    return currencyFormatter.format(price);
  };

  // Provides the function to open the spool adjustment modal and the modal component itself
  const { openSpoolAdjustModal, spoolAdjustModal } = useSpoolAdjustModal();

  // Function for opening an ant design modal that asks for confirmation for archiving a spool
  const archiveSpool = async (spool: ISpool, archive: boolean) => {
    await setSpoolArchived(spool, archive);
    invalidate({
      resource: "spool",
      id: spool.id,
      invalidates: ["list", "detail"],
    });
  };

  const archiveSpoolPopup = async (spool: ISpool | undefined) => {
    if (spool === undefined) {
      return;
    }
    // If the spool has no remaining weight, archive it immediately since it's likely not a mistake
    if (spool.remaining_weight != undefined && spool.remaining_weight <= 0) {
      await archiveSpool(spool, true);
    } else {
      confirm({
        title: t("spool.titles.archive"),
        content: t("spool.messages.archive"),
        okText: t("buttons.archive"),
        okType: "primary",
        cancelText: t("buttons.cancel"),
        onOk() {
          return archiveSpool(spool, true);
        },
      });
    }
  };

  const formatFilament = (item: IFilament) => {
    let vendorPrefix = "";
    if (item.vendor) {
      vendorPrefix = `${item.vendor.name} - `;
    }
    let name = item.name;
    if (!name) {
      name = `ID: ${item.id}`;
    }
    let material = "";
    if (item.material) {
      material = ` - ${item.material}`;
    }
    return `${vendorPrefix}${name}${material}`;
  };

  const filamentURL = (item: IFilament) => `/filament/show/${item.id}`;
  const multiColorLabel =
    record?.filament.multi_color_hexes && record.filament.multi_color_direction === "longitudinal"
      ? "Longitudinal Multi"
      : record?.filament.multi_color_hexes
      ? "Coextruded Multi"
      : null;

  const formatTitle = (item: ISpool) => {
    return t("spool.titles.show_title", {
      id: item.id,
      name: formatFilament(item.filament),
      interpolation: { escapeValue: false },
    });
  };

  return (
    <Show
      isLoading={isLoading}
      title={record ? formatTitle(record) : ""}
      headerButtons={({ defaultButtons }) => (
        <>
          <Button type="primary" icon={<ToolOutlined />} onClick={() => record && openSpoolAdjustModal(record)}>
            {t("spool.titles.adjust")}
          </Button>
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            href={
              getBasePath() +
              "/spool/labels?spools=" +
              record?.id +
              "&return=" +
              encodeURIComponent(stripBasePath(window.location.pathname))
            }
          >
            {t("printing.qrcode.selectButton")}
          </Button>
          {record?.archived ? (
            <Button icon={<ToTopOutlined />} onClick={() => archiveSpool(record, false)}>
              {t("buttons.unArchive")}
            </Button>
          ) : (
            <Button danger icon={<InboxOutlined />} onClick={() => archiveSpoolPopup(record)}>
              {t("buttons.archive")}
            </Button>
          )}

          {defaultButtons}
          {spoolAdjustModal}
        </>
      )}
    >
      <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
        {`${t("spool.fields.registered")} ${
          record?.registered ? dayjs.utc(record.registered).local().format("YYYY-MM-DD HH:mm:ss") : "-"
        }`}
      </Text>
      <Row gutter={[24, 16]} align="top">
        <Col xs={24} lg={16}>
          {record && (
            <Title level={5}>
              <a href={filamentURL(record.filament)}>{`${formatFilament(record.filament)} Filament`}</a>
            </Title>
          )}
          <Title level={5}>{t("filament.fields.color_hex")}</Title>
          {multiColorLabel && (
            <Text type="secondary" style={{ display: "block", marginTop: -10, marginBottom: 8 }}>
              {multiColorLabel}
            </Text>
          )}
          <ColorHexPreview
            colorHex={record?.filament.color_hex}
            multiColorHexes={record?.filament.multi_color_hexes}
            multiColorDirection={record?.filament.multi_color_direction}
          />
        </Col>
        <Col xs={24} lg={8}>
          <div>
            <strong>{t("filament.fields.vendor")}:</strong>{" "}
            {record?.filament.vendor?.id ? (
              <a href={`/vendor/show/${record.filament.vendor.id}`}>{record.filament.vendor.name}</a>
            ) : (
              <span>{record?.filament.vendor?.name ?? "-"}</span>
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
              vendor={record?.filament.vendor}
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
      <Title level={5}>{t("spool.fields.price")}</Title>
      <TextField value={spoolPrice(record)} />
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Title level={5}>{t("spool.fields.first_used")}</Title>
          {record?.first_used ? (
            <DateField
              value={dayjs.utc(record.first_used).local()}
              title={dayjs.utc(record.first_used).local().format()}
              format="YYYY-MM-DD HH:mm:ss"
            />
          ) : (
            <TextField value="-" />
          )}
        </Col>
        <Col xs={24} md={12}>
          <Title level={5}>{t("spool.fields.last_used")}</Title>
          {record?.last_used ? (
            <DateField
              value={dayjs.utc(record.last_used).local()}
              title={dayjs.utc(record.last_used).local().format()}
              format="YYYY-MM-DD HH:mm:ss"
            />
          ) : (
            <TextField value="-" />
          )}
        </Col>
      </Row>
      <Title level={5}>{t("spool.fields.remaining_length")}</Title>
      <NumberFieldUnit
        value={record?.remaining_length ?? ""}
        unit="mm"
        options={{
          maximumFractionDigits: 1,
          minimumFractionDigits: 1,
        }}
      />
      <Title level={5}>{t("spool.fields.used_length")}</Title>
      <NumberFieldUnit
        value={record?.used_length ?? ""}
        unit="mm"
        options={{
          maximumFractionDigits: 1,
          minimumFractionDigits: 1,
        }}
      />
      <Title level={5}>{t("spool.fields.remaining_weight")}</Title>
      <NumberFieldUnit
        value={record?.remaining_weight ?? ""}
        unit="g"
        options={{
          maximumFractionDigits: 1,
          minimumFractionDigits: 1,
        }}
      />
      <Title level={5}>{t("spool.fields.used_weight")}</Title>
      <NumberFieldUnit
        value={record?.used_weight ?? ""}
        unit="g"
        options={{
          maximumFractionDigits: 1,
          minimumFractionDigits: 1,
        }}
      />
      <Title level={5}>{t("spool.fields.location")}</Title>
      <TextField value={record?.location} />
      <Title level={5}>{t("spool.fields.lot_nr")}</Title>
      <TextField value={record?.lot_nr} />
      <Title level={5}>{t("spool.fields.comment")}</Title>
      <TextField value={enrichText(record?.comment)} />
      <Title level={5}>{t("spool.fields.archived")}</Title>
      <TextField value={record?.archived ? t("yes") : t("no")} />
      <Title level={4}>{t("settings.extra_fields.tab")}</Title>
      {extraFields?.data?.map((field, index) => (
        <ExtraFieldDisplay key={index} field={field} value={record?.extra[field.key]} />
      ))}
    </Show>
  );
};

export default SpoolShow;
