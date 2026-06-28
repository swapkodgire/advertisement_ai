import { NextResponse } from "next/server";
import { runComposePhotoshootPlan } from "@/lib/photoshoot/generate";
import type { BusinessDNA, ImageViewId, PlatformPostTypeId, SceneId } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      brandName,
      productName,
      productCategory,
      productDescription,
      businessDNA,
      platformPostTypeId,
      viewId,
      sceneId,
    } = body;

    if (
      !platformPostTypeId ||
      !viewId ||
      !sceneId ||
      !businessDNA
    ) {
      return NextResponse.json(
        { error: "Missing wizard inputs for agent plan" },
        { status: 400 }
      );
    }

    const plan = await runComposePhotoshootPlan({
      brandName: brandName ?? "Brand",
      productName: productName ?? "Product",
      productCategory: productCategory ?? "Other",
      productDescription: productDescription ?? "",
      businessDNA: businessDNA as BusinessDNA,
      platformPostTypeId: platformPostTypeId as PlatformPostTypeId,
      viewId: viewId as ImageViewId,
      sceneId: sceneId as SceneId,
    });

    return NextResponse.json(plan);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent plan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
