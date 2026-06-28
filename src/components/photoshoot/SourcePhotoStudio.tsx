"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Crop,
  ImagePlus,
  Loader2,
  RotateCw,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Link as LinkIcon,
  Boxes,
} from "lucide-react";
import { PrimaryButton, SecondaryButton } from "@/components/layout/DashboardLayout";
import { cn } from "@/lib/utils";

export interface SourcePhoto {
  id: string;
  filename: string;
  label: string;
  url: string;
  isPrimary: boolean;
  width?: number;
  height?: number;
}

export interface CatalogProductOption {
  id: string;
  name: string;
  category?: string;
  thumbUrl: string;
}

interface SourcePhotoStudioProps {
  brandId: string;
  productId: string;
  sources: SourcePhoto[];
  primaryId: string | null;
  importUrl: string;
  loading: boolean;
  onSourcesChange: (
    sources: SourcePhoto[],
    primaryId: string | null,
    primaryUrl: string | null,
    resolvedProductId?: string
  ) => void;
  onImportUrlChange: (url: string) => void;
  onImportUrl: () => void;
  onEnsureProductId: () => string;
  onError: (msg: string | null) => void;
  catalogProducts?: CatalogProductOption[];
  currentProductId?: string;
  onSelectCatalogProduct?: (productId: string) => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.15;

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function renderEditedImage(
  url: string,
  opts: {
    zoom: number;
    rotation: number;
    crop: { x: number; y: number; w: number; h: number } | null;
  }
): Promise<Blob> {
  const img = await loadImage(url);
  const rot = ((opts.rotation % 360) + 360) % 360;
  const rad = (rot * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const boundW = img.width * cos + img.height * sin;
  const boundH = img.width * sin + img.height * cos;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  canvas.width = boundW;
  canvas.height = boundH;
  ctx.translate(boundW / 2, boundH / 2);
  ctx.rotate(rad);
  ctx.scale(opts.zoom, opts.zoom);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);

  if (opts.crop) {
    const { x, y, w, h } = opts.crop;
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = w;
    cropCanvas.height = h;
    const cropCtx = cropCanvas.getContext("2d")!;
    cropCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
    return new Promise((resolve, reject) => {
      cropCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), "image/png");
    });
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), "image/png");
  });
}

