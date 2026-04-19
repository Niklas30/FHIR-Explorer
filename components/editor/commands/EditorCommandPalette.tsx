"use client";

import { Fragment, useMemo } from "react";
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
  const groupedCommands = useMemo(() => groupCommands(commands), [commands]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editor Commands"
      description="Search and run editor commands."
    >
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
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
