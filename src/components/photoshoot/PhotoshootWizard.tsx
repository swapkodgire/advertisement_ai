"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  GlassBar,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/layout/DashboardLayout";
import { PlatformSelectCard } from "@/components/photoshoot/PlatformSelectCard";
import { ProductTypeSelector } from "@/components/photoshoot/ProductTypeSelector";
import { SourcePhotoStudio, type SourcePhoto } from "@/components/photoshoot/SourcePhotoStudio";
import { PLATFORM_POST_TYPES, PLATFORM_GROUPS } from "@/lib/data/platform-post-types";
import { IMAGE_VIEWS } from "@/lib/data/image-views";
import {
  getCategoryDef,
  getCategoryForType,
  getDefaultViewForType,
  getRecommendedViewsForType,
} from "@/lib/data/product-taxonomy";
import { SceneSelectCard } from "@/components/photoshoot/SceneSelectCard";
import { PhotoshootGenerateStep } from "@/components/photoshoot/PhotoshootGenerateStep";
import { PhotoshootPublishStep } from "@/components/photoshoot/PhotoshootPublishStep";
import { SCENES, SCENE_CATEGORIES, SCENE_CATEGORY_LABELS, searchScenes } from "@/lib/data/scenes";
import { filterScenesByProductLabel } from "@/lib/data/scene-details";
import type { PhotoshootAgentPlan } from "@/lib/photoshoot/prompt-agent";
import { extractProductIdFromFileUrl } from "@/lib/photoshoot/product-id";
import { useActiveBrand, useAppStore } from "@/lib/store";
import type {
  GeneratedImage,
  ImageViewId,
  PlatformPostTypeId,
  ProductCategoryId,
  ProductProfile,
  ProductTypeId,
  SceneId,
} from "@/types";
import { cn } from "@/lib/utils";

const STEPS = [
  { num: 1, title: "Upload", desc: "Product photo from device or URL" },
  { num: 2, title: "Platform", desc: "Output format" },
  { num: 3, title: "Scene", desc: "Environment & mood" },
  { num: 4, title: "Generate", desc: "AI photoshoot" },
  { num: 5, title: "Publish", desc: "Post to platform" },
];

interface PhotoshootWizardProps {
  initialProductId?: string;
}

interface PhotoshootConfig {
  cursorAgent: boolean;
  cursorImage: boolean;
  imageModel: string;
}

