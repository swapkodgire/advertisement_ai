import Link from "next/link";
import { DashboardLayout, PageHeader } from "@/components/layout/DashboardLayout";

const DOC_SECTIONS = [
  {
    title: "Brand Showcase Strategies",
    description: "How to make your brand go viral on each platform",
    links: [
      { href: "/docs/brand-showcase/instagram", label: "Instagram" },
      { href: "/docs/brand-showcase/google", label: "Google" },
      { href: "/docs/brand-showcase/ai-agentic-search", label: "AI Agentic Search" },
      { href: "/docs/brand-showcase/facebook", label: "Facebook" },
    ],
  },
  {
    title: "Product Showcase Strategies",
    description: "Platform-specific tactics to drive product discovery and sales",
    links: [
      { href: "/docs/product-showcase/instagram", label: "Instagram" },
      { href: "/docs/product-showcase/google", label: "Google" },
      { href: "/docs/product-showcase/ai-agentic-search", label: "AI Agentic Search" },
      { href: "/docs/product-showcase/facebook", label: "Facebook" },
    ],
  },
  {
    title: "Architecture & Tooling",
    description: "How the Business DNA tool works and recommended integrations",
    links: [
      { href: "/docs/architecture/business-dna-tool", label: "Business DNA Tool" },
      { href: "/docs/architecture/ai-integration", label: "AI Integration Guide" },
    ],
  },
];

export default function DocsPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <PageHeader
          title="Documentation"
          subtitle="Deep-dive guides for going viral across Instagram, Google, Facebook, and AI agentic search — for both brand and product showcase."
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {DOC_SECTIONS.map((section) => (
            <div
              key={section.title}
              className="glass-card p-6 transition-transform hover:!translate-y-[-2px]"
            >
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <p className="mt-1 text-sm text-muted">{section.description}</p>
              <ul className="mt-4 space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-accent hover:underline"
                    >
                      {link.label} →
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="glass-card mt-8 p-6">
          <h2 className="text-lg font-semibold">Source Files</h2>
          <p className="mt-2 text-sm text-muted">
            Full markdown documentation lives in the{" "}
            <code className="rounded bg-background px-1.5 py-0.5 text-xs">
              docs/
            </code>{" "}
            folder at the project root. These guides are also available as
            browsable pages below.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
