import { NextResponse } from "next/server";
import { CursorAgentError } from "@cursor/sdk";
import { generateAssetBriefs, isCursorConfigured } from "@/lib/cursor-server";
import type { BusinessDNA, ImageViewId, PlatformPostTypeId, SceneId } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 120;

interface GenerateRequestBody {
  type: "photoshoot" | "campaign";
  brandName?: string;
  productName?: string;
  productCategory?: string;
  productDescription?: string;
  platformPostTypeIds: PlatformPostTypeId[];
  viewIds?: ImageViewId[];
  sceneIds?: SceneId[];
  businessDNA: BusinessDNA;
}

export async function POST(req: Request) {
  if (!isCursorConfigured()) {
    return NextResponse.json(
      {
        error:
          "CURSOR_API_KEY is not configured. Add it to .env.local — get a key at cursor.com/dashboard/integrations",
      },
      { status: 503 }
    );
  }

  let body: GenerateRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    type,
    brandName,
    productName,
    productCategory,
    productDescription,
    platformPostTypeIds,
    viewIds,
    sceneIds,
    businessDNA,
  } = body;

  if (!type || !platformPostTypeIds?.length || !businessDNA) {
    return NextResponse.json(
      { error: "type, platformPostTypeIds, and businessDNA are required" },
      { status: 400 }
    );
  }

  try {
    const content = await generateAssetBriefs({
      type,
      brandName,
      productName,
      productCategory,
      productDescription,
      platformPostTypeIds,
      viewIds,
      sceneIds,
      businessDNA,
    });

    return NextResponse.json({ content });
  } catch (err) {
    const message =
      err instanceof CursorAgentError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
