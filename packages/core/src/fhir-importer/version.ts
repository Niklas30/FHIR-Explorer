/**
 * Version ordering for FHIR® packages.
 *
 * They are semver in practice (`1.6.0`, `1.6.0-ballot2`, `4.0.1`), but the
 * registry also carries the odd four-part or non-numeric version, so this
 * compares defensively rather than rejecting what it does not understand.
 *
 * Used to settle a dependency disagreement without asking: when two packages
 * pin different exact versions of the same dependency, the newer one is the
 * one that can satisfy both, so it wins unless the user says otherwise.
 */

const RELEASE_AND_PRERELEASE = /^([^-+]+)(?:-([^+]+))?/;

const numericParts = (value: string): number[] =>
  value.split(".").map((part) => {
    const parsed = Number.parseInt(part, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  });

const comparePrerelease = (a: string | undefined, b: string | undefined): number => {
  // A release always outranks a pre-release of the same version.
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, "en");
};

/** Negative when `a` is older, positive when newer, zero when equal. */
export const compareVersions = (a: string, b: string): number => {
  const left = RELEASE_AND_PRERELEASE.exec(a);
  const right = RELEASE_AND_PRERELEASE.exec(b);
  if (!left || !right) return a.localeCompare(b, "en");

  const leftParts = numericParts(left[1]);
  const rightParts = numericParts(right[1]);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return comparePrerelease(left[2], right[2]);
};

export const isPrerelease = (version: string): boolean => version.includes("-");

/**
 * Newest first, with pre-releases pushed below every stable version.
 *
 * A version list is something the user picks from; offering `1.6.0-ballot2`
 * above `1.6.0` because it sorts higher would be actively unhelpful.
 */
export const sortVersionsForPicking = (versions: string[]): string[] =>
  [...versions].sort((a, b) => {
    const prereleaseDifference = Number(isPrerelease(a)) - Number(isPrerelease(b));
    if (prereleaseDifference !== 0) return prereleaseDifference;
    return compareVersions(b, a);
  });
