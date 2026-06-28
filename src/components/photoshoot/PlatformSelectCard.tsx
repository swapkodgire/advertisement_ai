"use client";

import { Check, Layout, Maximize2, Palette, Target } from "lucide-react";
import type { PlatformPostType } from "@/types";
import { getPlatformDetails, getPlatformBrandColor } from "@/lib/data/platform-details";
import { PlatformPreviewMockup } from "@/components/photoshoot/PlatformPreviewMockup";
import { cn } from "@/lib/utils";

interface PlatformSelectCardProps {
  platform: PlatformPostType;
  selected: boolean;
  onClick: () => void;
}

export function PlatformSelectCard({ platform, selected, onClick }: PlatformSelectCardProps) {
  const details = getPlatformDetails(platform.id);

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
      {/* Preview mockup */}
      <div className="flex items-center justify-center border-b border-border/30 bg-gradient-to-b from-white/40 to-white/10 px-4 py-4">
        <PlatformPreviewMockup
          platformId={platform.id}
          platformGroup={platform.platformGroup}
          aspectRatio={platform.aspectRatio}
          className="transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span
              className="mb-1.5 inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
              style={{ backgroundColor: getPlatformBrandColor(platform.platformGroup) }}
            >
              {platform.platformGroup}
            </span>
            <p className="text-sm font-semibold leading-tight text-foreground">{platform.platformName}</p>
          </div>
          {selected && (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-[#5856d6] shadow-md">
              <Check className="h-3.5 w-3.5 text-white" />
            </div>
          )}
        </div>

        <p className="line-clamp-2 text-xs leading-relaxed text-muted">{details.description}</p>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <DetailChip icon={Maximize2} label={platform.resolution} />
          <DetailChip icon={Layout} label={platform.aspectRatio} />
          <DetailChip icon={Target} label={details.safeArea.split("—")[0].trim()} />
          <DetailChip icon={Palette} label={details.backgroundStyle} />
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
          Output: {details.outputPurpose}
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
