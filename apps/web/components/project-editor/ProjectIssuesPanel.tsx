"use client";

import { AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ProjectIssue } from "@/lib/projects/analysis";
import type { ProjectEditorText } from "@/components/project-editor/project-editor/text";

type Props = {
  text: ProjectEditorText;
  issues: ProjectIssue[];
  onSelectResource: (resourceId: string) => void;
};

export const ProjectIssuesPanel = ({ text, issues, onSelectResource }: Props) => (
  <div className="flex h-full min-h-0 flex-col">
    <div className="border-b border-foreground/10 px-4 py-3">
      <div className="text-sm font-semibold text-foreground">{text.issuesTitle}</div>
    </div>
    <ScrollArea className="min-h-0 flex-1">
      {issues.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{text.noIssues}</p>
      ) : (
        <ul className="divide-y divide-foreground/5">
          {issues.map((issue, index) => (
            <li key={`${issue.code}-${index}`}>
              <button
                type="button"
                disabled={!issue.resourceId}
                onClick={() => issue.resourceId && onSelectResource(issue.resourceId)}
                className="flex w-full items-start gap-2 px-4 py-3 text-left text-sm hover:bg-muted/40 disabled:hover:bg-transparent"
              >
                <AlertTriangle
                  className={
                    issue.severity === "error"
                      ? "mt-0.5 size-4 shrink-0 text-red-500"
                      : "mt-0.5 size-4 shrink-0 text-amber-500"
                  }
                />
                <span className="text-foreground/90">{issue.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </ScrollArea>
  </div>
);
