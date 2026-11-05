import { describe, expect, it, vi } from "vitest";
import { fakeImageFile, pngBytes } from "../test/rooms";
import { deleteAsset, getAsset, getAssetUrl, listAssets } from "./assetStore";
import {
  MAX_UPLOAD_BYTES,
  sniffImageType,
  uploadImage,
  validateImageFile,
  type ProcessedImage,
} from "./imageUpload";

/** Stands in for canvas decoding, which jsdom doesn't support. */
const fakeProcess = async (): Promise<ProcessedImage> => ({
  blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" }),
  width: 640,
  height: 480,
});

describe("validateImageFile", () => {
  it("accepts real PNG, JPEG, GIF and WebP signatures", async () => {
    expect(await validateImageFile(fakeImageFile())).toEqual({ ok: true, type: "image/png" });
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    expect((await validateImageFile(fakeImageFile("a.jpg", "image/jpeg", jpeg))).ok).toBe(true);
    const gif = new TextEncoder().encode("GIF89a......");
    expect((await validateImageFile(fakeImageFile("a.gif", "image/gif", gif))).ok).toBe(true);
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect((await validateImageFile(fakeImageFile("a.webp", "image/webp", webp))).ok).toBe(true);
  });

  it("rejects SVG uploads", async () => {
    const svg = new TextEncoder().encode('<svg onload="alert(1)"/>');
    const result = await validateImageFile(fakeImageFile("evil.svg", "image/svg+xml", svg));
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.reason).toMatch(/SVG/);
  });

  it("rejects files whose contents aren't an image", async () => {
    const html = new TextEncoder().encode("<html><script>alert(1)</script>");
    expect((await validateImageFile(fakeImageFile("x.png", "image/png", html))).ok).toBe(false);
    expect((await validateImageFile(fakeImageFile("x.png", "", html))).ok).toBe(false);
  });

  it("rejects mismatched type and contents", async () => {
    expect((await validateImageFile(fakeImageFile("x.jpg", "image/jpeg", pngBytes()))).ok).toBe(false);
  });

  it("rejects other types, empty files and oversized files", async () => {
    expect((await validateImageFile(fakeImageFile("x.pdf", "application/pdf"))).ok).toBe(false);
    expect((await validateImageFile(new File([], "x.png", { type: "image/png" }))).ok).toBe(false);
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set(pngBytes());
    const result = await validateImageFile(fakeImageFile("big.png", "image/png", big));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/too large/);
  });

  it("identifies signatures directly", () => {
    expect(sniffImageType(pngBytes())).toBe("image/png");
    expect(sniffImageType(new Uint8Array([0, 1, 2, 3]))).toBeNull();
  });
});

describe("uploadImage and the asset store", () => {
  it("stores converted images in IndexedDB and restores them", async () => {
    const result = await uploadImage(fakeImageFile("holiday.png"), fakeProcess);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { asset } = result;
    expect(asset.id).toMatch(/^asset-/);
    expect(asset).toMatchObject({ type: "image/webp", width: 640, height: 480 });
    // The original file name is never stored.
    expect(JSON.stringify(asset)).not.toContain("holiday");

    const stored = await getAsset(asset.id);
    // (jsdom's Blob doesn't survive fake-indexeddb's structured clone, so
    // check the record; real browsers store Blobs natively.)
    expect(stored).toMatchObject({ id: asset.id, width: 640, height: 480, size: 3 });
    expect((await listAssets()).map((a) => a.id)).toEqual([asset.id]);
    expect(await getAssetUrl(asset.id)).toMatch(/^blob:/);
  });

  it("does not store rejected files", async () => {
    const process = vi.fn(fakeProcess);
    const html = new TextEncoder().encode("<html>");
    const result = await uploadImage(fakeImageFile("x.png", "image/png", html), process);
    expect(result.ok).toBe(false);
    expect(process).not.toHaveBeenCalled();
    expect(await listAssets()).toEqual([]);
  });

  it("reports images that fail to decode", async () => {
    const result = await uploadImage(fakeImageFile(), async () => {
      throw new Error("That image couldn't be opened. It may be damaged.");
    });
    expect(result).toEqual({ ok: false, reason: "That image couldn't be opened. It may be damaged." });
  });

  it("deletes assets only when asked", async () => {
    const result = await uploadImage(fakeImageFile(), fakeProcess);
    if (!result.ok) throw new Error("upload failed");
    await deleteAsset(result.asset.id);
    expect(await getAsset(result.asset.id)).toBeNull();
    expect(await getAssetUrl(result.asset.id)).toBeNull();
  });
});
