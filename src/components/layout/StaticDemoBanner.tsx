"use client";

import { useState } from "react";
import { X } from "lucide-react";

/** Shown on the static GitHub Pages demo — AI APIs are not available there. */
export function StaticDemoBanner() {
  const isStatic = process.env.NEXT_PUBLIC_STATIC_DEMO === "true";
  const [dismissed, setDismissed] = useState(false);

  if (!isStatic || dismissed) return null;

  return (
    <div className="relative z-50 border-b border-amber-200/80 bg-amber-50 px-4 py-2.5 text-amber-950">
      <div className="mx-auto flex max-w-6xl items-start justify-between gap-3 text-sm">
        <p className="leading-relaxed">
          <span className="font-semibold">Static demo</span>
          {" — "}
          Browse brands, Business DNA, catalog, campaigns, and docs. Upload,
          generate, and agent chat need a local or Node server (
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">
            npm run dev
          </code>
          ).
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-md p-1 text-amber-800/70 hover:bg-amber-100 hover:text-amber-950"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
