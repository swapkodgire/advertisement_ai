"use client";

import type { PlatformPostTypeId } from "@/types";
import {
  getPlatformBrandColor,
  getPreviewLayout,
  type PreviewLayout,
} from "@/lib/data/platform-details";

/** Fixed sample product — stylized eyewear used across all platform previews */
function SampleEyewear({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  const s = scale;
  return (
    <g transform={`translate(${x}, ${y}) scale(${s})`} opacity={0.95}>
      {/* Left lens */}
      <ellipse cx={-22} cy={0} rx={18} ry={14} fill="none" stroke="#2c2c2e" strokeWidth={2.5} />
      <ellipse cx={-22} cy={0} rx={14} ry={10} fill="url(#lensGrad)" opacity={0.35} />
      {/* Bridge */}
      <path d="M -4 0 Q 0 -4 4 0" fill="none" stroke="#2c2c2e" strokeWidth={2.5} />
      {/* Right lens */}
      <ellipse cx={22} cy={0} rx={18} ry={14} fill="none" stroke="#2c2c2e" strokeWidth={2.5} />
      <ellipse cx={22} cy={0} rx={14} ry={10} fill="url(#lensGrad)" opacity={0.35} />
      {/* Temples */}
      <line x1={-40} y1={0} x2={-52} y2={-2} stroke="#2c2c2e" strokeWidth={2} />
      <line x1={40} y1={0} x2={52} y2={-2} stroke="#2c2c2e" strokeWidth={2} />
      {/* Gold accent */}
      <line x1={-40} y1={-1} x2={-48} y2={-2} stroke="#C9A227" strokeWidth={1} />
      <line x1={40} y1={-1} x2={48} y2={-2} stroke="#C9A227" strokeWidth={1} />
    </g>
  );
}

function SceneBackground({ layout }: { layout: PreviewLayout }) {
  if (layout === "white_studio") {
    return <rect width="100%" height="100%" fill="#ffffff" />;
  }
  if (layout === "wide_banner") {
    return (
      <>
        <defs>
          <linearGradient id="bannerBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e8ecf4" />
            <stop offset="100%" stopColor="#d4dce8" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bannerBg)" />
      </>
    );
  }
  return (
    <>
      <defs>
        <linearGradient id="sceneBg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f5f0eb" />
          <stop offset="100%" stopColor="#e8e0d8" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#sceneBg)" />
      {/* Marble hint */}
      <ellipse cx="50%" cy="75%" rx="35%" ry="8%" fill="rgba(200,190,175,0.4)" />
    </>
  );
}

function PlatformChrome({
  platformId,
  brandColor,
  w,
  h,
}: {
  platformId: PlatformPostTypeId;
  brandColor: string;
  w: number;
  h: number;
}) {
  if (platformId.includes("instagram") || platformId.includes("facebook")) {
    const isStory = platformId.includes("story") || platformId.includes("reel");
    if (isStory) {
      return (
        <>
          <rect x={0} y={0} width={w} height={h * 0.06} fill="rgba(0,0,0,0.06)" />
          <rect x={w * 0.08} y={h * 0.025} width={w * 0.84} height={3} rx={1.5} fill="rgba(0,0,0,0.12)" />
          <rect x={0} y={h * 0.92} width={w} height={h * 0.08} fill="rgba(0,0,0,0.04)" />
        </>
      );
    }
    return (
      <>
        <circle cx={w * 0.12} cy={h * 0.08} r={w * 0.05} fill={brandColor} opacity={0.8} />
        <rect x={w * 0.2} y={h * 0.06} width={w * 0.25} height={4} rx={2} fill="rgba(0,0,0,0.15)" />
        <rect x={0} y={h * 0.88} width={w} height={h * 0.12} fill="rgba(0,0,0,0.03)" />
      </>
    );
  }
  if (platformId === "youtube_thumbnail") {
    return (
      <>
        <rect x={w * 0.72} y={h * 0.08} width={w * 0.22} height={h * 0.18} rx={4} fill="rgba(0,0,0,0.75)" />
        <text x={w * 0.83} y={h * 0.19} textAnchor="middle" fill="white" fontSize={8} fontWeight="bold">
          12:34
        </text>
      </>
    );
  }
  if (platformId === "amazon_listing") {
    return (
      <text x={w * 0.05} y={h * 0.95} fill="#565959" fontSize={7}>
        Amazon.com
      </text>
    );
  }
  if (platformId === "linkedin_banner") {
    return (
      <circle cx={w * 0.88} cy={h * 0.75} r={h * 0.35} fill="rgba(255,255,255,0.9)" stroke="#ddd" strokeWidth={1} />
    );
  }
  if (platformId === "pinterest_pin") {
    return (
      <rect x={w * 0.78} y={h * 0.03} width={w * 0.16} height={h * 0.05} rx={8} fill="#E60023" opacity={0.9} />
    );
  }
  return null;
}

