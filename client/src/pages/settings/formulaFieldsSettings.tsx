import { json } from "@codemirror/lang-json";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView, drawSelection } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { tags as highlightTags } from "@lezer/highlight";
import {
  CloseCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useTranslate } from "@refinedev/core";
import {
  Button,
  Checkbox,
  Col,
  Collapse,
  Divider,
  Empty,
  Flex,
  Form,
  Grid,
  Input,
  Modal,
  Popconfirm,
  Row,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
  theme,
} from "antd";
import { ColumnType } from "antd/es/table";
import { type CSSProperties, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  FORMULA_HELPER_GROUPS,
  FORMULA_HELPERS,
  FormulaHelperDefinition,
  getExtraFieldReferences,
  getFormulaReferencesFromJsonLogic,
} from "../../utils/formulaFields";
import {
  FormulaFieldSurface,
  DerivedField,
  DerivedFieldType,
  EntityType,
  FieldType,
  Field,
  useDeleteDerivedField,
  useGetDerivedFields,
  useGetFields,
  usePreviewDerivedField,
  useSetDerivedField,
} from "../../utils/queryFields";
import { useSavedState } from "../../utils/saveload";

const BUILTIN_REFERENCE_SUGGESTIONS: Record<EntityType, string[]> = {
  vendor: ["id", "registered", "created_at", "name", "comment", "empty_spool_weight", "external_id"],
  filament: [
    "id",
    "registered",
    "created_at",
    "name",
    "material",
    "price",
    "density",
    "diameter",
    "weight",
    "spool_weight",
    "article_number",
    "comment",
    "settings_extruder_temp",
    "settings_bed_temp",
    "color_hex",
    "multi_color_hexes",
    "multi_color_direction",
    "external_id",
    "vendor.id",
    "vendor.registered",
    "vendor.created_at",
    "vendor.name",
    "vendor.comment",
    "vendor.empty_spool_weight",
    "vendor.external_id",
  ],
  spool: [
    "id",
    "weight",
    "registered",
    "created_at",
    "first_used",
    "last_used",
    "price",
    "initial_weight",
    "spool_weight",
    "remaining_weight",
    "used_weight",
    "remaining_length",
    "used_length",
    "location",
    "lot_nr",
    "comment",
    "archived",
    "filament.id",
    "filament.registered",
    "filament.created_at",
    "filament.name",
    "filament.material",
    "filament.price",
    "filament.density",
    "filament.diameter",
    "filament.weight",
    "filament.spool_weight",
    "filament.article_number",
    "filament.comment",
    "filament.settings_extruder_temp",
    "filament.settings_bed_temp",
    "filament.color_hex",
    "filament.multi_color_hexes",
    "filament.multi_color_direction",
    "filament.external_id",
    "filament.vendor.id",
    "filament.vendor.registered",
    "filament.vendor.created_at",
    "filament.vendor.name",
    "filament.vendor.comment",
    "filament.vendor.empty_spool_weight",
    "filament.vendor.external_id",
  ],
};
const SAMPLE_VALUE_PLACEHOLDERS: Record<EntityType, string> = {
  vendor: '{"name": "Example Vendor", "registered": "2026-02-28T10:15:00Z"}',
  filament: '{"weight": 482.36, "material": "PLA", "registered": "2026-02-28T10:15:00Z", "color_hex": "#FF00FF"}',
  spool:
    '{"weight": 482.36, "remaining_weight": 225.12, "registered": "2026-02-28T10:15:00Z", "filament": {"weight": 1000, "price": 24.99, "color_hex": "#FF00FF", "vendor": {"name": "Example Vendor"}}}',
};
const EXTRA_REFERENCE_PREFIXES: Record<EntityType, string[]> = {
  vendor: ["extra."],
  filament: ["extra.", "vendor.extra."],
  spool: ["extra.", "filament.extra.", "filament.vendor.extra."],
};
const JSON_LOGIC_OPERATOR_GROUPS: Array<{ key: string; operators: string[] }> = [
  { key: "logical", operators: ["if", "and", "or", "!"] },
  { key: "comparison", operators: ["==", "!=", "<", "<=", ">", ">="] },
  { key: "arithmetic", operators: ["+", "-", "*", "/", "%", "floor"] },
];
// Layout constants for consistent spacing and sizing.
// PREVIEW_PANEL_WIDTH is reused beside Sample Values so the compact preview stays visually aligned.
const OPERATOR_PANEL_WIDTH = 244;
const INLINE_OPERATOR_PANEL_HEIGHT = 188;
const JSON_LOGIC_OPERATOR_SNIPPETS: Record<string, string> = {
  if: '{\n  "if": [\n    {"var": "condition"},\n    "then_value",\n    "else_value"\n  ]\n}',
  and: '{\n  "and": [\n    {"var": "left"},\n    {"var": "right"}\n  ]\n}',
  or: '{\n  "or": [\n    {"var": "left"},\n    {"var": "right"}\n  ]\n}',
  "!": '{\n  "!": [\n    {"var": "value"}\n  ]\n}',
  "==": '{\n  "==": [\n    {"var": "left"},\n    {"var": "right"}\n  ]\n}',
  "!=": '{\n  "!=": [\n    {"var": "left"},\n    {"var": "right"}\n  ]\n}',
  "<": '{\n  "<": [\n    {"var": "left"},\n    {"var": "right"}\n  ]\n}',
  "<=": '{\n  "<=": [\n    {"var": "left"},\n    {"var": "right"}\n  ]\n}',
  ">": '{\n  ">": [\n    {"var": "left"},\n    {"var": "right"}\n  ]\n}',
  ">=": '{\n  ">=": [\n    {"var": "left"},\n    {"var": "right"}\n  ]\n}',
  "+": '{\n  "+": [\n    {"var": "left"},\n    {"var": "right"}\n  ]\n}',
  "-": '{\n  "-": [\n    {"var": "left"},\n    {"var": "right"}\n  ]\n}',
  "*": '{\n  "*": [\n    {"var": "left"},\n    {"var": "right"}\n  ]\n}',
  "/": '{\n  "/": [\n    {"var": "left"},\n    {"var": "right"}\n  ]\n}',
  "%": '{\n  "%": [\n    {"var": "left"},\n    {"var": "right"}\n  ]\n}',
  floor: '{\n  "floor": [\n    {"var": "value"}\n  ]\n}',
};
const JSON_LOGIC_OPERATOR_OPERAND_COUNTS: Record<string, number> = {
  if: 3,
  and: 2,
  or: 2,
  "!": 1,
  "==": 2,
  "!=": 2,
  "<": 2,
  "<=": 2,
  ">": 2,
  ">=": 2,
  "+": 2,
  "-": 2,
  "*": 2,
  "/": 2,
  "%": 2,
  floor: 1,
};
// IF guided mode narrows the condition-builder to explicit comparison operators only.
const IF_CONDITION_COMPARISON_OPERATORS = new Set(["==", "!=", "<", "<=", ">", ">="]);
// Default scaffold shown immediately when IF is clicked on an empty editor.
const IF_SCAFFOLD_SNIPPET = '{\n  "if": [\n    {\n      "Condition": []\n    },\n    "Then",\n    "Else"\n  ]\n}';
const RESERVED_DERIVED_KEY_NAMES = new Set([
  ...JSON_LOGIC_OPERATOR_GROUPS.flatMap((group) => group.operators),
  ...FORMULA_HELPERS.map((helper) => helper.name),
]);

type ReferenceValueKind = "any" | "number" | "datetime" | "text" | "boolean" | "range" | "unknown";
type PendingTokenInsertState = {
  tokenName: string;
  tokenKind: "helper" | "operator";
  selectedOperands: unknown[];
  pendingIfComparisonOperator?: string | null;
  pendingIfComparisonOperands?: unknown[];
};
type PendingOperatorOperandConstraint = {
  mode: "comparison-operator" | "expression";
  allowedReferenceKinds: "scalar" | ReferenceValueKind[];
  allowedTokenKinds: "any" | ReferenceValueKind[];
  selectedKind?: ReferenceValueKind | null;
};
type PendingOperatorInsertState = {
  operator: string;
  selectedOperands: unknown[];
  requiredOperandCount: number;
  // `if` can optionally guide users through a structured condition:
  // compare operator -> left operand -> right operand -> then -> else.
  pendingIfComparisonOperator?: string | null;
  pendingIfComparisonOperands?: unknown[];
  replaceEditorOnComplete?: boolean;
};
type PendingHelperHintState = {
  helper: string;
  selected: number;
  total: number;
  allowHelperOnly: boolean;
  stepLabelKey?: string;
};
type FormulaResultTypeHint = "number" | "text" | "boolean" | "date" | "datetime" | "time" | "unknown";
type ReferenceSemanticKind = "generic" | "color_hex";
type ReferencePickerGroupDefinition = {
  key: string;
  labelType: "entity" | "extra";
  entityType: EntityType;
  source: "builtin" | "extra";
  prefix: string;
  excludedPrefixes?: string[];
  defaultExpanded: boolean;
  scope: "current" | "related";
};
type ReferencePickerOption = {
  value: string;
  label: string;
  fullLabel: string;
  searchText: string;
};
type ReferencePickerGroup = ReferencePickerGroupDefinition & {
  label: string;
  references: ReferencePickerOption[];
};
type TokenDefinition = {
  kind: "operator" | "helper";
  name: string;
};
type TokenCategory = {
  key: string;
  label: string;
  tokens: TokenDefinition[];
};

type FormulaFieldEditRequest = {
  key: string;
  nonce: number;
};

type FormulaFieldsSettingsProps = {
  editRequest?: FormulaFieldEditRequest | null;
  onEditRequestHandled?: () => void;
};

const REFERENCE_PICKER_GROUPS: Record<EntityType, ReferencePickerGroupDefinition[]> = {
  vendor: [
    {
      key: "vendor-builtins",
      labelType: "entity",
      entityType: EntityType.vendor,
      source: "builtin",
      prefix: "",
      defaultExpanded: true,
      scope: "current",
    },
    {
      key: "vendor-extra",
      labelType: "extra",
      entityType: EntityType.vendor,
      source: "extra",
      prefix: "extra.",
      defaultExpanded: true,
      scope: "current",
    },
  ],
  filament: [
    {
      key: "filament-builtins",
      labelType: "entity",
      entityType: EntityType.filament,
      source: "builtin",
      prefix: "",
      defaultExpanded: true,
      scope: "current",
    },
    {
      key: "filament-extra",
      labelType: "extra",
      entityType: EntityType.filament,
      source: "extra",
      prefix: "extra.",
      defaultExpanded: true,
      scope: "current",
    },
    {
      key: "vendor-builtins",
      labelType: "entity",
      entityType: EntityType.vendor,
      source: "builtin",
      prefix: "vendor.",
      excludedPrefixes: ["vendor.extra."],
      defaultExpanded: false,
      scope: "related",
    },
    {
      key: "vendor-extra",
      labelType: "extra",
      entityType: EntityType.vendor,
      source: "extra",
      prefix: "vendor.extra.",
      defaultExpanded: false,
      scope: "related",
    },
  ],
  spool: [
    {
      key: "spool-builtins",
      labelType: "entity",
      entityType: EntityType.spool,
      source: "builtin",
      prefix: "",
      defaultExpanded: true,
      scope: "current",
    },
    {
      key: "spool-extra",
      labelType: "extra",
      entityType: EntityType.spool,
      source: "extra",
      prefix: "extra.",
      defaultExpanded: true,
      scope: "current",
    },
    {
      key: "filament-builtins",
      labelType: "entity",
      entityType: EntityType.filament,
      source: "builtin",
      prefix: "filament.",
      excludedPrefixes: ["filament.extra.", "filament.vendor."],
      defaultExpanded: false,
      scope: "related",
    },
    {
      key: "filament-extra",
      labelType: "extra",
      entityType: EntityType.filament,
      source: "extra",
      prefix: "filament.extra.",
      defaultExpanded: false,
      scope: "related",
    },
    {
      key: "vendor-builtins",
      labelType: "entity",
      entityType: EntityType.vendor,
      source: "builtin",
      prefix: "filament.vendor.",
      excludedPrefixes: ["filament.vendor.extra."],
      defaultExpanded: false,
      scope: "related",
    },
    {
      key: "vendor-extra",
      labelType: "extra",
      entityType: EntityType.vendor,
      source: "extra",
      prefix: "filament.vendor.extra.",
      defaultExpanded: false,
      scope: "related",
    },
  ],
};

function getDefaultExpandedReferenceGroups(entityType: EntityType): string[] {
  return REFERENCE_PICKER_GROUPS[entityType].filter((group) => group.defaultExpanded).map((group) => group.key);
}

function referenceMatchesGroup(reference: string, group: ReferencePickerGroupDefinition): boolean {
  if (group.source === "extra") {
    return reference.startsWith(group.prefix);
  }
  if (group.prefix === "") {
    return !reference.includes(".");
  }
  if (!reference.startsWith(group.prefix)) {
    return false;
  }
  return !(group.excludedPrefixes || []).some((prefix) => reference.startsWith(prefix));
}

function compactReferenceLabel(reference: string, prefix: string): string {
  if (!prefix) {
    return reference;
  }
  return reference.startsWith(prefix) ? reference.slice(prefix.length) : reference;
}

// Resolve the current IF guided-insert prompt step so the yellow helper hint can
// explicitly tell users what token click is expected next.
function getIfPendingStepLabelKey(state: PendingOperatorInsertState): string {
  if (state.selectedOperands.length === 0) {
    if (!state.pendingIfComparisonOperator) {
      return "settings.formula_fields.formula.json_builder.if_step_condition_operator";
    }
    const comparisonOperandCount = state.pendingIfComparisonOperands?.length || 0;
    if (comparisonOperandCount === 0) {
      return "settings.formula_fields.formula.json_builder.if_step_condition_left";
    }
    return "settings.formula_fields.formula.json_builder.if_step_condition_right";
  }
  if (state.selectedOperands.length === 1) {
    return "settings.formula_fields.formula.json_builder.if_step_then";
  }
  return "settings.formula_fields.formula.json_builder.if_step_else";
}

const BUILTIN_REFERENCE_KIND_HINTS: Record<EntityType, Record<string, ReferenceValueKind>> = {
  vendor: {
    id: "number",
    name: "text",
    registered: "datetime",
    comment: "text",
  },
  filament: {
    id: "number",
    name: "text",
    material: "text",
    price: "number",
    density: "number",
    weight: "number",
    color_hex: "text",
    comment: "text",
    registered: "datetime",
    created_at: "datetime",
  },
  spool: {
    id: "number",
    weight: "number",
    remaining_weight: "number",
    used_weight: "number",
    price: "number",
    lot_nr: "text",
    comment: "text",
    registered: "datetime",
    created_at: "datetime",
  },
};

const NUMERIC_REFERENCE_LEAFS = new Set([
  "id",
  "price",
  "density",
  "diameter",
  "weight",
  "initial_weight",
  "spool_weight",
  "remaining_weight",
  "used_weight",
  "remaining_length",
  "used_length",
  "settings_extruder_temp",
  "settings_bed_temp",
  "empty_spool_weight",
]);
const DATETIME_REFERENCE_LEAFS = new Set(["registered", "created_at", "first_used", "last_used"]);
const BOOLEAN_REFERENCE_LEAFS = new Set(["archived"]);

function inferBuiltinReferenceKind(reference: string): ReferenceValueKind {
  const leaf = reference.split(".").filter(Boolean).at(-1) || reference;
  if (NUMERIC_REFERENCE_LEAFS.has(leaf)) {
    return "number";
  }
  if (DATETIME_REFERENCE_LEAFS.has(leaf)) {
    return "datetime";
  }
  if (BOOLEAN_REFERENCE_LEAFS.has(leaf)) {
    return "boolean";
  }
  return "text";
}

function inferReferenceSemantic(reference: string): ReferenceSemanticKind {
  const leaf = reference.split(".").filter(Boolean).at(-1) || reference;
  return leaf === "color_hex" ? "color_hex" : "generic";
}

function isScalarReferenceKind(kind: ReferenceValueKind): boolean {
  return ["text", "number", "datetime", "boolean"].includes(kind);
}

