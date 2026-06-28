import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { getPlatformPostType } from "@/lib/data/platform-post-types";
import { getProductDir, readFile as readProductFile } from "@/lib/storage/product-storage";

export type PublishStatus = "published" | "scheduled" | "needs_connection" | "failed";

export interface PublishRequest {
  brandId: string;
  productId: string;
  genId: string;
  platformPostTypeId: string;
  /** Absolute, publicly reachable image URL (required for real platform APIs) */
  imageUrl: string;
  caption: string;
  hashtags?: string;
  scheduledAt?: string | null;
}

export interface PublishResult {
  status: PublishStatus;
  provider: string;
  externalId?: string;
  externalUrl?: string;
  message: string;
}

export interface PublishRecord extends PublishResult {
  id: string;
  createdAt: string;
  platformPostTypeId: string;
  genId: string;
  caption: string;
  scheduledAt?: string | null;
}

const GRAPH_VERSION = "v21.0";

function isPubliclyReachable(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local") ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.startsWith("172.16.")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function buildCaption(req: PublishRequest): string {
  const tags = req.hashtags?.trim();
  return tags ? `${req.caption.trim()}\n\n${tags}` : req.caption.trim();
}

/**
 * Load the raw image bytes for a generation. Prefers reading directly from disk
 * (works on localhost — no public URL needed), falling back to fetching the URL.
 */
async function getImageBytes(
  req: PublishRequest
): Promise<{ buffer: Buffer; contentType: string }> {
  try {
    const buffer = await readProductFile(
      req.brandId,
      req.productId,
      "generated",
      `${req.genId}.png`
    );
    return { buffer, contentType: "image/png" };
  } catch {
    const res = await fetch(req.imageUrl);
    if (!res.ok) throw new Error("Could not load the generated image bytes.");
    const ab = await res.arrayBuffer();
    return {
      buffer: Buffer.from(ab),
      contentType: res.headers.get("content-type") || "image/png",
    };
  }
}

/** Instagram Graph API — create media container then publish. Requires a public image URL. */
async function publishToInstagram(req: PublishRequest): Promise<PublishResult> {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  const igUserId = process.env.META_IG_USER_ID?.trim();
  const provider = "Instagram";

  if (!token || !igUserId) {
    return {
      status: "needs_connection",
      provider,
      message:
        "Connect Instagram to publish — set META_ACCESS_TOKEN and META_IG_USER_ID in .env.local (Instagram Graph API).",
    };
  }
  if (!isPubliclyReachable(req.imageUrl)) {
    return {
      status: "failed",
      provider,
      message:
        "Instagram needs a publicly reachable image URL. Deploy the app or expose a public URL (e.g. tunnel) — localhost is not fetchable by Meta.",
    };
  }

  try {
    const createUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media`);
    createUrl.searchParams.set("image_url", req.imageUrl);
    createUrl.searchParams.set("caption", buildCaption(req));
    createUrl.searchParams.set("access_token", token);

    const createRes = await fetch(createUrl, { method: "POST" });
    const createJson = (await createRes.json()) as { id?: string; error?: { message?: string } };
    if (!createRes.ok || !createJson.id) {
      return { status: "failed", provider, message: createJson.error?.message ?? "Failed to create media container" };
    }

    const publishUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media_publish`);
    publishUrl.searchParams.set("creation_id", createJson.id);
    publishUrl.searchParams.set("access_token", token);

    const pubRes = await fetch(publishUrl, { method: "POST" });
    const pubJson = (await pubRes.json()) as { id?: string; error?: { message?: string } };
    if (!pubRes.ok || !pubJson.id) {
      return { status: "failed", provider, message: pubJson.error?.message ?? "Failed to publish media" };
    }

    return {
      status: "published",
      provider,
      externalId: pubJson.id,
      externalUrl: `https://www.instagram.com/`,
      message: "Published to Instagram",
    };
  } catch (err) {
    return { status: "failed", provider, message: err instanceof Error ? err.message : "Instagram publish failed" };
  }
}