export function SourcePhotoStudio({
  brandId,
  productId,
  sources,
  primaryId,
  importUrl,
  loading,
  onSourcesChange,
  onImportUrlChange,
  onImportUrl,
  onEnsureProductId,
  onError,
  catalogProducts = [],
  currentProductId,
  onSelectCatalogProduct,
}: SourcePhotoStudioProps) {
  const [activeId, setActiveId] = useState<string | null>(primaryId ?? sources[0]?.id ?? null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [cropMode, setCropMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasCatalog = catalogProducts.length > 0 && Boolean(onSelectCatalogProduct);

  const active = sources.find((s) => s.id === activeId) ?? sources[0] ?? null;

  useEffect(() => {
    if (primaryId) setActiveId(primaryId);
  }, [primaryId]);

  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setCropMode(false);
    setNaturalSize(null);
  }, [active?.url]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    onError(null);
    const pid = productId || onEnsureProductId();
    const form = new FormData();
    form.append("brandId", brandId);
    form.append("productId", pid);
    list.forEach((f) => form.append("file", f));

    const res = await fetch("/api/photoshoot/upload", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    onSourcesChange(data.sources, data.primaryId, data.url, data.productId ?? pid);
    setActiveId(data.primaryId ?? data.sources[data.sources.length - 1]?.id);
  };

  const setPrimary = async (sourceId: string) => {
    onError(null);
    const pid = productId || onEnsureProductId();
    const res = await fetch("/api/photoshoot/upload", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, productId: pid, primaryId: sourceId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    onSourcesChange(data.sources, data.primaryId, data.url, pid);
    setActiveId(sourceId);
  };

  const deleteSource = async (sourceId: string) => {
    if (sources.length <= 1) {
      onError("Keep at least one source photo");
      return;
    }
    onError(null);
    const pid = productId || onEnsureProductId();
    const res = await fetch(
      `/api/photoshoot/upload?brandId=${brandId}&productId=${pid}&sourceId=${sourceId}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    onSourcesChange(data.sources, data.primaryId, data.url, pid);
    setActiveId(data.primaryId);
  };

  const applyEdits = async () => {
    if (!active) return;
    setSaving(true);
    onError(null);
    try {
      const blob = await renderEditedImage(active.url, {
        zoom,
        rotation,
        crop: null,
      });
      const pid = productId || onEnsureProductId();
      const form = new FormData();
      form.append("brandId", brandId);
      form.append("productId", pid);
      form.append("sourceId", active.id);
      form.append("file", blob, "edited.png");

      const res = await fetch("/api/photoshoot/save-edited", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onSourcesChange(data.sources, primaryId, data.primaryUrl ?? data.url, pid);
      setZoom(1);
      setRotation(0);
      setCropMode(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetView = () => {
    setZoom(1);
    setRotation(0);
    setCropMode(false);
  };

  const aspectRatio =
    naturalSize && naturalSize.w > 0 ? naturalSize.w / naturalSize.h : active?.width && active?.height ? active.width / active.height : 4 / 3;

  const viewerMaxH = 420;

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Source Photos</h2>
        <p className="mt-1 text-sm text-muted">
          Upload one or more product angles. Fix orientation, zoom, and crop before continuing.
          The <span className="font-semibold text-accent">primary</span> photo drives generation.
        </p>
      </div>

      <div className={cn("grid gap-4 sm:grid-cols-2", hasCatalog && "lg:grid-cols-3")}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="glass-tile flex flex-col items-center p-8 transition-transform hover:!translate-y-[-3px] disabled:opacity-50"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = e.target.files;
              if (!files?.length) return;
              try {
                await uploadFiles(files);
              } catch (err) {
                onError(err instanceof Error ? err.message : "Upload failed");
              }
              e.target.value = "";
            }}
          />
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-[#5856d6]/20">
            <Upload className="h-7 w-7 text-accent" />
          </div>
          <p className="font-medium">Upload photos</p>
          <p className="mt-1 text-xs text-muted">Select multiple · JPG, PNG, WebP</p>
        </button>

        <div className="glass-card p-6">
          <div className="mb-3 flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-accent" />
            <p className="font-medium">Import from URL</p>
          </div>
          <input
            type="url"
            value={importUrl}
            onChange={(e) => onImportUrlChange(e.target.value)}
            placeholder="https://yourstore.com/product.jpg"
            className="glass-input mb-3 w-full rounded-xl px-4 py-3 text-sm"
          />
          <SecondaryButton
            onClick={onImportUrl}
            disabled={loading || !importUrl.trim()}
            className="w-full justify-center"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Import image"}
          </SecondaryButton>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Paste a product page or a direct image link (.jpg/.png/.webp). If a store blocks us,
            copy the image address directly.
          </p>
        </div>

        {hasCatalog && (
          <button
            type="button"
            onClick={() => setShowCatalog((v) => !v)}
            disabled={loading}
            className={cn(
              "glass-tile flex flex-col items-center p-8 transition-transform hover:!translate-y-[-3px] disabled:opacity-50",
              showCatalog && "ring-2 ring-accent"
            )}
          >
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-[#5856d6]/20">
              <Boxes className="h-7 w-7 text-accent" />
            </div>
            <p className="font-medium">Select from catalog</p>
            <p className="mt-1 text-xs text-muted">
              {catalogProducts.length} saved product{catalogProducts.length !== 1 ? "s" : ""}
            </p>
          </button>
        )}
      </div>

      {hasCatalog && showCatalog && (
        <div className="glass-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Boxes className="h-4 w-4 text-accent" />
            <p className="text-sm font-semibold">Choose a saved product</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {catalogProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelectCatalogProduct?.(p.id);
                  setShowCatalog(false);
                }}
                className={cn(
                  "group relative overflow-hidden rounded-xl border-2 text-left transition-all",
                  currentProductId === p.id
                    ? "border-accent ring-2 ring-accent/30"
                    : "border-transparent hover:border-border"
                )}
              >
                <div className="aspect-square w-full bg-[#f2f2f7]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumbUrl} alt={p.name} className="h-full w-full object-contain p-1" />
                  {currentProductId === p.id && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-accent p-1 text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <div className="px-2 py-1.5">
                  <p className="truncate text-xs font-medium">{p.name}</p>
                  {p.category && (
                    <p className="truncate text-[10px] text-muted">{p.category}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {active && (
        <div className="glass-card overflow-hidden !p-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-4 py-3">
            <div className="flex items-center gap-1">
              <span className="mr-2 text-xs font-semibold text-muted">Edit</span>
              <ToolBtn
                icon={ZoomOut}
                label="Zoom out"
                onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
                disabled={zoom <= MIN_ZOOM}
              />
              <span className="min-w-[3rem] text-center text-xs tabular-nums text-muted">
                {Math.round(zoom * 100)}%
              </span>
              <ToolBtn
                icon={ZoomIn}
                label="Zoom in"
                onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
                disabled={zoom >= MAX_ZOOM}
              />
              <ToolBtn icon={RotateCw} label="Rotate 90°" onClick={() => setRotation((r) => r + 90)} />
              <ToolBtn
                icon={Crop}
                label="Crop mode"
                active={cropMode}
                onClick={() => setCropMode((c) => !c)}
              />
              <ToolBtn icon={Maximize2} label="Reset view" onClick={resetView} />
            </div>
            <PrimaryButton
              onClick={applyEdits}
              disabled={saving || (zoom === 1 && rotation === 0 && !cropMode)}
              className="!py-1.5 !text-xs"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply edits"}
            </PrimaryButton>
          </div>

          {/* Viewer — natural aspect ratio fixes odd orientation display */}
          <div
            className="relative mx-auto flex w-full items-center justify-center overflow-hidden bg-[length:16px_16px] bg-[position:0_0,8px_8px]"
            style={{
              maxHeight: viewerMaxH,
              aspectRatio: `${aspectRatio}`,
              backgroundImage:
                "linear-gradient(45deg, #e8e8ed 25%, transparent 25%), linear-gradient(-45deg, #e8e8ed 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e8e8ed 75%), linear-gradient(-45deg, transparent 75%, #e8e8ed 75%)",
              backgroundColor: "#f2f2f7",
            }}
          >
            <div className="flex h-full w-full items-center justify-center overflow-hidden p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={active.url}
                src={active.url}
                alt={active.label}
                onLoad={handleImageLoad}
                className="max-h-full max-w-full object-contain transition-transform duration-200 ease-out"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                }}
                draggable={false}
              />
            </div>
            {cropMode && (
              <div className="pointer-events-none absolute inset-4 rounded-lg border-2 border-dashed border-accent/70 bg-accent/5" />
            )}
          </div>

          {naturalSize && (
            <p className="border-t border-border/40 px-4 py-2 text-center text-[11px] text-muted">
              {naturalSize.w} × {naturalSize.h}px
              {rotation % 360 !== 0 && ` · rotated ${rotation % 360}°`}
              {active.isPrimary && " · Primary source for generation"}
            </p>
          )}
        </div>
      )}

      {/* Multi-source thumbnails */}
      {sources.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">
              {sources.length} source photo{sources.length !== 1 ? "s" : ""}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
            >
              <ImagePlus className="h-3.5 w-3.5" /> Add more
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {sources.map((src) => (
              <div
                key={src.id}
                className={cn(
                  "glass-tile relative shrink-0 !rounded-xl !p-0 transition-all",
                  activeId === src.id && "ring-2 ring-accent ring-offset-2",
                  src.isPrimary && "border-accent/40"
                )}
              >
                <button
                  type="button"
                  onClick={() => setActiveId(src.id)}
                  className="block overflow-hidden rounded-xl"
                >
                  <div className="relative h-24 w-24 bg-[#f2f2f7]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src.url}
                      alt={src.label}
                      className="h-full w-full object-contain p-1"
                    />
                    {src.isPrimary && (
                      <span className="absolute left-1 top-1 rounded-md bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                        Primary
                      </span>
                    )}
                  </div>
                </button>
                <div className="flex border-t border-border/30">
                  {!src.isPrimary && (
                    <button
                      type="button"
                      title="Set as primary"
                      onClick={() => setPrimary(src.id).catch((e) => onError(e.message))}
                      className="flex flex-1 items-center justify-center py-1.5 text-[10px] font-medium text-accent hover:bg-accent-muted/50"
                    >
                      <Check className="mr-0.5 h-3 w-3" /> Primary
                    </button>
                  )}
                  <button
                    type="button"
                    title="Remove"
                    onClick={() => deleteSource(src.id).catch((e) => onError(e.message))}
                    className="flex flex-1 items-center justify-center py-1.5 text-[10px] text-muted hover:bg-danger-bg hover:text-danger"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ToolBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
        active ? "bg-accent text-white" : "text-muted hover:bg-white/60 hover:text-foreground",
        disabled && "opacity-40"
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
