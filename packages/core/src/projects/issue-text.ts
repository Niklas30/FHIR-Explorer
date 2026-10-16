import { byLocale } from "@fhir-explorer/core/i18n/select";
import type { Locale } from "@fhir-explorer/core/i18n/types";
import type { ProjectIssue, ProjectIssueCode } from "@fhir-explorer/core/projects/analysis";

/**
 * The sentences for project consistency issues, one per code and locale.
 *
 * Kept apart from the analysis so the analysis stays data: the web app picks
 * the user's locale, the VS Code extension the editor's.
 */

type Format = (issue: ProjectIssue) => string;
type IssueText = Record<ProjectIssueCode, Format>;

const s = (issue: ProjectIssue) => issue.subject ?? "?";
const t = (issue: ProjectIssue) => issue.target ?? "?";

const en: IssueText = {
  "canonical-mismatch": (i) => `${s(i)}: URL does not match the canonical base (${t(i)}).`,
  "base-unresolved": (i) =>
    `${s(i)}: base definition ${t(i)} cannot be resolved (missing dependency?).`,
  "binding-unresolved": (i) => `${s(i)}: bound value set ${t(i)} cannot be resolved.`,
  "example-profile-unresolved": (i) => `${s(i)}: profile ${t(i)} cannot be resolved.`,
  "duplicate-canonical": (i) => `Canonical URL is used by ${i.count ?? 2} resources: ${t(i)}`,
  "missing-core": () =>
    "hl7.fhir.r4.core is not imported as a dependency — profiles and bindings cannot be fully validated.",
};

const de: IssueText = {
  "canonical-mismatch": (i) => `${s(i)}: URL passt nicht zur Canonical-Basis (${t(i)}).`,
  "base-unresolved": (i) =>
    `${s(i)}: Basisdefinition ${t(i)} ist nicht auflösbar (fehlende Dependency?).`,
  "binding-unresolved": (i) => `${s(i)}: gebundenes ValueSet ${t(i)} ist nicht auflösbar.`,
  "example-profile-unresolved": (i) => `${s(i)}: Profil ${t(i)} ist nicht auflösbar.`,
  "duplicate-canonical": (i) =>
    `Canonical-URL wird von ${i.count ?? 2} Ressourcen verwendet: ${t(i)}`,
  "missing-core": () =>
    "hl7.fhir.r4.core ist nicht als Abhängigkeit importiert — Profile/Bindings können nicht vollständig validiert werden.",
};

const fr: IssueText = {
  "canonical-mismatch": (i) =>
    `${s(i)} : l’URL ne correspond pas à la base canonique (${t(i)}).`,
  "base-unresolved": (i) =>
    `${s(i)} : la définition de base ${t(i)} est introuvable (dépendance manquante ?).`,
  "binding-unresolved": (i) => `${s(i)} : le ValueSet lié ${t(i)} est introuvable.`,
  "example-profile-unresolved": (i) => `${s(i)} : le profil ${t(i)} est introuvable.`,
  "duplicate-canonical": (i) =>
    `L’URL canonique est utilisée par ${i.count ?? 2} ressources : ${t(i)}`,
  "missing-core": () =>
    "hl7.fhir.r4.core n’est pas importé comme dépendance — les profils et bindings ne peuvent pas être entièrement validés.",
};

const es: IssueText = {
  "canonical-mismatch": (i) => `${s(i)}: la URL no coincide con la base canónica (${t(i)}).`,
  "base-unresolved": (i) =>
    `${s(i)}: no se puede resolver la definición base ${t(i)} (¿falta una dependencia?).`,
  "binding-unresolved": (i) => `${s(i)}: no se puede resolver el ValueSet vinculado ${t(i)}.`,
  "example-profile-unresolved": (i) => `${s(i)}: no se puede resolver el perfil ${t(i)}.`,
  "duplicate-canonical": (i) => `La URL canónica la usan ${i.count ?? 2} recursos: ${t(i)}`,
  "missing-core": () =>
    "hl7.fhir.r4.core no está importado como dependencia: los perfiles y bindings no se pueden validar por completo.",
};

const it: IssueText = {
  "canonical-mismatch": (i) => `${s(i)}: l’URL non corrisponde alla base canonica (${t(i)}).`,
  "base-unresolved": (i) =>
    `${s(i)}: la definizione di base ${t(i)} non è risolvibile (dipendenza mancante?).`,
  "binding-unresolved": (i) => `${s(i)}: il ValueSet collegato ${t(i)} non è risolvibile.`,
  "example-profile-unresolved": (i) => `${s(i)}: il profilo ${t(i)} non è risolvibile.`,
  "duplicate-canonical": (i) => `L’URL canonica è usata da ${i.count ?? 2} risorse: ${t(i)}`,
  "missing-core": () =>
    "hl7.fhir.r4.core non è importato come dipendenza: profili e binding non possono essere validati completamente.",
};

export const formatProjectIssue = (issue: ProjectIssue, locale: Locale): string =>
  byLocale(locale, { en, de, fr, es, it })[issue.code](issue);
