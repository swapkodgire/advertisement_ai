import fs from "fs/promises";
import path from "path";
import { removeBackground } from "@imgly/background-removal-node";

/**
 * Pixel-faithful background removal.
 *
 * Unlike a generative model, this computes an alpha mask and applies it to the
 * ORIGINAL image pixels — the product's shape, colors, logos, and proportions
 * are never redrawn or modified. Runs fully locally (model assets are bundled
 * in the package's dist folder), so it needs no API key and no network.
 */

const DIST_DIR = path.join(
  process.cwd(),
  "node_modules",
  "@imgly",
  "background-removal-node",
  "dist"
);

// file:// base so the bundled ONNX model + resources load offline
const PUBLIC_PATH = `file://${DIST_DIR}/`;

export async function removeBackgroundLocal(inputPath: string): Promise<Buffer> {
  const inputBuffer = await fs.readFile(inputPath);

  // Typed blob so the library's decoder (sharp) auto-detects the source format
  // (png/jpeg/webp). A bare Uint8Array has no mime and is rejected.
  const inputBlob = new Blob([new Uint8Array(inputBuffer)], {
    type: "application/octet-stream",
  });

  const resultBlob = await removeBackground(inputBlob, {
    publicPath: PUBLIC_PATH,
    proxyToWorker: false,
    model: "medium",
    output: { format: "image/png", quality: 1 },
  });

  const arrayBuffer = await resultBlob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
