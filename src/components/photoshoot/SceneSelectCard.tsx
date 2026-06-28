"use client";

import { Check, Layers, Lightbulb, MapPin, Sparkles, Sun, TrendingUp } from "lucide-react";
import type { Scene } from "@/types";
import {
  getSceneDetails,
  getSceneCategoryColor,
  getSceneComplexityLabel,
} from "@/lib/data/scene-details";
import { SCENE_CATEGORY_LABELS } from "@/lib/data/scenes";
import { ScenePreviewMockup } from "@/components/photoshoot/ScenePreviewMockup";
import { cn } from "@/lib/utils";

interface SceneSelectCardProps {
  scene: Scene;
  selected: boolean;
  onClick: () => void;
}

export function SceneSelectCard({ scene, selected, onClick }: SceneSelectCardProps) {
  const details = getSceneDetails(scene.id);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "glass-tile group relative flex w-full flex-col overflow-hidden p-0 text-left transition-all",
        selected && "glass-tile-selected ring-2 ring-accent ring-offset-2",
        !selected && "hover:!translate-y-[-3px]"
      )}
    >
      <div className="flex items-center justify-center border-b border-border/30 bg-gradient-to-b from-white/40 to-white/10 px-4 py-4">
        <ScenePreviewMockup
          sceneId={scene.id}
          sceneCategory={scene.sceneCategory}
          mood={scene.mood}
          className="transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span
                className="inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                style={{ backgroundColor: getSceneCategoryColor(scene.sceneCategory) }}
              >
                {SCENE_CATEGORY_LABELS[scene.sceneCategory] ?? scene.sceneCategory} ·{" "}
                {getSceneComplexityLabel(scene.complexity)}
              </span>
              {scene.trending && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-[var(--success-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--success)]">
                  <TrendingUp className="h-3 w-3" />
                  Trending
                </span>
              )}
            </div>
            <p className="text-sm font-semibold leading-tight text-foreground">{scene.sceneName}</p>
          </div>
          {selected && (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-[#5856d6] shadow-md">
              <Check className="h-3.5 w-3.5 text-white" />
            </div>
          )}
        </div>

        <p className="line-clamp-2 text-xs leading-relaxed text-muted">{details.description}</p>

        <div className="rounded-xl border border-border/30 bg-white/20 px-3 py-2.5">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
            <Sparkles className="h-3 w-3" />
            What we&apos;ll do
          </p>
          <ol className="max-h-36 space-y-1 overflow-y-auto">
            {details.whatWeDo.map((step, i) => (
              <li key={`${i}-${step.slice(0, 24)}`} className="flex items-start gap-2 text-[10px] leading-relaxed text-muted">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[9px] font-bold text-accent">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <DetailChip icon={Sun} label={scene.lighting} />
          <DetailChip icon={Lightbulb} label={scene.mood} />
          <DetailChip icon={Layers} label={scene.props === "none" ? "No props" : scene.props} />
          <DetailChip icon={MapPin} label={details.bestFor.split("&")[0].trim()} />
        </div>

        <ul className="space-y-1 border-t border-border/30 pt-2">
          {details.highlights.slice(0, 2).map((h) => (
            <li key={h} className="flex items-start gap-1.5 text-[10px] text-muted">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent" />
              {h}
            </li>
          ))}
        </ul>

        <p className="mt-auto text-[10px] font-medium text-muted-light">
          Scene: {details.environmentSetup}
        </p>
      </div>
    </button>
  );
}

function DetailChip({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="glass-chip flex items-center gap-1 truncate rounded-lg px-2 py-1 capitalize">
      <Icon className="h-3 w-3 shrink-0 text-accent" />
      <span className="truncate">{label}</span>
    </span>
  );
}
