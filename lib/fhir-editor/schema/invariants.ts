import type { SchemaNode, SchemaTree } from "@/lib/fhir-editor/schema/types";
import type { ValidationIssue } from "@/lib/fhir-editor/schema/validate";
import { logger } from "@/lib/logger";

/**
 * FHIRPath invariant evaluation (ElementDefinition.constraint).
 *
 * fhirpath.js is heavy, so it is loaded lazily and evaluation runs as a
 * separate async pass that supplements the synchronous structural
 * validation. Expressions the engine cannot evaluate are skipped silently —
 * an unevaluable invariant must never block editing.
 */

export type CollectedInvariant = {
  /** Dotted path relative to the resource root ("" for root constraints). */
  relativePath: string;
  key: string;
  severity: "error" | "warning";
  human: string;
  expression: string;
};

/**
 * Constraint keys that hold for any syntactically valid FHIR JSON or are
 * pure narrative guidance — evaluating them everywhere is noise.
 */
const IGNORED_CONSTRAINT_KEYS = /^(ele-1|dom-)/;

const toRelativePath = (nodePath: string, rootType: string) =>
  nodePath === rootType ? "" : nodePath.slice(rootType.length + 1);

const collectFromNode = (
  node: SchemaNode,
  rootType: string,
  target: CollectedInvariant[],
  seen: Set<string>
) => {
  for (const constraint of node.constraints ?? []) {
    if (!constraint.expression || !constraint.key) continue;
    if (IGNORED_CONSTRAINT_KEYS.test(constraint.key)) continue;
    const relativePath = toRelativePath(node.path, rootType);
    const dedupeKey = `${relativePath}|${constraint.key}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    target.push({
      relativePath,
      key: constraint.key,
      severity: constraint.severity === "warning" ? "warning" : "error",
      human: constraint.human ?? constraint.key,
      expression: constraint.expression,
    });
  }
  for (const child of node.children) {
    collectFromNode(child, rootType, target, seen);
  }
};

/**
 * Collects evaluable invariants from the profile tree (root, top-level
 * elements and inline backbone children; datatype internals excluded).
 */
export const collectInvariants = (tree: SchemaTree): CollectedInvariant[] => {
  const invariants: CollectedInvariant[] = [];
  const seen = new Set<string>();
  collectFromNode(tree.root, tree.rootType, invariants, seen);
  return invariants;
};

type FhirPathEngine = {
  evaluate: (
    resource: unknown,
    expression: string,
    env: Record<string, unknown>,
    model: unknown
  ) => unknown[];
  model: unknown;
};

let enginePromise: Promise<FhirPathEngine | null> | null = null;

const loadEngine = (): Promise<FhirPathEngine | null> => {
  enginePromise ??= Promise.all([
    import("fhirpath"),
    import("fhirpath/fhir-context/r4"),
  ])
    .then(([fhirpath, model]) => ({
      evaluate: fhirpath.evaluate as FhirPathEngine["evaluate"],
      model: (model as { default?: unknown }).default ?? model,
    }))
    .catch((error) => {
      logger.error("Failed to load fhirpath engine", { error });
      return null;
    });
  return enginePromise;
};

/**
 * Element-level invariants apply to every instance of the element:
 * "<path>.all(<expr>)" evaluates the expression with each element value as
 * context and passes vacuously when the element is absent.
 */
const buildExpression = (invariant: CollectedInvariant) =>
  invariant.relativePath
    ? `${invariant.relativePath}.all(${invariant.expression})`
    : invariant.expression;

/**
 * Evaluates the profile's FHIRPath invariants against a resource instance.
 * Returns only violated invariants; unevaluable expressions are skipped.
 */
export const evaluateInvariants = async (
  content: Record<string, unknown>,
  tree: SchemaTree
): Promise<ValidationIssue[]> => {
  const invariants = collectInvariants(tree);
  if (invariants.length === 0) return [];

  const engine = await loadEngine();
  if (!engine) return [];

  const issues: ValidationIssue[] = [];
  for (const invariant of invariants) {
    let result: unknown[];
    try {
      result = engine.evaluate(
        content,
        buildExpression(invariant),
        { resource: content },
        engine.model
      );
    } catch {
      // Expression uses features the engine does not support — skip.
      continue;
    }
    if (result.length === 1 && result[0] === false) {
      issues.push({
        severity: invariant.severity,
        code: `invariant-${invariant.key}`,
        path: invariant.relativePath,
        message: `${invariant.key}: ${invariant.human}`,
      });
    }
  }
  return issues;
};
