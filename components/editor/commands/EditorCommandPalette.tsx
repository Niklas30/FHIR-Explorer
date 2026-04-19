"use client";

import { Fragment, useMemo } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  formatShortcut,
  toShortcutArray,
} from "@/components/editor/commands/shortcut-utils";
import type { EditorCommand } from "@/components/editor/commands/types";
import { byLocale } from "@/lib/i18n/select";

type EditorCommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: EditorCommand[];
};

type GroupedCommands = {
  name: string;
  commands: EditorCommand[];
};

const groupCommands = (commands: EditorCommand[]): GroupedCommands[] => {
  const groups: GroupedCommands[] = [];
  const indexByGroup = new Map<string, number>();

  for (const command of commands) {
    if (command.hidden) continue;
    const existingIndex = indexByGroup.get(command.group);
    if (existingIndex === undefined) {
      indexByGroup.set(command.group, groups.length);
      groups.push({ name: command.group, commands: [command] });
      continue;
    }
    groups[existingIndex].commands.push(command);
  }

  return groups;
};

export const EditorCommandPalette = ({
  open,
  onOpenChange,
  commands,
}: EditorCommandPaletteProps) => {
  const { locale } = useI18n();
  const text = byLocale(locale, {
    de: {
      title: "Editor-Commands",
      description: "Suche und führe einen Command aus.",
      inputPlaceholder: "Command tippen oder suchen...",
      noResults: "Keine Treffer gefunden.",
    },
    en: {
      title: "Editor Commands",
      description: "Search and run a command.",
      inputPlaceholder: "Type a command or search...",
      noResults: "No results found.",
    },
  });
  const groupedCommands = useMemo(() => groupCommands(commands), [commands]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={text.title}
      description={text.description}
    >
      <CommandInput placeholder={text.inputPlaceholder} />
      <CommandList>
        <CommandEmpty>{text.noResults}</CommandEmpty>
        {groupedCommands.map((group, groupIndex) => (
          <Fragment key={group.name}>
            <CommandGroup heading={group.name}>
              {group.commands.map((command) => {
                const Icon = command.icon;
                const primaryShortcut = toShortcutArray(command.shortcut)[0];
                const shortcutLabel = primaryShortcut
                  ? formatShortcut(primaryShortcut)
                  : null;

                return (
                  <CommandItem
                    key={command.id}
                    value={`${command.label} ${command.group} ${(command.keywords ?? []).join(" ")}`}
                    disabled={command.disabled}
                    onSelect={() => {
                      if (command.disabled) return;
                      onOpenChange(false);
                      command.run();
                    }}
                  >
                    {Icon ? <Icon /> : null}
                    <span>{command.label}</span>
                    {shortcutLabel ? (
                      <CommandShortcut>{shortcutLabel}</CommandShortcut>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {groupIndex < groupedCommands.length - 1 ? <CommandSeparator /> : null}
          </Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  );
};
