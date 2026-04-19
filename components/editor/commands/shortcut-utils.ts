import type { EditorCommandShortcut } from "@/components/editor/commands/types";

const KEY_LABELS: Record<string, string> = {
  arrowleft: "←",
  arrowright: "→",
  arrowup: "↑",
  arrowdown: "↓",
  enter: "↵",
  escape: "Esc",
  " ": "Space",
};

const normalizeKey = (key: string) => key.toLowerCase();

const hasCommandModifier = (event: KeyboardEvent) => event.metaKey || event.ctrlKey;

export const toShortcutArray = (
  shortcut?: EditorCommandShortcut | EditorCommandShortcut[]
) => {
  if (!shortcut) return [];
  return Array.isArray(shortcut) ? shortcut : [shortcut];
};

export const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (target.isContentEditable) return true;
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.getAttribute("role") === "textbox") return true;
  return false;
};

export const matchesShortcut = (
  event: KeyboardEvent,
  shortcut: EditorCommandShortcut
) => {
  const shortcutKey = normalizeKey(shortcut.key);
  const eventKey = normalizeKey(event.key);
  if (eventKey !== shortcutKey) return false;

  if (Boolean(shortcut.mod) !== hasCommandModifier(event)) return false;
  if (Boolean(shortcut.alt) !== event.altKey) return false;
  if (Boolean(shortcut.shift) !== event.shiftKey) return false;

  return true;
};

const isMacPlatform = () =>
  typeof navigator !== "undefined" &&
  /mac|iphone|ipad|ipod/i.test(navigator.platform);

export const formatShortcut = (shortcut: EditorCommandShortcut) => {
  const isMac = isMacPlatform();
  const tokens: string[] = [];
  if (shortcut.mod) {
    tokens.push(isMac ? "⌘" : "Ctrl");
  }
  if (shortcut.alt) {
    tokens.push(isMac ? "⌥" : "Alt");
  }
  if (shortcut.shift) {
    tokens.push(isMac ? "⇧" : "Shift");
  }

  const rawKey = normalizeKey(shortcut.key);
  const keyLabel = KEY_LABELS[rawKey] ?? (rawKey.length === 1 ? rawKey.toUpperCase() : rawKey);
  tokens.push(keyLabel);

  return isMac ? tokens.join("") : tokens.join("+");
};
