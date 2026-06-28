"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Camera,
  Link as LinkIcon,
  Megaphone,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Card,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/layout/DashboardLayout";
import { PRODUCT_CATEGORIES } from "@/lib/brand-utils";
import { useActiveBrand, useAppStore } from "@/lib/store";

export function CatalogPage() {
  const activeBrand = useActiveBrand();
  const { addProduct, removeProduct } = useAppStore();
  const [showAddUrl, setShowAddUrl] = useState(false);
  const [showAddScratch, setShowAddScratch] = useState(false);

  const products = activeBrand?.products ?? [];

  return (
    <div className="p-8">
      <PageHeader
        title="Business DNA — Catalog"
        subtitle={
          activeBrand
            ? `Products for ${activeBrand.name}. Add items to use in photoshoots and campaigns.`
            : "Select or create a brand to manage products."
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <ActionCard
          icon={LinkIcon}
          label="Add from URL"
          onClick={() => {
            setShowAddScratch(false);
            setShowAddUrl(true);
          }}
        />
        <ActionCard
          icon={Plus}
          label="Add from scratch"
          onClick={() => {
            setShowAddUrl(false);
            setShowAddScratch(true);
          }}
        />

        {products.map((item) => (
          <div
            key={item.id}
            className="group relative overflow-hidden glass-tile !p-0 transition-transform hover:!translate-y-[-3px]"
          >
            <div className="aspect-square bg-background">
              {item.rawPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.rawPhotoUrl}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted">
                  No image
                </div>
              )}
            </div>
            <div className="p-4">
              <span className="rounded-md bg-accent-muted px-2 py-0.5 text-[10px] font-medium text-accent">
                {item.category}
              </span>
              <h3 className="mt-2 truncate text-sm font-medium">{item.name}</h3>
              <p className="mt-1 line-clamp-2 text-xs text-muted">
                {item.description}
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  href={`/photoshoot?product=${item.id}`}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-accent-muted py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent-muted/80"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Photoshoot
                </Link>
                <Link
                  href={`/campaigns?product=${item.id}`}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-accent-muted py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent-muted/80"
                >
                  <Megaphone className="h-3.5 w-3.5" />
                  Campaign
                </Link>
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeProduct(item.id)}
              className="absolute right-3 top-3 rounded-lg bg-background/80 p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Delete product"
            >
              <Trash2 className="h-4 w-4 text-danger" />
            </button>
          </div>
        ))}
      </div>

      {showAddUrl && <AddFromUrlModal onClose={() => setShowAddUrl(false)} />}
      {showAddScratch && (
        <AddFromScratchModal onClose={() => setShowAddScratch(false)} />
      )}
    </div>
  );
}

function ActionCard({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-tile flex aspect-square flex-col items-center justify-center gap-3 transition-transform hover:!translate-y-[-3px]"
    >
      <Icon className="h-8 w-8 text-muted" />
      <span className="text-sm text-muted">{label}</span>
    </button>
  );
}

function AddFromUrlModal({ onClose }: { onClose: () => void }) {
  const { addProduct } = useAppStore();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    addProduct({
      name: "Imported Product",
      category: "Other",
      description: `Product imported from ${url}`,
      rawPhotoUrl: "",
      source: "url",
      sourceUrl: url,
    });
    setLoading(false);
    onClose();
  };

  return (
    <Modal title="Add from URL" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted">
          Paste a product page URL to import name, category, description, and images.
        </p>
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://yourstore.com/products/..."
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent"
        />
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton disabled={loading}>
            {loading ? "Importing..." : "Import Product"}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function AddFromScratchModal({ onClose }: { onClose: () => void }) {
  const { addProduct } = useAppStore();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Other");
  const [description, setDescription] = useState("");
  const [rawPhotoUrl, setRawPhotoUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addProduct({ name, category, description, rawPhotoUrl, source: "scratch" });
    onClose();
  };

  return (
    <Modal title="Add New Product" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-muted">Raw Photo URL</label>
          <input
            type="url"
            value={rawPhotoUrl}
            onChange={(e) => setRawPhotoUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Product Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nordic Monk Cosmetic Pouch"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Product Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent"
          >
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Premium vegan leather pouch..."
            className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton>Add to Catalog</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-lg shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </Card>
    </div>
  );
}
