export {
  createSchemaContext,
  isUppercaseTypeCode,
  type SchemaContext,
  type SchemaNode,
  type SchemaTree,
  type SchemaElementDefinition,
} from "@fhir-explorer/core/fhir-editor/schema/types";
export {
  createPrimitiveExtensionNode,
  getPrimitiveCompanionKey,
  isEmptyCompanion,
} from "@fhir-explorer/core/fhir-editor/schema/primitive-extensions";
export { resolveSnapshotElements, matchChoiceRename } from "@fhir-explorer/core/fhir-editor/schema/snapshot";
export {
  buildSchemaTree,
  buildTreeFromElements,
  getSchemaTreeByCanonical,
  getNodeChildren,
  getReferenceTargetTypes,
  getExtensionDefinitionTree,
  getExtensionUrl,
} from "@fhir-explorer/core/fhir-editor/schema/tree";
export {
  asItems,
  createDefaultFieldValue,
  createDefaultItem,
  createDefaultValue,
  detectChoiceType,
  getChoiceKey,
  getChoiceKeys,
  getNodeKey,
  isNodePresent,
  isRecord,
  matchesPattern,
  parseMaxCount,
  setChildValue,
} from "@fhir-explorer/core/fhir-editor/schema/values";
export { resolveRenderKind, type RenderKind, type PrimitiveKind } from "@fhir-explorer/core/fhir-editor/schema/render-kind";
export { validateResource, type ValidationIssue } from "@fhir-explorer/core/fhir-editor/schema/validate";
export {
  collectInvariants,
  evaluateInvariants,
  type CollectedInvariant,
} from "@fhir-explorer/core/fhir-editor/schema/invariants";