/** Facebook Page photo post. Requires a public image URL. */
async function publishToFacebook(req: PublishRequest): Promise<PublishResult> {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  const pageId = process.env.META_FB_PAGE_ID?.trim();
  const provider = "Facebook";

  if (!token || !pageId) {
    return {
      status: "needs_connection",
      provider,
      message: "Connect Facebook to publish — set META_ACCESS_TOKEN and META_FB_PAGE_ID in .env.local.",
    };
  }
  if (!isPubliclyReachable(req.imageUrl)) {
    return {
      status: "failed",
      provider,
      message: "Facebook needs a publicly reachable image URL — localhost is not fetchable by Meta.",
    };
  }

  try {
    const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos`);
    url.searchParams.set("url", req.imageUrl);
    url.searchParams.set("caption", buildCaption(req));
    url.searchParams.set("access_token", token);

    const res = await fetch(url, { method: "POST" });
    const json = (await res.json()) as { id?: string; post_id?: string; error?: { message?: string } };
    if (!res.ok || !(json.id || json.post_id)) {
      return { status: "failed", provider, message: json.error?.message ?? "Failed to post to Facebook" };
    }
    return {
      status: "published",
      provider,
      externalId: json.post_id ?? json.id,
      message: "Published to Facebook Page",
    };
  } catch (err) {
    return { status: "failed", provider, message: err instanceof Error ? err.message : "Facebook publish failed" };
  }
}

/** Pinterest Pins API (v5). Uploads the image inline as base64 — works on localhost. */
async function publishToPinterest(req: PublishRequest): Promise<PublishResult> {
  const token = process.env.PINTEREST_ACCESS_TOKEN?.trim();
  const boardId = process.env.PINTEREST_BOARD_ID?.trim();
  const provider = "Pinterest";

  if (!token || !boardId) {
    return {
      status: "needs_connection",
      provider,
      message:
        "Connect Pinterest to publish — set PINTEREST_ACCESS_TOKEN and PINTEREST_BOARD_ID in .env.local (Pinterest API v5).",
    };
  }

  try {
    const { buffer, contentType } = await getImageBytes(req);
    const res = await fetch("https://api.pinterest.com/v5/pins", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        board_id: boardId,
        title: req.caption.split("\n")[0]?.slice(0, 100) || "New design",
        description: buildCaption(req).slice(0, 800),
        media_source: {
          source_type: "image_base64",
          content_type: contentType,
          data: buffer.toString("base64"),
        },
      }),
    });
    const json = (await res.json()) as { id?: string; message?: string };
    if (!res.ok || !json.id) {
      return { status: "failed", provider, message: json.message ?? "Failed to create Pin" };
    }
    return {
      status: "published",
      provider,
      externalId: json.id,
      externalUrl: `https://www.pinterest.com/pin/${json.id}/`,
      message: "Published to Pinterest",
    };
  } catch (err) {
    return { status: "failed", provider, message: err instanceof Error ? err.message : "Pinterest publish failed" };
  }
}

