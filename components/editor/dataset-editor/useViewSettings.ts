"use client";

import { useEffect, useState } from "react";
import type { Layout } from "react-resizable-panels";

type Theme = "light" | "dark";

const parsePanelLayout = (raw: string | null): Layout | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      ([, value]) => typeof value === "number"
    );
    if (entries.length === 0) return null;
    return Object.fromEntries(entries) as Layout;
  } catch {
    return null;
  }
};

export const useDatasetEditorViewSettings = (layoutStorageKey: string) => {
  const [zoomPercent, setZoomPercent] = useState(100);
  const [theme, setTheme] = useState<Theme>("light");
  const [panelLayout, setPanelLayout] = useState<Layout | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setLoaded(false);

    const storedZoom = Number(window.localStorage.getItem("health-compose-zoom"));
    if (!Number.isNaN(storedZoom) && storedZoom >= 70 && storedZoom <= 140) {
      setZoomPercent(storedZoom);
    }

    const storedTheme = window.localStorage.getItem("health-compose-theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
    }

    setPanelLayout(parsePanelLayout(window.localStorage.getItem(layoutStorageKey)));
    setLoaded(true);
  }, [layoutStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!loaded) return;
    window.localStorage.setItem("health-compose-zoom", String(zoomPercent));
  }, [loaded, zoomPercent]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    if (typeof window === "undefined") return;
    if (!loaded) return;
    window.localStorage.setItem("health-compose-theme", theme);
  }, [loaded, theme]);

  const persistPanelLayout = (layout: Layout) => {
    setPanelLayout(layout);
    if (typeof window === "undefined") return;
    if (!loaded) return;
    window.localStorage.setItem(layoutStorageKey, JSON.stringify(layout));
  };

  return {
    viewSettingsLoaded: loaded,
    zoomPercent,
    setZoomPercent,
    theme,
    setTheme,
    panelLayout,
    persistPanelLayout,
  };
};