function resolveColorLuminance(color: string): number | null {
  const normalized = color.trim().toLowerCase();

  const hexMatch = normalized.match(/^#([a-f0-9]{3,4}|[a-f0-9]{6}|[a-f0-9]{8})$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    const value =
      hex.length === 3 || hex.length === 4 ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex.slice(0, 6);
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  const rgbMatch = normalized.match(/^rgba?\(([^)]+)\)$/);
  if (!rgbMatch) {
    return null;
  }
  const channels = rgbMatch[1]
    .split(",")
    .map((part) => part.trim())
    .slice(0, 3);
  if (channels.length !== 3) {
    return null;
  }

  const toByte = (channel: string): number | null => {
    if (channel.endsWith("%")) {
      const percent = Number(channel.slice(0, -1));
      if (Number.isNaN(percent)) {
        return null;
      }
      return Math.round((Math.max(0, Math.min(100, percent)) / 100) * 255);
    }
    const value = Number(channel);
    if (Number.isNaN(value)) {
      return null;
    }
    return Math.max(0, Math.min(255, value));
  };

  const r = toByte(channels[0]);
  const g = toByte(channels[1]);
  const b = toByte(channels[2]);
  if (r == null || g == null || b == null) {
    return null;
  }
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function formatPreviewValue(value: string | number | boolean | null): string {
  if (value === null) {
    return "null";
  }
  return `${value}`;
}

// Validates and parses sample values JSON. Called during form validation.
// Throws localized error message if JSON is invalid (not an object).
function parseSampleValues(raw: string | undefined, errorTranslation?: string): Record<string, unknown> {
  if (!raw || raw.trim() === "") {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error(errorTranslation || "Sample values must be a JSON object.");
    }
    return parsed as Record<string, unknown>;
  } catch (e) {
    if (e instanceof Error && (e.message === errorTranslation || !errorTranslation)) {
      throw e;
    }
    // If JSON.parse failed, throw the user-friendly error
    throw new Error(errorTranslation || "Sample values must be a JSON object.");
  }
}

// Validates and parses expression JSON. Called during form validation.
// Returns undefined if empty, throws localized error if invalid.
function parseExpressionJson(raw: string | undefined, errorTranslation?: string): Record<string, unknown> | undefined {
  if (!raw || raw.trim() === "") {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error(errorTranslation || "Expression JSON must be a JSON object.");
    }
    return parsed as Record<string, unknown>;
  } catch (e) {
    if (e instanceof Error && (e.message === errorTranslation || !errorTranslation)) {
      throw e;
    }
    // If JSON.parse failed, throw the user-friendly error
    throw new Error(errorTranslation || "Expression JSON must be a JSON object.");
  }
}

function hasReferencePath(sampleValues: Record<string, unknown>, reference: string): boolean {
  const parts = reference.split(".").filter((part) => part.length > 0);
  if (parts.length === 0) {
    return false;
  }

  let current: unknown = sampleValues;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
      return false;
    }
    const record = current as Record<string, unknown>;
    if (!(part in record)) {
      return false;
    }
    current = record[part];
  }

  return true;
}

// Ensure every detected reference path exists in sample JSON so preview can evaluate formulas
// immediately without requiring the user to hand-create nested keys.
function insertReferencePathIfMissing(
  sampleValues: Record<string, unknown>,
  reference: string,
  defaultValue: unknown,
): boolean {
  const parts = reference.split(".").filter((part) => part.length > 0);
  if (parts.length === 0) {
    return false;
  }

  let current: Record<string, unknown> = sampleValues;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    const existing = current[part];
    if (existing === undefined) {
      current[part] = {};
      current = current[part] as Record<string, unknown>;
      continue;
    }
    if (existing === null || typeof existing !== "object" || Array.isArray(existing)) {
      return false;
    }
    current = existing as Record<string, unknown>;
  }

  const leaf = parts[parts.length - 1];
  if (leaf in current) {
    return false;
  }
  current[leaf] = defaultValue;
  return true;
}

// Remove a previously auto-managed reference path when it no longer appears in the expression.
// This keeps sample JSON aligned with active refs and prunes empty parent objects afterwards.
function removeReferencePathIfPresent(sampleValues: Record<string, unknown>, reference: string): boolean {
  const parts = reference.split(".").filter((part) => part.length > 0);
  if (parts.length === 0) {
    return false;
  }

  const parents: Array<{ record: Record<string, unknown>; key: string }> = [];
  let current: Record<string, unknown> = sampleValues;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    const nextValue = current[part];
    if (nextValue === null || typeof nextValue !== "object" || Array.isArray(nextValue)) {
      return false;
    }
    parents.push({ record: current, key: part });
    current = nextValue as Record<string, unknown>;
  }

  const leaf = parts[parts.length - 1];
  if (!(leaf in current)) {
    return false;
  }
  delete current[leaf];

  // Remove now-empty containers so deleted transient references do not leave dead paths behind.
  for (let index = parents.length - 1; index >= 0; index -= 1) {
    const { record, key } = parents[index];
    const value = record[key];
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      break;
    }
    if (Object.keys(value as Record<string, unknown>).length > 0) {
      break;
    }
    delete record[key];
  }
  return true;
}

// Use bounded random numeric defaults so auto-scaffolded sample values feel realistic
// and avoid repeating the same constant during expression authoring.
function randomIntegerSampleValue(): number {
  return Math.floor(Math.random() * 1001);
}

function randomFloatSampleValue(): number {
  return Number((Math.random() * 1000).toFixed(2));
}

// Randomize datetime sample times so date-diff previews surface fractional values by default.
function randomTwoDigitSampleValue(maxExclusive: number): string {
  return Math.floor(Math.random() * maxExclusive)
    .toString()
    .padStart(2, "0");
}

function randomIsoDatetimeSampleValue(baseDate: string): string {
  return (
    baseDate +
    "T" +
    randomTwoDigitSampleValue(24) +
    ":" +
    randomTwoDigitSampleValue(60) +
    ":" +
    randomTwoDigitSampleValue(60) +
    "Z"
  );
}

function randomOrderedIntegerRangeSampleValue(): [number, number] {
  const first = randomIntegerSampleValue();
  const second = randomIntegerSampleValue();
  return first <= second ? [first, second] : [second, first];
}

function randomOrderedFloatRangeSampleValue(): [number, number] {
  const first = randomFloatSampleValue();
  const second = randomFloatSampleValue();
  return first <= second ? [first, second] : [second, first];
}

function getSampleDefaultValue(kind: ReferenceValueKind, reference: string, configuredField?: Field): unknown {
  // Custom extra-field defaults are type-driven so newly referenced fields get
  // meaningful sample values immediately for preview runs.
  if (configuredField) {
    switch (configuredField.field_type) {
      case FieldType.text:
        return "Preview Text";
      case FieldType.integer:
        return randomIntegerSampleValue();
      case FieldType.integer_range:
        return randomOrderedIntegerRangeSampleValue();
      case FieldType.float:
        return randomFloatSampleValue();
      case FieldType.float_range:
        return randomOrderedFloatRangeSampleValue();
      case FieldType.datetime:
        // ISO format preserves the user-requested timestamp/CET intent while remaining parser-safe.
        return randomIsoDatetimeSampleValue("2019-05-01");
      case FieldType.boolean:
        return true;
      case FieldType.choice:
        if (configuredField.multi_choice) {
          return configuredField.choices?.slice(0, 2) ?? ["Spool", "Man"];
        }
        return configuredField.choices?.[0] ?? "Spool";
      default:
        return null;
    }
  }

  const referenceLeaf = reference.split(".").filter(Boolean).at(-1) || reference;
  const normalizedLeaf = referenceLeaf.toLowerCase();

  // Seed known semantic fields with practical defaults so preview works immediately
  // without forcing users to hand-craft first-pass sample values.
  if (normalizedLeaf.includes("color_hex") || normalizedLeaf.endsWith("_hex")) {
    return "#FF00FF";
  }

  switch (kind) {
    case "number":
      return randomFloatSampleValue();
    case "boolean":
      return false;
    case "datetime":
      return randomIsoDatetimeSampleValue("2026-01-01");
    case "text":
      return "sample_text";
    case "range":
      return randomOrderedFloatRangeSampleValue();
    default:
      return null;
  }
}

function mergeTypeHints(typeHints: FormulaResultTypeHint[]): FormulaResultTypeHint {
  const knownHints = typeHints.filter((typeHint) => typeHint !== "unknown");
  if (knownHints.length === 0) {
    return "unknown";
  }
  return knownHints.every((typeHint) => typeHint === knownHints[0]) ? knownHints[0] : "unknown";
}

function inferExpressionJsonType(node: unknown): FormulaResultTypeHint {
  if (typeof node === "number") {
    return "number";
  }
  if (typeof node === "string") {
    return "text";
  }
  if (typeof node === "boolean") {
    return "boolean";
  }
  if (node === null || Array.isArray(node) || typeof node !== "object") {
    return "unknown";
  }

  const entries = Object.entries(node as Record<string, unknown>);
  if (entries.length !== 1) {
    return "unknown";
  }

  const [operator, rawArgs] = entries[0];
  const args = Array.isArray(rawArgs) ? rawArgs : [rawArgs];

  if (operator === "var") {
    return "unknown";
  }

  if (operator === "if") {
    const branchHints: FormulaResultTypeHint[] = [];
    for (let index = 1; index < args.length; index += 2) {
      branchHints.push(inferExpressionJsonType(args[index]));
    }
    if (args.length % 2 === 0 && args.length > 0) {
      branchHints.push(inferExpressionJsonType(args[args.length - 1]));
    }
    return mergeTypeHints(branchHints);
  }

  if (operator === "coalesce") {
    return mergeTypeHints(args.map((arg) => inferExpressionJsonType(arg)));
  }

  if (["==", "!=", "<", "<=", ">", ">=", "!", "and", "or"].includes(operator)) {
    return "boolean";
  }

  if (
    [
      "+",
      "-",
      "*",
      "/",
      "%",
      "abs",
      "min",
      "max",
      "round",
      "year",
      "month",
      "day",
      "hour",
      "minute",
      "second",
      "timestamp",
      "days_between",
      "hours_between",
      "hue_from_hex",
      "length",
    ].includes(operator)
  ) {
    return "number";
  }

  if (["cat", "concat", "replace", "trim", "upper", "lower", "left", "right"].includes(operator)) {
    return "text";
  }
  if (["date_only", "today"].includes(operator)) {
    return "date";
  }
  if (operator === "time_only") {
    return "time";
  }

  return "unknown";
}

function toDerivedFieldType(typeHint: FormulaResultTypeHint): DerivedFieldType | null {
  if (typeHint === "number") {
    return DerivedFieldType.number;
  }
  if (typeHint === "text") {
    return DerivedFieldType.text;
  }
  if (typeHint === "boolean") {
    return DerivedFieldType.boolean;
  }
  if (typeHint === "date") {
    return DerivedFieldType.date;
  }
  if (typeHint === "datetime") {
    return DerivedFieldType.datetime;
  }
  if (typeHint === "time") {
    return DerivedFieldType.time;
  }
  return null;
}

function resultTypeHintToReferenceKind(typeHint: FormulaResultTypeHint): ReferenceValueKind {
  switch (typeHint) {
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "date":
    case "datetime":
    case "time":
      return "datetime";
    case "text":
      return "text";
    default:
      return "unknown";
  }
}

function inferOperandValueKind(
  operand: unknown,
  referenceKindByName: Record<string, ReferenceValueKind>,
): ReferenceValueKind | null {
  const referencedField = extractVarReference(operand);
  if (referencedField) {
    return referenceKindByName[referencedField] || "unknown";
  }
  return resultTypeHintToReferenceKind(inferExpressionJsonType(operand));
}

function extractVarReference(operand: unknown): string | null {
  if (!operand || typeof operand !== "object" || Array.isArray(operand)) {
    return null;
  }
  const entries = Object.entries(operand as Record<string, unknown>);
  if (entries.length === 1 && entries[0][0] === "var" && typeof entries[0][1] === "string") {
    return entries[0][1];
  }
  return null;
}

function tokenResultTypeHint(name: string): FormulaResultTypeHint {
  if (name === "if" || ["==", "!=", "<", "<=", ">", ">=", "!", "and", "or"].includes(name)) {
    return "boolean";
  }
  if (
    [
      "+",
      "-",
      "*",
      "/",
      "%",
      "floor",
      "abs",
      "min",
      "max",
      "round",
      "year",
      "month",
      "day",
      "hour",
      "minute",
      "second",
      "timestamp",
      "days_between",
      "hours_between",
      "hue_from_hex",
      "length",
    ].includes(name)
  ) {
    return "number";
  }
  if (["cat", "trim", "upper", "lower", "left", "right"].includes(name)) {
    return "text";
  }
  if (["date_only", "today"].includes(name)) {
    return "date";
  }
  if (name === "time_only") {
    return "time";
  }
  if (name === "coalesce") {
    return "unknown";
  }
  return "unknown";
}

