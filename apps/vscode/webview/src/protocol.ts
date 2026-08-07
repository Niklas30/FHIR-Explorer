import type { ResourcePayload } from "@fhir-explorer/core/fhir-importer/types";
import type { Locale } from "@fhir-explorer/core/i18n/types";

/**
 * Messages between the extension host and the form webview.
 *
 * The document is the single source of truth and it lives in the host. The
 * webview never owns state that is not derived from a message it received —
 * that is what keeps undo, hot exit and the text editor in the other split
 * pane correct.
 */

export type HostToWebview =
  | {
      type: "init";
      /** Conformance resources this resource needs, already reduced to its closure. */
      payloads: ResourcePayload[];
      /** Current document text. */
      text: string;
      documentVersion: number;
      locale: Locale;
      terminologyServerUrl: string | null;
      /** `ResourceType/id` of everything in the project, for reference checks. */
      references: string[];
    }
  | {
      type: "documentChanged";
      text: string;
      documentVersion: number;
    }
  | {
      type: "terminologyExpansion";
      requestId: string;
      body: unknown;
      error?: string;
    };

export type WebviewToHost =
  | { type: "ready" }
  | {
      type: "edit";
      /** Full resource content; the host turns it into minimal document edits. */
      content: Record<string, unknown>;
      /** Version the edit was made against, so a stale edit can be dropped. */
      documentVersion: number;
    }
  | { type: "expandValueSet"; requestId: string; url: string }
  | { type: "error"; message: string };
