import { useI18n } from "@fhir-explorer/ui/i18n/context";
import { byLocale } from "@fhir-explorer/core/i18n/select";

const enText = {
  constraintsOn: "Constraints on",
  noBaseDefinition: "No base definition",
  baseNotResolved:
    "Base type not resolvable — import the dependency that defines it (e.g. hl7.fhir.r4.core).",
  constraintsBadge: "constraints",
  cardMin: "min",
  cardMax: "max",
  mustSupport: "Must-support",
  bindingNone: "No binding",
  usedBy: "Used by",
  expand: "Expand",
  collapse: "Collapse",
};

export type ProfileConstraintsText = typeof enText;

export const useProfileConstraintsText = (): ProfileConstraintsText => {
  const { locale } = useI18n();
  return byLocale(locale, {
    en: enText,
    de: {
      constraintsOn: "Constraints auf",
      noBaseDefinition: "Keine Basisdefinition",
      baseNotResolved:
        "Basistyp nicht auflösbar — importiere die Dependency, die ihn definiert (z. B. hl7.fhir.r4.core).",
      constraintsBadge: "Constraints",
      cardMin: "min",
      cardMax: "max",
      mustSupport: "Must-Support",
      bindingNone: "Kein Binding",
      usedBy: "Verwendet von",
      expand: "Aufklappen",
      collapse: "Zuklappen",
    },
    fr: {
      constraintsOn: "Contraintes sur",
      noBaseDefinition: "Aucune définition de base",
      baseNotResolved:
        "Type de base introuvable — importe la dépendance qui le définit (p. ex. hl7.fhir.r4.core).",
      constraintsBadge: "contraintes",
      cardMin: "min",
      cardMax: "max",
      mustSupport: "Must-support",
      bindingNone: "Aucun binding",
      usedBy: "Utilisé par",
      expand: "Déplier",
      collapse: "Replier",
    },
    es: {
      constraintsOn: "Restricciones sobre",
      noBaseDefinition: "Sin definición base",
      baseNotResolved:
        "No se puede resolver el tipo base: importa la dependencia que lo define (p. ej. hl7.fhir.r4.core).",
      constraintsBadge: "restricciones",
      cardMin: "mín",
      cardMax: "máx",
      mustSupport: "Must-support",
      bindingNone: "Sin binding",
      usedBy: "Usado por",
      expand: "Expandir",
      collapse: "Contraer",
    },
    it: {
      constraintsOn: "Vincoli su",
      noBaseDefinition: "Nessuna definizione di base",
      baseNotResolved:
        "Tipo base non risolvibile: importa la dipendenza che lo definisce (ad es. hl7.fhir.r4.core).",
      constraintsBadge: "vincoli",
      cardMin: "min",
      cardMax: "max",
      mustSupport: "Must-support",
      bindingNone: "Nessun binding",
      usedBy: "Usato da",
      expand: "Espandi",
      collapse: "Comprimi",
    },
  });
};