export function PhotoshootWizard({ initialProductId }: PhotoshootWizardProps) {
  const activeBrand = useActiveBrand();
  const { addProductWithId, updateProduct, addGeneratedImage } = useAppStore();

  const [step, setStep] = useState(1);
  const [productId, setProductId] = useState(initialProductId ?? "");
  const productIdRef = useRef(initialProductId ?? "");
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [sourcePhotos, setSourcePhotos] = useState<SourcePhoto[]>([]);
  const [primarySourceId, setPrimarySourceId] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState("");

  const [platformId, setPlatformId] = useState<PlatformPostTypeId | null>(null);
  const [viewId, setViewId] = useState<ImageViewId | null>(null);
  const [sceneId, setSceneId] = useState<SceneId | null>(null);

  const [platformGroup, setPlatformGroup] = useState("all");
  const [sceneCategory, setSceneCategory] = useState("all");
  const [sceneSearch, setSceneSearch] = useState("");
  const [showTrendingScenesOnly, setShowTrendingScenesOnly] = useState(false);
  const [showAllScenes, setShowAllScenes] = useState(false);

  const [productProfile, setProductProfile] = useState<ProductProfile | null>(null);
  const [detectingProduct, setDetectingProduct] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedResults, setGeneratedResults] = useState<GeneratedImage[]>([]);
  const [agentPlan, setAgentPlan] = useState<PhotoshootAgentPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [config, setConfig] = useState<PhotoshootConfig | null>(null);

  const resolvedProductId = useMemo(() => {
    for (const s of sourcePhotos) {
      const id = extractProductIdFromFileUrl(s.url);
      if (id) return id;
    }
    const fromOriginal = extractProductIdFromFileUrl(originalUrl);
    if (fromOriginal) return fromOriginal;
    return productId || productIdRef.current;
  }, [sourcePhotos, originalUrl, productId]);

  const product = activeBrand?.products.find(
    (p) => p.id === resolvedProductId || p.id === productId
  );

  const scenes = useMemo(() => {
    let list = SCENES;
    if (productProfile?.label && !showAllScenes) {
      list = filterScenesByProductLabel(productProfile.label);
    }
    if (showTrendingScenesOnly) {
      list = list.filter((s) => s.trending);
    }
    if (sceneCategory !== "all") {
      list = list.filter((s) => s.sceneCategory === sceneCategory);
    }
    if (sceneSearch.trim()) {
      const ids = new Set(searchScenes(sceneSearch).map((s) => s.id));
      list = list.filter((s) => ids.has(s.id));
    }
    return list;
  }, [sceneCategory, sceneSearch, showTrendingScenesOnly, productProfile?.label, showAllScenes]);

  const trendingSceneCount = useMemo(() => SCENES.filter((s) => s.trending).length, []);

  const filteredPlatforms = useMemo(() => {
    if (platformGroup === "all") return PLATFORM_POST_TYPES;
    return PLATFORM_POST_TYPES.filter((p) => p.platformGroup === platformGroup);
  }, [platformGroup]);

  const catalogProducts = useMemo(() => {
    if (!activeBrand) return [];
    return activeBrand.products
      .filter((p) => p.rawPhotoUrl)
      .map((p) => ({
        id: p.id,
        name: p.name || "Product",
        category: p.category,
        thumbUrl: p.rawPhotoUrl,
      }));
  }, [activeBrand]);

  // View/camera angle is auto-derived from the product type — the source product
  // is never re-angled, so the user no longer picks a view. Platform + scene drive framing.
  const effectiveViewId: ImageViewId = useMemo(() => {
    if (viewId) return viewId;
    if (productProfile?.typeId) return getDefaultViewForType(productProfile.typeId);
    return IMAGE_VIEWS[0].id;
  }, [viewId, productProfile?.typeId]);

  useEffect(() => {
    productIdRef.current = productId;
  }, [productId]);

  useEffect(() => {
    fetch("/api/cursor/status")
      .then((r) => r.json())
      .then((d) => {
        if (d.photoshoot) setConfig(d.photoshoot);
      })
      .catch(() => {});
  }, []);

  const applyProductProfile = useCallback(
    (profile: ProductProfile, pid: string) => {
      setProductProfile(profile);
      updateProduct(pid, { category: profile.label });
      const recommended = getRecommendedViewsForType(profile.typeId);
      setViewId((current) => {
        if (!current || !recommended.includes(current)) {
          return getDefaultViewForType(profile.typeId);
        }
        return current;
      });
    },
    [updateProduct]
  );

  const runProductDetection = useCallback(
    async (pid: string) => {
      if (!activeBrand) return;
      setDetectingProduct(true);
      try {
        const res = await fetch("/api/photoshoot/product-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brandId: activeBrand.id, productId: pid }),
        });
        const data = await res.json();
        if (res.ok && data.profile) {
          applyProductProfile(data.profile, pid);
        }
      } catch {
        // ignore — user can select manually
      } finally {
        setDetectingProduct(false);
      }
    },
    [activeBrand, applyProductProfile]
  );

  const saveManualProductType = useCallback(
    async (categoryId: ProductCategoryId, typeId: ProductTypeId) => {
      if (!activeBrand || !productId) return;
      try {
        const res = await fetch("/api/photoshoot/product-profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandId: activeBrand.id,
            productId,
            categoryId,
            typeId,
          }),
        });
        const data = await res.json();
        if (res.ok && data.profile) {
          applyProductProfile(data.profile, productId);
        }
      } catch {
        // ignore
      }
    },
    [activeBrand, productId, applyProductProfile]
  );

  const assignProductId = useCallback(
    (id: string) => {
      productIdRef.current = id;
      setProductId(id);
    },
    []
  );

  const ensureProductId = useCallback((): string => {
    if (productIdRef.current) return productIdRef.current;
    const id = crypto.randomUUID();
    productIdRef.current = id;
    addProductWithId(id, {
      name: "Product",
      category: "General",
      description: "",
      rawPhotoUrl: "",
      source: "upload",
    });
    setProductId(id);
    return id;
  }, [addProductWithId]);

  useEffect(() => {
    if (resolvedProductId && resolvedProductId !== productIdRef.current) {
      assignProductId(resolvedProductId);
    }
  }, [resolvedProductId, assignProductId]);

  const loadProductAssets = useCallback(async () => {
    if (!activeBrand || !productId) return;
    try {
      const res = await fetch(`/api/photoshoot/${activeBrand.id}/${productId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.originalUrl) setOriginalUrl(data.originalUrl);
      if (data.sources?.length) {
        setSourcePhotos(data.sources);
        setPrimarySourceId(data.primaryId ?? data.sources.find((s: SourcePhoto) => s.isPrimary)?.id ?? null);
        const diskProductId = extractProductIdFromFileUrl(data.sources[0]?.url);
        if (diskProductId && diskProductId !== productIdRef.current) {
          assignProductId(diskProductId);
        }
      }
      if (data.generations?.length) {
        const gens = data.generations.map(
          (g: GeneratedImage & { url: string; resolution?: string }) => ({
            id: g.id,
            url: g.url,
            platformPostTypeId: g.platformPostTypeId,
            viewId: g.viewId,
            sceneId: g.sceneId,
            type: "photoshoot" as const,
            createdAt: g.createdAt,
            resolution: g.resolution,
          })
        );
        setGeneratedResults(gens);
      }
      if (data.profile) {
        setProductProfile(data.profile);
      }
    } catch {
      // ignore
    }
  }, [activeBrand, productId, assignProductId]);

  useEffect(() => {
    if (product?.rawPhotoUrl) setOriginalUrl(product.rawPhotoUrl);
  }, [product]);

  useEffect(() => {
    loadProductAssets();
  }, [loadProductAssets]);

  const fetchAgentPlan = useCallback(async () => {
    if (!activeBrand || !platformId || !sceneId) return;
    setPlanLoading(true);
    try {
      const res = await fetch("/api/photoshoot/compose-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: activeBrand.name,
          productName: product?.name || "Product",
          productCategory: product?.category || "General",
          productDescription: product?.description || "",
          businessDNA: activeBrand.businessDNA,
          platformPostTypeId: platformId,
          viewId: effectiveViewId,
          sceneId,
        }),
      });
      const data = await res.json();
      if (res.ok) setAgentPlan(data);
    } catch {
      // ignore
    } finally {
      setPlanLoading(false);
    }
  }, [activeBrand, platformId, effectiveViewId, sceneId, product?.name, product?.category, product?.description]);

  useEffect(() => {
    if (step === 4 && platformId && sceneId) {
      fetchAgentPlan();
    }
  }, [step, platformId, sceneId, fetchAgentPlan]);

  const handleSourcesChange = (
    sources: SourcePhoto[],
    primaryId: string | null,
    primaryUrl: string | null,
    incomingProductId?: string
  ) => {
    setSourcePhotos(sources);
    setPrimarySourceId(primaryId);
    if (primaryUrl) {
      setOriginalUrl(primaryUrl);
      const fromUrl = extractProductIdFromFileUrl(primaryUrl);
      const pid = incomingProductId || fromUrl || productIdRef.current || ensureProductId();
      if (productIdRef.current !== pid) {
        assignProductId(pid);
      }
      updateProduct(pid, { rawPhotoUrl: primaryUrl });
      void runProductDetection(pid);
    }
  };

  const handleCategoryChange = (categoryId: ProductCategoryId) => {
    const cat = getCategoryDef(categoryId);
    const firstType = cat?.types[0]?.id;
    if (firstType) {
      void saveManualProductType(categoryId, firstType);
    }
  };

  const handleTypeChange = (typeId: ProductTypeId) => {
    const categoryId = productProfile?.categoryId ?? getCategoryForType(typeId);
    if (!categoryId) return;
    void saveManualProductType(categoryId, typeId);
  };

  const handleSelectCatalogProduct = useCallback(
    (pid: string) => {
      setError(null);
      assignProductId(pid);
      const picked = activeBrand?.products.find((x) => x.id === pid);
      if (picked?.rawPhotoUrl) setOriginalUrl(picked.rawPhotoUrl);
      // loadProductAssets (productId-change effect) restores disk sources + profile.
      // Kick detection as a fallback so the View step stays unblocked.
      void runProductDetection(pid);
    },
    [activeBrand, assignProductId, runProductDetection]
  );

  const handleImportUrl = async () => {
    if (!activeBrand || !importUrl.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const id = ensureProductId();
      const res = await fetch("/api/photoshoot/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: activeBrand.id,
          productId: id,
          url: importUrl.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const pid = data.productId || id;
      assignProductId(pid);
      handleSourcesChange(
        data.sources ?? [],
        data.primaryId ?? null,
        data.url,
        pid
      );
      updateProduct(pid, {
        rawPhotoUrl: data.url,
        name: data.suggestedName || "Product",
        description: data.suggestedDescription || "",
        sourceUrl: importUrl,
        source: "url",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const canNext = () => {
    switch (step) {
      case 1:
        return sourcePhotos.length > 0 && Boolean(productProfile?.typeId);
      case 2:
        return Boolean(platformId);
      case 3:
        return Boolean(sceneId);
      case 4:
        return generatedResults.length > 0;
      default:
        return true;
    }
  };

  if (!activeBrand) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8 text-muted">
        Select a brand to start a photoshoot.
      </div>
    );
  }

  const selectedPlatform = PLATFORM_POST_TYPES.find((p) => p.id === platformId);
  const selectedView = IMAGE_VIEWS.find((v) => v.id === effectiveViewId);
  const selectedScene = SCENES.find((s) => s.id === sceneId);

  return (
    <div className="p-8 pb-28">
      <PageHeader
        title="Photoshoot Agent"
        subtitle={`${activeBrand.name} — Cursor agent handles prompt + image generation`}
      />

      {/* Step progress */}
      <div className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => s.num < step && setStep(s.num)}
                disabled={s.num > step}
                className={cn(
                  "flex flex-col items-center gap-2 transition-opacity",
                  s.num < step && "cursor-pointer",
                  s.num > step && "opacity-40"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300",
                    step === s.num
                      ? "bg-gradient-to-br from-accent to-[#5856d6] text-white shadow-lg shadow-accent/30"
                      : s.num < step
                        ? "glass-nav-active text-accent"
                        : "glass-chip text-muted"
                  )}
                >
                  {s.num < step ? <Check className="h-4 w-4" /> : s.num}
                </span>
                <span
                  className={cn(
                    "hidden text-xs sm:block",
                    step === s.num ? "font-semibold text-foreground" : "text-muted"
                  )}
                >
                  {s.title}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-0.5 flex-1 rounded-full transition-colors duration-300",
                    s.num < step
                      ? "bg-gradient-to-r from-accent to-[#5856d6]"
                      : "bg-border/60"
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="glass-panel mb-4 flex items-start gap-3 border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1 — Upload & edit sources */}
      {step === 1 && activeBrand && (
        <div className="space-y-5">
          <SourcePhotoStudio
            brandId={activeBrand.id}
            productId={resolvedProductId}
            sources={sourcePhotos}
            primaryId={primarySourceId}
            importUrl={importUrl}
            loading={loading}
            onSourcesChange={handleSourcesChange}
            onImportUrlChange={setImportUrl}
            onImportUrl={handleImportUrl}
            onEnsureProductId={ensureProductId}
            onError={setError}
            catalogProducts={catalogProducts}
            currentProductId={resolvedProductId}
            onSelectCatalogProduct={handleSelectCatalogProduct}
          />
          {(sourcePhotos.length > 0 || originalUrl) && productId && (
            <ProductTypeSelector
              profile={productProfile}
              detecting={detectingProduct}
              onDetect={() => runProductDetection(productId)}
              onCategoryChange={handleCategoryChange}
              onTypeChange={handleTypeChange}
              disabled={loading}
            />
          )}
        </div>
      )}

      {step === 2 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Platform & Post Type</h2>
          <p className="mb-4 text-sm text-muted">
            Choose where this photoshoot will be published. Each tile shows a preview with our sample
            product framed for that format.
          </p>
          <div className="mb-6 flex flex-wrap gap-2">
            <FilterPill active={platformGroup === "all"} onClick={() => setPlatformGroup("all")} label="All" />
            {PLATFORM_GROUPS.map((g) => (
              <FilterPill key={g} active={platformGroup === g} onClick={() => setPlatformGroup(g)} label={g} />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredPlatforms.map((p) => (
              <PlatformSelectCard
                key={p.id}
                platform={p}
                selected={platformId === p.id}
                onClick={() => setPlatformId(p.id)}
              />
            ))}
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Scene</h2>
          <p className="mb-4 max-w-3xl text-sm text-muted">
            Choose from {SCENES.length} environments across 8 categories — including{" "}
            {trendingSceneCount} trending 2026 aesthetics (quiet luxury, UGC realism, dopamine color,
            Cloud Dancer neutrals, lived-in lifestyle, and more). Each tile previews the scene and
            explains what the AI pipeline will do.
          </p>

          <div className="glass-bar mb-4 flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              type="search"
              value={sceneSearch}
              onChange={(e) => setSceneSearch(e.target.value)}
              placeholder="Search scenes — e.g. marble, café, winter, UGC…"
              className="glass-input w-full max-w-md rounded-xl px-3 py-2 text-sm sm:flex-1"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted">
                Showing <span className="font-semibold text-foreground">{scenes.length}</span> of{" "}
                {SCENES.length}
              </span>
              <button
                type="button"
                onClick={() => setShowTrendingScenesOnly((v) => !v)}
                className={cn(
                  "rounded-full px-3 py-1 font-medium transition-colors",
                  showTrendingScenesOnly
                    ? "bg-[var(--success-bg)] text-[var(--success)]"
                    : "glass-chip text-muted hover:text-foreground"
                )}
              >
                Trending 2026
              </button>
            </div>
          </div>

          {productProfile?.label && (
            <div className="glass-bar mb-4 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs">
              <span className="text-muted">
                Showing scenes recommended for{" "}
                <span className="font-semibold text-foreground">{productProfile.label}</span>
              </span>
              <button
                type="button"
                onClick={() => setShowAllScenes((v) => !v)}
                className="font-medium text-accent hover:underline"
              >
                {showAllScenes ? "Show recommended only" : "Show all scenes"}
              </button>
            </div>
          )}
          <div className="mb-6 flex flex-wrap gap-2">
            <FilterPill active={sceneCategory === "all"} onClick={() => setSceneCategory("all")} label="All" />
            {SCENE_CATEGORIES.map((c) => (
              <FilterPill
                key={c}
                active={sceneCategory === c}
                onClick={() => setSceneCategory(c)}
                label={SCENE_CATEGORY_LABELS[c]}
              />
            ))}
          </div>
          <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
            {scenes.length === 0 ? (
              <p className="col-span-full text-sm text-muted">
                No scenes match this filter. Try &quot;Show all scenes&quot; or change the product type in Step 1.
              </p>
            ) : (
              scenes.map((s) => (
                <SceneSelectCard
                  key={s.id}
                  scene={s}
                  selected={sceneId === s.id}
                  onClick={() => setSceneId(s.id)}
                />
              ))
            )}
          </div>
        </section>
      )}

      {/* Step 4 — Professional generate */}
      {step === 4 && platformId && sceneId && resolvedProductId && (
        <PhotoshootGenerateStep
          brandId={activeBrand.id}
          productId={resolvedProductId}
          brandName={activeBrand.name}
          productName={product?.name || "Product"}
          productCategory={product?.category || productProfile?.label || "General"}
          productDescription={product?.description || ""}
          businessDNA={activeBrand.businessDNA}
          platformId={platformId}
          viewId={effectiveViewId}
          sceneId={sceneId}
          originalUrl={originalUrl}
          agentPlan={agentPlan}
          planLoading={planLoading}
          config={config}
          platformLabel={selectedPlatform?.platformName ?? "Platform"}
          platformMeta={selectedPlatform ? `${selectedPlatform.aspectRatio} · ${selectedPlatform.resolution}` : ""}
          viewLabel={selectedView?.viewName ?? "View"}
          sceneLabel={selectedScene?.sceneName ?? "Scene"}
          sceneMeta={selectedScene?.mood ?? ""}
          generatedResults={generatedResults}
          onGenerated={(image) => {
            addGeneratedImage(resolvedProductId, image);
            setGeneratedResults((prev) => [image, ...prev]);
          }}
          onError={setError}
          onAgentPlanUpdate={setAgentPlan}
        />
      )}

      {/* Step 5 — Publish */}
      {step === 5 && platformId && resolvedProductId && (
        <PhotoshootPublishStep
          brandId={activeBrand.id}
          productId={resolvedProductId}
          platformId={platformId}
          platformLabel={selectedPlatform?.platformName ?? "Platform"}
          platformMeta={
            selectedPlatform ? `${selectedPlatform.aspectRatio} · ${selectedPlatform.resolution}` : ""
          }
          brandName={activeBrand.name}
          productName={product?.name || "Product"}
          productCategory={product?.category || productProfile?.label || "General"}
          productDescription={product?.description || ""}
          businessDNA={activeBrand.businessDNA}
          viewLabel={selectedView?.viewName}
          sceneLabel={selectedScene?.sceneName}
          generatedResults={generatedResults}
        />
      )}

      <GlassBar className="flex justify-between">
        <SecondaryButton onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1 || loading}>
          <ArrowLeft className="h-4 w-4" /> Back
        </SecondaryButton>
        {step < 5 && (
          <PrimaryButton onClick={() => setStep((s) => s + 1)} disabled={!canNext() || loading}>
            {step === 4 ? "Next: Publish" : "Next"} <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        )}
      </GlassBar>

      {loading && step < 4 && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/15 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "glass-chip rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition-all",
        active ? "bg-accent text-white shadow-md shadow-accent/30" : "text-muted hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
