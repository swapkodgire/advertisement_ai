"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Link2,
  Calendar,
  Hash,
  Sparkles,
  Search,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BusinessDNA, GeneratedImage } from "@/types";

interface PublishRecord {
  id: string;
  createdAt: string;
  status: "published" | "scheduled" | "needs_connection" | "failed";
  provider: string;
  externalId?: string;
  externalUrl?: string;
  message: string;
  platformPostTypeId: string;
  genId: string;
  caption: string;
  scheduledAt?: string | null;
}

interface SeoContent {
  seoTitle: string;
  metaDescription: string;
  keywords: string[];
  altText: string;
  aiSummary: string;
}

const EMPTY_SEO: SeoContent = {
  seoTitle: "",
  metaDescription: "",
  keywords: [],
  altText: "",
  aiSummary: "",
};

interface PhotoshootPublishStepProps {
  brandId: string;
  productId: string;
  platformId: string;
  platformLabel: string;
  platformMeta: string;
  brandName: string;
  productName: string;
  productCategory?: string;
  productDescription?: string;
  businessDNA?: BusinessDNA;
  viewLabel?: string;
  sceneLabel?: string;
  generatedResults: GeneratedImage[];
}

export function PhotoshootPublishStep({
  brandId,
  productId,
  platformId,
  platformLabel,
  platformMeta,
  brandName,
  productName,
  productCategory,
  productDescription,
  businessDNA,
  viewLabel,
  sceneLabel,
  generatedResults,
}: PhotoshootPublishStepProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    generatedResults[0]?.id ?? null
  );
  const [caption, setCaption] = useState(`${productName} by ${brandName}. ✨`);
  const [hashtags, setHashtags] = useState("#newdrop #design #brand");
  const [tone, setTone] = useState("");
  const [seo, setSeo] = useState<SeoContent>(EMPTY_SEO);
  const [seoOpen, setSeoOpen] = useState(false);

  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [genTarget, setGenTarget] = useState<null | "caption" | "hashtags" | "all">(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PublishRecord[]>([]);

  const selected = useMemo(
    () => generatedResults.find((g) => g.id === selectedId) ?? generatedResults[0],
    [generatedResults, selectedId]
  );

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/publish?brandId=${brandId}&productId=${productId}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.records)) setHistory(data.records);
    } catch {
      // ignore
    }
  }, [brandId, productId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const generateContent = useCallback(
    async (target: "caption" | "hashtags" | "all") => {
      setGenTarget(target);
      setError(null);
      try {
        const res = await fetch("/api/publish/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platformPostTypeId: platformId,
            brandName,
            productName,
            productCategory,
            productDescription,
            viewLabel,
            sceneLabel,
            tone: tone.trim() || undefined,
            existingCaption: target !== "hashtags" ? caption : undefined,
            target,
            businessDNA,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Generation failed");
        const content = data.content as {
          caption: string;
          hashtags: string[];
          seoTitle: string;
          metaDescription: string;
          keywords: string[];
          altText: string;
          aiSummary: string;
        };
        if (target !== "hashtags" && content.caption) setCaption(content.caption);
        if (target !== "caption" && content.hashtags?.length) {
          setHashtags(content.hashtags.join(" "));
        }
        setSeo({
          seoTitle: content.seoTitle || "",
          metaDescription: content.metaDescription || "",
          keywords: content.keywords || [],
          altText: content.altText || "",
          aiSummary: content.aiSummary || "",
        });
        setSeoOpen(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Generation failed");
      } finally {
        setGenTarget(null);
      }
    },
    [
      platformId,
      brandName,
      productName,
      productCategory,
      productDescription,
      viewLabel,
      sceneLabel,
      tone,
      caption,
      businessDNA,
    ]
  );

  const handlePublish = async () => {
    if (!selected) {
      setError("Select an image to publish.");
      return;
    }
    if (scheduleMode === "later" && !scheduledAt) {
      setError("Pick a date and time to schedule.");
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      const absoluteUrl = new URL(selected.url, window.location.origin).toString();
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          productId,
          genId: selected.id,
          platformPostTypeId: platformId,
          imageUrl: absoluteUrl,
          caption,
          hashtags,
          scheduledAt: scheduleMode === "later" ? new Date(scheduledAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (data.record) {
        setHistory((prev) => [data.record as PublishRecord, ...prev]);
      }
      if (!res.ok && !data.record) {
        throw new Error(data.error || "Publish failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  if (generatedResults.length === 0) {
    return (
      <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 text-center text-muted">
        <AlertCircle className="h-8 w-8 text-muted/40" />
        <p className="text-sm">No generated designs yet. Go back and generate a photoshoot first.</p>
      </div>
    );
  }

  const captionBusy = genTarget === "caption" || genTarget === "all";
  const tagsBusy = genTarget === "hashtags" || genTarget === "all";

  return (
    <section className="space-y-5">
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Send className="h-5 w-5 text-accent" />
            Publish
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Choose a design, let AI write an SEO + AI-discoverable caption and viral hashtags, then publish to{" "}
            <span className="font-medium text-foreground">{platformLabel}</span> · {platformMeta}
          </p>
        </div>
        <button
          type="button"
          onClick={() => generateContent("all")}
          disabled={genTarget !== null}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-opacity",
            genTarget !== null
              ? "cursor-not-allowed bg-muted/20 text-muted"
              : "bg-gradient-to-br from-accent to-[#5856d6] text-white shadow-lg shadow-accent/30 hover:opacity-90"
          )}
        >
          {genTarget === "all" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Generate caption + hashtags
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Image picker + preview */}
        <div className="space-y-4 lg:col-span-2">
          <div className="glass-card p-5">
            <h3 className="mb-3 text-sm font-semibold">Select the post to publish</h3>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {generatedResults.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedId(g.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border-2 transition-all",
                    selected?.id === g.id
                      ? "border-accent ring-2 ring-accent/30"
                      : "border-transparent hover:border-border"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.url} alt="Generated" className="aspect-square w-full object-cover" />
                  {selected?.id === g.id && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-accent p-1 text-white">
                      <CheckCircle2 className="h-3 w-3" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {selected && (
            <div className="glass-card overflow-hidden !p-0">
              <div className="flex items-center justify-center bg-white/20 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.url}
                  alt="Selected design"
                  className="max-h-[420px] w-auto max-w-full object-contain"
                />
              </div>
            </div>
          )}

          {/* SEO & AI discoverability */}
          <div className="glass-card p-5">
            <button
              type="button"
              onClick={() => setSeoOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 text-sm font-semibold"
            >
              <span className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-accent" /> SEO &amp; AI discoverability
              </span>
              <ChevronDown
                className={cn("h-4 w-4 text-muted transition-transform", seoOpen && "rotate-180")}
              />
            </button>
            {seoOpen && (
              <div className="mt-4 space-y-3">
                {!seo.seoTitle && !seo.aiSummary ? (
                  <p className="text-xs text-muted">
                    Generate a caption to produce an SEO title, meta description, keywords, alt text,
                    and an AI-answer-engine summary that helps ChatGPT, Gemini &amp; Perplexity
                    recommend this product.
                  </p>
                ) : (
                  <>
                    <SeoField label="SEO title" value={seo.seoTitle} />
                    <SeoField label="Meta description" value={seo.metaDescription} />
                    <SeoField label="Image alt text" value={seo.altText} />
                    <SeoField label="AI answer-engine summary" value={seo.aiSummary} />
                    {seo.keywords.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-foreground">Keywords</p>
                        <div className="flex flex-wrap gap-1.5">
                          {seo.keywords.map((k) => (
                            <span
                              key={k}
                              className="glass-chip rounded-full px-2.5 py-1 text-[11px] text-muted"
                            >
                              {k}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Compose + publish */}
        <div className="space-y-4">
          <div className="glass-card space-y-4 p-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                AI direction <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="glass-input w-full rounded-xl px-3 py-2 text-sm"
                placeholder="e.g. playful launch, luxury, Mother's Day…"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">Caption</label>
                <button
                  type="button"
                  onClick={() => generateContent("caption")}
                  disabled={genTarget !== null}
                  className="flex items-center gap-1 text-xs font-medium text-accent hover:underline disabled:opacity-50"
                >
                  {captionBusy ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : caption && caption !== `${productName} by ${brandName}. ✨` ? (
                    <RefreshCw className="h-3 w-3" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {captionBusy ? "Writing…" : "AI write"}
                </button>
              </div>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={6}
                className="glass-input w-full rounded-xl px-3 py-2 text-sm"
                placeholder="Write a caption…"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Hash className="h-3.5 w-3.5" /> Hashtags
                </label>
                <button
                  type="button"
                  onClick={() => generateContent("hashtags")}
                  disabled={genTarget !== null}
                  className="flex items-center gap-1 text-xs font-medium text-accent hover:underline disabled:opacity-50"
                >
                  {tagsBusy ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Search className="h-3 w-3" />
                  )}
                  {tagsBusy ? "Researching…" : "Research viral tags"}
                </button>
              </div>
              <textarea
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                rows={3}
                className="glass-input w-full rounded-xl px-3 py-2 text-sm"
                placeholder="#brand #design"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Calendar className="h-3.5 w-3.5" /> Timing
              </label>
              <div className="flex gap-2">
                <ScheduleToggle active={scheduleMode === "now"} onClick={() => setScheduleMode("now")} label="Publish now" />
                <ScheduleToggle active={scheduleMode === "later"} onClick={() => setScheduleMode("later")} label="Schedule" />
              </div>
              {scheduleMode === "later" && (
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="glass-input mt-2 w-full rounded-xl px-3 py-2 text-sm"
                />
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger-bg px-3 py-2 text-xs text-danger">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || !selected}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity",
                publishing || !selected
                  ? "cursor-not-allowed bg-muted/20 text-muted"
                  : "bg-gradient-to-br from-accent to-[#5856d6] text-white shadow-lg shadow-accent/30 hover:opacity-90"
              )}
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {scheduleMode === "later" ? "Schedule post" : `Publish to ${platformLabel}`}
            </button>
          </div>

          {history.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="mb-3 text-sm font-semibold">Publish history</h3>
              <div className="space-y-2">
                {history.map((rec) => (
                  <PublishRecordRow key={rec.id} record={rec} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SeoField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  return (
    <div className="rounded-xl border border-border/40 bg-white/20 px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-light">
          {label}
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 text-[11px] text-accent hover:underline"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-xs text-foreground">{value}</p>
    </div>
  );
}

function ScheduleToggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
        active ? "bg-accent text-white shadow-sm" : "glass-chip text-muted hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function PublishRecordRow({ record }: { record: PublishRecord }) {
  const meta = STATUS_META[record.status];
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border/40 bg-white/20 px-3 py-2.5 text-xs">
      <span className={cn("mt-0.5 shrink-0", meta.color)}>{meta.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-foreground">
            {meta.label} · {record.provider}
          </span>
          <span className="shrink-0 text-[10px] text-muted-light">
            {new Date(record.createdAt).toLocaleString()}
          </span>
        </div>
        <p className="mt-0.5 text-muted">{record.message}</p>
        {record.externalUrl && (
          <a
            href={record.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-accent hover:underline"
          >
            <Link2 className="h-3 w-3" /> View post
          </a>
        )}
      </div>
    </div>
  );
}

const STATUS_META: Record<
  PublishRecord["status"],
  { label: string; color: string; icon: ReactNode }
> = {
  published: { label: "Published", color: "text-[var(--success)]", icon: <CheckCircle2 className="h-4 w-4" /> },
  scheduled: { label: "Scheduled", color: "text-accent", icon: <Clock className="h-4 w-4" /> },
  needs_connection: { label: "Needs connection", color: "text-warning", icon: <AlertCircle className="h-4 w-4" /> },
  failed: { label: "Failed", color: "text-danger", icon: <AlertCircle className="h-4 w-4" /> },
};
