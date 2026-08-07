import type { LucideIcon } from "lucide-react";

export type EditorCommandShortcut = {
  key: string;
  mod?: boolean;
  alt?: boolean;
  shift?: boolean;
  allowInInput?: boolean;
  preventDefault?: boolean;
};

export type EditorCommand = {
  id: string;
  label: string;
  group: string;
  run: () => void;
  icon?: LucideIcon;
  keywords?: string[];
  disabled?: boolean;
  hidden?: boolean;
  shortcut?: EditorCommandShortcut | EditorCommandShortcut[];
};
