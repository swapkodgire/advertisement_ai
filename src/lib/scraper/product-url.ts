import * as cheerio from "cheerio";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

function extFromContentType(contentType: string | null, fallbackUrl?: string): string {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("avif")) return "avif";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  // fall back to the URL extension
  if (fallbackUrl) {
    const m = fallbackUrl.split("?")[0].match(/\.(png|webp|avif|gif|jpe?g)$/i);
    if (m) return m[1].toLowerCase() === "jpeg" ? "jpg" : m[1].toLowerCase();
  }
  return "jpg";
}

function looksLikeImageUrl(url: string): boolean {
  return /\.(png|webp|avif|gif|jpe?g)(\?|#|$)/i.test(url);
}

/** Collect the best candidate product image URLs from an HTML document, best-first. */
function collectImageCandidates($: ReturnType<typeof cheerio.load>, pageUrl: string): string[] {
  const candidates: string[] = [];
  const push = (val?: string | null) => {
    if (val && val.trim()) candidates.push(val.trim());
  };

  push($('meta[property="og:image:secure_url"]').attr("content"));
  push($('meta[property="og:image"]').attr("content"));
  push($('meta[name="og:image"]').attr("content"));
  push($('meta[name="twitter:image"]').attr("content"));
  push($('meta[name="twitter:image:src"]').attr("content"));
  push($('link[rel="image_src"]').attr("href"));

  // JSON-LD Product schema
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() ?? "");
      const items = Array.isArray(json) ? json : [json];
      for (const item of items) {
        const graph = item["@graph"] ? item["@graph"] : [item];
        for (const node of graph) {
          if (node?.image) {
            const img = node.image;
            if (typeof img === "string") push(img);
            else if (Array.isArray(img)) push(typeof img[0] === "string" ? img[0] : img[0]?.url);
            else if (img.url) push(img.url);
          }
        }
      }
    } catch {
      // skip invalid JSON-LD
    }
  });

  // Largest visible <img> (use width hints, else first reasonable image)
  let bestImg: { url: string; score: number } | null = null;
  $("img").each((_, el) => {
    const src =
      $(el).attr("src") ||
      $(el).attr("data-src") ||
      $(el).attr("data-original") ||
      ($(el).attr("srcset")?.split(",").pop()?.trim().split(" ")[0] ?? "");
    if (!src || src.startsWith("data:")) return;
    const w = parseInt($(el).attr("width") || "0", 10) || 0;
    const h = parseInt($(el).attr("height") || "0", 10) || 0;
    const score = w * h || (looksLikeImageUrl(src) ? 1 : 0);
    if (score > 0 && (!bestImg || score > bestImg.score)) {
      bestImg = { url: src, score };
    }
  });
  if (bestImg) push((bestImg as { url: string }).url);

  // Resolve to absolute + dedupe
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of candidates) {
    try {
      const abs = new URL(c, pageUrl).href;
      if (!seen.has(abs)) {
        seen.add(abs);
        out.push(abs);
      }
    } catch {
      // ignore malformed
    }
  }
  return out;
}

export async function downloadImage(url: string): Promise<{ buffer: Buffer; ext: string }> {
  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Failed to download image (${res.status})`);

  const contentType = res.headers.get("content-type");
  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength === 0) throw new Error("Downloaded image was empty");
  return { buffer: Buffer.from(arrayBuffer), ext: extFromContentType(contentType, url) };
}

export interface ResolvedProductImage {
  buffer: Buffer;
  ext: string;
  imageUrl: string;
  title?: string;
  description?: string;
}

/**
 * Resolve a product image from any URL — a direct image link OR a product page.
 * Handles bot-blocking, missing og:image, lazy-loaded images, and JSON-LD.
 */
export async function resolveProductImage(pageUrl: string): Promise<ResolvedProductImage> {
  let res: Response;
  try {
    res = await fetch(pageUrl, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error("The site took too long to respond. Try a direct image URL or upload the file.");
    }
    throw new Error("Could not reach that URL. Check the link, or upload the image instead.");
  }

  if (!res.ok) {
    if (res.status === 403 || res.status === 401 || res.status === 429) {
      throw new Error(
        `The site blocked automated access (${res.status}). Right-click the product image, copy its direct image address, and paste that — or upload the file.`
      );
    }
    throw new Error(`Failed to fetch URL (${res.status})`);
  }

  const contentType = res.headers.get("content-type") ?? "";

  // Direct image URL — we already have the bytes.
  if (contentType.startsWith("image/")) {
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength === 0) throw new Error("That image URL returned no data.");
    return {
      buffer: Buffer.from(arrayBuffer),
      ext: extFromContentType(contentType, pageUrl),
      imageUrl: pageUrl,
    };
  }

  // Otherwise parse the HTML page for image candidates.
  const html = await res.text();
  const $ = cheerio.load(html);

  const title =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").text().trim() ||
    undefined;
  const description =
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    undefined;

  const candidates = collectImageCandidates($, pageUrl);
  if (candidates.length === 0) {
    throw new Error(
      "No product image found on that page. Paste a direct image URL (ending in .jpg/.png/.webp) or upload the file."
    );
  }

  let lastErr: unknown;
  for (const candidate of candidates) {
    try {
      const { buffer, ext } = await downloadImage(candidate);
      return { buffer, ext, imageUrl: candidate, title, description };
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(
    lastErr instanceof Error
      ? `Found an image but couldn't download it: ${lastErr.message}`
      : "Found an image but couldn't download it."
  );
}

/** @deprecated use resolveProductImage — kept for compatibility */
export async function extractProductImageFromUrl(pageUrl: string): Promise<{
  imageUrl: string;
  title?: string;
  description?: string;
}> {
  const r = await resolveProductImage(pageUrl);
  return { imageUrl: r.imageUrl, title: r.title, description: r.description };
}
