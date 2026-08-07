"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DependencyRequirement } from "@/lib/fhir-importer/types";
import type { useImportWizardText } from "@/components/importer/import-wizard/text";

/**
 * The versions the resolver settled on where packages disagreed.
 *
 * These are not errors and nothing here has to be touched — the newest of the
 * requested versions is chosen automatically, because it is the one that can
 * satisfy every requirement. The card exists so that a user who knows better
 * can say so, which is why it only appears in the advanced controls.
 */

export type VersionChoicesCardProps = {
  text: ReturnType<typeof useImportWizardText>["text"];
  decisions: DependencyRequirement[];
  onPickVersion: (depId: string, version: string) => void;
};

export const VersionChoicesCard = ({
  text,
  decisions,
  onPickVersion,
}: VersionChoicesCardProps) => {
  if (decisions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{text.versionChoices}</CardTitle>
        <CardDescription>{text.versionChoicesDescription}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {decisions.map((decision) => {
          const chosen = decision.chosenVersion ?? decision.exactVersion;
          return (
            <div
              key={decision.id}
              className="rounded-lg border border-foreground/10 bg-muted/30 px-3 py-2"
            >
              <p className="text-sm font-semibold text-foreground">{decision.id}</p>
              <p className="text-xs text-muted-foreground">
                {`${text.requestedVersions} ${decision.ranges.join(", ")}`}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {decision.ranges.map((version) => (
                  <Button
                    key={version}
                    size="sm"
                    variant={version === chosen ? "default" : "secondary"}
                    onClick={() => onPickVersion(decision.id, version)}
                  >
                    {version}
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
