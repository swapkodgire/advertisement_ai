import { NextResponse } from "next/server";
import { generatePostContent, type ContentTarget } from "@/lib/publish/content-service";
import { isCursorConfigured } from "@/lib/cursor-server";
import type { BusinessDNA } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 120;

interface ContentBody {
  platformPostTypeId: string;
  brandName: string;
  productName: string;
  productCategory?: string;
  productDescription?: string;
  sceneLabel?: string;
  viewLabel?: string;
  tone?: string;
  existingCaption?: string;
  target?: ContentTarget;
  businessDNA?: BusinessDNA;
}

export async function POST(req: Request) {
  if (!isCursorConfigured()) {
    return NextResponse.json(
      { error: "CURSOR_API_KEY is required to generate captions and hashtags." },
      { status: 400 }
    );
  }

  try {
    const body = (await req.json()) as ContentBody;

    if (!body.platformPostTypeId || !body.productName) {
      return NextResponse.json(
        { error: "platformPostTypeId and productName are required" },
        { status: 400 }
      );
    }

    const content = await generatePostContent({
      platformPostTypeId: body.platformPostTypeId,
      brandName: body.brandName || "Brand",
      productName: body.productName,
      productCategory: body.productCategory,
      productDescription: body.productDescription,
      sceneLabel: body.sceneLabel,
      viewLabel: body.viewLabel,
      tone: body.tone,
      existingCaption: body.existingCaption,
      target: body.target ?? "all",
      businessDNA: body.businessDNA,
    });

    return NextResponse.json({ content });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Content generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
