import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignMiddleOutlined,
  VerticalAlignTopOutlined,
} from "@ant-design/icons";
import { useTranslate } from "@refinedev/core";
import {
  Col,
  Divider,
  Form,
  InputNumber,
  QRCode,
  Radio,
  RadioChangeEvent,
  Row,
  Segmented,
  Slider,
  Switch,
  Typography,
} from "antd";
import { ReactElement } from "react";
import { useMemo, useState } from "react";
import VendorLogo from "../../components/vendorLogo";
import { getBasePath } from "../../utils/url";
import { IVendor } from "../vendors/model";
import { QRCodePrintSettings } from "./printing";
import ExportDialog from "./exportDialog";
import TitleTextBlock from "./titleTextBlock";

const { Text } = Typography;

interface QRCodeData {
  value: string;
  vendor?: IVendor;
  title?: ReactElement;
  label?: ReactElement;
  errorLevel?: "L" | "M" | "Q" | "H";
  amlName?: string;
}

interface QRCodeExportDialogProps {
  items: QRCodeData[];
  printSettings: QRCodePrintSettings;
  setPrintSettings: (setPrintSettings: QRCodePrintSettings) => void;
  extraExportSettings?: ReactElement;
  extraTitleSettings?: ReactElement;
  extraInfoSettings?: ReactElement;
  extraSettingsStart?: ReactElement;
  extraButtons?: ReactElement;
  baseUrlRoot: string;
  useHTTPUrl: boolean;
  setUseHTTPUrl: (value: boolean) => void;
  previewValues?: { default: string; url: string };
  zipFileTypeName: string;
}