/** LinkedIn UGC post with image. registerUpload → binary upload → ugcPosts. Works on localhost. */
async function publishToLinkedIn(req: PublishRequest): Promise<PublishResult> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN?.trim();
  const authorUrn = process.env.LINKEDIN_AUTHOR_URN?.trim(); // e.g. urn:li:person:xxxx or urn:li:organization:xxxx
  const provider = "LinkedIn";

  if (!token || !authorUrn) {
    return {
      status: "needs_connection",
      provider,
      message:
        "Connect LinkedIn to publish — set LINKEDIN_ACCESS_TOKEN and LINKEDIN_AUTHOR_URN (urn:li:person:… or urn:li:organization:…) in .env.local.",
    };
  }

  const baseHeaders = {
    Authorization: `Bearer ${token}`,
    "X-Restli-Protocol-Version": "2.0.0",
  };

  try {
    // 1) register upload
    const registerRes = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
      method: "POST",
      headers: { ...baseHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: authorUrn,
          serviceRelationships: [
            { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" },
          ],
        },
      }),
    });
    const registerJson = (await registerRes.json()) as {
      value?: {
        asset?: string;
        uploadMechanism?: {
          "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"?: { uploadUrl?: string };
        };
      };
      message?: string;
    };
    const uploadUrl =
      registerJson.value?.uploadMechanism?.[
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
      ]?.uploadUrl;
    const asset = registerJson.value?.asset;
    if (!registerRes.ok || !uploadUrl || !asset) {
      return { status: "failed", provider, message: registerJson.message ?? "Failed to register LinkedIn upload" };
    }

    // 2) upload binary
    const { buffer, contentType } = await getImageBytes(req);
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
      body: new Uint8Array(buffer),
    });
    if (!uploadRes.ok) {
      return { status: "failed", provider, message: `Image upload to LinkedIn failed (${uploadRes.status})` };
    }

    // 3) create post
    const postRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: { ...baseHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        author: authorUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: buildCaption(req) },
            shareMediaCategory: "IMAGE",
            media: [{ status: "READY", media: asset }],
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });
    const postJson = (await postRes.json()) as { id?: string; message?: string };
    if (!postRes.ok || !postJson.id) {
      return { status: "failed", provider, message: postJson.message ?? "Failed to create LinkedIn post" };
    }
    return {
      status: "published",
      provider,
      externalId: postJson.id,
      externalUrl: `https://www.linkedin.com/feed/update/${postJson.id}/`,
      message: "Published to LinkedIn",
    };
  } catch (err) {
    return { status: "failed", provider, message: err instanceof Error ? err.message : "LinkedIn publish failed" };
  }
}

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!*'()]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/** Build an OAuth 1.0a Authorization header (HMAC-SHA1) for X/Twitter user-context requests. */
function oauth1Header(
  method: string,
  url: string,
  creds: { apiKey: string; apiSecret: string; accessToken: string; accessSecret: string },
  extraParams: Record<string, string> = {}
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };

  const allParams = { ...oauthParams, ...extraParams };
  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join("&");

  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString),
  ].join("&");

  const signingKey = `${percentEncode(creds.apiSecret)}&${percentEncode(creds.accessSecret)}`;
  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");

  const headerParams: Record<string, string> = { ...oauthParams, oauth_signature: signature };
  return (
    "OAuth " +
    Object.keys(headerParams)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(headerParams[k])}"`)
      .join(", ")
  );
}

/** X / Twitter: upload media (v1.1, OAuth1.0a) then create a tweet (v2). */
async function publishToTwitter(req: PublishRequest): Promise<PublishResult> {
  const creds = {
    apiKey: process.env.TWITTER_API_KEY?.trim() ?? "",
    apiSecret: process.env.TWITTER_API_SECRET?.trim() ?? "",
    accessToken: process.env.TWITTER_ACCESS_TOKEN?.trim() ?? "",
    accessSecret: process.env.TWITTER_ACCESS_SECRET?.trim() ?? "",
  };
  const provider = "Twitter / X";

  if (!creds.apiKey || !creds.apiSecret || !creds.accessToken || !creds.accessSecret) {
    return {
      status: "needs_connection",
      provider,
      message:
        "Connect X to publish — set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN and TWITTER_ACCESS_SECRET (OAuth 1.0a) in .env.local.",
    };
  }

  try {
    // Re-encode to JPEG <=2048px to stay under the 5MB media limit.
    const { buffer } = await getImageBytes(req);
    const jpeg = await sharp(buffer)
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    const mediaB64 = jpeg.toString("base64");

    // 1) media upload (v1.1, form-urlencoded so media_data is signed)
    const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json";
    const uploadAuth = oauth1Header("POST", uploadUrl, creds, { media_data: mediaB64 });
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: { Authorization: uploadAuth, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ media_data: mediaB64 }).toString(),
    });
    const uploadJson = (await uploadRes.json()) as {
      media_id_string?: string;
      errors?: { message?: string }[];
    };
    if (!uploadRes.ok || !uploadJson.media_id_string) {
      return {
        status: "failed",
        provider,
        message: uploadJson.errors?.[0]?.message ?? "Failed to upload media to X",
      };
    }

    // 2) create tweet (v2, JSON body — body is not part of the OAuth signature)
    const tweetUrl = "https://api.twitter.com/2/tweets";
    const tweetAuth = oauth1Header("POST", tweetUrl, creds);
    const tweetRes = await fetch(tweetUrl, {
      method: "POST",
      headers: { Authorization: tweetAuth, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: buildCaption(req).slice(0, 280),
        media: { media_ids: [uploadJson.media_id_string] },
      }),
    });
    const tweetJson = (await tweetRes.json()) as {
      data?: { id?: string };
      detail?: string;
      title?: string;
    };
    if (!tweetRes.ok || !tweetJson.data?.id) {
      return { status: "failed", provider, message: tweetJson.detail ?? tweetJson.title ?? "Failed to post to X" };
    }
    return {
      status: "published",
      provider,
      externalId: tweetJson.data.id,
      externalUrl: `https://x.com/i/web/status/${tweetJson.data.id}`,
      message: "Published to X",
    };
  } catch (err) {
    return { status: "failed", provider, message: err instanceof Error ? err.message : "X publish failed" };
  }
}

