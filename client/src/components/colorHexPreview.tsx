import { Typography } from "antd";
import SpoolIcon from "./spoolIcon";

interface ColorHexPreviewProps {
  colorHex?: string | null;
  multiColorHexes?: string | null;
  multiColorDirection?: string | null;
}

const SMALL_TEXT_STYLE = {
  fontSize: 12,
  color: "rgba(255,255,255,0.45)",
  lineHeight: 1.2,
};

const normalizeHex = (value: string) => `#${value.replace("#", "").toUpperCase()}`;

export default function ColorHexPreview({ colorHex, multiColorHexes, multiColorDirection }: Readonly<ColorHexPreviewProps>) {
  const colors =
    multiColorHexes
      ?.split(",")
      .map((hex) => hex.trim())
      .filter((hex) => hex.length > 0)
      .map(normalizeHex) ?? [];

  if (colors.length <= 1) {
    const singleColor = colorHex ? normalizeHex(colorHex) : colors[0];
    if (!singleColor) return null;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <SpoolIcon color={singleColor} size="large" no_margin />
        <Typography.Text style={SMALL_TEXT_STYLE}>{singleColor}</Typography.Text>
      </div>
    );
  }

  const isLongitudinal = multiColorDirection === "longitudinal";
  if (isLongitudinal) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {colors.map((hex) => (
          <div key={hex} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 56,
                height: 22,
                borderRadius: 5,
                border: "1px solid rgba(255,255,255,0.22)",
                background: hex,
              }}
            />
            <Typography.Text style={SMALL_TEXT_STYLE}>{hex}</Typography.Text>
          </div>
        ))}
      </div>
    );
  }

  const swatchWidth = Math.max(64, colors.length * 22);
  const strip = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${colors.length}, minmax(0, 1fr))`,
        width: swatchWidth,
        height: 26,
        borderRadius: 6,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.22)",
      }}
    >
      {colors.map((hex, index) => (
        <div key={`${hex}-${index}`} style={{ background: hex }} />
      ))}
    </div>
  );

  if (colors.length === 2) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Typography.Text style={SMALL_TEXT_STYLE}>{colors[0]}</Typography.Text>
        {strip}
        <Typography.Text style={SMALL_TEXT_STYLE}>{colors[1]}</Typography.Text>
      </div>
    );
  }

  const middle = colors.slice(1, -1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Typography.Text style={SMALL_TEXT_STYLE}>{colors[0]}</Typography.Text>
        {strip}
        <Typography.Text style={SMALL_TEXT_STYLE}>{colors[colors.length - 1]}</Typography.Text>
      </div>
      <div style={{ marginLeft: 8 + 54, display: "grid", gridTemplateColumns: `repeat(${middle.length}, minmax(0, 1fr))`, width: swatchWidth - 44 }}>
        {middle.map((hex, index) => (
          <Typography.Text key={`${hex}-${index}`} style={{ ...SMALL_TEXT_STYLE, textAlign: "center" }}>
            {hex}
          </Typography.Text>
        ))}
      </div>
    </div>
  );
}
