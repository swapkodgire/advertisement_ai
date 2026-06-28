"use client";

import { useState } from "react";
import {
  Card,
  GlassBar,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TagInput,
} from "@/components/layout/DashboardLayout";
import { AgentPanel } from "@/components/agent/AgentPanel";
import { useActiveBrand, useAppStore } from "@/lib/store";
import { BookOpen, Globe, Pencil, Trash2 } from "lucide-react";

export function OverviewPage() {
  const activeBrand = useActiveBrand();
  const { updateBrandOverview, updateBusinessDetails, resetActiveBrandDNA } =
    useAppStore();
  const brandOverview = activeBrand?.businessDNA.brandOverview;
  const businessDetails = activeBrand?.businessDNA.businessDetails;
  const [tab, setTab] = useState<"brand" | "business">("brand");

  if (!brandOverview || !businessDetails) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-muted">
        Select or create a brand to get started.
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto p-8 pb-28">
        <PageHeader
          title={`Your Business DNA — ${activeBrand.name}`}
          subtitle="Unlock the power to generate product photos, marketing campaigns, a website, and more."
        />

        <div className="glass-panel mb-6 flex w-fit gap-1 p-1">
          {(["brand", "business"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm transition-colors ${
                tab === t
                  ? "bg-background text-foreground font-medium"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t === "brand" ? "Brand Overview" : "Business Details"}
            </button>
          ))}
        </div>

        {tab === "brand" ? (
          <BrandOverviewTab
            brandOverview={brandOverview}
            onUpdate={updateBrandOverview}
          />
        ) : (
          <BusinessDetailsTab
            businessDetails={businessDetails}
            onUpdate={updateBusinessDetails}
          />
        )}

        <GlassBar className="flex justify-center gap-3">
          <SecondaryButton onClick={resetActiveBrandDNA}>
            <Trash2 className="h-4 w-4" />
            Reset
          </SecondaryButton>
          <SecondaryButton>
            <BookOpen className="h-4 w-4" />
            Brand Book
          </SecondaryButton>
          <PrimaryButton>
            <Globe className="h-4 w-4" />
            Create Website
          </PrimaryButton>
        </GlassBar>
      </div>

      <AgentPanel />
    </div>
  );
}

