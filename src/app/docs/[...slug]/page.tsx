import fs from "fs";
import path from "path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

const DOCS_DIR = path.join(process.cwd(), "docs");

function slugToPath(slug: string[]): string | null {
  const filePath = path.join(DOCS_DIR, ...slug) + ".md";
  if (fs.existsSync(filePath)) return filePath;
  return null;
}

function simpleMarkdownToHtml(md: string): string {
  return md
    .replace(/^### (.*$)/gim, "<h3 class='text-lg font-semibold mt-6 mb-2'>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2 class='text-xl font-semibold mt-8 mb-3'>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1 class='text-2xl font-semibold mb-4'>$1</h1>")
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/gim, "<em>$1</em>")
    .replace(/^- (.*$)/gim, "<li class='ml-4 list-disc'>$1</li>")
    .replace(/^\d+\. (.*$)/gim, "<li class='ml-4 list-decimal'>$1</li>")
    .replace(/`(.*?)`/gim, "<code class='rounded bg-background px-1.5 py-0.5 text-xs'>$1</code>")
    .replace(/\n\n/gim, "</p><p class='mb-4 text-sm leading-relaxed text-muted'>")
    .replace(/^(?!<[hluop])/gim, (line) =>
      line.startsWith("<") ? line : `<p class='mb-4 text-sm leading-relaxed text-muted'>${line}`
    );
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const filePath = slugToPath(slug);
  if (!filePath) notFound();

  const content = fs.readFileSync(filePath, "utf-8");
  const html = simpleMarkdownToHtml(content);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl p-8">
        <Link
          href="/docs"
          className="mb-6 inline-block text-sm text-accent hover:underline"
        >
          ← Back to Documentation
        </Link>
        <article
          className="prose-invert"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </DashboardLayout>
  );
}

export function generateStaticParams() {
  const slugs: { slug: string[] }[] = [];

  function walk(dir: string, prefix: string[] = []) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), [...prefix, entry.name]);
      } else if (entry.name.endsWith(".md") && entry.name !== "README.md") {
        slugs.push({
          slug: [...prefix, entry.name.replace(/\.md$/, "")],
        });
      }
    }
  }

  walk(DOCS_DIR);
  return slugs;
}
