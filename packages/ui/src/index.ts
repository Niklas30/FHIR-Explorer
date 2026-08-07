/**
 * Entry point of the shared component package.
 *
 * The profile-driven form and the primitives it is built from, plus the two
 * contexts a host has to fill in: the locale and the optional terminology
 * server. Everything else is reached through deep imports such as
 * `@fhir-explorer/ui/ui/button`.
 */
export { ResourceDetailPanel } from "@fhir-explorer/ui/editor/ResourceDetailPanel";
export type { ResourceDetailPanelHandle } from "@fhir-explorer/ui/editor/ResourceDetailPanel";
export { I18nContextProvider, useI18n } from "@fhir-explorer/ui/i18n/context";
export type { I18nContextValue, LocaleMode } from "@fhir-explorer/ui/i18n/context";
export {
  TerminologyProvider,
  useTerminology,
} from "@fhir-explorer/ui/terminology/context";
export type { TerminologyContextValue } from "@fhir-explorer/ui/terminology/context";
