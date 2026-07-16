/**
 * Curated list of common UCUM units for Quantity editing. This is a UX
 * convenience, not a validation source — any UCUM code can still be entered
 * manually. Selected units set Quantity.system to the UCUM canonical.
 */

export const UCUM_SYSTEM = "http://unitsofmeasure.org";

export type UcumUnit = {
  code: string;
  display: string;
};

export const COMMON_UCUM_UNITS: UcumUnit[] = [
  // time
  { code: "s", display: "seconds" },
  { code: "min", display: "minutes" },
  { code: "h", display: "hours" },
  { code: "d", display: "days" },
  { code: "wk", display: "weeks" },
  { code: "mo", display: "months" },
  { code: "a", display: "years" },
  // mass
  { code: "kg", display: "kilogram" },
  { code: "g", display: "gram" },
  { code: "mg", display: "milligram" },
  { code: "ug", display: "microgram" },
  // volume
  { code: "L", display: "liter" },
  { code: "mL", display: "milliliter" },
  // length
  { code: "m", display: "meter" },
  { code: "cm", display: "centimeter" },
  { code: "mm", display: "millimeter" },
  // clinical
  { code: "mm[Hg]", display: "millimeter of mercury" },
  { code: "Cel", display: "degree Celsius" },
  { code: "/min", display: "per minute" },
  { code: "/d", display: "per day" },
  { code: "%", display: "percent" },
  { code: "1", display: "unity (dimensionless)" },
  { code: "U", display: "enzyme unit" },
  { code: "mmol/L", display: "millimole per liter" },
  { code: "mg/dL", display: "milligram per deciliter" },
];
