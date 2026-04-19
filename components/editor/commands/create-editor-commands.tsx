import {
  ArrowLeft,
  ArrowRight,
  Command as CommandIcon,
  Download,
  FilePlus2,
  Home,
  Moon,
  Search,
  Sun,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { EditorCommand } from "@/components/editor/commands/types";

type CreateEditorCommandsOptions = {
  openPalette: () => void;
  openProjects: () => void;
  createResource: () => void;
  openExport: () => void;
  openDiagram: () => void;
  focusFormSearch: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  navigateBack: () => void;
  navigateForward: () => void;
  canNavigateBack: boolean;
  canNavigateForward: boolean;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
};

export const createEditorCommands = ({
  openPalette,
  openProjects,
  createResource,
  openExport,
  openDiagram,
  focusFormSearch,
  zoomIn,
  zoomOut,
  navigateBack,
  navigateForward,
  canNavigateBack,
  canNavigateForward,
  theme,
  setTheme,
}: CreateEditorCommandsOptions): EditorCommand[] => {
  return [
    {
      id: "open-command-palette",
      label: "Open Commands",
      group: "Navigation",
      icon: CommandIcon,
      hidden: true,
      run: openPalette,
      shortcut: [
        { key: ".", preventDefault: true },
        { key: "k", mod: true, preventDefault: true },
      ],
    },
    {
      id: "go-to-projects",
      label: "Back to Projects",
      group: "Navigation",
      icon: Home,
      run: openProjects,
      keywords: ["overview", "home"],
    },
    {
      id: "previous-resource",
      label: "Previous Resource",
      group: "Navigation",
      icon: ArrowLeft,
      run: navigateBack,
      disabled: !canNavigateBack,
      shortcut: { key: "[", preventDefault: true },
    },
    {
      id: "next-resource",
      label: "Next Resource",
      group: "Navigation",
      icon: ArrowRight,
      run: navigateForward,
      disabled: !canNavigateForward,
      shortcut: { key: "]", preventDefault: true },
    },
    {
      id: "create-resource",
      label: "Create Resource",
      group: "Actions",
      icon: FilePlus2,
      run: createResource,
      shortcut: { key: "n", shift: true, preventDefault: true },
    },
    {
      id: "open-export",
      label: "Export",
      group: "Actions",
      icon: Download,
      run: openExport,
      shortcut: { key: "e", shift: true, preventDefault: true },
    },
    {
      id: "open-diagram",
      label: "Visualize",
      group: "Actions",
      icon: CommandIcon,
      run: openDiagram,
      shortcut: { key: "v", shift: true, preventDefault: true },
    },
    {
      id: "search-form-fields",
      label: "Formular durchsuchen",
      group: "Actions",
      icon: Search,
      run: focusFormSearch,
      keywords: ["search", "find", "filter", "fields", "formular", "suche"],
      shortcut: {
        key: "f",
        mod: true,
        allowInInput: true,
        preventDefault: true,
      },
    },
    {
      id: "zoom-in",
      label: "Zoom In",
      group: "View",
      icon: ZoomIn,
      run: zoomIn,
      shortcut: [
        { key: "=", preventDefault: true },
        { key: "+", shift: true, preventDefault: true },
      ],
    },
    {
      id: "zoom-out",
      label: "Zoom Out",
      group: "View",
      icon: ZoomOut,
      run: zoomOut,
      shortcut: { key: "-", preventDefault: true },
    },
    {
      id: "theme-light",
      label: "Set Light Theme",
      group: "View",
      icon: Sun,
      run: () => setTheme("light"),
      disabled: theme === "light",
    },
    {
      id: "theme-dark",
      label: "Set Dark Theme",
      group: "View",
      icon: Moon,
      run: () => setTheme("dark"),
      disabled: theme === "dark",
    },
  ];
};
