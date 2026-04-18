"use client";

import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT_PX = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);

    const update = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(event.matches);
    };

    update(mediaQuery);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }

    // Safari < 14
    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  return isMobile;
}
