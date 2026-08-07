/**
 * Version ordering for FHIR packages.
 *
 * They are semver in practice (`1.6.0`, `1.6.0-ballot2`, `4.0.1`), but the
 * registry also carries the odd four-part or non-numeric version, so this
 * compares defensively rather than rejecting what it does not understand.
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

/** Newest stable match, or the newest match at all when only pre-releases fit. */
const bestOf = (candidates: string[]): string | undefined => {
  const stable = candidates.filter((candidate) => !isPrerelease(candidate));
  return sortVersionsForPicking(stable.length > 0 ? stable : candidates)[0];
};

/** `1.6.0` -> [1, 6, 0], padded so comparisons never read undefined. */
const partsOf = (version: string): number[] => {
  const [release] = version.split("-");
  const parts = numericParts(release);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
};

/**
 * Resolve a dependency range to a concrete version.
 *
 * FHIR manifests overwhelmingly pin exact versions, but `latest`, caret and
 * tilde do occur. Getting caret wrong would silently install a different major
 * version, so the ranges that appear are implemented with their real semver
 * meaning rather than approximated by string prefix. Anything genuinely
 * unrecognised falls back to `latest` — one unusual manifest must not be able
 * to block an install.
 */
export const resolveVersionRange = (
  range: string,
  available: string[],
  latest?: string
): string | undefined => {
  const trimmed = range.trim();
  if (available.includes(trimmed)) return trimmed;
  if (available.length === 0) return undefined;

  const fallback = () => latest ?? bestOf(available);

  if (trimmed === "latest" || trimmed === "*" || trimmed === "") return fallback();

  // `1.5.x`, `1.x` — every component before the wildcard has to match.
  const wildcard = /^(\d+)(?:\.(\d+))?\.[x*]$/i.exec(trimmed);
  if (wildcard) {
    const [major, minor] = [Number(wildcard[1]), wildcard[2] ? Number(wildcard[2]) : null];
    return (
      bestOf(
        available.filter((candidate) => {
          const parts = partsOf(candidate);
          return parts[0] === major && (minor === null || parts[1] === minor);
        })
      ) ?? fallback()
    );
  }

  const operator = /^([\^~])\s*(\d+(?:\.\d+){0,2})$/.exec(trimmed);
  if (operator) {
    const bound = partsOf(operator[2]);
    const sameRange =
      operator[1] === "^"
        ? // Caret: anything up to the next major.
          (parts: number[]) => parts[0] === bound[0]
        : // Tilde: anything up to the next minor.
          (parts: number[]) => parts[0] === bound[0] && parts[1] === bound[1];

    return (
      bestOf(
        available.filter((candidate) => {
          const parts = partsOf(candidate);
          return sameRange(parts) && compareVersions(candidate, operator[2]) >= 0;
        })
      ) ?? fallback()
    );
  }

  return fallback();
};
