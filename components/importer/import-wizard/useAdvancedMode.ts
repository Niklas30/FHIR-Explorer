"use client";

import { useEffect, useState } from "react";

/**
 * Whether the wizard shows its manual controls.
 *
 * Off by default: importing a package and everything it needs is one button,
 * and the version decisions the resolver makes are sound on their own. The
 * per-package links, version pickers and upload dropzones are for the cases
 * where someone genuinely wants to steer, so they stay out of the way until
 * asked for — and the answer is remembered, because a user who wants them
 * once usually wants them every time.
 */

const STORAGE_KEY = "fhir-importer:advanced-mode";

export const useAdvancedMode = (): [boolean, (value: boolean) => void] => {
  const [advanced, setAdvanced] = useState(false);

  // Read after mount rather than during render: the server renders without
  // storage, and a first paint that disagreed with it would hydrate wrong.
  useEffect(() => {
    try {
      setAdvanced(window.localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      // Storage can be denied outright; the default stands.
    }
  }, []);

  const update = (value: boolean) => {
    setAdvanced(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Not remembering the choice is survivable; refusing to honour it is not.
    }
  };

  return [advanced, update];
};
