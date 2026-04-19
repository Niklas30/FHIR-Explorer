import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { byLocale } from "@/lib/i18n/select";
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
  const { locale } = useI18n();
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [resourceId, setResourceId] = useState<string>("");
  const [query, setQuery] = useState("");
  const enText = {
    title: "New resource",
    description: "Pick a profile and start composing a resource instance.",
    search: "Search",
    searchProfiles: "Search profiles",
    noMatchingProfiles: "No matching profiles.",
    profileFallback: "Profile",
    matchingProfiles: "Matching profiles",
    noProfilesAvailable: "No profiles available",
    resourceIdLabel: "FHIR ID (optional)",
    resourceIdPlaceholder: "endpoint-001",
    resourceIdHint: "Use an ID if the resource should be referenced by others.",
    cancel: "Cancel",
    createResource: "Create resource",
  };
  const text = byLocale(locale, {
    de: {
      title: "Neue Ressource",
      description: "Wähle ein Profil und starte mit einer Ressourceninstanz.",
      search: "Suche",
      searchProfiles: "Profile suchen",
      noMatchingProfiles: "Keine passenden Profile.",
      profileFallback: "Profil",
      matchingProfiles: "Passende Profile",
      noProfilesAvailable: "Keine Profile verfügbar",
      resourceIdLabel: "FHIR-ID (optional)",
      resourceIdPlaceholder: "endpoint-001",
      resourceIdHint: "Verwende eine ID, wenn andere Ressourcen darauf referenzieren sollen.",
      cancel: "Abbrechen",
      createResource: "Ressource erstellen",
    },
    en: enText,
    fr: {
      ...enText,
      title: "Nouvelle ressource",
      description: "Choisissez un profil et commencez une instance de ressource.",
      search: "Rechercher",
      searchProfiles: "Rechercher des profils",
      noMatchingProfiles: "Aucun profil correspondant.",
      matchingProfiles: "Profils correspondants",
      noProfilesAvailable: "Aucun profil disponible",
      resourceIdHint:
        "Utilisez un ID si la ressource doit etre referencee par d'autres.",
      cancel: "Annuler",
      createResource: "Creer la ressource",
    },
    es: {
      ...enText,
      title: "Nuevo recurso",
      description: "Elige un perfil y comienza una instancia de recurso.",
      search: "Buscar",
      searchProfiles: "Buscar perfiles",
      noMatchingProfiles: "No hay perfiles coincidentes.",
      matchingProfiles: "Perfiles coincidentes",
      noProfilesAvailable: "No hay perfiles disponibles",
      resourceIdHint: "Usa un ID si otros recursos deben referenciar este recurso.",
      cancel: "Cancelar",
      createResource: "Crear recurso",
    },
    it: {
      ...enText,
      title: "Nuova risorsa",
      description: "Scegli un profilo e inizia a comporre una risorsa.",
      search: "Cerca",
      searchProfiles: "Cerca profili",
      noMatchingProfiles: "Nessun profilo corrispondente.",
      matchingProfiles: "Profili corrispondenti",
      noProfilesAvailable: "Nessun profilo disponibile",
      resourceIdHint:
        "Usa un ID se la risorsa deve essere referenziata da altre risorse.",
      cancel: "Annulla",
      createResource: "Crea risorsa",
    },
  });

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
          <DialogTitle>{text.title}</DialogTitle>
          <DialogDescription>
            {text.description}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="profile-search">{text.search}</Label>
            <Input
              id="profile-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={text.searchProfiles}
            />
          </div>
          <div className="grid gap-2">
            <div className="max-h-56 overflow-auto">
              {filteredProfiles.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground">
                  {text.noMatchingProfiles}
                </div>
              ) : (
                <div className="grid gap-2">
                  {filteredProfiles.map((profile) => {
                    const name = profile.name ?? profile.title ?? profile.url ?? text.profileFallback;
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
            <Label htmlFor="profile-select">{text.matchingProfiles}</Label>
            <select
              id="profile-select"
              value={selectedProfile}
              onChange={(event) => setSelectedProfile(event.target.value)}
              className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
            >
              {filteredProfiles.length === 0 ? (
                <option value="">{text.noProfilesAvailable}</option>
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
            <Label htmlFor="resource-id">{text.resourceIdLabel}</Label>
            <Input
              id="resource-id"
              value={resourceId}
              onChange={(event) => setResourceId(event.target.value)}
              placeholder={text.resourceIdPlaceholder}
            />
            <p className="text-xs text-muted-foreground">
              {text.resourceIdHint}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {text.cancel}
          </Button>
          <Button onClick={handleCreate} disabled={!selectedProfile}>
            {text.createResource}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
