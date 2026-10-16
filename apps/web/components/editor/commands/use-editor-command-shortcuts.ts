import { useEffect } from "react";
import type { EditorCommand } from "@/components/editor/commands/types";
import {
  isEditableTarget,
  matchesShortcut,
  toShortcutArray,
} from "@/components/editor/commands/shortcut-utils";

type UseEditorCommandShortcutsOptions = {
  commands: EditorCommand[];
};

export const useEditorCommandShortcuts = ({
  commands,
}: UseEditorCommandShortcutsOptions) => {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      for (const command of commands) {
        if (command.disabled) continue;
        const shortcuts = toShortcutArray(command.shortcut);
        for (const shortcut of shortcuts) {
          if (!shortcut.allowInInput && isEditableTarget(event.target)) continue;
          if (!matchesShortcut(event, shortcut)) continue;
          if (shortcut.preventDefault ?? true) {
            event.preventDefault();
          }
          command.run();
          return;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [commands]);
};