/** Export-only destinations (no public publish API) — the image is ready to use/download. */
function exportReady(provider: string): PublishResult {
  return {
    status: "published",
    provider,
    message: `Image exported and ready for ${provider}. Download it and upload to your ${provider} destination — no direct publish API is available for this channel.`,
  };
}

/** Platforms without a wired integration yet — record the intent and ask the user to connect. */
function notConnected(provider: string): PublishResult {
  return {
    status: "needs_connection",
    provider,
    message: `${provider} publishing isn't connected yet. The image is exported and ready — connect ${provider} to publish automatically.`,
  };
}

async function dispatch(req: PublishRequest): Promise<PublishResult> {
  const platform = getPlatformPostType(req.platformPostTypeId);
  const group = platform?.platformGroup ?? "Unknown";

  switch (group) {
    case "Instagram":
      return publishToInstagram(req);
    case "Facebook":
      return publishToFacebook(req);
    case "Pinterest":
      return publishToPinterest(req);
    case "LinkedIn":
      return publishToLinkedIn(req);
    case "Twitter / X":
      return publishToTwitter(req);
    // Channels with no public image-post API — exported and ready to use.
    case "Website":
    case "Amazon":
    case "Shopify":
    case "Print":
    case "Outdoor":
    case "Email":
    case "Mobile":
    case "YouTube":
      return exportReady(group);
    default:
      return notConnected(group);
  }
}

async function appendPublishRecord(
  brandId: string,
  productId: string,
  record: PublishRecord
): Promise<void> {
  const file = path.join(getProductDir(brandId, productId), "publishes.json");
  let list: PublishRecord[] = [];
  try {
    list = JSON.parse(await fs.readFile(file, "utf-8")) as PublishRecord[];
  } catch {
    // new file
  }
  list.unshift(record);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(list, null, 2));
}

export async function listPublishRecords(
  brandId: string,
  productId: string
): Promise<PublishRecord[]> {
  const file = path.join(getProductDir(brandId, productId), "publishes.json");
  try {
    return JSON.parse(await fs.readFile(file, "utf-8")) as PublishRecord[];
  } catch {
    return [];
  }
}

export async function runPublish(req: PublishRequest): Promise<PublishRecord> {
  let result: PublishResult;

  if (req.scheduledAt && new Date(req.scheduledAt).getTime() > Date.now()) {
    const platform = getPlatformPostType(req.platformPostTypeId);
    result = {
      status: "scheduled",
      provider: platform?.platformGroup ?? "Platform",
      message: `Scheduled for ${new Date(req.scheduledAt).toLocaleString()}`,
    };
  } else {
    result = await dispatch(req);
  }

  const record: PublishRecord = {
    ...result,
    id: `pub_${Date.now()}`,
    createdAt: new Date().toISOString(),
    platformPostTypeId: req.platformPostTypeId,
    genId: req.genId,
    caption: buildCaption(req),
    scheduledAt: req.scheduledAt ?? null,
  };

  await appendPublishRecord(req.brandId, req.productId, record);
  return record;
}
