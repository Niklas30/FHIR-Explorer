import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProfileSummary } from "@/lib/fhir-editor/profiles";

type NewResourceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: ProfileSummary[];
  onCreate: (payload: { profileUrl: string; resourceId?: string }) => void;
};

export const NewResourceDialog = ({
  open,
  onOpenChange,
  profiles,
  onCreate,
}: NewResourceDialogProps) => {
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [resourceId, setResourceId] = useState<string>("");
  const [query, setQuery] = useState("");

  const createDefaultId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `resource-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  };

  const sortedProfiles = useMemo(() => {
    return [...profiles].sort((a, b) => {
      const aName = a.name ?? a.title ?? a.url ?? "";
      const bName = b.name ?? b.title ?? b.url ?? "";
      return aName.localeCompare(bName);
    });
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sortedProfiles.filter((profile) => {
      if (!normalizedQuery) return true;
      const label = `${profile.name ?? ""} ${profile.title ?? ""} ${profile.type ?? ""}`.toLowerCase();
      return label.includes(normalizedQuery);
    });
  }, [sortedProfiles, query]);

  useEffect(() => {
    if (open) {
      const initial = profiles[0]?.url ?? "";
      setSelectedProfile(initial);
      setResourceId(createDefaultId());
      setQuery("");
    }
  }, [open, profiles]);

  useEffect(() => {
    if (!open) return;
    if (filteredProfiles.length === 0) return;
    const exists = filteredProfiles.some((profile) => profile.url === selectedProfile);
    if (!exists) {
      setSelectedProfile(filteredProfiles[0].url);
    }
  }, [filteredProfiles, open, selectedProfile]);

  const handleCreate = () => {
    if (!selectedProfile) return;
    onCreate({ profileUrl: selectedProfile, resourceId: resourceId.trim() || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New resource</DialogTitle>
          <DialogDescription>
            Pick a profile and start composing a resource instance.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="profile-search">Search</Label>
            <Input
              id="profile-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search profiles"
            />
          </div>
          <div className="grid gap-2">
            <div className="max-h-56 overflow-auto">
              {filteredProfiles.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground">
                  No matching profiles.
                </div>
              ) : (
                <div className="grid gap-2">
                  {filteredProfiles.map((profile) => {
                    const name = profile.name ?? profile.title ?? profile.url ?? "Profile";
                    const isActive = profile.url === selectedProfile;
                    return (
                      <button
                        key={profile.url}
                        type="button"
                        onClick={() => setSelectedProfile(profile.url)}
                        className={[
                          "rounded-md border px-3 py-2 text-left text-sm transition",
                          isActive
                            ? "border-foreground/30 bg-muted/50"
                            : "border-foreground/10 hover:border-foreground/30 hover:bg-muted/40",
                        ].join(" ")}
                      >
                        <div className="font-medium text-foreground">{name}</div>
                        {profile.type ? (
                          <div className="text-xs text-muted-foreground">{profile.type}</div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-select">Matching profiles</Label>
            <select
              id="profile-select"
              value={selectedProfile}
              onChange={(event) => setSelectedProfile(event.target.value)}
              className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
            >
              {filteredProfiles.length === 0 ? (
                <option value="">No profiles available</option>
              ) : (
                filteredProfiles.map((profile) => (
                  <option key={profile.url} value={profile.url}>
                    {profile.name ?? profile.title ?? profile.url}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="resource-id">FHIR id (optional)</Label>
            <Input
              id="resource-id"
              value={resourceId}
              onChange={(event) => setResourceId(event.target.value)}
              placeholder="endpoint-001"
            />
            <p className="text-xs text-muted-foreground">
              Use an id if the resource should be referenced by others.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!selectedProfile}>
            Create resource
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
