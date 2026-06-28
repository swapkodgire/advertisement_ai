"use client";

import type { SceneId } from "@/types";
import {
  getScenePreviewVisual,
  getSceneCategoryColor,
  type ScenePreviewVisual,
} from "@/lib/data/scene-details";
import { cn } from "@/lib/utils";

function SampleProduct({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`} opacity={0.95}>
      <ellipse cx={-22} cy={0} rx={18} ry={14} fill="none" stroke="#2c2c2e" strokeWidth={2.5} />
      <ellipse cx={-22} cy={0} rx={14} ry={10} fill="url(#sceneLensGrad)" opacity={0.35} />
      <path d="M -4 0 Q 0 -4 4 0" fill="none" stroke="#2c2c2e" strokeWidth={2.5} />
      <ellipse cx={22} cy={0} rx={18} ry={14} fill="none" stroke="#2c2c2e" strokeWidth={2.5} />
      <ellipse cx={22} cy={0} rx={14} ry={10} fill="url(#sceneLensGrad)" opacity={0.35} />
      <line x1={-40} y1={0} x2={-52} y2={-2} stroke="#2c2c2e" strokeWidth={2} />
      <line x1={40} y1={0} x2={52} y2={-2} stroke="#2c2c2e" strokeWidth={2} />
    </g>
  );
}

function SceneEnvironment({ visual, w, h }: { visual: ScenePreviewVisual; w: number; h: number }) {
  switch (visual) {
    case "white_studio":
    case "ecommerce":
      return (
        <>
          <rect width={w} height={h} fill="#ffffff" />
          <ellipse cx={w * 0.5} cy={h * 0.82} rx={w * 0.18} ry={h * 0.03} fill="rgba(0,0,0,0.06)" />
        </>
      );
    case "marble":
      return (
        <>
          <defs>
            <linearGradient id="marbleBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f5f0eb" />
              <stop offset="50%" stopColor="#e8e0d8" />
              <stop offset="100%" stopColor="#d4c8bc" />
            </linearGradient>
          </defs>
          <rect width={w} height={h} fill="url(#marbleBg)" />
          <rect x={w * 0.2} y={h * 0.62} width={w * 0.6} height={h * 0.12} rx={4} fill="rgba(255,255,255,0.5)" />
          <path d={`M ${w * 0.15} ${h * 0.55} Q ${w * 0.5} ${h * 0.48} ${w * 0.85} ${h * 0.55}`} stroke="rgba(180,160,140,0.4)" fill="none" />
        </>
      );
    case "black_studio":
    case "runway":
      return (
        <>
          <rect width={w} height={h} fill="#1a1a1c" />
          <ellipse cx={w * 0.5} cy={h * 0.15} rx={w * 0.35} ry={h * 0.08} fill="rgba(255,255,255,0.08)" />
          <rect x={0} y={h * 0.7} width={w} height={h * 0.3} fill="#0d0d0f" />
        </>
      );
    case "glass_reflect":
    case "gloss_black":
      return (
        <>
          <defs>
            <linearGradient id="glassBg" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#d8dce0" />
              <stop offset="60%" stopColor="#b0b8c0" />
              <stop offset="60%" stopColor="#8090a0" />
              <stop offset="100%" stopColor="#607080" />
            </linearGradient>
          </defs>
          <rect width={w} height={h} fill={visual === "gloss_black" ? "#0a0a0c" : "url(#glassBg)"} />
          <line x1={0} y1={h * 0.62} x2={w} y2={h * 0.62} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
        </>
      );
    case "fashion_dramatic":
      return (
        <>
          <rect width={w} height={h} fill="#e8e4e0" />
          <polygon points={`0,0 ${w * 0.4},0 0,${h * 0.5}`} fill="rgba(0,0,0,0.12)" />
          <rect x={w * 0.65} y={0} width={w * 0.35} height={h} fill="rgba(0,0,0,0.06)" />
        </>
      );
    case "beach":
      return (
        <>
          <defs>
            <linearGradient id="beachSky" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#87CEEB" />
              <stop offset="45%" stopColor="#B0E0F6" />
              <stop offset="45%" stopColor="#F4E4BC" />
              <stop offset="100%" stopColor="#E8D4A8" />
            </linearGradient>
          </defs>
          <rect width={w} height={h} fill="url(#beachSky)" />
          <ellipse cx={w * 0.2} cy={h * 0.25} rx={w * 0.15} ry={h * 0.12} fill="rgba(34,120,60,0.35)" transform={`rotate(-20 ${w * 0.2} ${h * 0.25})`} />
        </>
      );
    case "desert":
      return (
        <>
          <defs>
            <linearGradient id="desertBg" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFB347" />
              <stop offset="40%" stopColor="#E8A860" />
              <stop offset="100%" stopColor="#C4956A" />
            </linearGradient>
          </defs>
          <rect width={w} height={h} fill="url(#desertBg)" />
          <path d={`M 0 ${h * 0.55} Q ${w * 0.5} ${h * 0.42} ${w} ${h * 0.58} L ${w} ${h} L 0 ${h} Z`} fill="rgba(180,130,80,0.5)" />
        </>
      );
    case "urban":
      return (
        <>
          <rect width={w} height={h} fill="#b0b0b5" />
          <rect x={w * 0.1} y={h * 0.55} width={w * 0.35} height={h * 0.25} fill="#909095" />
          <rect x={w * 0.55} y={h * 0.48} width={w * 0.3} height={h * 0.32} fill="#808085" />
        </>
      );
    case "wood":
    case "scandinavian":
      return (
        <>
          <rect width={w} height={h} fill={visual === "scandinavian" ? "#f5f5f0" : "#faf6f0"} />
          <rect x={0} y={h * 0.55} width={w} height={h * 0.45} fill="#c4a882" opacity={0.5} />
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={i} x1={0} y1={h * 0.55 + i * 6} x2={w} y2={h * 0.55 + i * 6} stroke="rgba(100,70,40,0.15)" />
          ))}
        </>
      );
    case "leather":
    case "hotel":
      return (
        <>
          <rect width={w} height={h} fill={visual === "hotel" ? "#f0ebe4" : "#e8e0d8"} />
          <rect x={0} y={h * 0.58} width={w} height={h * 0.42} fill="#6B4423" opacity={0.7} />
          {visual === "hotel" && (
            <rect x={w * 0.7} y={h * 0.15} width={w * 0.2} height={h * 0.35} rx={2} fill="rgba(200,180,150,0.4)" />
          )}
        </>
      );
    case "neon":
      return (
        <>
          <rect width={w} height={h} fill="#0a0a14" />
          <rect x={0} y={h * 0.3} width={w} height={4} fill="#9B59B6" opacity={0.7} />
          <rect x={0} y={h * 0.65} width={w} height={4} fill="#00CED1" opacity={0.7} />
          <ellipse cx={w * 0.5} cy={h * 0.5} rx={w * 0.4} ry={h * 0.3} fill="rgba(155,89,182,0.08)" />
        </>
      );
    case "floating":
    case "lens_float":
      return (
        <>
          <defs>
            <linearGradient id="floatBg" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#eef0f4" />
              <stop offset="100%" stopColor="#d8dce4" />
            </linearGradient>
          </defs>
          <rect width={w} height={h} fill="url(#floatBg)" />
        </>
      );
    case "crystal":
      return (
        <>
          <rect width={w} height={h} fill="#e8ecf0" />
          <polygon points={`${w * 0.15},${h * 0.7} ${w * 0.25},${h * 0.3} ${w * 0.35},${h * 0.7}`} fill="rgba(180,200,220,0.5)" />
          <polygon points={`${w * 0.65},${h * 0.75} ${w * 0.75},${h * 0.35} ${w * 0.85},${h * 0.75}`} fill="rgba(180,200,220,0.4)" />
        </>
      );
    case "stone":
      return (
        <>
          <rect width={w} height={h} fill="#e8e8ec" />
          <rect x={w * 0.25} y={h * 0.58} width={w * 0.5} height={h * 0.15} rx={3} fill="#a0a0a8" />
        </>
      );
    case "workspace":
      return (
        <>
          <rect width={w} height={h} fill="#f0f0f5" />
          <rect x={0} y={h * 0.6} width={w} height={h * 0.4} fill="#e0e0e8" />
          <rect x={w * 0.75} y={h * 0.1} width={w * 0.15} height={h * 0.45} fill="rgba(200,220,240,0.5)" />
        </>
      );
    case "lab":
    case "optical_bench":
      return (
        <>
          <rect width={w} height={h} fill="#f5f8fc" />
          <rect x={w * 0.1} y={h * 0.55} width={w * 0.8} height={h * 0.08} fill="#d0d8e8" />
          <circle cx={w * 0.25} cy={h * 0.59} r={4} fill="#007AFF" opacity={0.4} />
          <circle cx={w * 0.75} cy={h * 0.59} r={4} fill="#007AFF" opacity={0.4} />
        </>
      );
    case "retail_display":
      return (
        <>
          <rect width={w} height={h} fill="#f5f5f7" />
          <path d={`M ${w * 0.35} ${h * 0.75} L ${w * 0.4} ${h * 0.5} L ${w * 0.6} ${h * 0.5} L ${w * 0.65} ${h * 0.75} Z`} fill="#d0d0d5" />
        </>
      );
    case "travel":
      return (
        <>
          <rect width={w} height={h} fill="#e8dcc8" />
          <rect x={w * 0.6} y={h * 0.2} width={w * 0.25} height={h * 0.35} rx={3} fill="rgba(120,80,40,0.3)" transform={`rotate(8 ${w * 0.72} ${h * 0.37})`} />
        </>
      );
    case "sand":
      return (
        <>
          <rect width={w} height={h} fill="#F4E4BC" />
          {Array.from({ length: 12 }).map((_, i) => (
            <circle key={i} cx={(i * 23) % w} cy={h * 0.6 + (i % 3) * 8} r={1.5} fill="rgba(180,150,100,0.4)" />
          ))}
        </>
      );
    case "gradient":
      return (
        <>
          <defs>
            <linearGradient id="gradBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e8ecf4" />
              <stop offset="100%" stopColor="#d0d8e8" />
            </linearGradient>
          </defs>
          <rect width={w} height={h} fill="url(#gradBg)" />
        </>
      );
    case "macro_jewelry":
      return (
        <>
          <rect width={w} height={h} fill="#f8f8fa" />
          <circle cx={w * 0.5} cy={h * 0.5} r={w * 0.35} fill="none" stroke="rgba(0,122,255,0.15)" strokeWidth={1} strokeDasharray="4 3" />
        </>
      );
    case "tech":
      return (
        <>
          <rect width={w} height={h} fill="#0a1420" />
          <line x1={0} y1={h * 0.4} x2={w} y2={h * 0.4} stroke="#007AFF" opacity={0.2} />
          <line x1={0} y1={h * 0.6} x2={w} y2={h * 0.6} stroke="#007AFF" opacity={0.15} />
          <circle cx={w * 0.8} cy={h * 0.2} r={20} fill="rgba(0,122,255,0.08)" />
        </>
      );
    case "warm_neutral":
      return (
        <>
          <defs>
            <linearGradient id="warmNeutral" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f7f5f0" />
              <stop offset="100%" stopColor="#ede8df" />
            </linearGradient>
          </defs>
          <rect width={w} height={h} fill="url(#warmNeutral)" />
          <ellipse cx={w * 0.5} cy={h * 0.82} rx={w * 0.16} ry={h * 0.025} fill="rgba(0,0,0,0.05)" />
        </>
      );
    case "linen":
      return (
        <>
          <rect width={w} height={h} fill="#f4f0ea" />
          {Array.from({ length: 6 }).map((_, i) => (
            <line key={i} x1={0} y1={h * 0.35 + i * 8} x2={w} y2={h * 0.35 + i * 8 + 2} stroke="rgba(180,160,140,0.2)" />
          ))}
          <rect x={0} y={h * 0.55} width={w} height={h * 0.45} fill="#e8dfd4" opacity={0.6} />
        </>
      );
    case "cafe":
      return (
        <>
          <rect width={w} height={h} fill="#e8e4dc" />
          <rect x={0} y={h * 0.58} width={w} height={h * 0.42} fill="#d4cfc4" />
          <circle cx={w * 0.72} cy={h * 0.48} r={w * 0.06} fill="rgba(120,80,50,0.25)" />
          <rect x={w * 0.15} y={h * 0.2} width={w * 0.25} height={h * 0.35} fill="rgba(200,190,170,0.35)" />
        </>
      );
    case "botanical":
      return (
        <>
          <rect width={w} height={h} fill="#eef2e8" />
          <ellipse cx={w * 0.25} cy={h * 0.3} rx={w * 0.12} ry={h * 0.1} fill="rgba(60,120,60,0.35)" />
          <ellipse cx={w * 0.75} cy={h * 0.25} rx={w * 0.1} ry={h * 0.08} fill="rgba(80,130,70,0.3)" />
          <rect x={0} y={h * 0.6} width={w} height={h * 0.4} fill="#d8e0cc" opacity={0.5} />
        </>
      );
    case "snow":
      return (
        <>
          <defs>
            <linearGradient id="snowBg" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#eef4f8" />
              <stop offset="100%" stopColor="#dce8f0" />
            </linearGradient>
          </defs>
          <rect width={w} height={h} fill="url(#snowBg)" />
          {Array.from({ length: 8 }).map((_, i) => (
            <circle key={i} cx={(i * 37) % w} cy={(i * 19) % (h * 0.5)} r={1.5} fill="rgba(255,255,255,0.9)" />
          ))}
        </>
      );
    case "dopamine":
      return (
        <>
          <rect width={w} height={h} fill="#fff0f5" />
          <rect x={0} y={0} width={w * 0.35} height={h} fill="#FFE066" opacity={0.35} />
          <rect x={w * 0.65} y={0} width={w * 0.35} height={h} fill="#FF6B9D" opacity={0.25} />
          <circle cx={w * 0.5} cy={h * 0.35} r={w * 0.12} fill="#00CED1" opacity={0.2} />
        </>
      );
    case "flash":
      return (
        <>
          <rect width={w} height={h} fill="#2a2a2e" />
          <polygon points={`0,0 ${w},0 ${w * 0.7},${h}`} fill="rgba(255,255,255,0.06)" />
          <ellipse cx={w * 0.5} cy={h * 0.15} rx={w * 0.4} ry={h * 0.1} fill="rgba(255,255,255,0.12)" />
        </>
      );
    case "rustic":
      return (
        <>
          <rect width={w} height={h} fill="#ebe4d8" />
          <rect x={0} y={h * 0.52} width={w} height={h * 0.48} fill="#b8956a" opacity={0.55} />
          {Array.from({ length: 10 }).map((_, i) => (
            <line key={i} x1={0} y1={h * 0.52 + i * 5} x2={w} y2={h * 0.52 + i * 5} stroke="rgba(80,50,20,0.12)" />
          ))}
        </>
      );
    default:
      return <rect width={w} height={h} fill="#f5f0eb" />;
  }
}

function productPosition(visual: ScenePreviewVisual, w: number, h: number) {
  if (visual === "floating" || visual === "lens_float") {
    return { x: w / 2, y: h * 0.42, scale: Math.min(w, h) / 200, showReflection: false, showShadow: true };
  }
  if (visual === "glass_reflect" || visual === "gloss_black") {
    return { x: w / 2, y: h * 0.38, scale: Math.min(w, h) / 210, showReflection: true, showShadow: false };
  }
  if (visual === "macro_jewelry") {
    return { x: w / 2, y: h * 0.48, scale: Math.min(w, h) / 170, showReflection: false, showShadow: false };
  }
  return { x: w / 2, y: h * 0.45, scale: Math.min(w, h) / 200, showReflection: false, showShadow: true };
}

function PipelineOverlay({ w, h }: { w: number; h: number }) {
  const y = h - 22;
  const steps = ["Isolate", "Scene", "Composite"];
  const xs = [w * 0.18, w * 0.5, w * 0.82];
  return (
    <g opacity={0.92}>
      <rect x={0} y={h - 28} width={w} height={28} fill="rgba(0,0,0,0.55)" />
      {steps.map((label, i) => (
        <g key={label}>
          <circle cx={xs[i]} cy={y - 6} r={7} fill="#007AFF" />
          <text x={xs[i]} y={y - 3} textAnchor="middle" fill="white" fontSize={7} fontWeight="700">
            {i + 1}
          </text>
          <text x={xs[i]} y={y + 8} textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize={6}>
            {label}
          </text>
          {i < 2 && (
            <line
              x1={xs[i] + 10}
              y1={y - 6}
              x2={xs[i + 1] - 10}
              y2={y - 6}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          )}
        </g>
      ))}
    </g>
  );
}

interface ScenePreviewMockupProps {
  sceneId: SceneId;
  sceneCategory: string;
  mood: string;
  className?: string;
}

export function ScenePreviewMockup({
  sceneId,
  sceneCategory,
  mood,
  className,
}: ScenePreviewMockupProps) {
  const visual = getScenePreviewVisual(sceneId);
  const categoryColor = getSceneCategoryColor(sceneCategory);

  const w = 280;
  const h = 160;
  const pos = productPosition(visual, w, h);

  return (
    <div className={cn(className)} style={{ width: w, height: h }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-hidden rounded-lg shadow-sm" aria-hidden>
        <defs>
          <linearGradient id="sceneLensGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a8d4f5" />
            <stop offset="100%" stopColor="#6bb3e0" />
          </linearGradient>
          <clipPath id={`sceneClip-${sceneId}`}>
            <rect width={w} height={h} rx={4} />
          </clipPath>
        </defs>
        <g clipPath={`url(#sceneClip-${sceneId})`}>
          <SceneEnvironment visual={visual} w={w} h={h} />
          {pos.showShadow && (
            <ellipse cx={pos.x} cy={h * 0.72} rx={w * 0.14} ry={h * 0.025} fill="rgba(0,0,0,0.12)" />
          )}
          <SampleProduct x={pos.x} y={pos.y} scale={pos.scale} />
          {pos.showReflection && (
            <g transform={`translate(${pos.x}, ${h * 0.72}) scale(1, -0.3)`} opacity={0.3}>
              <SampleProduct x={0} y={0} scale={pos.scale} />
            </g>
          )}
          <PipelineOverlay w={w} h={h} />
        </g>
        <circle cx={w - 58} cy={11} r={4} fill={categoryColor} />
        <rect x={w - 52} y={4} width={48} height={14} rx={3} fill="rgba(0,0,0,0.55)" />
        <text x={w - 28} y={14} textAnchor="middle" fill="white" fontSize={6.5} fontWeight="600">
          {mood.length > 12 ? mood.slice(0, 10) + "…" : mood}
        </text>
      </svg>
    </div>
  );
}