function BrandOverviewTab({
  brandOverview,
  onUpdate,
}: {
  brandOverview: NonNullable<ReturnType<typeof useActiveBrand>>["businessDNA"]["brandOverview"];
  onUpdate: (data: Partial<typeof brandOverview>) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wider text-muted">
              Logo
            </label>
            <Pencil className="h-3.5 w-3.5 text-muted" />
          </div>
          <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-border bg-background">
            {brandOverview.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brandOverview.logoUrl}
                alt="Brand logo"
                className="max-h-32 max-w-full object-contain"
              />
            ) : (
              <div className="text-center">
                <p className="text-2xl font-bold tracking-widest">
                  {brandOverview.businessName || "YOUR BRAND"}
                </p>
                <p className="mt-1 text-xs text-muted">Upload or enter logo URL below</p>
              </div>
            )}
          </div>
          <input
            type="url"
            placeholder="Logo URL"
            value={brandOverview.logoUrl}
            onChange={(e) => onUpdate({ logoUrl: e.target.value })}
            className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Card>

        <Card>
          <label className="mb-3 block text-xs font-medium uppercase tracking-wider text-muted">
            Font
          </label>
          <div className="flex items-center gap-4">
            <span
              className="text-5xl"
              style={{ fontFamily: brandOverview.fontFamily }}
            >
              Aa
            </span>
            <select
              value={brandOverview.fontFamily}
              onChange={(e) => onUpdate({ fontFamily: e.target.value })}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {["Montserrat", "Inter", "Playfair Display", "Roboto", "Open Sans"].map(
                (f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                )
              )}
            </select>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Business Name"
          value={brandOverview.businessName}
          onChange={(v) => onUpdate({ businessName: v })}
          placeholder="Nordic Monk"
        />
        <Field
          label="Tagline"
          value={brandOverview.tagline}
          onChange={(v) => onUpdate({ tagline: v })}
          placeholder="Crafted for the modern explorer"
        />
      </div>

      <Card>
        <label className="mb-4 block text-xs font-medium uppercase tracking-wider text-muted">
          Colors
        </label>
        <div className="flex flex-wrap gap-4">
          {brandOverview.colors.map((color, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <input
                type="color"
                value={color.hex}
                onChange={(e) => {
                  const colors = [...brandOverview.colors];
                  colors[i] = { ...color, hex: e.target.value };
                  onUpdate({ colors });
                }}
                className="h-12 w-12 cursor-pointer rounded-full border-2 border-border"
              />
              <input
                type="text"
                value={color.hex}
                onChange={(e) => {
                  const colors = [...brandOverview.colors];
                  colors[i] = { ...color, hex: e.target.value };
                  onUpdate({ colors });
                }}
                className="w-20 rounded border border-border bg-background px-2 py-1 text-center text-xs outline-none"
              />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <label className="mb-3 block text-xs font-medium uppercase tracking-wider text-muted">
          Brand Aesthetic
        </label>
        <TagInput
          tags={brandOverview.brandAesthetics}
          onChange={(brandAesthetics) => onUpdate({ brandAesthetics })}
          placeholder="Add aesthetic tag..."
        />
      </Card>

      <Card>
        <label className="mb-3 block text-xs font-medium uppercase tracking-wider text-muted">
          Brand Tone of Voice
        </label>
        <TagInput
          tags={brandOverview.brandTone}
          onChange={(brandTone) => onUpdate({ brandTone })}
          placeholder="Add tone tag..."
        />
      </Card>

      <Card>
        <label className="mb-3 block text-xs font-medium uppercase tracking-wider text-muted">
          Brand Values / Pillars
        </label>
        <TagInput
          tags={brandOverview.brandValues}
          onChange={(brandValues) => onUpdate({ brandValues })}
          placeholder="Add brand value..."
        />
      </Card>

      <Card>
        <label className="mb-3 block text-xs font-medium uppercase tracking-wider text-muted">
          Business Overview
        </label>
        <textarea
          value={brandOverview.businessOverview}
          onChange={(e) => onUpdate({ businessOverview: e.target.value })}
          rows={4}
          placeholder="Describe your business, mission, and what makes you unique..."
          className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent"
        />
      </Card>
    </div>
  );
}

function BusinessDetailsTab({
  businessDetails,
  onUpdate,
}: {
  businessDetails: NonNullable<ReturnType<typeof useActiveBrand>>["businessDNA"]["businessDetails"];
  onUpdate: (data: Partial<typeof businessDetails>) => void;
}) {
  const socialFields = [
    { key: "facebook" as const, label: "Facebook" },
    { key: "instagram" as const, label: "Instagram" },
    { key: "linkedin" as const, label: "LinkedIn" },
    { key: "x" as const, label: "X (Twitter)" },
    { key: "youtube" as const, label: "YouTube" },
    { key: "pinterest" as const, label: "Pinterest" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Location"
          value={businessDetails.location}
          onChange={(v) => onUpdate({ location: v })}
          placeholder="123 Main St, City, Country"
        />
        <Field
          label="Phone Number"
          value={businessDetails.phone}
          onChange={(v) => onUpdate({ phone: v })}
          placeholder="+1 (555) 000-0000"
        />
      </div>

      <Field
        label="Business Hours"
        value={businessDetails.businessHours}
        onChange={(v) => onUpdate({ businessHours: v })}
        placeholder="Mon–Fri 9am–6pm, Sat 10am–4pm"
      />

      <Card>
        <label className="mb-3 block text-xs font-medium uppercase tracking-wider text-muted">
          Keywords
        </label>
        <TagInput
          tags={businessDetails.keywords}
          onChange={(keywords) => onUpdate({ keywords })}
          placeholder="Add SEO keyword..."
        />
      </Card>

      <Card>
        <label className="mb-3 block text-xs font-medium uppercase tracking-wider text-muted">
          Social Links
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {socialFields.map(({ key, label }) => (
            <div key={key}>
              <label className="mb-1 block text-xs text-muted">{label}</label>
              <input
                type="url"
                value={businessDetails.socialLinks[key]}
                onChange={(e) =>
                  onUpdate({
                    socialLinks: {
                      ...businessDetails.socialLinks,
                      [key]: e.target.value,
                    },
                  })
                }
                placeholder={`https://${key}.com/yourbrand`}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <label className="mb-3 block text-xs font-medium uppercase tracking-wider text-muted">
          Call-to-Action Links
        </label>
        <p className="mb-3 text-xs text-muted">
          Add links like Shop Now, Book a Demo, or Contact Us.
        </p>
        {businessDetails.ctaLinks.map((cta, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <input
              type="text"
              value={cta.label}
              placeholder="Label"
              onChange={(e) => {
                const ctaLinks = [...businessDetails.ctaLinks];
                ctaLinks[i] = { ...cta, label: e.target.value };
                onUpdate({ ctaLinks });
              }}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
            />
            <input
              type="url"
              value={cta.url}
              placeholder="URL"
              onChange={(e) => {
                const ctaLinks = [...businessDetails.ctaLinks];
                ctaLinks[i] = { ...cta, url: e.target.value };
                onUpdate({ ctaLinks });
              }}
              className="flex-[2] rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
            />
          </div>
        ))}
        <SecondaryButton
          onClick={() =>
            onUpdate({
              ctaLinks: [...businessDetails.ctaLinks, { label: "", url: "" }],
            })
          }
        >
          + Add CTA Link
        </SecondaryButton>
      </Card>

      <Card>
        <label className="mb-3 block text-xs font-medium uppercase tracking-wider text-muted">
          Testimonials
        </label>
        {businessDetails.testimonials.map((t, i) => (
          <div key={t.id} className="mb-3 rounded-xl border border-border p-4">
            <input
              type="text"
              value={t.author}
              placeholder="Customer name"
              onChange={(e) => {
                const testimonials = [...businessDetails.testimonials];
                testimonials[i] = { ...t, author: e.target.value };
                onUpdate({ testimonials });
              }}
              className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
            />
            <textarea
              value={t.text}
              placeholder="Testimonial text"
              rows={2}
              onChange={(e) => {
                const testimonials = [...businessDetails.testimonials];
                testimonials[i] = { ...t, text: e.target.value };
                onUpdate({ testimonials });
              }}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
            />
          </div>
        ))}
        <SecondaryButton
          onClick={() =>
            onUpdate({
              testimonials: [
                ...businessDetails.testimonials,
                {
                  id: crypto.randomUUID(),
                  author: "",
                  text: "",
                  rating: 5,
                },
              ],
            })
          }
        >
          + Add Testimonial
        </SecondaryButton>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Card>
      <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </Card>
  );
}
