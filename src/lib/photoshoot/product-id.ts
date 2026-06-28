/** Extract productId from /api/files/{brandId}/{productId}/raw|generated/... URLs */
export function extractProductIdFromFileUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/api\/files\/[A-Za-z0-9_-]+\/([A-Za-z0-9_-]+)\/(?:raw|generated)\//);
  return match?.[1] ?? null;
}
