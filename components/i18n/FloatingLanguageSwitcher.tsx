"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";

const STATIC_VISIBLE_PATHS = new Set(["/", "/importer", "/devmode"]);

const shouldShowFloatingSwitcher = (pathname: string) => {
  if (STATIC_VISIBLE_PATHS.has(pathname)) return true;
  return false;
};

export const FloatingLanguageSwitcher = () => {
  const pathname = usePathname();
  const visible = useMemo(
    () => shouldShowFloatingSwitcher(pathname ?? "/"),
    [pathname]
  );

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
      <LanguageSwitcher className="pointer-events-auto h-11 w-11 rounded-full border bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80" />
    </div>
  );
};
