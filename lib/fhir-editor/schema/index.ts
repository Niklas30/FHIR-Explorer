export {
  createSchemaContext,
  isUppercaseTypeCode,
  type SchemaContext,
  type SchemaNode,
  type SchemaTree,
  type SchemaElementDefinition,
} from "@/lib/fhir-editor/schema/types";
export {
  createPrimitiveExtensionNode,
  getPrimitiveCompanionKey,
  isEmptyCompanion,
} from "@/lib/fhir-editor/schema/primitive-extensions";
export { resolveSnapshotElements, matchChoiceRename } from "@/lib/fhir-editor/schema/snapshot";
export {
  buildSchemaTree,
  buildTreeFromElements,
  getSchemaTreeByCanonical,
  getNodeChildren,
  getReferenceTargetTypes,
  getExtensionDefinitionTree,
  getExtensionUrl,
} from "@/lib/fhir-editor/schema/tree";
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
} from "@/lib/fhir-editor/schema/values";
export { resolveRenderKind, type RenderKind, type PrimitiveKind } from "@/lib/fhir-editor/schema/render-kind";
export { validateResource, type ValidationIssue } from "@/lib/fhir-editor/schema/validate";
export {
  collectInvariants,
  evaluateInvariants,
  type CollectedInvariant,
} from "@/lib/fhir-editor/schema/invariants";
