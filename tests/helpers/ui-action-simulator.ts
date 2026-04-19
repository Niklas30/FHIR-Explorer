import {
  getDefaultValueForField,
  getFieldValue,
  removeFieldValue,
  setFieldValue,
} from "@/lib/fhir-editor/fields";
import type { FieldDefinition } from "@/lib/fhir-editor/profiles";
import type { FhirRegistry } from "@/lib/fhir-editor/registry";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const findField = (fields: FieldDefinition[], path: string) => {
  const field = fields.find((entry) => entry.path === path);
  if (!field) {
    throw new Error(`Field not found in test context: ${path}`);
  }
  return field;
};

const getRepeatingValues = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return [...value];
  if (value === undefined || value === null) return [];
  return [value];
};

const withGroupItem = (
  content: Record<string, unknown>,
  rootField: FieldDefinition,
  index: number,
  update: (item: Record<string, unknown>) => Record<string, unknown>
) => {
  const items = getRepeatingValues(getFieldValue(content, rootField));
  while (items.length <= index) {
    items.push({});
  }
  const current = isRecord(items[index]) ? items[index] : {};
  items[index] = update(current);
  return setFieldValue(content, rootField, items);
};

export const addField = (
  content: Record<string, unknown>,
  fields: FieldDefinition[],
  path: string,
  registry?: FhirRegistry
) => {
  const field = findField(fields, path);
  const defaultValue = getDefaultValueForField(field, registry);
  return setFieldValue(content, field, defaultValue);
};

export const removeField = (
  content: Record<string, unknown>,
  fields: FieldDefinition[],
  path: string
) => {
  const field = findField(fields, path);
  return removeFieldValue(content, field);
};

export const setField = (
  content: Record<string, unknown>,
  fields: FieldDefinition[],
  path: string,
  value: unknown
) => {
  const field = findField(fields, path);
  return setFieldValue(content, field, value);
};

export const addFieldValue = (
  content: Record<string, unknown>,
  fields: FieldDefinition[],
  path: string,
  value: unknown
) => {
  const field = findField(fields, path);
  const values = getRepeatingValues(getFieldValue(content, field));
  values.push(value);
  return setFieldValue(content, field, values);
};

export const updateFieldValue = (
  content: Record<string, unknown>,
  fields: FieldDefinition[],
  path: string,
  index: number,
  value: unknown
) => {
  const field = findField(fields, path);
  const values = getRepeatingValues(getFieldValue(content, field));
  while (values.length <= index) {
    values.push(undefined);
  }
  values[index] = value;
  return setFieldValue(content, field, values);
};

export const removeFieldValueAt = (
  content: Record<string, unknown>,
  fields: FieldDefinition[],
  path: string,
  index: number
) => {
  const field = findField(fields, path);
  const values = getRepeatingValues(getFieldValue(content, field)).filter(
    (_, currentIndex) => currentIndex !== index
  );
  return setFieldValue(content, field, values);
};

export const addGroupEntry = (
  content: Record<string, unknown>,
  fields: FieldDefinition[],
  rootPath: string
) => {
  const rootField = findField(fields, rootPath);
  const items = getRepeatingValues(getFieldValue(content, rootField));
  items.push({});
  return setFieldValue(content, rootField, items);
};

export const removeGroupEntry = (
  content: Record<string, unknown>,
  fields: FieldDefinition[],
  rootPath: string,
  index: number
) => {
  const rootField = findField(fields, rootPath);
  const items = getRepeatingValues(getFieldValue(content, rootField)).filter(
    (_, currentIndex) => currentIndex !== index
  );
  return setFieldValue(content, rootField, items);
};

export const setGroupChildField = (
  content: Record<string, unknown>,
  fields: FieldDefinition[],
  rootPath: string,
  childPath: string,
  index: number,
  value: unknown
) => {
  const rootField = findField(fields, rootPath);
  const childField = findField(fields, childPath);
  const relativeChildField: FieldDefinition = {
    ...childField,
    segments: childField.segments.slice(1),
  };
  return withGroupItem(content, rootField, index, (item) =>
    setFieldValue(item, relativeChildField, value)
  );
};

export const removeGroupChildField = (
  content: Record<string, unknown>,
  fields: FieldDefinition[],
  rootPath: string,
  childPath: string,
  index: number
) => {
  const rootField = findField(fields, rootPath);
  const childField = findField(fields, childPath);
  const relativeChildField: FieldDefinition = {
    ...childField,
    segments: childField.segments.slice(1),
  };
  return withGroupItem(content, rootField, index, (item) =>
    removeFieldValue(item, relativeChildField)
  );
};

export const addGroupChildFieldValue = (
  content: Record<string, unknown>,
  fields: FieldDefinition[],
  rootPath: string,
  childPath: string,
  index: number,
  value: unknown
) => {
  const rootField = findField(fields, rootPath);
  const childField = findField(fields, childPath);
  const relativeChildField: FieldDefinition = {
    ...childField,
    segments: childField.segments.slice(1),
  };
  return withGroupItem(content, rootField, index, (item) => {
    const values = getRepeatingValues(getFieldValue(item, relativeChildField));
    values.push(value);
    return setFieldValue(item, relativeChildField, values);
  });
};

export const removeGroupChildFieldValueAt = (
  content: Record<string, unknown>,
  fields: FieldDefinition[],
  rootPath: string,
  childPath: string,
  index: number,
  valueIndex: number
) => {
  const rootField = findField(fields, rootPath);
  const childField = findField(fields, childPath);
  const relativeChildField: FieldDefinition = {
    ...childField,
    segments: childField.segments.slice(1),
  };
  return withGroupItem(content, rootField, index, (item) => {
    const values = getRepeatingValues(getFieldValue(item, relativeChildField)).filter(
      (_, currentIndex) => currentIndex !== valueIndex
    );
    return setFieldValue(item, relativeChildField, values);
  });
};
