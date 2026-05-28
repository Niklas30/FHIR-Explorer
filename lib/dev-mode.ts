const DEV_MODE_STORAGE_KEY = "fhir-explorer-dev-mode";
const DEV_MODE_COOKIE_KEY = "health_compose_dev_mode";
const DEV_MODE_COOKIE_VALUE = "1";
const DEV_MODE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const parseCookieValue = (cookieSource: string, key: string): string | null => {
  const parts = cookieSource.split(";").map((entry) => entry.trim());
  for (const part of parts) {
    if (!part) continue;
    if (!part.startsWith(`${key}=`)) continue;
    return decodeURIComponent(part.slice(key.length + 1));
  }
  return null;
};

const readDevModeCookie = (): boolean => {
  if (typeof document === "undefined") return false;
  const value = parseCookieValue(document.cookie, DEV_MODE_COOKIE_KEY);
  return value === DEV_MODE_COOKIE_VALUE;
};

const writeDevModeCookie = (enabled: boolean) => {
  if (typeof document === "undefined") return;
  const value = enabled ? DEV_MODE_COOKIE_VALUE : "0";
  document.cookie = `${DEV_MODE_COOKIE_KEY}=${value}; path=/; max-age=${DEV_MODE_COOKIE_MAX_AGE}; samesite=lax`;
};

export const isDevModeEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    const value = window.localStorage.getItem(DEV_MODE_STORAGE_KEY);
    if (value === DEV_MODE_COOKIE_VALUE) return true;
  } catch {
    // Ignore localStorage access errors and continue with cookie fallback.
  }
  return readDevModeCookie();
};

export const setDevModeEnabled = (enabled: boolean) => {
  if (typeof window === "undefined") return;
  try {
    if (enabled) {
      window.localStorage.setItem(DEV_MODE_STORAGE_KEY, DEV_MODE_COOKIE_VALUE);
    } else {
      window.localStorage.removeItem(DEV_MODE_STORAGE_KEY);
    }
  } catch {
    // Ignore localStorage access errors and still update cookie.
  }
  writeDevModeCookie(enabled);
};
