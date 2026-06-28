import { NextResponse } from "next/server";
import { runPhotoshootGeneration } from "@/lib/photoshoot/generate";
import { isSafeSegment } from "@/lib/storage/product-storage";
import type { BusinessDNA, ImageViewId, PlatformPostTypeId, SceneId } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 600;

interface GenerateBody {
  brandId: string;
  productId: string;
  brandName?: string;
  productName?: string;
  productCategory?: string;
  productDescription?: string;
  businessDNA: BusinessDNA;
  platformPostTypeId: PlatformPostTypeId;
  viewId: ImageViewId;
  sceneId: SceneId;
  stream?: boolean;
  /** standard = full Cursor pipeline; pro = single-shot Cursor scene transform */
  pipelineMode?: "standard" | "pro";
}

function validateBody(body: GenerateBody) {
  const {
    brandId,
    productId,
    platformPostTypeId,
    viewId,
    sceneId,
    businessDNA,
  } = body;

  if (
    !brandId ||
    !productId ||
    !platformPostTypeId ||
    !viewId ||
    !sceneId ||
    !businessDNA ||
    !isSafeSegment(brandId) ||
    !isSafeSegment(productId)
  ) {
    return "Missing required fields for generation";
  }
  return null;
}

function buildInput(body: GenerateBody) {
  return {
    brandId: body.brandId,
    productId: body.productId,
    brandName: body.brandName ?? "Brand",
    productName: body.productName ?? "Product",
    productCategory: body.productCategory ?? "Other",
    productDescription: body.productDescription ?? "",
    businessDNA: body.businessDNA as BusinessDNA,
    platformPostTypeId: body.platformPostTypeId as PlatformPostTypeId,
    viewId: body.viewId as ImageViewId,
    sceneId: body.sceneId as SceneId,
    pipelineMode: body.pipelineMode ?? "standard",
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateBody;
    const validationError = validateBody(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const input = buildInput(body);

    if (body.stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const send = (data: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          try {
            const result = await runPhotoshootGeneration({
              ...input,
              onProgress: (event) => send({ type: "progress", ...event }),
            });

            send({
              type: "done",
              id: result.id,
              url: result.url,
              meta: result.meta,
              genId: result.id,
              sceneBgFilename: result.sceneBgFilename,
              agentPlan: result.agentPlan,
              usedAI: result.usedAI,
              method: result.method,
              message: result.message,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : "Generation failed";
            send({ type: "error", error: message });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const result = await runPhotoshootGeneration(input);

    return NextResponse.json({
      id: result.id,
      url: result.url,
      meta: result.meta,
      agentPlan: result.agentPlan,
      usedAI: result.usedAI,
      method: result.method,
      message: result.message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
