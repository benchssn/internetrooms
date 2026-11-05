import { putAsset, type AssetSummary } from "./assetStore";

/** Formats we accept from the user's computer. SVG is never accepted. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Uploads larger than this (in either dimension) are scaled down. */
export const MAX_IMAGE_DIMENSION = 2048;

export type ValidationResult =
  | { ok: true; type: AcceptedImageType }
  | { ok: false; reason: string };

/**
 * Identifies an image by its first bytes ("magic numbers") rather than
 * trusting the file name or the browser-reported type.
 */
export function sniffImageType(bytes: Uint8Array): AcceptedImageType | null {
  const starts = (sig: number[], offset = 0) =>
    sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}

function formatMb(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

export async function validateImageFile(file: Blob): Promise<ValidationResult> {
  if (file.size === 0) return { ok: false, reason: "That file is empty." };
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      reason: `That image is too large. Please choose one under ${formatMb(MAX_UPLOAD_BYTES)}.`,
    };
  }
  if (file.type === "image/svg+xml" || file.type.includes("svg")) {
    return {
      ok: false,
      reason: "SVG files can contain code, so they can't be uploaded. Please use PNG, JPEG, GIF or WebP.",
    };
  }
  if (file.type && !(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, reason: "Please choose a PNG, JPEG, GIF or WebP image." };
  }

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const sniffed = sniffImageType(head);
  if (!sniffed) {
    return {
      ok: false,
      reason: "That file doesn't look like a PNG, JPEG, GIF or WebP image.",
    };
  }
  if (file.type && file.type !== sniffed) {
    return {
      ok: false,
      reason: "That file's contents don't match its type, so it wasn't uploaded.",
    };
  }
  return { ok: true, type: sniffed };
}

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Decodes the image and re-encodes it from raw pixels. This strips
 * metadata (including camera GPS data) and anything that isn't image data,
 * and scales very large images down. Animated GIFs become still images.
 */
export async function processImage(file: Blob): Promise<ProcessedImage> {
  if (typeof createImageBitmap !== "function") {
    throw new Error("This browser can't process images.");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That image couldn't be opened. It may be damaged.");
  }
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't process images.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob =
    (await canvasToBlob(canvas, "image/webp", 0.9)) ??
    (await canvasToBlob(canvas, "image/png", 1));
  if (!blob) throw new Error("That image couldn't be converted.");
  return { blob, width, height };
}

/**
 * The decoder used by uploads. Kept on an object so tests (and any future
 * worker-based implementation) can swap it without changing callers.
 */
export const imageProcessor = {
  process: processImage,
};

export function createAssetId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `asset-${Date.now().toString(36)}-${random}`;
}

export type UploadResult =
  | { ok: true; asset: AssetSummary }
  | { ok: false; reason: string };

/**
 * Validates, converts and stores an uploaded image. The original file
 * (and its name or path) is never stored.
 */
export async function uploadImage(
  file: Blob,
  process: (file: Blob) => Promise<ProcessedImage> = (f) => imageProcessor.process(f),
): Promise<UploadResult> {
  const check = await validateImageFile(file);
  if (!check.ok) return check;

  let processed: ProcessedImage;
  try {
    processed = await process(file);
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "That image couldn't be processed.",
    };
  }

  const asset = {
    id: createAssetId(),
    blob: processed.blob,
    type: processed.blob.type || "image/png",
    width: processed.width,
    height: processed.height,
    size: processed.blob.size,
    createdAt: new Date().toISOString(),
  };
  try {
    await putAsset(asset);
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "The image couldn't be saved in this browser.",
    };
  }
  const { blob: _blob, ...summary } = asset;
  return { ok: true, asset: summary };
}