function productPosition(layout: PreviewLayout, w: number, h: number) {
  switch (layout) {
    case "vertical_story":
      return { x: w / 2, y: h * 0.42, scale: Math.min(w, h) / 180 };
    case "tall_pin":
      return { x: w / 2, y: h * 0.32, scale: Math.min(w, h) / 200 };
    case "wide_banner":
      return { x: w * 0.38, y: h / 2, scale: Math.min(w, h) / 220 };
    case "landscape":
      return { x: w / 2, y: h / 2, scale: Math.min(w, h) / 160 };
    case "white_studio":
      return { x: w / 2, y: h / 2, scale: Math.min(w, h) / 150 };
    case "email_header":
      return { x: w * 0.35, y: h / 2, scale: Math.min(w, h) / 170 };
    default:
      return { x: w / 2, y: h / 2, scale: Math.min(w, h) / 160 };
  }
}

const ASPECT_MAP: Record<PreviewLayout, number> = {
  square_center: 1,
  vertical_story: 9 / 16,
  tall_pin: 2 / 3,
  wide_banner: 4 / 1,
  landscape: 16 / 9,
  white_studio: 1,
  email_header: 4 / 3,
};

interface PlatformPreviewMockupProps {
  platformId: PlatformPostTypeId;
  platformGroup: string;
  aspectRatio: string;
  className?: string;
}

export function PlatformPreviewMockup({
  platformId,
  platformGroup,
  aspectRatio,
  className,
}: PlatformPreviewMockupProps) {
  const layout = getPreviewLayout(platformId);
  const brandColor = getPlatformBrandColor(platformGroup);

  const [arW, arH] = aspectRatio.split(":").map(Number);
  const ratio = arW / arH;

  const maxW = 280;
  const maxH = 160;
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }

  const pos = productPosition(layout, w, h);

  return (
    <div className={className} style={{ width: w, height: h }}>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="overflow-hidden rounded-lg shadow-sm"
        aria-hidden
      >
        <defs>
          <linearGradient id="lensGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a8d4f5" />
            <stop offset="100%" stopColor="#6bb3e0" />
          </linearGradient>
          <clipPath id="frameClip">
            <rect width={w} height={h} rx={layout === "vertical_story" ? 8 : 4} />
          </clipPath>
        </defs>
        <g clipPath="url(#frameClip)">
          <SceneBackground layout={layout} />
          <SampleEyewear x={pos.x} y={pos.y} scale={pos.scale} />
          <PlatformChrome platformId={platformId} brandColor={brandColor} w={w} h={h} />
        </g>
        {/* Aspect ratio badge */}
        <rect x={w - 36} y={4} width={32} height={14} rx={3} fill="rgba(0,0,0,0.55)" />
        <text x={w - 20} y={14} textAnchor="middle" fill="white" fontSize={7} fontWeight="600">
          {aspectRatio}
        </text>
      </svg>
    </div>
  );
}

export { ASPECT_MAP };