const QRCodeExportDialog = ({
  items,
  printSettings,
  setPrintSettings,
  extraExportSettings,
  extraTitleSettings,
  extraInfoSettings,
  extraSettingsStart,
  extraButtons,
  baseUrlRoot,
  useHTTPUrl,
  setUseHTTPUrl,
  previewValues,
  zipFileTypeName,
}: QRCodeExportDialogProps) => {
  const t = useTranslate();

  const toOneDecimal = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, Math.round(value * 10) / 10));
  const horizontalToFlex = (value: "left" | "center" | "right"): "flex-start" | "center" | "flex-end" => {
    if (value === "center") return "center";
    if (value === "right") return "flex-end";
    return "flex-start";
  };
  const verticalToFlex = (value: "top" | "center" | "bottom"): "flex-start" | "center" | "flex-end" => {
    if (value === "center") return "center";
    if (value === "bottom") return "flex-end";
    return "flex-start";
  };

  const showContent = printSettings?.showContent === undefined ? true : printSettings?.showContent;
  const showQRCodeMode = printSettings?.showQRCodeMode || "withIcon";
  const infoTextSize = printSettings?.textSize || 3;
  const showManufacturerLogo = printSettings?.showManufacturerLogo ?? true;
  const logoHeightMm = printSettings?.logoHeightMm ?? 6;
  const logoAlign = printSettings?.logoAlign || "left";
  const showTitle = printSettings?.showTitle ?? true;
  const titleMaxTextSize = printSettings?.titleMaxTextSize ?? printSettings?.titleTextSize ?? 4;
  const titleFitToWidth = printSettings?.titleFitToWidth ?? true;
  const titleAlign = printSettings?.titleAlign || "left";
  const qrCodePosition = printSettings?.qrCodePosition || "right";
  const qrCodeAlign = printSettings?.qrCodeAlign || "center";
  const infoAlign = printSettings?.infoAlign || "left";
  const infoVerticalAlign = printSettings?.infoVerticalAlign || "top";
  const qrCodeSizeMax = 30;
  const qrCodeSizeMm = toOneDecimal(printSettings?.qrCodeSizeMm ?? 16, 8, qrCodeSizeMax);
  const [titleEffectiveTextSizesByItem, setTitleEffectiveTextSizesByItem] = useState<Record<number, number>>({});

  const paperHeight = printSettings.printSettings?.customPaperSize?.height ?? 30;
  const topMargin = printSettings.printSettings?.margin?.top ?? 0;
  const bottomMargin = printSettings.printSettings?.margin?.bottom ?? 0;
  const containerPaddingMm = 1.2; // .print-qrcode-item vertical padding
  const minMainHeightMm = showQRCodeMode === "no" ? 0 : 8;
  const availableContentHeightMm = Math.max(0, paperHeight - topMargin - bottomMargin - containerPaddingMm);
  const maxHeaderHeightMm = Math.max(0, availableContentHeightMm - minMainHeightMm);
  const preview =
    previewValues ?? ({ default: `WEB+SPOOLMAN:S-{id}`, url: `${baseUrlRoot}/spool/show/{id}` } as const);
  const appliedTitleSizeDisplay = useMemo(() => {
    const values = Object.values(titleEffectiveTextSizesByItem).filter((value) => Number.isFinite(value));
    if (values.length === 0) {
      return `${titleMaxTextSize.toFixed(1)} mm`;
    }
    const minSize = Math.min(...values);
    const maxSize = Math.max(...values);
    if (values.length > 1 && maxSize - minSize >= 0.1) {
      return `${minSize.toFixed(1)}-${maxSize.toFixed(1)} mm`;
    }
    return `${maxSize.toFixed(1)} mm`;
  }, [titleEffectiveTextSizesByItem, titleMaxTextSize]);

  const elements = items.map((item, idx) => {
    const hasHeader = (showManufacturerLogo && !!item.vendor) || (showTitle && !!item.title);
    return (
      <div className="print-qrcode-item" key={idx} data-aml-name={item.amlName ?? ""}>
        {hasHeader && (
          <div className="print-qrcode-header">
            {showManufacturerLogo && !!item.vendor && (
              <div className="print-qrcode-logo-row">
                <div className="print-qrcode-logo">
                  <VendorLogo
                    vendor={item.vendor}
                    usePrintLogo
                    showFallbackText
                    imgStyle={{
                      display: "block",
                      width: "100%",
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                      objectPosition: `${logoAlign} center`,
                    }}
                    fallbackStyle={{
                      fontWeight: 700,
                      fontSize: `${Math.max(titleMaxTextSize - 0.4, 2)}mm`,
                      lineHeight: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      width: "100%",
                    }}
                  />
                </div>
              </div>
            )}
            {showTitle && item.title && (
              <div className="print-qrcode-title-area">
                <TitleTextBlock
                  fitToWidth={titleFitToWidth}
                  align={titleAlign}
                  maxTextSizeMm={titleMaxTextSize}
                  onEffectiveTextSizeChange={(sizeMm) => {
                    setTitleEffectiveTextSizesByItem((current) => {
                      if (current[idx] === sizeMm) {
                        return current;
                      }
                      return { ...current, [idx]: sizeMm };
                    });
                  }}
                >
                  {item.title}
                </TitleTextBlock>
              </div>
            )}
          </div>
        )}
        {(showQRCodeMode !== "no" || showContent) && (
          <div className={`print-qrcode-main print-qrcode-main-${qrCodePosition}`}>
            {showContent && (
              <div className="print-qrcode-info">
                <div className="print-qrcode-info-text">{item.label ?? item.value}</div>
              </div>
            )}
            {showQRCodeMode !== "no" && (
              <div className={`print-qrcode-code-column print-qrcode-code-column-${qrCodeAlign}`}>
                <div className="print-qrcode-code-box">
                  <QRCode
                    className="print-qrcode"
                    icon={showQRCodeMode === "withIcon" ? getBasePath() + "/favicon.svg" : undefined}
                    value={item.value}
                    errorLevel={item.errorLevel}
                    type="svg"
                    color="#000"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  });

  return (
    <ExportDialog
      items={elements}
      printSettings={printSettings.printSettings}
      setPrintSettings={(newSettings) => {
        printSettings.printSettings = newSettings;
        setPrintSettings(printSettings);
      }}
      extraExportSettings={extraExportSettings}
      extraButtons={extraButtons}
      zipFileTypeName={zipFileTypeName}
      extraSettingsStart={extraSettingsStart}
      extraSettings={
        <>
          <Typography.Text strong>{t("printing.qrcode.sectionLogo")}</Typography.Text>
          <Form.Item label={t("printing.qrcode.showManufacturerLogo")} style={{ marginTop: 8 }}>
            <Switch
              checked={showManufacturerLogo}
              onChange={(checked) => {
                printSettings.showManufacturerLogo = checked;
                setPrintSettings(printSettings);
              }}
            />
          </Form.Item>
          <Form.Item label={t("printing.qrcode.logoSize")}>
            <Row>
              <Col span={12}>
                <Slider
                  min={2}
                  max={12}
                  step={0.1}
                  tooltip={{ formatter: (value) => `${value} mm` }}
                  value={logoHeightMm}
                  onChange={(value) => {
                    printSettings.logoHeightMm = value;
                    setPrintSettings(printSettings);
                  }}
                />
              </Col>
              <Col span={12}>
                <InputNumber
                  min={2}
                  max={12}
                  step={0.1}
                  precision={1}
                  style={{ margin: "0 16px" }}
                  value={logoHeightMm}
                  addonAfter="mm"
                  onChange={(value) => {
                    printSettings.logoHeightMm = value ?? 6;
                    setPrintSettings(printSettings);
                  }}
                />
              </Col>
            </Row>
          </Form.Item>
          <Form.Item label={t("printing.qrcode.logoAlign")}>
            <Segmented
              block
              options={[
                { value: "left", icon: <AlignLeftOutlined title={t("printing.qrcode.qrCodePositionLeft")} /> },
                { value: "center", icon: <AlignCenterOutlined title={t("printing.qrcode.qrCodeAlignCenter")} /> },
                { value: "right", icon: <AlignRightOutlined title={t("printing.qrcode.qrCodePositionRight")} /> },
              ]}
              value={logoAlign}
              onChange={(value) => {
                printSettings.logoAlign = value as "left" | "center" | "right";
                setPrintSettings(printSettings);
              }}
            />
          </Form.Item>

          <Divider />
          <Typography.Text strong>{t("printing.qrcode.sectionTitle")}</Typography.Text>
          <Form.Item label={t("printing.qrcode.showTitle")} style={{ marginTop: 8 }}>
            <Switch
              checked={showTitle}
              onChange={(checked) => {
                printSettings.showTitle = checked;
                setPrintSettings(printSettings);
              }}
            />
          </Form.Item>
          <Form.Item label={t("printing.qrcode.titleMaxTextSize")}>
            <Row>
              <Col span={12}>
                <Slider
                  disabled={!showTitle}
                  min={1}
                  max={8}
                  step={0.1}
                  tooltip={{ formatter: (value) => `${value} mm` }}
                  value={titleMaxTextSize}
                  onChange={(value) => {
                    printSettings.titleMaxTextSize = value;
                    setPrintSettings(printSettings);
                  }}
                />
              </Col>
              <Col span={12}>
                <InputNumber
                  disabled={!showTitle}
                  min={1}
                  max={8}
                  step={0.1}
                  precision={1}
                  style={{ margin: "0 16px" }}
                  value={titleMaxTextSize}
                  addonAfter="mm"
                  onChange={(value) => {
                    printSettings.titleMaxTextSize = value ?? 4;
                    setPrintSettings(printSettings);
                  }}
                />
              </Col>
            </Row>
          </Form.Item>
          <Form.Item label={t("printing.qrcode.titleFitToWidth")}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Radio.Group
                disabled={!showTitle}
                options={[
                  { label: t("printing.qrcode.titleFitToWidthOptions.on"), value: true },
                  { label: t("printing.qrcode.titleFitToWidthOptions.off"), value: false },
                ]}
                onChange={(e: RadioChangeEvent) => {
                  printSettings.titleFitToWidth = e.target.value;
                  setPrintSettings(printSettings);
                }}
                value={titleFitToWidth}
                optionType="button"
                buttonStyle="solid"
              />
              {showTitle && (
                <Text type="secondary">
                  {t("printing.qrcode.appliedTextSize")}: {appliedTitleSizeDisplay}
                </Text>
              )}
            </div>
          </Form.Item>
          <Form.Item label={t("printing.qrcode.titleAlign")}>
            <Segmented
              block
              disabled={!showTitle}
              options={[
                { value: "left", icon: <AlignLeftOutlined title={t("printing.qrcode.qrCodePositionLeft")} /> },
                { value: "center", icon: <AlignCenterOutlined title={t("printing.qrcode.qrCodeAlignCenter")} /> },
                { value: "right", icon: <AlignRightOutlined title={t("printing.qrcode.qrCodePositionRight")} /> },
              ]}
              value={titleAlign}
              onChange={(value) => {
                printSettings.titleAlign = value as "left" | "center" | "right";
                setPrintSettings(printSettings);
              }}
            />
          </Form.Item>
          {extraTitleSettings}

          <Divider />
          <Typography.Text strong>{t("printing.qrcode.sectionQRCode")}</Typography.Text>
          <Form.Item label={t("printing.qrcode.showQRCode")} style={{ marginTop: 8 }}>
            <Radio.Group
              options={[
                { label: t("printing.qrcode.showQRCodeMode.no"), value: "no" },
                {
                  label: t("printing.qrcode.showQRCodeMode.simple"),
                  value: "simple",
                },
                { label: t("printing.qrcode.showQRCodeMode.withIcon"), value: "withIcon" },
              ]}
              onChange={(e: RadioChangeEvent) => {
                printSettings.showQRCodeMode = e.target.value;
                setPrintSettings(printSettings);
              }}
              value={showQRCodeMode}
              optionType="button"
              buttonStyle="solid"
            />
          </Form.Item>
          <Form.Item label={t("printing.qrcode.qrCodePosition")}>
            <Radio.Group
              options={[
                { label: t("printing.qrcode.qrCodePositionLeft"), value: "left" },
                { label: t("printing.qrcode.qrCodePositionRight"), value: "right" },
              ]}
              onChange={(e: RadioChangeEvent) => {
                printSettings.qrCodePosition = e.target.value;
                setPrintSettings(printSettings);
              }}
              value={qrCodePosition}
              optionType="button"
              buttonStyle="solid"
            />
          </Form.Item>
          <Form.Item label={t("printing.qrcode.qrCodeAlign")}>
            <Segmented
              block
              options={[
                { value: "top", icon: <VerticalAlignTopOutlined title={t("printing.qrcode.qrCodeAlignTop")} /> },
                {
                  value: "center",
                  icon: <VerticalAlignMiddleOutlined title={t("printing.qrcode.qrCodeAlignCenter")} />,
                },
                {
                  value: "bottom",
                  icon: <VerticalAlignBottomOutlined title={t("printing.qrcode.qrCodeAlignBottom")} />,
                },
              ]}
              onChange={(value) => {
                printSettings.qrCodeAlign = value as "top" | "center" | "bottom";
                setPrintSettings(printSettings);
              }}
              value={qrCodeAlign}
            />
          </Form.Item>
          <Form.Item label={t("printing.qrcode.qrCodeSize")}>
            <Row>
              <Col span={12}>
                <Slider
                  min={8}
                  max={qrCodeSizeMax}
                  step={0.1}
                  tooltip={{ formatter: (value) => `${value} mm` }}
                  value={qrCodeSizeMm}
                  onChange={(value) => {
                    printSettings.qrCodeSizeMm = toOneDecimal(value, 8, qrCodeSizeMax);
                    setPrintSettings(printSettings);
                  }}
                />
              </Col>
              <Col span={12}>
                <InputNumber
                  min={8}
                  max={qrCodeSizeMax}
                  step={0.1}
                  precision={1}
                  style={{ margin: "0 16px" }}
                  value={qrCodeSizeMm}
                  addonAfter="mm"
                  onChange={(value) => {
                    printSettings.qrCodeSizeMm = toOneDecimal(value ?? 16, 8, qrCodeSizeMax);
                    setPrintSettings(printSettings);
                  }}
                />
              </Col>
            </Row>
          </Form.Item>
          {showQRCodeMode !== "no" && (
            <>
              <Form.Item
                label={t("printing.qrcode.useHTTPUrl.label")}
                tooltip={t("printing.qrcode.useHTTPUrl.tooltip")}
                style={{ marginBottom: 0 }}
              >
                <Radio.Group onChange={(e) => setUseHTTPUrl(e.target.value)} value={useHTTPUrl}>
                  <Radio value={false}>{t("printing.qrcode.useHTTPUrl.options.default")}</Radio>
                  <Radio value={true}>{t("printing.qrcode.useHTTPUrl.options.url")}</Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item label={t("printing.qrcode.useHTTPUrl.preview")}>
                <Text> {useHTTPUrl ? preview.url : preview.default}</Text>
              </Form.Item>
            </>
          )}

          <Divider />
          <Typography.Text strong>{t("printing.qrcode.sectionInformation")}</Typography.Text>
          <Form.Item label={t("printing.qrcode.showContent")} style={{ marginTop: 8 }}>
            <Switch
              checked={showContent}
              onChange={(checked) => {
                printSettings.showContent = checked;
                setPrintSettings(printSettings);
              }}
            />
          </Form.Item>
          <Form.Item label={t("printing.qrcode.infoTextSize")}>
            <Row>
              <Col span={12}>
                <Slider
                  disabled={!showContent}
                  tooltip={{ formatter: (value) => `${value} mm` }}
                  min={1}
                  max={7}
                  value={infoTextSize}
                  step={0.1}
                  onChange={(value) => {
                    printSettings.textSize = value;
                    setPrintSettings(printSettings);
                  }}
                />
              </Col>
              <Col span={12}>
                <InputNumber
                  disabled={!showContent}
                  min={1}
                  max={7}
                  step={0.1}
                  precision={1}
                  style={{ margin: "0 16px" }}
                  value={infoTextSize}
                  addonAfter="mm"
                  onChange={(value) => {
                    printSettings.textSize = value ?? 5;
                    setPrintSettings(printSettings);
                  }}
                />
              </Col>
            </Row>
          </Form.Item>
          <Form.Item label={t("printing.qrcode.infoAlign")}>
            <Segmented
              block
              disabled={!showContent}
              options={[
                { value: "left", icon: <AlignLeftOutlined title={t("printing.qrcode.qrCodePositionLeft")} /> },
                { value: "center", icon: <AlignCenterOutlined title={t("printing.qrcode.qrCodeAlignCenter")} /> },
                { value: "right", icon: <AlignRightOutlined title={t("printing.qrcode.qrCodePositionRight")} /> },
              ]}
              value={infoAlign}
              onChange={(value) => {
                printSettings.infoAlign = value as "left" | "center" | "right";
                setPrintSettings(printSettings);
              }}
            />
          </Form.Item>
          <Form.Item label={t("printing.qrcode.infoVerticalAlign")}>
            <Segmented
              block
              disabled={!showContent}
              options={[
                { value: "top", icon: <VerticalAlignTopOutlined title={t("printing.qrcode.qrCodeAlignTop")} /> },
                {
                  value: "center",
                  icon: <VerticalAlignMiddleOutlined title={t("printing.qrcode.qrCodeAlignCenter")} />,
                },
                {
                  value: "bottom",
                  icon: <VerticalAlignBottomOutlined title={t("printing.qrcode.qrCodeAlignBottom")} />,
                },
              ]}
              value={infoVerticalAlign}
              onChange={(value) => {
                printSettings.infoVerticalAlign = value as "top" | "center" | "bottom";
                setPrintSettings(printSettings);
              }}
            />
          </Form.Item>
          {extraInfoSettings}
        </>
      }
      style={`
            .print-page .print-qrcode-item {
              display: flex;
              flex-direction: column;
              width: 100%;
              height: 100%;
              padding: 0.6mm;
              overflow: hidden;
            }

            .print-page .print-qrcode-header {
              display: flex;
              flex-direction: column;
              width: 100%;
              overflow: visible;
              margin-bottom: 0.3mm;
              gap: 0.4mm;
              max-height: ${maxHeaderHeightMm}mm;
            }

            .print-page .print-qrcode-logo-row {
              width: 100%;
              min-height: ${showManufacturerLogo ? logoHeightMm : 0}mm;
              max-height: ${showManufacturerLogo ? logoHeightMm : 0}mm;
              overflow: hidden;
            }

            .print-page .print-qrcode-logo {
              width: 100%;
              height: 100%;
              display: flex;
              justify-content: ${horizontalToFlex(logoAlign)};
              align-items: center;
              overflow: hidden;
            }

            .print-page .print-qrcode-title-area {
              width: 100%;
              display: block;
              overflow: visible;
              flex: 0 0 auto;
            }

            .print-page .print-qrcode-title-text {
              overflow: visible;
            }

            .print-page .print-qrcode-main {
              flex: 1 1 auto;
              min-height: 0;
              height: 100%;
              display: flex;
              gap: 1mm;
              align-items: stretch;
            }

            .print-page .print-qrcode-main-left {
              flex-direction: row-reverse;
            }

            .print-page .print-qrcode-main-right {
              flex-direction: row;
            }

            .print-page .print-qrcode-info {
              flex: 1 1 auto;
              min-width: 0;
              min-height: 0;
              height: 100%;
              display: flex;
              flex-direction: column;
              justify-content: ${verticalToFlex(infoVerticalAlign)};
              align-items: ${horizontalToFlex(infoAlign)};
              overflow: hidden;
            }

            .print-page .print-qrcode-info-text {
              width: 100%;
              font-size: ${infoTextSize}mm;
              text-align: ${infoAlign};
              color: #000;
              line-height: 1.15;
              overflow: hidden;
            }

            .print-page .print-qrcode-code-column {
              flex: 0 0 auto;
              width: ${qrCodeSizeMm}mm;
              max-width: 80%;
              display: flex;
              align-items: center;
            }

            .print-page .print-qrcode-code-column-top {
              align-items: flex-start;
            }

            .print-page .print-qrcode-code-column-center {
              align-items: center;
            }

            .print-page .print-qrcode-code-column-bottom {
              align-items: flex-end;
            }

            .print-page .print-qrcode-code-box {
              width: min(${qrCodeSizeMm}mm, 100%);
              height: min(${qrCodeSizeMm}mm, 100%);
              aspect-ratio: 1 / 1;
              display: flex;
            }

            .print-page .print-qrcode {
              width: 100% !important;
              height: 100% !important;
              padding: 0.6mm;
            }

            .print-page canvas, .print-page svg {
              object-fit: contain;
              height: 100% !important;
              width: 100% !important;
              max-height: 100%;
              max-width: 100%;
            }
            `}
    />
  );
};

export default QRCodeExportDialog;
