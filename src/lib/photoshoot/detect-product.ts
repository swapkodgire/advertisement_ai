import fs from "fs/promises";
import path from "path";
import { Agent } from "@cursor/sdk";
import {
  buildDetectionPromptCatalog,
  getCategoryForType,
  getProductTypeLabel,
  isValidProductType,
} from "@/lib/data/product-taxonomy";
import { findOriginalImagePath } from "@/lib/photoshoot/generate";
import { getAgentOptions, isCursorConfigured } from "@/lib/cursor-server";
import type { ProductCategoryId, ProductProfile, ProductTypeId } from "@/types";

const DETECTION_INSTRUCTIONS = `You are a product classification expert for e-commerce photoshoots.

Analyze the attached product photo and classify it into exactly ONE category and ONE type from this catalog:

${buildDetectionPromptCatalog()}

Rules:
- Pick the closest match even if uncertain
- eyewear = prescription/optical frames without heavy tint
- sunglasses = tinted lenses for sun protection
- bags = handbags, totes, backpacks with handles/straps
- pouches = small zippered or drawstring pouches
- eyewear_accessories = cases, chains, cleaning kits, clip-ons
- eye_lens = contact lenses or lens packs (not frames)

Return JSON only, no markdown:
{
  "categoryId": "<category id>",
  "typeId": "<type id>",
  "confidence": <0.0 to 1.0>,
  "label": "<short human label, e.g. Classic Sunglasses>",
  "reasoning": "<one sentence>"
}`;

export interface DetectionResult {
  categoryId: ProductCategoryId;
  typeId: ProductTypeId;
  confidence: number;
  label: string;
  source: ProductProfile["source"];
}

function defaultDetection(): DetectionResult {
  return {
    categoryId: "eyewear",
    typeId: "optical_frames",
    confidence: 0,
    label: "Optical Frames",
    source: "default",
  };
}

function parseDetectionJson(text: string): Partial<DetectionResult> | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as Partial<DetectionResult>;
  } catch {
    return null;
  }
}

function normalizeDetection(raw: Partial<DetectionResult>): DetectionResult | null {
  const categoryId = raw.categoryId as ProductCategoryId | undefined;
  const typeId = raw.typeId as ProductTypeId | undefined;
  if (!categoryId || !typeId || !isValidProductType(categoryId, typeId)) {
    const inferredCategory = typeId ? getCategoryForType(typeId) : undefined;
    if (inferredCategory && typeId && isValidProductType(inferredCategory, typeId)) {
      return {
        categoryId: inferredCategory,
        typeId,
        confidence: Math.min(1, Math.max(0, Number(raw.confidence) || 0.5)),
        label: raw.label?.trim() || getProductTypeLabel(typeId),
        source: "auto",
      };
    }
    return null;
  }
  return {
    categoryId,
    typeId,
    confidence: Math.min(1, Math.max(0, Number(raw.confidence) || 0.5)),
    label: raw.label?.trim() || getProductTypeLabel(typeId),
    source: "auto",
  };
}

export async function detectProductFromImage(
  brandId: string,
  productId: string
): Promise<DetectionResult> {
  if (!isCursorConfigured()) {
    return defaultDetection();
  }

  const imagePath = await findOriginalImagePath(brandId, productId);
  if (!imagePath) {
    return defaultDetection();
  }

  const buffer = await fs.readFile(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType =
    ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
        ? "image/webp"
        : "image/png";

  const agent = await Agent.create({
    ...getAgentOptions(),
    name: "Product Classifier",
  });

  try {
    const run = await agent.send({
      text: DETECTION_INSTRUCTIONS,
      images: [{ data: buffer.toString("base64"), mimeType }],
    });

    let responseText = "";
    for await (const event of run.stream()) {
      if (event.type === "assistant") {
        for (const block of event.message.content) {
          if (block.type === "text" && block.text) {
            responseText = block.text;
          }
        }
      }
    }

    const result = await run.wait();
    if (result.status === "error") {
      return defaultDetection();
    }

    const parsed = normalizeDetection(parseDetectionJson(responseText) ?? {});
    return parsed ?? defaultDetection();
  } catch {
    return defaultDetection();
  } finally {
    await agent.close();
  }
}

export function toProductProfile(result: DetectionResult): ProductProfile {
  return {
    categoryId: result.categoryId,
    typeId: result.typeId,
    confidence: result.confidence,
    source: result.source,
    label: result.label,
    detectedAt: new Date().toISOString(),
  };
}