export function FormulaFieldsSettings({ editRequest, onEditRequestHandled }: FormulaFieldsSettingsProps) {
  const { entityType } = useParams<{ entityType: EntityType }>();
  const selectedEntityType = entityType as EntityType;
  const t = useTranslate();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const [messageApi, contextHolder] = message.useMessage();
  const [derivedModalOpen, setDerivedModalOpen] = useState(false);
  const [editingDerivedKey, setEditingDerivedKey] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewErrorText, setPreviewErrorText] = useState<string | null>(null);
  const [pendingJsonHelperInsert, setPendingJsonHelperInsert] = useState<PendingTokenInsertState | null>(null);
  const [pendingOperatorInsert, setPendingOperatorInsert] = useState<PendingOperatorInsertState | null>(null);
  const [tokensPanelCollapsedByEntity, setTokensPanelCollapsedByEntity] = useSavedState<
    Partial<Record<EntityType, boolean>>
  >("formula-fields-builder-collapsed", {});
  const [expandedReferenceGroupsByEntity, setExpandedReferenceGroupsByEntity] = useSavedState<
    Partial<Record<EntityType, string[]>>
  >("formula-fields-reference-groups", {});
  const [helperCompatiblePanelOpenByEntity, setHelperCompatiblePanelOpenByEntity] = useSavedState<
    Partial<Record<EntityType, boolean>>
  >("formula-fields-helper-compatible-open", {});
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null);
  const [referenceSearch, setReferenceSearch] = useState("");
  const [sampleValuesAutoUpdateEnabled, setSampleValuesAutoUpdateEnabled] = useState(true);
  const [derivedForm] = Form.useForm();
  const expressionJsonEditorRef = useRef<EditorView | null>(null);
  const expressionJsonSelectionRef = useRef<{ from: number; to: number }>({ from: 0, to: 0 });
  const expressionJsonProgrammaticValueRef = useRef<string | null>(null);
  const previewRequestRef = useRef(0);
  // Track only auto-scaffolded sample references so we can safely prune stale transient
  // keys without deleting user-authored sample keys.
  const autoManagedSampleReferencesRef = useRef<Set<string>>(new Set());
  const deferredReferenceSearch = useDeferredValue(referenceSearch.trim().toLowerCase());

  const tokensPanelCollapsed = tokensPanelCollapsedByEntity[selectedEntityType] ?? false;
  const expandedReferenceGroupKeys =
    expandedReferenceGroupsByEntity[selectedEntityType] ?? getDefaultExpandedReferenceGroups(selectedEntityType);
  const helperCompatiblePanelOpen = helperCompatiblePanelOpenByEntity[selectedEntityType] ?? false;
  const niceName = t(`${selectedEntityType}.${selectedEntityType}`);
  const guidedInsertionEnabled = false;
  const sectionBodyStyle = { marginTop: 0, fontSize: token.fontSize, lineHeight: 1.7 };
  const tokenPanelStyle = useMemo(
    () => ({
      border: `1px solid ${token.colorBorderSecondary}`,
      borderRadius: token.borderRadiusLG,
      padding: 8,
      background: token.colorBgContainer,
    }),
    [token.colorBgContainer, token.colorBorderSecondary, token.borderRadiusLG],
  );
  const tokenCategoryStyle = useMemo(
    () => ({
      borderRadius: token.borderRadius,
      border: `1px solid ${token.colorBorderSecondary}`,
      background: token.colorFillQuaternary,
      padding: "5px 8px",
      minHeight: 0,
    }),
    [token.borderRadius, token.colorBorderSecondary, token.colorFillQuaternary],
  );
  const denseTokenCategoryStyle = useMemo<CSSProperties>(
    () => ({
      ...tokenCategoryStyle,
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      gap: 3,
      padding: "5px 8px 6px",
    }),
    [tokenCategoryStyle],
  );
  const tokenCategoryLabelStyle = useMemo<CSSProperties>(
    () => ({
      display: "block",
      lineHeight: 1.05,
      margin: 0,
    }),
    [],
  );
  const tokenCategoryBodyStyle = useMemo<CSSProperties>(
    () => ({
      display: "flex",
      flexWrap: "wrap",
      gap: 2,
      alignItems: "flex-start",
      justifyContent: "flex-start",
    }),
    [],
  );
  const referenceGroupTokenListStyle = useMemo<CSSProperties>(
    () => ({
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      alignItems: "flex-start",
    }),
    [],
  );
  const tokenCategoryColumnsStyle = useMemo<CSSProperties>(
    () => ({
      display: "grid",
      gridTemplateColumns:
        screens.lg || screens.xl || screens.xxl
          ? "repeat(3, minmax(0, 1fr))"
          : screens.md
            ? "repeat(2, minmax(0, 1fr))"
            : "repeat(1, minmax(0, 1fr))",
      gap: 6,
      alignItems: "start",
    }),
    [screens.lg, screens.md, screens.xl, screens.xxl],
  );
  const tokenCategoryColumnStyle = useMemo<CSSProperties>(
    () => ({
      display: "flex",
      flexDirection: "column",
      gap: 6,
      minWidth: 0,
      alignSelf: "start",
    }),
    [],
  );
  const isDesktopLayout = Boolean(screens.lg || screens.xl || screens.xxl);
  const expressionEditorHeight = INLINE_OPERATOR_PANEL_HEIGHT;
  // Keep JSON string tokens orange in both editors so references/values do not appear as errors.
  const codeMirrorHighlightStyle = useMemo(
    () =>
      HighlightStyle.define([
        {
          tag: [highlightTags.string, highlightTags.special(highlightTags.string)],
          color: token.colorWarningText,
        },
      ]),
    [token.colorWarningText],
  );
  const codeMirrorSyntaxHighlight = useMemo(
    () => syntaxHighlighting(codeMirrorHighlightStyle),
    [codeMirrorHighlightStyle],
  );
  const codeMirrorTheme = useMemo(() => {
    const bgLuminance = resolveColorLuminance(token.colorBgContainer);
    const textLuminance = resolveColorLuminance(token.colorText);
    const isDark = bgLuminance != null ? bgLuminance < 0.5 : (textLuminance ?? 0) > 0.6;
    // Use Ant warning background tokens so selection follows the theme palette,
    // but stays muted enough for multiline editing in dark mode.
    const selectionColor = isDark ? token.colorWarningBg : token.colorWarningBgHover;
    const selectionMatchColor = isDark ? "rgba(250, 173, 20, 0.24)" : "rgba(250, 173, 20, 0.18)";
    const activeLineColor = isDark ? "rgba(250, 173, 20, 0.02)" : "rgba(22, 119, 255, 0.04)";
    const activeLineGutterColor = isDark ? "rgba(250, 173, 20, 0.04)" : "rgba(22, 119, 255, 0.06)";
    // Force editor foreground/background directly from design tokens so formula JSON remains
    // readable in both light and dark themes regardless of global CSS inheritance.
    return EditorView.theme(
      {
        "&": {
          backgroundColor: token.colorBgContainer,
          color: token.colorText,
          borderRadius: token.borderRadius,
          border: `1px solid ${token.colorBorder}`,
        },
        "&.cm-editor": {
          backgroundColor: token.colorBgContainer,
          color: token.colorText,
        },
        "& .cm-scroller": {
          backgroundColor: token.colorBgContainer,
          color: token.colorText,
        },
        "&.cm-focused": {
          outline: `1px solid ${token.colorPrimaryBorderHover}`,
        },
        ".cm-scroller": {
          fontFamily: token.fontFamilyCode || "monospace",
        },
        ".cm-content, .cm-line": {
          color: token.colorText,
          caretColor: token.colorText,
        },
        // Keep JSON string literals in warning/orange instead of red so valid string values
        // don't read like errors in either expression or sample-value editors.
        ".cm-string": {
          color: `${token.colorWarningText} !important`,
        },
        ".cm-cursor, .cm-dropCursor": {
          borderLeftColor: token.colorText,
        },
        // Keep bracket feedback enabled (standard editor behavior) but align it to amber theme.
        ".cm-matchingBracket": {
          backgroundColor: `${selectionMatchColor} !important`,
          color: token.colorText,
          outline: `1px solid ${token.colorWarningBorder}`,
          borderRadius: 2,
        },
        ".cm-nonmatchingBracket": {
          backgroundColor: "transparent !important",
          color: token.colorError,
          outline: `1px solid ${token.colorErrorBorder}`,
          borderRadius: 2,
        },
        // Keep selection/search matches enabled (standard behavior), but use the same amber family.
        ".cm-content .cm-selectionMatch, .cm-content .cm-searchMatch, .cm-content .cm-searchMatch-selected": {
          backgroundColor: `${selectionMatchColor} !important`,
          outline: `1px solid ${token.colorWarningBorder}`,
          border: "none !important",
          borderRadius: 2,
          boxShadow: "none !important",
        },
        ".cm-gutters": {
          backgroundColor: token.colorBgElevated,
          color: token.colorTextTertiary,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        },
        ".cm-activeLine": {
          backgroundColor: activeLineColor,
        },
        ".cm-activeLineGutter": {
          backgroundColor: activeLineGutterColor,
        },
        ".cm-selectionLayer": {
          mixBlendMode: "normal",
        },
        // Force one consistent drawn selection color for both focused and blurred states.
        ".cm-selectionBackground, .cm-selectionLayer .cm-selectionBackground, &.cm-focused .cm-selectionBackground, &.cm-focused .cm-selectionLayer .cm-selectionBackground":
          {
            backgroundColor: `${selectionColor} !important`,
            borderRadius: 2,
          },
        // Keep native browser selection transparent so it doesn't override with platform colors.
        ".cm-content ::selection, .cm-line ::selection, .cm-line > span::selection, .cm-content *::selection": {
          backgroundColor: "transparent !important",
        },
      },
      { dark: isDark },
    );
  }, [
    token.borderRadius,
    token.colorBgContainer,
    token.colorBgElevated,
    token.colorBorder,
    token.colorBorderSecondary,
    token.colorError,
    token.colorErrorBorder,
    token.colorPrimaryBorderHover,
    token.colorText,
    token.colorTextTertiary,
    token.colorWarningBorder,
    token.colorWarningBg,
    token.colorWarningBgHover,
    token.fontFamilyCode,
  ]);
  const derivedFields = useGetDerivedFields(selectedEntityType);
  const configuredFields = useGetFields(selectedEntityType);
  const filamentConfiguredFields = useGetFields(EntityType.filament);
  const vendorConfiguredFields = useGetFields(EntityType.vendor);
  const setDerivedField = useSetDerivedField(selectedEntityType);
  const deleteDerivedField = useDeleteDerivedField(selectedEntityType);
  const previewDerivedField = usePreviewDerivedField(selectedEntityType);
  const expressionJsonValue = Form.useWatch("expression_json", derivedForm) as string | undefined;
  const sampleValuesValue = Form.useWatch("sample_values", derivedForm) as string | undefined;
  const derivedKeyValue = ((Form.useWatch("key", derivedForm) as string | undefined) || "").trim();
  // Show the concrete API/template path for the currently typed key to remove
  // ambiguity between formula operator names and field output identifiers.
  const derivedKeyPath = useMemo(
    () => (derivedKeyValue ? `derived.${derivedKeyValue}` : "derived.<key>"),
    [derivedKeyValue],
  );
  const displaySurfaceOptions = useMemo(
    () => [
      { value: FormulaFieldSurface.show, label: t("settings.formula_fields.formula.display_targets.show_pages") },
      {
        value: FormulaFieldSurface.template,
        label: t("settings.formula_fields.formula.display_targets.template_selections"),
      },
      { value: FormulaFieldSurface.list, label: t("settings.formula_fields.formula.display_targets.tables") },
    ],
    [t],
  );
  const keyLooksLikeReservedToken = useMemo(() => RESERVED_DERIVED_KEY_NAMES.has(derivedKeyValue), [derivedKeyValue]);
  const sampleValuesPlaceholder = SAMPLE_VALUE_PLACEHOLDERS[selectedEntityType];

  useEffect(() => {
    if (!derivedModalOpen) {
      setReferenceSearch("");
    }
  }, [derivedModalOpen]);

  useEffect(() => {
    if (!pendingJsonHelperInsert?.tokenName) {
      return;
    }
    setHelperCompatiblePanelOpenByEntity((current) => ({
      ...current,
      [selectedEntityType]: true,
    }));
  }, [pendingJsonHelperInsert?.tokenName, selectedEntityType, setHelperCompatiblePanelOpenByEntity]);

  const labeledField = (labelKey: string, tooltipKey: string) => (
    <Space size={4}>
      <span>{t(labelKey)}</span>
      <Tooltip title={t(tooltipKey)}>
        <QuestionCircleOutlined />
      </Tooltip>
    </Space>
  );

  const referenceOptions = useMemo(() => {
    const extraReferenceGroups: string[] = [];
    EXTRA_REFERENCE_PREFIXES[selectedEntityType].forEach((prefix) => {
      if (prefix === "extra.") {
        (configuredFields.data || []).forEach((field) => extraReferenceGroups.push(`${prefix}${field.key}`));
      } else if (prefix === "filament.extra.") {
        (filamentConfiguredFields.data || []).forEach((field) => extraReferenceGroups.push(`${prefix}${field.key}`));
      } else if (prefix === "filament.vendor.extra." || prefix === "vendor.extra.") {
        (vendorConfiguredFields.data || []).forEach((field) => extraReferenceGroups.push(`${prefix}${field.key}`));
      }
    });
    // Suggest both built-in fields and configured extra fields so users can compose formulas
    // without memorizing the exact reference syntax for each entity.
    return [...new Set([...BUILTIN_REFERENCE_SUGGESTIONS[selectedEntityType], ...extraReferenceGroups])];
  }, [configuredFields.data, filamentConfiguredFields.data, selectedEntityType, vendorConfiguredFields.data]);
  const configuredFieldByReference = useMemo(
    () =>
      ({
        ...Object.fromEntries((configuredFields.data || []).map((field) => [`extra.${field.key}`, field] as const)),
        ...Object.fromEntries(
          (filamentConfiguredFields.data || []).map((field) => [`filament.extra.${field.key}`, field] as const),
        ),
        ...Object.fromEntries(
          (vendorConfiguredFields.data || []).map((field) => [`vendor.extra.${field.key}`, field] as const),
        ),
        ...Object.fromEntries(
          (vendorConfiguredFields.data || []).map((field) => [`filament.vendor.extra.${field.key}`, field] as const),
        ),
      }) as Record<string, Field>,
    [configuredFields.data, filamentConfiguredFields.data, vendorConfiguredFields.data],
  );
  const referenceGroups = useMemo<ReferencePickerGroup[]>(() => {
    const entityNames: Record<EntityType, string> = {
      vendor: t("vendor.vendor"),
      filament: t("filament.filament"),
      spool: t("spool.spool"),
    };

    return REFERENCE_PICKER_GROUPS[selectedEntityType]
      .map((group) => {
        const groupLabel =
          group.labelType === "entity"
            ? entityNames[group.entityType]
            : `${entityNames[group.entityType]} ${t("settings.extra_fields.tab")}`;

        const references = referenceOptions
          .filter((reference) => referenceMatchesGroup(reference, group))
          .map((reference) => {
            const shortLabel = compactReferenceLabel(reference, group.prefix);
            return {
              value: reference,
              label: shortLabel,
              fullLabel: `{${reference}}`,
              searchText: `${shortLabel} ${reference}`.toLowerCase(),
            };
          });

        return {
          ...group,
          label: groupLabel,
          references,
        };
      })
      .filter((group) => group.references.length > 0);
  }, [referenceOptions, selectedEntityType, t]);
  const filteredReferenceGroups = useMemo(() => {
    if (!deferredReferenceSearch) {
      return referenceGroups;
    }

    return referenceGroups
      .map((group) => ({
        ...group,
        references: group.references.filter((reference) => reference.searchText.includes(deferredReferenceSearch)),
      }))
      .filter((group) => group.references.length > 0);
  }, [deferredReferenceSearch, referenceGroups]);
  const visibleReferenceGroupKeys = useMemo(
    () =>
      deferredReferenceSearch
        ? [...new Set([...expandedReferenceGroupKeys, ...filteredReferenceGroups.map((group) => group.key)])]
        : expandedReferenceGroupKeys,
    [deferredReferenceSearch, expandedReferenceGroupKeys, filteredReferenceGroups],
  );
  // Keep parsed expression state explicit so reference syncing only mutates sample JSON
  // when the editor content is valid JSON (invalid typing states should not generate keys).
  const parsedExpressionJson = useMemo(() => {
    try {
      return parseExpressionJson(expressionJsonValue);
    } catch {
      return null;
    }
  }, [expressionJsonValue]);

  // Detect active var references from the current valid expression only.
  const detectedExpressionReferences = useMemo(() => {
    if (!parsedExpressionJson) {
      return [] as string[];
    }
    return getFormulaReferencesFromJsonLogic(parsedExpressionJson).filter((reference) => reference.trim().length > 0);
  }, [parsedExpressionJson]);
  const parsedSampleValues = useMemo(() => {
    try {
      return parseSampleValues(sampleValuesValue);
    } catch {
      return null;
    }
  }, [sampleValuesValue]);
  const currentDerivedResultType = useMemo(() => {
    const inferredType = parsedExpressionJson
      ? toDerivedFieldType(inferExpressionJsonType(parsedExpressionJson))
      : null;
    if (inferredType) {
      return inferredType;
    }
    if (editingDerivedKey) {
      return (
        derivedFields.data?.find((field) => field.key === editingDerivedKey)?.result_type ?? DerivedFieldType.number
      );
    }
    return DerivedFieldType.number;
  }, [derivedFields.data, editingDerivedKey, parsedExpressionJson]);
  const missingSampleValueReferences = useMemo(() => {
    if (!parsedSampleValues) {
      return [] as string[];
    }
    return detectedExpressionReferences.filter((reference) => !hasReferencePath(parsedSampleValues, reference));
  }, [detectedExpressionReferences, parsedSampleValues]);
  const hasValidSampleValues = parsedSampleValues !== null;
  const helperByName = useMemo(
    () => Object.fromEntries(FORMULA_HELPERS.map((helper) => [helper.name, helper] as const)),
    [],
  );
  const tokenCategories = useMemo<TokenCategory[]>(
    () => [
      {
        key: "logical",
        label: t("settings.formula_fields.formula.token_categories.logical"),
        tokens: JSON_LOGIC_OPERATOR_GROUPS.find((group) => group.key === "logical")!.operators.map((name) => ({
          kind: "operator",
          name,
        })),
      },
      {
        key: "comparison",
        label: t("settings.formula_fields.formula.token_categories.comparison"),
        tokens: JSON_LOGIC_OPERATOR_GROUPS.find((group) => group.key === "comparison")!.operators.map((name) => ({
          kind: "operator",
          name,
        })),
      },
      {
        key: "math",
        label: t("settings.formula_fields.formula.token_categories.math"),
        tokens: ["+", "-", "*", "/", "%", "floor", "abs", "min", "max", "round", "coalesce"].map((name) => ({
          kind: JSON_LOGIC_OPERATOR_SNIPPETS[name] ? ("operator" as const) : ("helper" as const),
          name,
        })),
      },
      {
        key: "text",
        label: t("settings.formula_fields.formula.token_categories.text"),
        tokens: FORMULA_HELPER_GROUPS.find((group) => group.key === "text")!.helpers.map((helper) => ({
          kind: "helper",
          name: helper.name,
        })),
      },
      {
        key: "datetime",
        label: t("settings.formula_fields.formula.token_categories.datetime"),
        tokens: FORMULA_HELPER_GROUPS.find((group) => group.key === "datetime")!.helpers.map((helper) => ({
          kind: "helper",
          name: helper.name,
        })),
      },
      {
        key: "dynamic",
        label: t("settings.formula_fields.formula.token_categories.dynamic"),
        tokens: FORMULA_HELPER_GROUPS.find((group) => group.key === "dynamic")!.helpers.map((helper) => ({
          kind: "helper",
          name: helper.name,
        })),
      },
      {
        key: "date_diff",
        label: t("settings.formula_fields.formula.token_categories.date_diff"),
        tokens: FORMULA_HELPER_GROUPS.find((group) => group.key === "date_diff")!.helpers.map((helper) => ({
          kind: "helper",
          name: helper.name,
        })),
      },
      {
        key: "color",
        label: t("settings.formula_fields.formula.token_categories.color"),
        tokens: FORMULA_HELPER_GROUPS.find((group) => group.key === "color")!.helpers.map((helper) => ({
          kind: "helper",
          name: helper.name,
        })),
      },
    ],
    [t],
  );
  const tokenCategoriesByKey = useMemo(
    () => Object.fromEntries(tokenCategories.map((category) => [category.key, category])),
    [tokenCategories],
  );
  const orderedTokenCategoryColumns = useMemo<TokenCategory[][]>(() => {
    const pick = (keys: string[]) =>
      keys.map((key) => tokenCategoriesByKey[key]).filter((category): category is TokenCategory => Boolean(category));

    if (screens.lg || screens.xl || screens.xxl) {
      return [
        pick(["logical", "text", "color"]),
        pick(["comparison", "datetime"]),
        pick(["math", "dynamic", "date_diff"]),
      ];
    }

    if (screens.md) {
      return [pick(["logical", "comparison", "math", "dynamic", "color", "date_diff"]), pick(["text", "datetime"])];
    }

    return [tokenCategories];
  }, [screens.lg, screens.md, screens.xl, screens.xxl, tokenCategories, tokenCategoriesByKey]);
  const referenceKindByName = useMemo(() => {
    const map: Record<string, ReferenceValueKind> = Object.fromEntries(
      BUILTIN_REFERENCE_SUGGESTIONS[selectedEntityType].map((reference) => [
        reference,
        BUILTIN_REFERENCE_KIND_HINTS[selectedEntityType][reference] || inferBuiltinReferenceKind(reference),
      ]),
    );

    (configuredFields.data || []).forEach((field) => {
      const fieldKind: ReferenceValueKind = (() => {
        switch (field.field_type) {
          case FieldType.integer:
          case FieldType.float:
            return "number";
          case FieldType.datetime:
            return "datetime";
          case FieldType.boolean:
            return "boolean";
          case FieldType.integer_range:
          case FieldType.float_range:
            return "range";
          case FieldType.text:
          case FieldType.choice:
            return "text";
          default:
            return "unknown";
        }
      })();
      map[`extra.${field.key}`] = fieldKind;
    });
    (filamentConfiguredFields.data || []).forEach((field) => {
      const fieldKind: ReferenceValueKind = (() => {
        switch (field.field_type) {
          case FieldType.integer:
          case FieldType.float:
            return "number";
          case FieldType.datetime:
            return "datetime";
          case FieldType.boolean:
            return "boolean";
          case FieldType.integer_range:
          case FieldType.float_range:
            return "range";
          case FieldType.text:
          case FieldType.choice:
            return "text";
          default:
            return "unknown";
        }
      })();
      map[`filament.extra.${field.key}`] = fieldKind;
    });
    (vendorConfiguredFields.data || []).forEach((field) => {
      const fieldKind: ReferenceValueKind = (() => {
        switch (field.field_type) {
          case FieldType.integer:
          case FieldType.float:
            return "number";
          case FieldType.datetime:
            return "datetime";
          case FieldType.boolean:
            return "boolean";
          case FieldType.integer_range:
          case FieldType.float_range:
            return "range";
          case FieldType.text:
          case FieldType.choice:
            return "text";
          default:
            return "unknown";
        }
      })();
      map[`vendor.extra.${field.key}`] = fieldKind;
      map[`filament.vendor.extra.${field.key}`] = fieldKind;
    });

    return map;
  }, [configuredFields.data, filamentConfiguredFields.data, selectedEntityType, vendorConfiguredFields.data]);
  const referenceSemanticByName = useMemo(
    () => Object.fromEntries(referenceOptions.map((reference) => [reference, inferReferenceSemantic(reference)])),
    [referenceOptions],
  );
  const getHelperReferenceCount = (helper: FormulaHelperDefinition): number => {
    if (helper.insert_mode === "none") {
      return 0;
    }
    return helper.reference_count ?? 1;
  };
  // Resolve how many operands an operator requires so the click-flow can collect
  // references/helpers and insert complete JSON Logic snippets in one step.
  const getOperatorOperandCount = (operator: string): number => {
    return JSON_LOGIC_OPERATOR_OPERAND_COUNTS[operator] ?? 2;
  };
  const getPendingTokenOperandCount = (state: PendingTokenInsertState): number => {
    if (state.tokenKind === "operator") {
      return getOperatorOperandCount(state.tokenName);
    }
    const helper = helperByName[state.tokenName];
    return helper ? getHelperReferenceCount(helper) : 0;
  };
  const buildPendingTokenSnippet = (state: PendingTokenInsertState, operands: unknown[]) => {
    return {
      [state.tokenName]: operands.slice(0, getPendingTokenOperandCount(state)),
    };
  };
  const activeOperatorInsertState = useMemo<PendingOperatorInsertState | null>(() => {
    if (pendingJsonHelperInsert?.tokenKind === "operator") {
      return {
        operator: pendingJsonHelperInsert.tokenName,
        selectedOperands: pendingJsonHelperInsert.selectedOperands,
        requiredOperandCount: getOperatorOperandCount(pendingJsonHelperInsert.tokenName),
        pendingIfComparisonOperator: pendingJsonHelperInsert.pendingIfComparisonOperator,
        pendingIfComparisonOperands: pendingJsonHelperInsert.pendingIfComparisonOperands,
      };
    }
    return pendingOperatorInsert;
  }, [getOperatorOperandCount, pendingJsonHelperInsert, pendingOperatorInsert]);
  // `if` guided mode starts by collecting a comparison operator for the condition node.
  const isAwaitingIfComparisonOperator = useMemo(
    () =>
      activeOperatorInsertState?.operator === "if" &&
      activeOperatorInsertState.selectedOperands.length === 0 &&
      !activeOperatorInsertState.pendingIfComparisonOperator,
    [activeOperatorInsertState],
  );
  // While `if` is waiting for a comparison operator, shade out non-comparison operator tokens
  // so click-flow remains deterministic and users are guided toward valid condition structure.
  const helperAllowsReference = (helper: FormulaHelperDefinition, reference: string): boolean => {
    const referenceKind = referenceKindByName[reference] || "unknown";
    const referenceSemantic = referenceSemanticByName[reference] || "generic";

    if (helper.name === "hue_from_hex") {
      return referenceSemantic === "color_hex" && !reference.startsWith("extra.") && !reference.includes(".extra.");
    }

    if (helper.name === "cat") {
      return isScalarReferenceKind(referenceKind);
    }

    if (helper.name === "coalesce") {
      if (!isScalarReferenceKind(referenceKind)) {
        return false;
      }
      const selectedReference = pendingJsonHelperInsert?.selectedOperands
        .map((operand) => extractVarReference(operand))
        .find((operand): operand is string => Boolean(operand));
      if (!selectedReference) {
        return true;
      }
      const selectedKind = referenceKindByName[selectedReference] || "unknown";
      return selectedKind === "unknown" ? true : referenceKind === selectedKind;
    }

    const requiredKind = helper.reference_kind ?? "any";
    if (requiredKind === "any") {
      return isScalarReferenceKind(referenceKind);
    }
    return referenceKind === requiredKind;
  };
  const pendingHelperDefinition = useMemo(() => {
    if (!pendingJsonHelperInsert || pendingJsonHelperInsert.tokenKind !== "helper") {
      return null;
    }
    return helperByName[pendingJsonHelperInsert.tokenName] || null;
  }, [helperByName, pendingJsonHelperInsert]);
  const pendingOperatorOperandConstraint = useMemo<PendingOperatorOperandConstraint | null>(() => {
    if (!activeOperatorInsertState) {
      return null;
    }

    const resolveMatchingConstraint = (
      allowedReferenceKinds: ReferenceValueKind[] | "scalar",
      selectedOperands: unknown[],
    ): PendingOperatorOperandConstraint => {
      const selectedKind =
        selectedOperands.length > 0 ? inferOperandValueKind(selectedOperands[0], referenceKindByName) : null;
      return {
        mode: "expression",
        allowedReferenceKinds,
        allowedTokenKinds: Array.isArray(allowedReferenceKinds) ? allowedReferenceKinds : "any",
        selectedKind,
      };
    };

    if (
      activeOperatorInsertState.operator === "if" &&
      activeOperatorInsertState.selectedOperands.length === 0 &&
      !activeOperatorInsertState.pendingIfComparisonOperator
    ) {
      return {
        mode: "comparison-operator",
        allowedReferenceKinds: "scalar",
        allowedTokenKinds: "any",
      };
    }

    if (activeOperatorInsertState.operator === "if" && activeOperatorInsertState.selectedOperands.length === 0) {
      const comparisonOperator = activeOperatorInsertState.pendingIfComparisonOperator;
      const selectedComparisonOperands = activeOperatorInsertState.pendingIfComparisonOperands || [];
      if (comparisonOperator && ["<", "<=", ">", ">="].includes(comparisonOperator)) {
        return resolveMatchingConstraint(["number", "datetime"], selectedComparisonOperands);
      }
      if (comparisonOperator && ["==", "!="].includes(comparisonOperator)) {
        return resolveMatchingConstraint("scalar", selectedComparisonOperands);
      }
      return {
        mode: "expression",
        allowedReferenceKinds: "scalar",
        allowedTokenKinds: "any",
      };
    }

    if (activeOperatorInsertState.operator === "if") {
      return {
        mode: "expression",
        allowedReferenceKinds: "scalar",
        allowedTokenKinds: "any",
      };
    }

    if (["+", "-", "*", "/", "%", "floor"].includes(activeOperatorInsertState.operator)) {
      return {
        mode: "expression",
        allowedReferenceKinds: ["number"],
        allowedTokenKinds: ["number"],
      };
    }

    if (["and", "or", "!"].includes(activeOperatorInsertState.operator)) {
      return {
        mode: "expression",
        allowedReferenceKinds: ["boolean"],
        allowedTokenKinds: ["boolean"],
      };
    }

    if (["<", "<=", ">", ">="].includes(activeOperatorInsertState.operator)) {
      return resolveMatchingConstraint(["number", "datetime"], activeOperatorInsertState.selectedOperands);
    }

    if (["==", "!="].includes(activeOperatorInsertState.operator)) {
      return resolveMatchingConstraint("scalar", activeOperatorInsertState.selectedOperands);
    }

    return {
      mode: "expression",
      allowedReferenceKinds: "scalar",
      allowedTokenKinds: "any",
    };
  }, [activeOperatorInsertState, referenceKindByName]);
  const matchesAllowedReferenceKinds = (
    referenceKind: ReferenceValueKind,
    allowedKinds: "scalar" | ReferenceValueKind[],
    selectedKind?: ReferenceValueKind | null,
  ) => {
    if (allowedKinds === "scalar") {
      if (!isScalarReferenceKind(referenceKind)) {
        return false;
      }
    } else if (!allowedKinds.includes(referenceKind)) {
      return false;
    }
    if (!selectedKind || selectedKind === "unknown") {
      return true;
    }
    return referenceKind === selectedKind;
  };
  const isTokenCompatibleWithPendingOperator = (tokenName: string): boolean => {
    if (!pendingOperatorOperandConstraint) {
      return true;
    }
    if (pendingOperatorOperandConstraint.mode === "comparison-operator") {
      return IF_CONDITION_COMPARISON_OPERATORS.has(tokenName);
    }
    if (pendingOperatorOperandConstraint.allowedTokenKinds === "any") {
      return true;
    }
    const tokenKind = resultTypeHintToReferenceKind(tokenResultTypeHint(tokenName));
    if (!pendingOperatorOperandConstraint.allowedTokenKinds.includes(tokenKind)) {
      return false;
    }
    if (!pendingOperatorOperandConstraint.selectedKind || pendingOperatorOperandConstraint.selectedKind === "unknown") {
      return true;
    }
    return tokenKind === pendingOperatorOperandConstraint.selectedKind;
  };
  const getHelperDisabledReason = (helper: FormulaHelperDefinition): string | null => {
    if (pendingJsonHelperInsert?.tokenKind === "operator") {
      return t("settings.formula_fields.formula.json_builder.helper_incompatible_reason", { helper: helper.name });
    }
    if (pendingOperatorOperandConstraint && !isTokenCompatibleWithPendingOperator(helper.name)) {
      return t("settings.formula_fields.formula.json_builder.helper_incompatible_reason", { helper: helper.name });
    }

    // Keep date-diff pending mode intentionally narrow: only today() may act as the helper-side
    // operand while reference picking handles datetime fields like created_at/extra.dry_date.
    if (pendingHelperDefinition?.category === "date_diff" && helper.name !== "today") {
      return t("settings.formula_fields.formula.json_builder.helper_incompatible_reason", { helper: helper.name });
    }

    if (helper.insert_mode === "none") {
      return null;
    }

    const requiredRefCount = getHelperReferenceCount(helper);
    const compatibleReferences = referenceOptions.filter((reference) => helperAllowsReference(helper, reference));
    // Date-diff helpers can still be composed with non-reference operands (for example today()),
    // so keep them available even when matching reference count is below required placeholders.
    const supportsNonReferenceOperands = helper.category === "date_diff";
    if (!supportsNonReferenceOperands && compatibleReferences.length < requiredRefCount) {
      return t("settings.formula_fields.formula.json_builder.helper_unavailable_reason", { helper: helper.name });
    }

    // When the user already picked reference #1 for a pending helper, temporarily disable helper
    // tokens that can't accept that selected reference kind. Clearing/completing pending insert
    // resets all helper tokens back to normal.
    if (pendingJsonHelperInsert?.selectedOperands.length) {
      const selectedReference = pendingJsonHelperInsert.selectedOperands
        .map((operand) => extractVarReference(operand))
        .find((operand): operand is string => Boolean(operand));
      if (!selectedReference) {
        return null;
      }
      if (!helperAllowsReference(helper, selectedReference)) {
        return t("settings.formula_fields.formula.json_builder.helper_incompatible_reason", { helper: helper.name });
      }
    }

    return null;
  };
  const getOperatorDisabledReason = (operator: string): string | null => {
    if (pendingJsonHelperInsert) {
      return t("settings.formula_fields.formula.json_builder.helper_incompatible_reason", { helper: operator });
    }
    if (!pendingOperatorOperandConstraint) {
      return null;
    }
    if (pendingOperatorOperandConstraint.mode === "comparison-operator") {
      return IF_CONDITION_COMPARISON_OPERATORS.has(operator)
        ? null
        : t("settings.formula_fields.formula.json_builder.helper_incompatible_reason", { helper: operator });
    }
    return isTokenCompatibleWithPendingOperator(operator)
      ? null
      : t("settings.formula_fields.formula.json_builder.helper_incompatible_reason", { helper: operator });
  };
  const isReferenceCompatibleWithPendingHelper = (reference: string): boolean => {
    if (pendingHelperDefinition) {
      return helperAllowsReference(pendingHelperDefinition, reference);
    }
    if (!pendingOperatorOperandConstraint || pendingOperatorOperandConstraint.mode !== "expression") {
      return true;
    }
    const referenceKind = referenceKindByName[reference] || "unknown";
    return matchesAllowedReferenceKinds(
      referenceKind,
      pendingOperatorOperandConstraint.allowedReferenceKinds,
      pendingOperatorOperandConstraint.selectedKind,
    );
  };
  const helperCompatibleReferenceGroups = useMemo<ReferencePickerGroup[]>(() => {
    if (!pendingHelperDefinition && !pendingOperatorOperandConstraint) {
      return [];
    }
    return referenceGroups
      .map((group) => ({
        ...group,
        references: group.references.filter((reference) => isReferenceCompatibleWithPendingHelper(reference.value)),
      }))
      .filter((group) => group.references.length > 0);
  }, [
    isReferenceCompatibleWithPendingHelper,
    pendingHelperDefinition,
    pendingOperatorOperandConstraint,
    referenceGroups,
  ]);
  const helperCompatibleReferenceCount = useMemo(
    () => helperCompatibleReferenceGroups.reduce((sum, group) => sum + group.references.length, 0),
    [helperCompatibleReferenceGroups],
  );
  const activePendingTokenName = pendingJsonHelperInsert?.tokenName ?? pendingOperatorInsert?.operator ?? null;
  const showCompatibleReferenceGroups = Boolean(
    pendingHelperDefinition || pendingOperatorOperandConstraint?.mode === "expression",
  );
  const buildHelperPlaceholderArguments = (helper: FormulaHelperDefinition): Array<{ var: string }> => {
    const referenceCount = getHelperReferenceCount(helper);
    if (referenceCount <= 0) {
      return [];
    }
    if (helper.name === "cat") {
      return Array.from({ length: referenceCount }, (_, index) => ({ var: `text_${index + 1}` }));
    }
    if (helper.name === "coalesce") {
      return Array.from({ length: referenceCount }, (_, index) => ({ var: `value_${index + 1}` }));
    }
    if (referenceCount === 1) {
      return [{ var: "value" }];
    }
    if (referenceCount === 2) {
      return [{ var: "start" }, { var: "end" }];
    }
    return Array.from({ length: referenceCount }, (_, index) => ({ var: `arg_${index + 1}` }));
  };
  const copyTextToClipboard = useCallback(
    async (text: string, successMessage: string) => {
      try {
        await navigator.clipboard.writeText(text);
        messageApi.success(successMessage);
      } catch {
        messageApi.error("Failed to copy to clipboard.");
      }
    },
    [messageApi],
  );
  const copyReferenceToClipboard = useCallback(
    (reference: string) =>
      void copyTextToClipboard(reference, t("settings.formula_fields.formula.reference_picker.reference_copied")),
    [copyTextToClipboard, t],
  );
  const copyOperatorSnippetToClipboard = useCallback(
    (operator: string) =>
      void copyTextToClipboard(
        JSON_LOGIC_OPERATOR_SNIPPETS[operator] ?? JSON.stringify({ [operator]: [] }, null, 2),
        t("settings.formula_fields.formula.json_builder.operator_copied"),
      ),
    [copyTextToClipboard, t],
  );
  const copyHelperSnippetToClipboard = useCallback(
    (helper: FormulaHelperDefinition) =>
      void copyTextToClipboard(
        JSON.stringify({ [helper.name]: buildHelperPlaceholderArguments(helper) }, null, 2),
        t("settings.formula_fields.formula.json_builder.helper_copied"),
      ),
    [copyTextToClipboard, t],
  );
  const getTokenCategoryBodyStyle = (categoryKey: string): CSSProperties => {
    if (categoryKey === "math") {
      return {
        ...tokenCategoryBodyStyle,
        gap: 1,
      };
    }
    if (["comparison", "date_diff", "logical"].includes(categoryKey)) {
      return {
        ...tokenCategoryBodyStyle,
        gap: 2,
      };
    }
    return tokenCategoryBodyStyle;
  };

  const renderUnifiedTokenChip = (tokenDefinition: TokenDefinition, categoryKey: string) => {
    const isOperator = tokenDefinition.kind === "operator";
    const helper = isOperator ? null : helperByName[tokenDefinition.name];
    const disabledReason = guidedInsertionEnabled
      ? isOperator
        ? getOperatorDisabledReason(tokenDefinition.name)
        : helper
          ? getHelperDisabledReason(helper)
          : null
      : null;
    const tokenId = `${tokenDefinition.kind}-${tokenDefinition.name}`;
    const isHovered = hoveredTokenId === tokenId;
    const isDenseCategory = ["comparison", "math", "date_diff", "logical"].includes(categoryKey);
    const isSymbolLike = /^[!<>=+\-*/%]+$/.test(tokenDefinition.name);
    const isMathCategory = categoryKey === "math";
    const denseFontSize = isMathCategory
      ? Math.max(token.fontSizeSM - 1, 11)
      : isDenseCategory
        ? token.fontSizeSM
        : token.fontSize;
    const densePaddingInline = isSymbolLike ? 4 : isMathCategory ? 4 : isDenseCategory ? 5 : 6;
    const tooltipContent =
      disabledReason ||
      (isOperator ? (
        <pre
          style={{
            margin: 0,
            fontFamily: token.fontFamilyCode,
            fontSize: token.fontSizeSM,
            lineHeight: 1.4,
            whiteSpace: "pre-wrap",
          }}
        >
          {JSON_LOGIC_OPERATOR_SNIPPETS[tokenDefinition.name] ??
            JSON.stringify({ [tokenDefinition.name]: [] }, null, 2)}
        </pre>
      ) : helper ? (
        <pre
          style={{
            margin: 0,
            fontFamily: token.fontFamilyCode,
            fontSize: token.fontSizeSM,
            lineHeight: 1.4,
            whiteSpace: "pre-wrap",
          }}
        >
          {JSON.stringify({ [helper.name]: buildHelperPlaceholderArguments(helper) }, null, 2)}
        </pre>
      ) : undefined);

    return (
      <Tooltip key={tokenId} title={tooltipContent}>
        <Typography.Text
          code
          style={{
            cursor: disabledReason ? "not-allowed" : "pointer",
            opacity: disabledReason ? 0.45 : 1,
            whiteSpace: "nowrap",
            wordBreak: "normal",
            overflowWrap: "normal",
            flexShrink: 0,
            fontSize: denseFontSize,
            lineHeight: 1.15,
            letterSpacing: isMathCategory ? "-0.03em" : isDenseCategory ? "-0.02em" : "-0.01em",
            paddingInline: densePaddingInline,
            paddingBlock: 1,
            color: !disabledReason && isHovered ? token.colorWarningText : undefined,
            background: !disabledReason && isHovered ? token.colorWarningBg : undefined,
            borderColor: !disabledReason && isHovered ? token.colorWarningBorder : undefined,
            transition: "all 120ms ease-out",
          }}
          onMouseEnter={!disabledReason ? () => setHoveredTokenId(tokenId) : undefined}
          onMouseLeave={
            !disabledReason ? () => setHoveredTokenId((current) => (current === tokenId ? null : current)) : undefined
          }
          onClick={
            !disabledReason
              ? () => {
                  if (guidedInsertionEnabled && isOperator) {
                    insertExpressionJsonOperator(tokenDefinition.name);
                    return;
                  }
                  if (guidedInsertionEnabled && helper) {
                    insertExpressionJsonHelper(helper);
                    return;
                  }
                  if (isOperator) {
                    copyOperatorSnippetToClipboard(tokenDefinition.name);
                    return;
                  }
                  if (helper) {
                    copyHelperSnippetToClipboard(helper);
                  }
                }
              : undefined
          }
        >
          {tokenDefinition.name}
        </Typography.Text>
      </Tooltip>
    );
  };

  const renderTokenCategories = () => (
    <div style={tokenCategoryColumnsStyle}>
      {orderedTokenCategoryColumns.map((column, columnIndex) => (
        <div key={`token-column-${columnIndex}`} style={tokenCategoryColumnStyle}>
          {column.map((category) => (
            <div key={category.key} style={denseTokenCategoryStyle}>
              <Typography.Text type="secondary" style={tokenCategoryLabelStyle}>
                <strong>{category.label}</strong>
              </Typography.Text>
              <div style={getTokenCategoryBodyStyle(category.key)}>
                {category.tokens.map((tokenDefinition) => renderUnifiedTokenChip(tokenDefinition, category.key))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  const missingCustomReferencesByDerivedField = useMemo(() => {
    const availableCustomFieldKeys = new Set((configuredFields.data || []).map((field) => field.key));
    const missingMap: Record<string, string[]> = {};

    (derivedFields.data || []).forEach((derivedField) => {
      const missingReferences = getExtraFieldReferences(derivedField.expression_json || undefined).filter(
        (reference) => !availableCustomFieldKeys.has(reference),
      );
      if (missingReferences.length > 0) {
        missingMap[derivedField.key] = missingReferences;
      }
    });

    return missingMap;
  }, [configuredFields.data, derivedFields.data]);

  const hasBrokenFormulaDependencies = useMemo(
    () => Object.keys(missingCustomReferencesByDerivedField).length > 0,
    [missingCustomReferencesByDerivedField],
  );

  const openCreateDerived = () => {
    // Reset modal UI state and pending operations when opening for new field creation.
    // This ensures clean slate: no stale helper selections, panel states, or preview errors.
    setEditingDerivedKey(null);
    setPreviewText(null);
    setPreviewErrorText(null);
    setSampleValuesAutoUpdateEnabled(true);
    setPendingOperatorInsert(null);
    autoManagedSampleReferencesRef.current.clear();
    derivedForm.resetFields();
    derivedForm.setFieldsValue({
      key: "",
      name: "",
      description: "",
      surfaces: [FormulaFieldSurface.show],
      include_in_api: false,
      expression_json: "",
      sample_values: "{}",
    });
    setDerivedModalOpen(true);
  };

  const openEditDerived = useCallback(
    (record: DerivedField) => {
      setEditingDerivedKey(record.key);
      setPreviewText(null);
      setPreviewErrorText(null);
      setSampleValuesAutoUpdateEnabled(true);
      setPendingOperatorInsert(null);
      autoManagedSampleReferencesRef.current.clear();
      derivedForm.setFieldsValue({
        key: record.key,
        name: record.name,
        description: record.description || "",
        surfaces: record.surfaces,
        include_in_api: record.include_in_api ?? false,
        expression_json: record.expression_json ? JSON.stringify(record.expression_json, null, 2) : "",
        sample_values: "{}",
      });
      setDerivedModalOpen(true);
    },
    [derivedForm],
  );

  useEffect(() => {
    if (!editRequest) {
      return;
    }

    const requestedField = (derivedFields.data || []).find((field) => field.key === editRequest.key);
    if (requestedField) {
      openEditDerived(requestedField);
      onEditRequestHandled?.();
      return;
    }

    if (!derivedFields.isLoading) {
      onEditRequestHandled?.();
    }
  }, [derivedFields.data, derivedFields.isLoading, editRequest, onEditRequestHandled, openEditDerived]);

  const closeDerivedModal = () => {
    setDerivedModalOpen(false);
    setEditingDerivedKey(null);
    setPreviewText(null);
    setPreviewErrorText(null);
    setPendingJsonHelperInsert(null);
    setPendingOperatorInsert(null);
    autoManagedSampleReferencesRef.current.clear();
    // Keep selection state so reopening the modal preserves cursor position
    // expressionJsonSelectionRef is preserved intentionally
    derivedForm.resetFields();
  };

  // Distinguish snippet/format writes from manual typing so guided IF/operator state
  // survives programmatic editor updates instead of being cleared as "manual edits".
  const setExpressionJsonProgrammatically = useCallback(
    (nextValue: string) => {
      expressionJsonProgrammaticValueRef.current = nextValue;
      derivedForm.setFieldValue("expression_json", nextValue);
    },
    [derivedForm],
  );

  // Insert a JSON snippet into the expression editor while honoring any active guided
  // operator state (including IF compare-flow) before writing final JSON text.
  const insertExpressionJsonSnippet = (snippet: string) => {
    let snippetToInsert = snippet;
    let replaceEditorOnComplete = false;
    // While an operator is pending, treat each clicked helper/reference snippet as one operand.
    // Insert only after collecting the full required operand count for that operator.
    if (pendingOperatorInsert) {
      // `if` guided mode requires a comparison operator before accepting condition operands.
      if (
        pendingOperatorInsert.operator === "if" &&
        pendingOperatorInsert.selectedOperands.length === 0 &&
        !pendingOperatorInsert.pendingIfComparisonOperator
      ) {
        messageApi.warning("Select a comparison operator before choosing IF condition operands.");
        return;
      }
      try {
        const parsedOperand = JSON.parse(snippet) as unknown;
        if (
          pendingOperatorInsert.operator === "if" &&
          pendingOperatorInsert.selectedOperands.length === 0 &&
          pendingOperatorInsert.pendingIfComparisonOperator
        ) {
          const conditionOperands = [...(pendingOperatorInsert.pendingIfComparisonOperands || []), parsedOperand];
          if (conditionOperands.length < 2) {
            setPendingOperatorInsert({
              ...pendingOperatorInsert,
              pendingIfComparisonOperands: conditionOperands,
            });
            return;
          }

          const ifConditionNode = {
            [pendingOperatorInsert.pendingIfComparisonOperator]: conditionOperands.slice(0, 2),
          };
          const selectedOperands = [ifConditionNode];
          if (selectedOperands.length < pendingOperatorInsert.requiredOperandCount) {
            setPendingOperatorInsert({
              ...pendingOperatorInsert,
              selectedOperands,
              pendingIfComparisonOperator: null,
              pendingIfComparisonOperands: [],
            });
            return;
          }

          snippetToInsert = JSON.stringify(
            {
              [pendingOperatorInsert.operator]: selectedOperands.slice(0, pendingOperatorInsert.requiredOperandCount),
            },
            null,
            2,
          );
        } else {
          const selectedOperands = [...pendingOperatorInsert.selectedOperands, parsedOperand];
          if (selectedOperands.length < pendingOperatorInsert.requiredOperandCount) {
            setPendingOperatorInsert({
              ...pendingOperatorInsert,
              selectedOperands,
            });
            return;
          }
          snippetToInsert = JSON.stringify(
            {
              [pendingOperatorInsert.operator]: selectedOperands.slice(0, pendingOperatorInsert.requiredOperandCount),
            },
            null,
            2,
          );
        }
        replaceEditorOnComplete = Boolean(pendingOperatorInsert.replaceEditorOnComplete);
      } catch {
        messageApi.warning(t("settings.formula_fields.formula.expression_json_invalid"));
      }
      setPendingOperatorInsert(null);
    }

    const currentValue = (derivedForm.getFieldValue("expression_json") as string | undefined) || "";
    if (replaceEditorOnComplete) {
      const nextCursor = snippetToInsert.length;
      setExpressionJsonProgrammatically(snippetToInsert);
      expressionJsonSelectionRef.current = { from: nextCursor, to: nextCursor };
      requestAnimationFrame(() => {
        const editor = expressionJsonEditorRef.current;
        if (!editor) {
          return;
        }
        editor.focus();
        editor.dispatch({
          selection: { anchor: nextCursor, head: nextCursor },
          scrollIntoView: true,
        });
      });
      return;
    }

    const hasEditor = expressionJsonEditorRef.current !== null;
    if (!hasEditor) {
      const prefix = currentValue.trim() === "" ? "" : "\n";
      setExpressionJsonProgrammatically(`${currentValue}${prefix}${snippetToInsert}`);
      return;
    }

    const start = expressionJsonSelectionRef.current.from;
    const end = expressionJsonSelectionRef.current.to;
    const nextValue = `${currentValue.slice(0, start)}${snippetToInsert}${currentValue.slice(end)}`;
    const nextCursor = start + snippetToInsert.length;
    setExpressionJsonProgrammatically(nextValue);
    expressionJsonSelectionRef.current = { from: nextCursor, to: nextCursor };

    requestAnimationFrame(() => {
      const editor = expressionJsonEditorRef.current;
      if (!editor) {
        return;
      }
      editor.focus();
      editor.dispatch({
        selection: { anchor: nextCursor, head: nextCursor },
        scrollIntoView: true,
      });
    });
  };

  const insertExpressionJsonReference = (reference: string) => {
    const pendingState = pendingJsonHelperInsert;
    if (!pendingState) {
      insertExpressionJsonSnippet(JSON.stringify({ var: reference }, null, 2));
      return;
    }

    if (!isReferenceCompatibleWithPendingHelper(reference)) {
      messageApi.warning(
        t("settings.formula_fields.formula.json_builder.reference_incompatible_reason", {
          helper: pendingHelperDefinition?.name ?? pendingState.tokenName,
        }),
      );
      return;
    }

    const requiredOperandCount = getPendingTokenOperandCount(pendingState);
    const selectedOperands = [...pendingState.selectedOperands, { var: reference }];
    if (selectedOperands.length < requiredOperandCount) {
      setPendingJsonHelperInsert({
        ...pendingState,
        selectedOperands,
      });
      return;
    }

    insertExpressionJsonSnippet(JSON.stringify(buildPendingTokenSnippet(pendingState, selectedOperands), null, 2));
    setPendingJsonHelperInsert(null);
  };

  const insertExpressionJsonHelper = (helper: FormulaHelperDefinition) => {
    // Treat today() as a valid date-diff operand while a pending helper is collecting
    // operands, so clicks produce one combined snippet instead of standalone {"today":[]}.
    if (
      pendingHelperDefinition &&
      helper.insert_mode === "none" &&
      helper.name === "today" &&
      pendingHelperDefinition.category === "date_diff"
    ) {
      const pendingState = pendingJsonHelperInsert;
      if (!pendingState) {
        return;
      }
      const requiredReferenceCount = getPendingTokenOperandCount(pendingState);
      const selectedOperands = [...pendingState.selectedOperands, { [helper.name]: [] }];
      if (selectedOperands.length < requiredReferenceCount) {
        setPendingJsonHelperInsert({
          ...pendingState,
          selectedOperands,
        });
        return;
      }
      // Allow date-diff helpers to consume dynamic today() as an operand instead of inserting it standalone.
      insertExpressionJsonSnippet(JSON.stringify(buildPendingTokenSnippet(pendingState, selectedOperands), null, 2));
      setPendingJsonHelperInsert(null);
      return;
    }

    if (helper.insert_mode === "none") {
      insertExpressionJsonSnippet(JSON.stringify({ [helper.name]: [] }, null, 2));
      setPendingJsonHelperInsert(null);
      return;
    }
    const disabledReason = getHelperDisabledReason(helper);
    if (disabledReason) {
      messageApi.warning(disabledReason);
      return;
    }
    // Keep helper insertion staged until required reference tokens are selected, so helpers with
    // multiple reference operands (for example days_between/hours_between) can be assembled safely.
    setPendingJsonHelperInsert({ tokenName: helper.name, tokenKind: "helper", selectedOperands: [] });
    messageApi.info(
      t("settings.formula_fields.formula.json_builder.pending_helper", {
        helper: helper.name,
        selected: 0,
        total: getHelperReferenceCount(helper),
      }),
    );
  };

  const insertPendingHelperWithoutReferences = () => {
    if (!pendingHelperDefinition) {
      return;
    }
    const placeholderSnippet = {
      [pendingHelperDefinition.name]: buildHelperPlaceholderArguments(pendingHelperDefinition),
    };
    insertExpressionJsonSnippet(JSON.stringify(placeholderSnippet, null, 2));
    setPendingJsonHelperInsert(null);
  };
  const cancelPendingHelperInsert = () => {
    setPendingJsonHelperInsert(null);
    setPendingOperatorInsert(null);
  };

  // Handle operator-token clicks in two modes:
  // 1) direct snippet insertion and
  // 2) guided operand collection when starting from an empty expression.
  const insertExpressionJsonOperator = (operator: string) => {
    // When `if` scaffolding is active and waiting for a comparison choice, only accept
    // comparison operators for the condition node builder.
    if (isAwaitingIfComparisonOperator) {
      if (!IF_CONDITION_COMPARISON_OPERATORS.has(operator)) {
        messageApi.info(t("settings.formula_fields.formula.json_builder.if_step_condition_operator"));
        return;
      }
      if (pendingJsonHelperInsert?.tokenKind === "operator" && pendingJsonHelperInsert.tokenName === "if") {
        setPendingJsonHelperInsert({
          ...pendingJsonHelperInsert,
          pendingIfComparisonOperator: operator,
          pendingIfComparisonOperands: [],
        });
      } else if (pendingOperatorInsert) {
        setPendingOperatorInsert({
          ...pendingOperatorInsert,
          pendingIfComparisonOperator: operator,
          pendingIfComparisonOperands: [],
        });
      } else {
        return;
      }
      messageApi.info(
        t("settings.formula_fields.formula.json_builder.pending_helper", {
          helper: "if",
          selected: 1,
          total: 5,
        }),
      );
      return;
    }

    if (pendingOperatorInsert) {
      if (operator === "if") {
        messageApi.info(t("settings.formula_fields.formula.json_builder.nested_if_raw_json"));
        return;
      }
      setPendingJsonHelperInsert({
        tokenName: operator,
        tokenKind: "operator",
        selectedOperands: [],
      });
      messageApi.info(
        t("settings.formula_fields.formula.json_builder.pending_helper", {
          helper: operator,
          selected: 0,
          total: getOperatorOperandCount(operator),
        }),
      );
      return;
    }

    const currentValue = ((derivedForm.getFieldValue("expression_json") as string | undefined) || "").trim();
    // Option 3 behavior for IF:
    // 1) insert a readable scaffold immediately
    // 2) keep guided click-flow active so further clicks can complete condition/then/else.
    if (currentValue === "" && operator === "if") {
      insertExpressionJsonSnippet(IF_SCAFFOLD_SNIPPET);
      setPendingOperatorInsert({
        operator,
        selectedOperands: [],
        requiredOperandCount: getOperatorOperandCount(operator),
        pendingIfComparisonOperator: null,
        pendingIfComparisonOperands: [],
        replaceEditorOnComplete: true,
      });
      setPendingJsonHelperInsert(null);
      messageApi.info(
        t("settings.formula_fields.formula.json_builder.pending_helper", {
          helper: operator,
          selected: 0,
          total: 5,
        }),
      );
      return;
    }

    // Start guided operator flow on empty expressions so users can click operator -> operands
    // and get a complete JSON snippet without placeholder vars like left/right.
    if (currentValue === "") {
      setPendingOperatorInsert({
        operator,
        selectedOperands: [],
        requiredOperandCount: getOperatorOperandCount(operator),
      });
      setPendingJsonHelperInsert(null);
      messageApi.info(
        t("settings.formula_fields.formula.json_builder.pending_helper", {
          helper: operator,
          selected: 0,
          total: getOperatorOperandCount(operator),
        }),
      );
      return;
    }

    const snippet = JSON_LOGIC_OPERATOR_SNIPPETS[operator];
    if (!snippet) {
      return;
    }
    insertExpressionJsonSnippet(snippet);
    setPendingJsonHelperInsert(null);
  };

  const formatExpressionJson = async () => {
    try {
      const currentValue = (derivedForm.getFieldValue("expression_json") as string | undefined) || "";
      const parsed = parseExpressionJson(currentValue);
      if (!parsed) {
        return;
      }
      setExpressionJsonProgrammatically(JSON.stringify(parsed, null, 2));
      messageApi.success(t("settings.formula_fields.formula.json_builder.formatted"));
    } catch (errInfo) {
      if (errInfo instanceof Error) {
        messageApi.error(errInfo.message);
      }
    }
  };

  const saveDerived = async () => {
    try {
      const values = await derivedForm.validateFields();
      const key = editingDerivedKey || values.key;
      const expressionJson = parseExpressionJson(values.expression_json);
      if (!expressionJson) {
        throw new Error(t("settings.formula_fields.formula.expression_json_required"));
      }
      // Keep backend contract intact without exposing Result Type controls in the editor:
      // infer from JSON when possible, otherwise preserve existing type (edit) or default new fields.
      await setDerivedField.mutateAsync({
        key,
        params: {
          name: values.name,
          description: values.description || undefined,
          result_type: currentDerivedResultType,
          expression_json: expressionJson,
          surfaces: values.surfaces,
          // List-surface formula fields are always hideable through Hide Columns. Persist this
          // explicitly so pre-existing records with false are normalized on save.
          allow_list_column_toggle: (values.surfaces as string[]).includes(FormulaFieldSurface.list),
          include_in_api: values.include_in_api ?? false,
        },
      });

      messageApi.success(
        t(
          editingDerivedKey
            ? "settings.formula_fields.formula.messages.updated"
            : "settings.formula_fields.formula.messages.created",
          {
            name: values.name,
          },
        ),
      );
      closeDerivedModal();
    } catch (errInfo) {
      if (errInfo instanceof Error) {
        messageApi.error(errInfo.message);
      }
    }
  };

  // Reconcile current sample JSON against detected expression references by:
  // 1) adding missing reference paths with type-aware defaults and
  // 2) pruning stale keys that were auto-managed but are no longer referenced.
  const buildSampleValuesWithMissingReferences = (currentSampleValues: Record<string, unknown>) => {
    const mergedSampleValues = JSON.parse(JSON.stringify(currentSampleValues)) as Record<string, unknown>;
    const insertedReferences: string[] = [];
    const removedReferences: string[] = [];
    const detectedReferenceSet = new Set(detectedExpressionReferences);

    const trackedAutoReferences = autoManagedSampleReferencesRef.current;
    [...trackedAutoReferences].forEach((reference) => {
      if (detectedReferenceSet.has(reference)) {
        return;
      }
      if (removeReferencePathIfPresent(mergedSampleValues, reference)) {
        removedReferences.push(reference);
      }
      trackedAutoReferences.delete(reference);
    });

    detectedExpressionReferences.forEach((reference) => {
      const referenceKind = referenceKindByName[reference] || "unknown";
      // Seed new sample keys with type-aware defaults so previews work immediately
      // and users can adjust values instead of building sample JSON from scratch.
      const defaultValue = getSampleDefaultValue(referenceKind, reference, configuredFieldByReference[reference]);
      if (insertReferencePathIfMissing(mergedSampleValues, reference, defaultValue)) {
        insertedReferences.push(reference);
        trackedAutoReferences.add(reference);
      }
    });

    return {
      mergedSampleValues,
      insertedReferences,
      removedReferences,
    };
  };

  // Execute preview with request sequencing so stale async responses never overwrite
  // newer editor state while users are typing quickly.
  const runPreview = useCallback(
    async (showMessageOnError: boolean) => {
      const requestId = previewRequestRef.current + 1;
      previewRequestRef.current = requestId;
      try {
        const sampleValues = parseSampleValues(
          (derivedForm.getFieldValue("sample_values") as string | undefined) || "{}",
        );
        const expressionJson = parseExpressionJson(derivedForm.getFieldValue("expression_json") as string | undefined);
        if (!expressionJson) {
          throw new Error(t("settings.formula_fields.formula.expression_json_required"));
        }
        // Preview uses sample JSON only as a sandbox for validating formulas before they are exposed
        // on show/list/template surfaces.
        const preview = await previewDerivedField.mutateAsync({
          expression_json: expressionJson,
          sample_values: sampleValues,
          result_type: currentDerivedResultType,
        });

        if (requestId !== previewRequestRef.current) {
          return;
        }
        setPreviewText(formatPreviewValue(preview.result));
        setPreviewErrorText(null);
      } catch (errInfo) {
        if (requestId !== previewRequestRef.current) {
          return;
        }
        setPreviewText(null);
        if (errInfo instanceof Error) {
          setPreviewErrorText(errInfo.message);
        } else {
          setPreviewErrorText(t("settings.formula_fields.formula.preview.error_fallback"));
        }
        if (showMessageOnError && errInfo instanceof Error) {
          messageApi.error(errInfo.message);
        }
      }
    },
    [currentDerivedResultType, derivedForm, messageApi, previewDerivedField, t],
  );

  // Apply one synchronization pass between expression refs and sample JSON.
  // The pass is non-destructive for user-owned keys while still cleaning stale auto-managed refs.
  const syncMissingSampleValueKeys = (showMessageOnError: boolean) => {
    let currentSampleValues: Record<string, unknown>;
    try {
      currentSampleValues = parseSampleValues(
        (derivedForm.getFieldValue("sample_values") as string | undefined) || "{}",
      );
    } catch (errInfo) {
      if (showMessageOnError && errInfo instanceof Error) {
        messageApi.warning(errInfo.message);
      }
      return false;
    }

    // Apply additive scaffolding and dead-key pruning without touching user-owned sample keys.
    const { mergedSampleValues, insertedReferences, removedReferences } =
      buildSampleValuesWithMissingReferences(currentSampleValues);

    if (insertedReferences.length === 0 && removedReferences.length === 0) {
      return true;
    }

    derivedForm.setFieldValue("sample_values", JSON.stringify(mergedSampleValues, null, 2));
    return true;
  };

  useEffect(() => {
    if (!derivedModalOpen) {
      return;
    }

    if (!sampleValuesAutoUpdateEnabled) {
      return;
    }

    if ((expressionJsonValue || "").trim() === "") {
      autoManagedSampleReferencesRef.current.clear();
      const currentSampleValuesRaw = (derivedForm.getFieldValue("sample_values") as string | undefined) || "";
      if (currentSampleValuesRaw.trim() !== "{}") {
        derivedForm.setFieldValue("sample_values", "{}");
      }
      return;
    }

    // Ignore invalid JSON editing states so transient typing does not create stale sample keys.
    if (parsedExpressionJson === null) {
      return;
    }

    // Keep sample values synchronized with newly referenced variables while preserving
    // any user-authored values that already exist in the sample JSON.
    syncMissingSampleValueKeys(false);
  }, [
    derivedModalOpen,
    expressionJsonValue,
    detectedExpressionReferences,
    sampleValuesValue,
    referenceKindByName,
    configuredFieldByReference,
    sampleValuesAutoUpdateEnabled,
    derivedForm,
  ]);

  useEffect(() => {
    if (!derivedModalOpen) {
      return;
    }

    if ((expressionJsonValue || "").trim() === "") {
      setPreviewText(null);
      setPreviewErrorText(t("settings.formula_fields.formula.expression_json_required"));
      return;
    }

    // Debounce preview with 700ms to allow formula typing without constant re-evaluation.
    // Preview API calls can be slow, especially with complex expressions. Short debounce (350ms)
    // would cause excessive requests during active editing. Longer debounce gives better UX.
    const timeout = window.setTimeout(() => {
      void runPreview(false);
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [derivedModalOpen, expressionJsonValue, sampleValuesValue, runPreview, t]);

  const removeDerived = async (record: DerivedField) => {
    try {
      await deleteDerivedField.mutateAsync(record.key);
      messageApi.success(t("settings.formula_fields.formula.messages.deleted", { name: record.name }));
    } catch (errInfo) {
      if (errInfo instanceof Error) {
        messageApi.error(errInfo.message);
      }
    }
  };

  const derivedColumns: ColumnType<DerivedField>[] = [
    {
      title: <span style={{ whiteSpace: "nowrap" }}>{t("settings.formula_fields.formula.columns.key")}</span>,
      dataIndex: "key",
      key: "key",
      width: 150,
      fixed: "left",
      render: (value: string) => (
        <Typography.Text code style={{ whiteSpace: "nowrap" }}>
          {value}
        </Typography.Text>
      ),
    },
    {
      title: <span style={{ whiteSpace: "nowrap" }}>{t("settings.formula_fields.formula.columns.path")}</span>,
      key: "path",
      width: 190,
      render: (_: unknown, record) => (
        <Typography.Text code style={{ whiteSpace: "nowrap" }}>{`derived.${record.key}`}</Typography.Text>
      ),
    },
    {
      title: <span style={{ whiteSpace: "nowrap" }}>{t("settings.formula_fields.formula.columns.name")}</span>,
      dataIndex: "name",
      key: "name",
      width: 180,
    },
    {
      title: <span style={{ whiteSpace: "nowrap" }}>{t("settings.formula_fields.formula.columns.expression")}</span>,
      dataIndex: "expression_json",
      key: "expression",
      width: 460,
      render: (_value: Record<string, unknown> | undefined, record) => {
        const expressionValue = record.expression_json ? JSON.stringify(record.expression_json) : "";
        const missingReferences = missingCustomReferencesByDerivedField[record.key] || [];
        return (
          <Space direction="vertical" size={4}>
            <Typography.Text code style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
              {expressionValue}
            </Typography.Text>
            {missingReferences.length > 0 && (
              <Typography.Text type="danger">
                {t("settings.formula_fields.formula.missing_references", {
                  references: missingReferences.join(", "),
                })}
              </Typography.Text>
            )}
          </Space>
        );
      },
    },
    {
      title: <span style={{ whiteSpace: "nowrap" }}>{t("settings.formula_fields.formula.columns.surfaces")}</span>,
      dataIndex: "surfaces",
      key: "surfaces",
      width: 240,
      // Keep one at-a-glance destination column by showing API as a tag alongside display surfaces.
      render: (surfaces: string[], record) => (
        <Space size={[4, 4]} wrap>
          {surfaces.map((surface) => (
            <Tag key={surface}>{t(`settings.formula_fields.surfaces.${surface}`)}</Tag>
          ))}
          {record.include_in_api ? <Tag color="processing">API</Tag> : null}
        </Space>
      ),
    },
    {
      title: "",
      key: "operation",
      width: 140,
      fixed: "right",
      render: (_: unknown, record) => (
        <Space wrap={false}>
          <Tooltip title={t("buttons.edit")}>
            <Button icon={<EditOutlined />} onClick={() => openEditDerived(record)} size="small" type="text" />
          </Tooltip>
          <Popconfirm
            title={t("settings.formula_fields.formula.delete_confirm", { name: record.name })}
            onConfirm={() => removeDerived(record)}
            okText={t("buttons.delete")}
            cancelText={t("buttons.cancel")}
          >
            <Tooltip title={t("buttons.delete")}>
              <Button danger icon={<DeleteOutlined />} size="small" type="text" />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Render a compact side preview card beside Sample Values so result/error state stays visible
  // without consuming extra vertical space under the editor.
  const previewPanelContent = useMemo(() => {
    if (previewErrorText) {
      return (
        <Typography.Text type="danger" style={{ textAlign: "center" }}>
          {previewErrorText}
        </Typography.Text>
      );
    }

    if (previewText == null) {
      return (
        <Typography.Text type="secondary" style={{ textAlign: "center" }}>
          {t("settings.formula_fields.formula.preview.empty")}
        </Typography.Text>
      );
    }

    return (
      <Space direction="vertical" size={6} align="center">
        <Typography.Text style={{ fontWeight: 600 }}>
          <Typography.Text code>{`${derivedKeyPath} =`}</Typography.Text>
        </Typography.Text>
        <Typography.Text code style={{ fontSize: token.fontSizeLG + 2, lineHeight: 1.35 }}>
          {previewText}
        </Typography.Text>
      </Space>
    );
  }, [derivedKeyPath, previewErrorText, previewText, t, token.fontSizeLG]);
  const pendingHelperHint = useMemo<PendingHelperHintState | null>(() => {
    if (pendingJsonHelperInsert) {
      const selected =
        pendingJsonHelperInsert.tokenKind === "operator" && pendingJsonHelperInsert.tokenName === "if"
          ? (() => {
              if (pendingJsonHelperInsert.selectedOperands.length === 0) {
                if (!pendingJsonHelperInsert.pendingIfComparisonOperator) {
                  return 0;
                }
                return 1 + (pendingJsonHelperInsert.pendingIfComparisonOperands?.length || 0);
              }
              return 3 + (pendingJsonHelperInsert.selectedOperands.length - 1);
            })()
          : pendingJsonHelperInsert.selectedOperands.length;
      const total =
        pendingJsonHelperInsert.tokenKind === "operator"
          ? pendingJsonHelperInsert.tokenName === "if"
            ? 5
            : getOperatorOperandCount(pendingJsonHelperInsert.tokenName)
          : pendingHelperDefinition
            ? getHelperReferenceCount(pendingHelperDefinition)
            : 0;
      return {
        helper: pendingJsonHelperInsert.tokenName,
        selected,
        total,
        allowHelperOnly: pendingJsonHelperInsert.tokenKind === "helper",
        stepLabelKey:
          pendingJsonHelperInsert.tokenKind === "operator" && pendingJsonHelperInsert.tokenName === "if"
            ? getIfPendingStepLabelKey({
                operator: "if",
                selectedOperands: pendingJsonHelperInsert.selectedOperands,
                requiredOperandCount: 3,
                pendingIfComparisonOperator: pendingJsonHelperInsert.pendingIfComparisonOperator,
                pendingIfComparisonOperands: pendingJsonHelperInsert.pendingIfComparisonOperands,
              })
            : undefined,
      };
    }
    if (pendingOperatorInsert) {
      if (pendingOperatorInsert.operator === "if") {
        const completedIfSteps = (() => {
          if (pendingOperatorInsert.selectedOperands.length === 0) {
            if (!pendingOperatorInsert.pendingIfComparisonOperator) {
              return 0;
            }
            return 1 + (pendingOperatorInsert.pendingIfComparisonOperands?.length || 0);
          }
          // After condition is built, steps are:
          // 3) compare-left-right complete + 4) then + 5) else
          return 3 + (pendingOperatorInsert.selectedOperands.length - 1);
        })();
        return {
          helper: pendingOperatorInsert.operator,
          selected: Math.min(5, completedIfSteps),
          total: 5,
          allowHelperOnly: false,
          stepLabelKey: getIfPendingStepLabelKey(pendingOperatorInsert),
        };
      }
      return {
        helper: pendingOperatorInsert.operator,
        selected: pendingOperatorInsert.selectedOperands.length,
        total: pendingOperatorInsert.requiredOperandCount,
        allowHelperOnly: false,
      };
    }
    return null;
  }, [getHelperReferenceCount, pendingHelperDefinition, pendingJsonHelperInsert, pendingOperatorInsert]);
  return (
    <>
      <Divider orientation="left" plain>
        <Space size={8}>
          <span>
            {t("settings.formula_fields.formula.header")}: {niceName}
          </span>
          <Tooltip title={t("settings.formula_fields.formula.tooltip")}>
            <QuestionCircleOutlined />
          </Tooltip>
          <Link
            style={{
              fontSize: "0.85em",
            }}
            to="/help#formula-fields"
          >
            {t("settings.formula_fields.help_links.formula")}
          </Link>
        </Space>
      </Divider>
      <Typography.Paragraph type="secondary" style={sectionBodyStyle}>
        {t("settings.formula_fields.formula.intro")}
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary" style={{ ...sectionBodyStyle, marginTop: -8 }}>
        {t("settings.formula_fields.formula.evaluation_model_help")}
      </Typography.Paragraph>
      {hasBrokenFormulaDependencies && (
        <Typography.Paragraph type="danger" style={{ marginTop: 0 }}>
          {t("settings.formula_fields.formula.missing_references_intro")}
        </Typography.Paragraph>
      )}
      <Typography.Paragraph type="secondary" style={{ ...sectionBodyStyle, marginBottom: 12 }}>
        {t("settings.formula_fields.available_functions.value")}
      </Typography.Paragraph>
      <Table
        columns={derivedColumns}
        dataSource={derivedFields.data || []}
        loading={derivedFields.isLoading}
        pagination={false}
        scroll={{ x: 1360 }}
        sticky
        locale={{
          emptyText: (
            <Empty description={t("settings.formula_fields.formula.empty")} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ),
        }}
        onRow={(record) => {
          const hasMissingReferences = (missingCustomReferencesByDerivedField[record.key] || []).length > 0;
          if (!hasMissingReferences) {
            return {};
          }
          return {
            style: {
              backgroundColor: token.colorErrorBg,
            },
          };
        }}
        rowKey="key"
      />
      <Flex justify="center">
        <Button
          type="primary"
          shape="circle"
          icon={<PlusOutlined />}
          size="large"
          style={{
            margin: "1em",
          }}
          onClick={() => openCreateDerived()}
        />
      </Flex>

      <Modal
        destroyOnHidden
        onCancel={() => closeDerivedModal()}
        onOk={() => saveDerived()}
        open={derivedModalOpen}
        okText={t("buttons.save")}
        cancelText={t("buttons.cancel")}
        title={`${t(
          editingDerivedKey
            ? "settings.formula_fields.formula.modal.edit_title"
            : "settings.formula_fields.formula.modal.create_title",
        )}: ${niceName}`}
        width={820}
      >
        <Form
          form={derivedForm}
          layout="vertical"
          initialValues={{
            surfaces: [FormulaFieldSurface.show],
            include_in_api: false,
            expression_json: "",
            sample_values: "{}",
          }}
        >
          {/* Responsive split: two columns on medium+ screens, stacked flow on narrow/mobile widths. */}
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item
                label={labeledField(
                  "settings.formula_fields.formula.columns.key",
                  "settings.formula_fields.formula.tooltips.key",
                )}
                name="key"
                extra={
                  <Space direction="vertical" size={2} style={{ width: "100%" }}>
                    <Typography.Text type="secondary">
                      {t("settings.formula_fields.formula.key_usage_help")}:{" "}
                      <Typography.Text code>{derivedKeyPath}</Typography.Text>
                    </Typography.Text>
                    {keyLooksLikeReservedToken && (
                      <Typography.Text type="warning">
                        <WarningOutlined style={{ marginRight: 6 }} />
                        {t("settings.formula_fields.formula.key_reserved_hint", { key: derivedKeyValue })}
                      </Typography.Text>
                    )}
                  </Space>
                }
                rules={[
                  { required: true, min: 1, max: 64, pattern: /^[a-z0-9_]+$/ },
                  {
                    validator: async (_, value) => {
                      if (RESERVED_DERIVED_KEY_NAMES.has(value)) {
                        throw new Error(t("settings.formula_fields.formula.key_reserved_hint", { key: value }));
                      }
                    },
                  },
                  {
                    validator: async (_, value) => {
                      if (!editingDerivedKey && derivedFields.data?.some((field) => field.key === value)) {
                        throw new Error(t("settings.extra_fields.non_unique_key_error"));
                      }
                    },
                  },
                ]}
              >
                <Input disabled={editingDerivedKey != null} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label={labeledField(
                  "settings.formula_fields.formula.columns.name",
                  "settings.formula_fields.formula.tooltips.name",
                )}
                name="name"
                rules={[{ required: true, min: 1, max: 128 }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label={t("settings.formula_fields.formula.columns.description")}
            name="description"
            rules={[{ max: 512 }]}
          >
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
          <Form.Item
            label={labeledField(
              "settings.formula_fields.formula.columns.surfaces",
              "settings.formula_fields.formula.tooltips.display_in",
            )}
            required
          >
            {/* Keep all visibility controls visible in one row so users can decide targets without opening menus. */}
            <Flex align="center" gap={16} wrap>
              <Form.Item name="surfaces" rules={[{ required: true, type: "array", min: 1 }]} noStyle>
                <Checkbox.Group options={displaySurfaceOptions} />
              </Form.Item>
              <Space size={4} align="center">
                <Form.Item name="include_in_api" valuePropName="checked" noStyle>
                  <Checkbox>{t("settings.formula_fields.formula.display_targets.api")}</Checkbox>
                </Form.Item>
                <Tooltip title={t("settings.formula_fields.formula.tooltips.include_in_api")}>
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            </Flex>
          </Form.Item>
          <Form.Item
            style={{ marginBottom: 4 }}
            label={
              <Flex justify="space-between" align="center" gap={8} wrap={false}>
                <Space size={8} align="center" wrap>
                  {labeledField(
                    "settings.formula_fields.formula.columns.expression_json",
                    "settings.formula_fields.formula.expression_json_help",
                  )}
                  <Link style={{ fontSize: "0.85em" }} to="/help#formula-json-logic">
                    {t("settings.formula_fields.help_links.formula_json")}
                  </Link>
                </Space>
              </Flex>
            }
            name="expression_json"
            trigger="onChange"
            getValueFromEvent={(value: string) => value}
            rules={[
              {
                validator: async (_, value) => {
                  const parsed = parseExpressionJson(
                    value,
                    t("settings.formula_fields.formula.expression_json_invalid"),
                  );
                  if (!parsed) {
                    throw new Error(t("settings.formula_fields.formula.expression_json_required"));
                  }
                  // Validate that all referenced custom fields still exist (prevent silent formula failures after field deletion)
                  const referencedCustomFields = getExtraFieldReferences(parsed);
                  const availableCustomFields = new Set((configuredFields.data || []).map((field) => field.key));
                  const missingFields = referencedCustomFields.filter(
                    (fieldKey) => !availableCustomFields.has(fieldKey),
                  );
                  if (missingFields.length > 0) {
                    throw new Error(
                      t("settings.formula_fields.formula.missing_references", { references: missingFields.join(", ") }),
                    );
                  }
                },
              },
            ]}
          >
            <div style={{ position: "relative" }}>
              {/* Keep expression editor and operator rail in one row so hiding operators can
                  immediately reclaim horizontal space without changing editor height. */}
              <div>
                <div
                  style={{
                    height: expressionEditorHeight,
                    minHeight: expressionEditorHeight,
                    resize: "vertical",
                    overflow: "auto",
                  }}
                >
                  <CodeMirror
                    value={expressionJsonValue || ""}
                    height="100%"
                    style={{
                      height: "100%",
                      backgroundColor: token.colorBgContainer,
                      color: token.colorText,
                    }}
                    extensions={[json(), drawSelection(), codeMirrorSyntaxHighlight, codeMirrorTheme]}
                    basicSetup={{
                      lineNumbers: true,
                      drawSelection: false,
                      bracketMatching: true,
                      highlightSelectionMatches: true,
                      highlightActiveLine: false,
                      foldGutter: true,
                    }}
                    onCreateEditor={(editor) => {
                      expressionJsonEditorRef.current = editor;
                      const mainSelection = editor.state.selection.main;
                      expressionJsonSelectionRef.current = { from: mainSelection.from, to: mainSelection.to };
                    }}
                    onUpdate={(viewUpdate) => {
                      const mainSelection = viewUpdate.state.selection.main;
                      expressionJsonSelectionRef.current = { from: mainSelection.from, to: mainSelection.to };
                    }}
                    onChange={(value) => {
                      if (expressionJsonProgrammaticValueRef.current !== null) {
                        if (value === expressionJsonProgrammaticValueRef.current) {
                          expressionJsonProgrammaticValueRef.current = null;
                          return;
                        }
                        expressionJsonProgrammaticValueRef.current = null;
                      }
                      const currentExpressionValue =
                        (derivedForm.getFieldValue("expression_json") as string | undefined) || "";
                      if (value === currentExpressionValue) {
                        return;
                      }
                      if (pendingJsonHelperInsert) {
                        setPendingJsonHelperInsert(null);
                      }
                      if (pendingOperatorInsert) {
                        setPendingOperatorInsert(null);
                      }
                      derivedForm.setFieldValue("expression_json", value);
                    }}
                  />
                </div>
                <Flex justify="flex-end" align="center" gap={8} style={{ marginTop: 4 }}>
                  <Tooltip title={t("settings.formula_fields.formula.json_builder.format_tooltip")}>
                    <Button size="small" onClick={() => formatExpressionJson()}>
                      {t("settings.formula_fields.formula.json_builder.format")}
                    </Button>
                  </Tooltip>
                </Flex>
              </div>
            </div>
          </Form.Item>
          {/* Keep the reference-aid panel above field groups so JSON writing help stays in one place. */}
          <Space
            direction="vertical"
            size={2}
            style={{
              width: "100%",
              marginBottom: 8,
            }}
          >
            <Flex justify="space-between" align="center">
              <Space size={8} align="center">
                <Typography.Text type="secondary">
                  <strong>{t("settings.formula_fields.formula.json_builder.operators_title")}</strong>
                </Typography.Text>
                <Tooltip title={t("settings.formula_fields.formula.json_builder.click_to_insert_help")}>
                  <QuestionCircleOutlined style={{ fontSize: "0.9em" }} />
                </Tooltip>
                <Link style={{ fontSize: "0.85em" }} to="/help#formula-token-groups">
                  {t("settings.formula_fields.help_links.formula_tokens")}
                </Link>
                <Tooltip
                  title={
                    tokensPanelCollapsed
                      ? t("settings.formula_fields.formula.json_builder.show_tokens")
                      : t("settings.formula_fields.formula.json_builder.hide_tokens")
                  }
                >
                  <Button
                    size="small"
                    type="default"
                    icon={tokensPanelCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                    onClick={() =>
                      setTokensPanelCollapsedByEntity((current) => ({
                        ...current,
                        [selectedEntityType]: !(current[selectedEntityType] ?? false),
                      }))
                    }
                    aria-label={
                      tokensPanelCollapsed
                        ? t("settings.formula_fields.formula.json_builder.show_tokens")
                        : t("settings.formula_fields.formula.json_builder.hide_tokens")
                    }
                  />
                </Tooltip>
              </Space>
            </Flex>
            {!tokensPanelCollapsed ? (
              <>
                <div style={tokenPanelStyle}>
                  <Space direction="vertical" size={8} style={{ width: "100%" }}>
                    {!guidedInsertionEnabled ? (
                      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                        <CopyOutlined style={{ marginRight: 4 }} />
                        {t("settings.formula_fields.formula.json_builder.copy_hint")}
                      </Typography.Text>
                    ) : null}
                    <div>
                      <Flex justify="space-between" align="center" gap={8} wrap={false} style={{ height: 34 }}>
                        <Typography.Text type="secondary">
                          <strong>{t("settings.formula_fields.formula.token_sections.operators")}</strong>
                        </Typography.Text>
                        {guidedInsertionEnabled && pendingHelperHint ? (
                          <Space size={6} style={{ minWidth: 0, flexShrink: 0 }}>
                            <Typography.Text type="warning" style={{ whiteSpace: "nowrap" }}>
                              {t("settings.formula_fields.formula.json_builder.pending_helper_prefix")}
                            </Typography.Text>
                            <Typography.Text code style={{ color: token.colorWarningText }}>
                              {pendingHelperHint.helper}
                            </Typography.Text>
                            <Typography.Text type="warning" style={{ whiteSpace: "nowrap" }}>
                              {t("settings.formula_fields.formula.json_builder.pending_helper_count", {
                                selected: pendingHelperHint.selected,
                                total: pendingHelperHint.total,
                              })}
                            </Typography.Text>
                            {pendingHelperHint.stepLabelKey ? (
                              <Typography.Text type="warning" style={{ whiteSpace: "nowrap" }}>
                                {t(pendingHelperHint.stepLabelKey)}
                              </Typography.Text>
                            ) : null}
                            <Tooltip title={t("settings.formula_fields.formula.json_builder.cancel_pending_tooltip")}>
                              <Button
                                danger
                                size="small"
                                type="text"
                                icon={<CloseCircleOutlined />}
                                onClick={() => cancelPendingHelperInsert()}
                                aria-label={t("settings.formula_fields.formula.json_builder.cancel_pending_tooltip")}
                              />
                            </Tooltip>
                            {pendingHelperHint.allowHelperOnly ? (
                              <Tooltip
                                title={t(
                                  "settings.formula_fields.formula.json_builder.insert_without_reference_tooltip",
                                )}
                              >
                                <Button
                                  size="small"
                                  type="primary"
                                  onClick={() => insertPendingHelperWithoutReferences()}
                                  aria-label={t(
                                    "settings.formula_fields.formula.json_builder.insert_without_reference_tooltip",
                                  )}
                                >
                                  {t("settings.formula_fields.formula.json_builder.helper_only")}
                                </Button>
                              </Tooltip>
                            ) : null}
                          </Space>
                        ) : null}
                      </Flex>
                      <div style={{ marginTop: 6 }}>{renderTokenCategories()}</div>
                    </div>
                    {guidedInsertionEnabled ? (
                      <div style={{ paddingTop: 4 }}>
                        <Collapse
                          ghost
                          size="small"
                          activeKey={helperCompatiblePanelOpen ? ["helper-compatible"] : []}
                          onChange={(keys) => {
                            const nextKeys = Array.isArray(keys) ? keys : [keys];
                            setHelperCompatiblePanelOpenByEntity((current) => ({
                              ...current,
                              [selectedEntityType]: nextKeys.includes("helper-compatible"),
                            }));
                          }}
                        >
                          <Collapse.Panel
                            key="helper-compatible"
                            header={
                              <Flex justify="space-between" align="center" gap={8} wrap>
                                <Typography.Text type={activePendingTokenName ? undefined : "secondary"}>
                                  <strong>
                                    {t("settings.formula_fields.formula.reference_picker.helper_compatible")}
                                  </strong>
                                </Typography.Text>
                                {activePendingTokenName ? (
                                  <Space size={8} wrap>
                                    <Typography.Text code>{activePendingTokenName}</Typography.Text>
                                    <Tag bordered={false}>{helperCompatibleReferenceCount}</Tag>
                                  </Space>
                                ) : (
                                  <Typography.Text type="secondary">
                                    {t("settings.formula_fields.formula.reference_picker.no_helper_selected")}
                                  </Typography.Text>
                                )}
                              </Flex>
                            }
                          >
                            {showCompatibleReferenceGroups ? (
                              helperCompatibleReferenceGroups.length > 0 ? (
                                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                                  {helperCompatibleReferenceGroups.map((group) => (
                                    <div
                                      key={`helper-compatible-${group.key}`}
                                      style={{ ...tokenCategoryStyle, padding: 8 }}
                                    >
                                      <Flex justify="space-between" align="center" gap={8} wrap>
                                        <Typography.Text type="secondary">
                                          <strong>{group.label}</strong>
                                        </Typography.Text>
                                        <Tag bordered={false}>{group.references.length}</Tag>
                                      </Flex>
                                      <div style={{ ...referenceGroupTokenListStyle, marginTop: 6 }}>
                                        {group.references.map((reference) => (
                                          <Tooltip
                                            key={`helper-compatible-reference-${reference.value}`}
                                            title={reference.fullLabel}
                                          >
                                            <Typography.Text
                                              code
                                              style={{
                                                cursor: "pointer",
                                                whiteSpace: "nowrap",
                                                fontWeight: 500,
                                              }}
                                              onClick={() => insertExpressionJsonReference(reference.value)}
                                            >
                                              {reference.label}
                                            </Typography.Text>
                                          </Tooltip>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </Space>
                              ) : (
                                <Typography.Text type="secondary">
                                  {t("settings.formula_fields.formula.reference_picker.no_compatible_fields")}
                                </Typography.Text>
                              )
                            ) : activePendingTokenName ? (
                              <Typography.Text type="secondary">
                                {t("settings.formula_fields.formula.json_builder.if_step_condition_operator")}
                              </Typography.Text>
                            ) : (
                              <Typography.Text type="secondary">
                                {t("settings.formula_fields.formula.reference_picker.no_helper_selected_help")}
                              </Typography.Text>
                            )}
                          </Collapse.Panel>
                        </Collapse>
                      </div>
                    ) : null}
                    <div style={{ paddingTop: 4 }}>
                      <Flex justify="space-between" align="center" gap={8} wrap>
                        <Space size={8} align="center">
                          <Typography.Text type="secondary">
                            <strong>{t("settings.formula_fields.formula.reference_picker.label")}</strong>
                          </Typography.Text>
                          <Tooltip title={t("settings.formula_fields.formula.reference_picker.help")}>
                            <QuestionCircleOutlined style={{ fontSize: "0.9em" }} />
                          </Tooltip>
                        </Space>
                        <Input
                          allowClear
                          size="small"
                          value={referenceSearch}
                          onChange={(event) => setReferenceSearch(event.target.value)}
                          placeholder={t("settings.formula_fields.formula.reference_picker.search_placeholder")}
                          prefix={<SearchOutlined />}
                          style={{ width: isDesktopLayout ? 260 : "100%" }}
                        />
                      </Flex>
                      <div style={{ ...tokenCategoryStyle, marginTop: 6 }}>
                        {filteredReferenceGroups.length > 0 ? (
                          <Collapse
                            ghost
                            size="small"
                            activeKey={visibleReferenceGroupKeys}
                            onChange={(keys) => {
                              const nextKeys = Array.isArray(keys) ? keys : [keys];
                              setExpandedReferenceGroupsByEntity((current) => ({
                                ...current,
                                [selectedEntityType]: nextKeys,
                              }));
                            }}
                          >
                            {filteredReferenceGroups.map((group) => (
                              <Collapse.Panel
                                key={group.key}
                                header={
                                  <Flex justify="space-between" align="center" gap={8} wrap>
                                    <Space size={8} wrap>
                                      <Typography.Text strong>{group.label}</Typography.Text>
                                      <Tag bordered={false}>{group.references.length}</Tag>
                                    </Space>
                                    <Space size={6} wrap>
                                      <Tag bordered={false}>
                                        {t(
                                          group.scope === "current"
                                            ? "settings.formula_fields.formula.reference_picker.current_scope"
                                            : "settings.formula_fields.formula.reference_picker.related_scope",
                                        )}
                                      </Tag>
                                      {group.source === "extra" ? (
                                        <Tag color="gold" bordered={false}>
                                          {t("settings.extra_fields.tab")}
                                        </Tag>
                                      ) : null}
                                    </Space>
                                  </Flex>
                                }
                              >
                                <div style={referenceGroupTokenListStyle}>
                                  {group.references.map((reference) => {
                                    const referenceCompatible = guidedInsertionEnabled
                                      ? isReferenceCompatibleWithPendingHelper(reference.value)
                                      : true;
                                    const isSelectedForPendingHelper = Boolean(
                                      guidedInsertionEnabled &&
                                      pendingJsonHelperInsert?.selectedOperands.some(
                                        (operand) => extractVarReference(operand) === reference.value,
                                      ),
                                    );
                                    const disabledReason =
                                      guidedInsertionEnabled && !referenceCompatible && pendingHelperDefinition
                                        ? t(
                                            "settings.formula_fields.formula.json_builder.reference_incompatible_reason",
                                            {
                                              helper: pendingHelperDefinition.name,
                                            },
                                          )
                                        : null;
                                    const tooltipTitle = disabledReason || reference.fullLabel;
                                    return (
                                      <Tooltip
                                        key={`reference-cell-${reference.value}`}
                                        title={
                                          disabledReason ? (
                                            tooltipTitle
                                          ) : (
                                            <Typography.Text code>{reference.fullLabel}</Typography.Text>
                                          )
                                        }
                                      >
                                        <Typography.Text
                                          code
                                          style={{
                                            cursor: disabledReason ? "not-allowed" : "pointer",
                                            opacity: disabledReason ? 0.45 : 1,
                                            whiteSpace: "nowrap",
                                            fontWeight: 500,
                                            color: isSelectedForPendingHelper
                                              ? token.colorPrimaryText
                                              : !disabledReason && hoveredTokenId === `reference-${reference.value}`
                                                ? token.colorWarningText
                                                : undefined,
                                            background:
                                              !disabledReason && hoveredTokenId === `reference-${reference.value}`
                                                ? token.colorWarningBg
                                                : undefined,
                                            borderColor:
                                              !disabledReason && hoveredTokenId === `reference-${reference.value}`
                                                ? token.colorWarningBorder
                                                : undefined,
                                            transition: "all 120ms ease-out",
                                          }}
                                          onMouseEnter={
                                            !disabledReason
                                              ? () => setHoveredTokenId(`reference-${reference.value}`)
                                              : undefined
                                          }
                                          onMouseLeave={
                                            !disabledReason
                                              ? () =>
                                                  setHoveredTokenId((current) =>
                                                    current === `reference-${reference.value}` ? null : current,
                                                  )
                                              : undefined
                                          }
                                          onClick={
                                            !disabledReason
                                              ? () =>
                                                  guidedInsertionEnabled
                                                    ? insertExpressionJsonReference(reference.value)
                                                    : copyReferenceToClipboard(reference.value)
                                              : undefined
                                          }
                                        >
                                          {reference.label}
                                        </Typography.Text>
                                      </Tooltip>
                                    );
                                  })}
                                </div>
                              </Collapse.Panel>
                            ))}
                          </Collapse>
                        ) : (
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={t("settings.formula_fields.formula.reference_picker.no_results")}
                          />
                        )}
                      </div>
                    </div>
                  </Space>
                </div>
              </>
            ) : null}
          </Space>
          <Form.Item
            name="sample_values"
            rules={[
              {
                validator: async (_, value) => {
                  parseSampleValues(value, t("settings.formula_fields.formula.sample_values_invalid"));
                },
              },
            ]}
          >
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              {/* Keep labels in one row and content in the next so Preview is clearly outside the card. */}
              <Row gutter={8} align="middle" wrap={!isDesktopLayout}>
                <Col flex="auto" style={{ minWidth: 0 }}>
                  <Space size={10} wrap>
                    {labeledField(
                      "settings.formula_fields.formula.sample_values",
                      "settings.formula_fields.formula.tooltips.sample_values",
                    )}
                    <Space size={6}>
                      <Typography.Text type="secondary">Auto-update</Typography.Text>
                      <Switch
                        size="small"
                        checked={sampleValuesAutoUpdateEnabled}
                        onChange={(checked) => setSampleValuesAutoUpdateEnabled(checked)}
                      />
                    </Space>
                  </Space>
                </Col>
                <Col flex={isDesktopLayout ? `${OPERATOR_PANEL_WIDTH}px` : "100%"}>
                  <Space size={4}>
                    <span>{t("settings.formula_fields.formula.preview.panel_title")}</span>
                  </Space>
                </Col>
              </Row>
              <Row gutter={[8, 8]} align="top" wrap={!isDesktopLayout}>
                <Col flex={isDesktopLayout ? "auto" : "100%"} style={{ minWidth: 0 }}>
                  <div
                    style={{
                      height: 78,
                      minHeight: 78,
                      resize: "vertical",
                      overflow: "auto",
                    }}
                  >
                    <CodeMirror
                      value={sampleValuesValue || ""}
                      height="100%"
                      style={{
                        height: "100%",
                        backgroundColor: token.colorBgContainer,
                        color: token.colorText,
                      }}
                      extensions={[json(), drawSelection(), codeMirrorSyntaxHighlight, codeMirrorTheme]}
                      basicSetup={{
                        lineNumbers: false,
                        drawSelection: false,
                        bracketMatching: true,
                        highlightSelectionMatches: true,
                        highlightActiveLine: false,
                        foldGutter: false,
                      }}
                      placeholder={sampleValuesPlaceholder}
                      onChange={(value) => {
                        derivedForm.setFieldValue("sample_values", value);
                      }}
                    />
                  </div>
                </Col>
                <Col flex={isDesktopLayout ? `${OPERATOR_PANEL_WIDTH}px` : "100%"}>
                  <div
                    style={{
                      ...tokenPanelStyle,
                      minHeight: 78,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      padding: 8,
                    }}
                  >
                    <div style={{ minHeight: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {previewPanelContent}
                    </div>
                  </div>
                </Col>
              </Row>
              {/* Surface detected references and clearly mark only invalid/undefined entries.
                  Missing paths are auto-scaffolded while typing and preview updates automatically. */}
              <Flex align="center" gap={8} wrap="wrap">
                <Space size={[6, 6]} wrap>
                  <Typography.Text type="secondary">
                    <strong>{t("settings.formula_fields.formula.sample_values_detected_references")}</strong>
                  </Typography.Text>
                  {detectedExpressionReferences.length > 0 ? (
                    detectedExpressionReferences.map((reference) => {
                      const isDefined = hasValidSampleValues && !missingSampleValueReferences.includes(reference);
                      const statusTooltip = isDefined
                        ? undefined
                        : t("settings.formula_fields.formula.sample_values_reference_invalid");
                      const referenceText = (
                        <Typography.Text
                          key={`sample-ref-${reference}`}
                          code
                          style={
                            isDefined ? undefined : { color: token.colorErrorText, borderColor: token.colorErrorBorder }
                          }
                        >
                          {reference}
                        </Typography.Text>
                      );
                      return (
                        <Tooltip key={`sample-ref-tooltip-${reference}`} title={statusTooltip}>
                          <span>{referenceText}</span>
                        </Tooltip>
                      );
                    })
                  ) : (
                    <Typography.Text type="secondary">
                      {t("settings.formula_fields.formula.sample_values_detected_references_empty")}
                    </Typography.Text>
                  )}
                </Space>
              </Flex>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      {contextHolder}
    </>
  );
}
