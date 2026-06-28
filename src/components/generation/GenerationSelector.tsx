"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import {
  GlassBar,
  PageHeader,
  PrimaryButton,
} from "@/components/layout/DashboardLayout";
import { PLATFORM_POST_TYPES, PLATFORM_GROUPS } from "@/lib/data/platform-post-types";
import { IMAGE_VIEWS, VIEW_CATEGORIES } from "@/lib/data/image-views";
import { SCENES, SCENE_CATEGORIES, SCENE_CATEGORY_LABELS, filterScenesByProductCategory } from "@/lib/data/scenes";
import { useActiveBrand } from "@/lib/store";
import type { ImageViewId, PlatformPostTypeId, SceneId } from "@/types";
import { cn } from "@/lib/utils";

const MAX_PLATFORM = 4;
const MAX_VIEWS = 4;
const MAX_SCENES = 4;

type Tab = "platforms" | "views" | "scenes";

interface GenerationSelectorProps {
  mode: "photoshoot" | "campaign";
  productId?: string;
}

export function GenerationSelector({ mode, productId }: GenerationSelectorProps) {
  const activeBrand = useActiveBrand();
  const product = activeBrand?.products.find((p) => p.id === productId);

  const [tab, setTab] = useState<Tab>("platforms");
  const [platformIds, setPlatformIds] = useState<PlatformPostTypeId[]>([]);
  const [viewIds, setViewIds] = useState<ImageViewId[]>([]);
  const [sceneIds, setSceneIds] = useState<SceneId[]>([]);
  const [platformGroup, setPlatformGroup] = useState<string>("all");
  const [viewCategory, setViewCategory] = useState<string>("all");
  const [sceneCategory, setSceneCategory] = useState<string>("all");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scenes = useMemo(() => {
    const base = product?.category
      ? filterScenesByProductCategory(product.category)
      : SCENES;
    if (sceneCategory === "all") return base;
    return base.filter((s) => s.sceneCategory === sceneCategory);
  }, [product?.category, sceneCategory]);

  const filteredPlatforms = useMemo(() => {
    if (platformGroup === "all") return PLATFORM_POST_TYPES;
    return PLATFORM_POST_TYPES.filter((p) => p.platformGroup === platformGroup);
  }, [platformGroup]);

  const filteredViews = useMemo(() => {
    if (viewCategory === "all") return IMAGE_VIEWS;
    return IMAGE_VIEWS.filter((v) => v.category === viewCategory);
  }, [viewCategory]);

  const toggle = <T extends string>(id: T, list: T[], max: number, setter: (v: T[]) => void) => {
    if (list.includes(id)) setter(list.filter((x) => x !== id));
    else if (list.length < max) setter([...list, id]);
  };

  const totalSelected = platformIds.length + viewIds.length + sceneIds.length;
  const canGenerate =
    platformIds.length > 0 &&
    (mode === "campaign" || (viewIds.length > 0 && sceneIds.length > 0));

  const handleGenerate = async () => {
    if (!activeBrand || !canGenerate) return;
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/generate/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: mode,
          brandName: activeBrand.name,
          productName: product?.name,
          productCategory: product?.category,
          productDescription: product?.description,
          platformPostTypeIds: platformIds,
          viewIds,
          sceneIds,
          businessDNA: activeBrand.businessDNA,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setResult(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const tabs: { id: Tab; label: string; count: number; max: number }[] = [
    { id: "platforms", label: "Platform Post Types", count: platformIds.length, max: MAX_PLATFORM },
    { id: "views", label: "Image Views", count: viewIds.length, max: MAX_VIEWS },
    { id: "scenes", label: "Scenes", count: sceneIds.length, max: MAX_SCENES },
  ];

  return (
    <div className="p-8 pb-28">
      <PageHeader
        title={mode === "photoshoot" ? "Photoshoot" : "Campaigns"}
        subtitle={
          product
            ? `${activeBrand?.name} · ${product.name} (${product.category})`
            : `${activeBrand?.name ?? "Brand"} — select platform formats, camera views, and scenes`
        }
      />

      <div className="mb-6 flex flex-wrap gap-1 rounded-xl bg-card p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm transition-colors",
              tab === t.id
                ? "bg-background font-medium text-foreground"
                : "text-muted hover:text-foreground"
            )}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-muted">
              ({t.count}/{t.max})
            </span>
          </button>
        ))}
      </div>

      {tab === "platforms" && (
        <section>
          <p className="mb-4 text-sm text-muted">
            Select up to {MAX_PLATFORM} output formats — aspect ratio and resolution per platform.
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <FilterPill active={platformGroup === "all"} onClick={() => setPlatformGroup("all")} label="All" />
            {PLATFORM_GROUPS.map((g) => (
              <FilterPill key={g} active={platformGroup === g} onClick={() => setPlatformGroup(g)} label={g} />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredPlatforms.map((p) => (
              <SelectCard
                key={p.id}
                selected={platformIds.includes(p.id)}
                onClick={() => toggle(p.id, platformIds, MAX_PLATFORM, setPlatformIds)}
                title={p.platformName}
                subtitle={`${p.aspectRatio} · ${p.resolution}`}
                badge={p.platformGroup}
              />
            ))}
          </div>
        </section>
      )}

      {tab === "views" && (
        <section>
          <p className="mb-4 text-sm text-muted">
            Select up to {MAX_VIEWS} camera angles / product views for the shoot.
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <FilterPill active={viewCategory === "all"} onClick={() => setViewCategory("all")} label="All" />
            {VIEW_CATEGORIES.map((c) => (
              <FilterPill key={c} active={viewCategory === c} onClick={() => setViewCategory(c)} label={c} />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredViews.map((v) => (
              <SelectCard
                key={v.id}
                selected={viewIds.includes(v.id)}
                onClick={() => toggle(v.id, viewIds, MAX_VIEWS, setViewIds)}
                title={v.viewName}
                subtitle={v.cameraAngle}
                badge={v.category}
              />
            ))}
          </div>
        </section>
      )}

      {tab === "scenes" && (
        <section>
          <p className="mb-4 text-sm text-muted">
            Select up to {MAX_SCENES} scenes — environment, lighting, and mood.
            {product?.category && (
              <span className="text-accent"> Filtered for &quot;{product.category}&quot;.</span>
            )}
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <FilterPill active={sceneCategory === "all"} onClick={() => setSceneCategory("all")} label="All" />
            {SCENE_CATEGORIES.map((c) => (
              <FilterPill key={c} active={sceneCategory === c} onClick={() => setSceneCategory(c)} label={SCENE_CATEGORY_LABELS[c]} />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {scenes.map((s) => (
              <SelectCard
                key={s.id}
                selected={sceneIds.includes(s.id)}
                onClick={() => toggle(s.id, sceneIds, MAX_SCENES, setSceneIds)}
                title={s.sceneName}
                subtitle={s.sceneDescription}
                badge={`${s.sceneCategory} · ${s.complexity}`}
                meta={`${s.lighting} · ${s.mood}`}
              />
            ))}
          </div>
        </section>
      )}

      <GlassBar className="flex items-center justify-between">
        <p className="text-xs text-muted">
          {totalSelected} selected
          {mode === "photoshoot" && " · needs platforms + views + scenes"}
        </p>
        <div className="flex items-center gap-3">
          {error && <p className="max-w-xs text-xs text-danger">{error}</p>}
          <PrimaryButton disabled={!canGenerate || generating} onClick={handleGenerate}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Looks Good"
            )}
          </PrimaryButton>
        </div>
      </GlassBar>

      {result && (
        <ResultModal title={`${mode === "photoshoot" ? "Photoshoot" : "Campaign"} Briefs`} content={result} onClose={() => setResult(null)} />
      )}
    </div>
  );
}

function FilterPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "glass-chip rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition-all",
        active ? "bg-accent text-white shadow-md shadow-accent/25" : "text-muted hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function SelectCard({
  selected,
  onClick,
  title,
  subtitle,
  badge,
  meta,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  badge?: string;
  meta?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "glass-tile relative p-4 text-left",
        selected && "glass-tile-selected",
        !selected && "hover:!translate-y-[-3px]"
      )}
    >
      {badge && (
        <span className="mb-2 inline-block rounded-full bg-background px-2 py-0.5 text-[10px] text-muted capitalize">
          {badge}
        </span>
      )}
      <p className="text-sm font-medium leading-tight">{title}</p>
      <p className="mt-1 line-clamp-2 text-xs text-muted">{subtitle}</p>
      {meta && <p className="mt-2 text-[10px] text-muted/80">{meta}</p>}
      {selected && (
        <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}
    </button>
  );
}

function ResultModal({ title, content, onClose }: { title: string; content: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-md">
      <div className="glass-dropdown flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl">
        <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted">{content}</pre>
        </div>
        <div className="border-t border-border px-6 py-4">
          <PrimaryButton onClick={onClose}>Done</PrimaryButton>
        </div>
      </div>
    </div>
  );
}
