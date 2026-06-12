import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { ArtifactStore, type AuditLog, PathPolicy, checkImageDimensions, checkFileSize } from "@vel/core";
import type { ImageRef } from "../schemas.js";

export interface ImageMetadata {
  sha256: string;
  bytes: number;
  mimeType?: string;
  width?: number;
  height?: number;
  source: { kind: string; value: string };
}

export interface LoadedImage {
  meta: ImageMetadata;
  imageBytes: Buffer;
  warnings: string[];
}

export interface ImageLoaderOptions {
  artifactStore: ArtifactStore;
  auditLog?: AuditLog;
  pathPolicy: PathPolicy;
  allowHttpImageLoading: boolean;
  maxImageDimension: number;
  warnFileSizeMb: number;
}

interface DataUrlParsed {
  mimeType?: string;
  bytes: Buffer;
}

export class ImageLoader {
  private artifactStore: ArtifactStore;
  private auditLog?: AuditLog;
  private pathPolicy: PathPolicy;
  private allowHttpImageLoading: boolean;
  private maxImageDimension: number;
  private warnFileSizeMb: number;

  constructor(opts: ImageLoaderOptions) {
    this.artifactStore = opts.artifactStore;
    this.auditLog = opts.auditLog;
    this.pathPolicy = opts.pathPolicy;
    this.allowHttpImageLoading = opts.allowHttpImageLoading;
    this.maxImageDimension = opts.maxImageDimension;
    this.warnFileSizeMb = opts.warnFileSizeMb;
  }

  async load(imageRef: ImageRef): Promise<LoadedImage> {
    switch (imageRef.kind) {
      case "file_path":
        return this.loadFromPath(imageRef);
      case "artifact_id":
        return this.loadFromArtifact(imageRef);
      case "data_url":
        return this.loadFromDataUrl(imageRef);
      case "url":
        return this.loadFromUrl(imageRef);
      default:
        throw new Error(`Unsupported image kind: ${(imageRef as { kind: string }).kind}`);
    }
  }

  private async loadFromPath(imageRef: ImageRef): Promise<LoadedImage> {
    const warnings: string[] = [];
    const real = this.pathPolicy.assertAllowed(imageRef.value);
    const bytes = await readFile(real);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const dims = extractDimensions(bytes);
    const mime = imageRef.mimeType ?? detectMimeFromFilename(real);

    warnings.push(...checkFileSize(bytes.length, this.warnFileSizeMb));
    if (dims) warnings.push(...checkImageDimensions(dims.width, dims.height, this.maxImageDimension));

    void this.auditLog?.append({
      type: "image_load",
      package: "glasses",
      operation: "load_image",
      metadata: { kind: "file_path", sha256, bytes: bytes.length, mimeType: mime, width: dims?.width, height: dims?.height }
    });

    return {
      meta: { sha256, bytes: bytes.length, mimeType: mime, width: dims?.width, height: dims?.height, source: { kind: "file_path", value: real } },
      imageBytes: bytes,
      warnings
    };
  }

  private async loadFromArtifact(imageRef: ImageRef): Promise<LoadedImage> {
    const warnings: string[] = [];
    const meta = await this.artifactStore.getMetadata(imageRef.value);
    const dataPath = this.artifactStore.dataPath(imageRef.value);
    const headBytes = await readFile(dataPath);
    const dims = extractDimensions(headBytes);

    warnings.push(...checkFileSize(meta.bytes, this.warnFileSizeMb));
    if (dims) warnings.push(...checkImageDimensions(dims.width, dims.height, this.maxImageDimension));

    void this.auditLog?.append({
      type: "image_load",
      package: "glasses",
      operation: "load_image",
      metadata: { kind: "artifact_id", sha256: meta.sha256, bytes: meta.bytes, mimeType: meta.mimeType, width: dims?.width, height: dims?.height, artifactId: meta.id }
    });

    return {
      meta: { sha256: meta.sha256, bytes: meta.bytes, mimeType: meta.mimeType, width: dims?.width, height: dims?.height, source: { kind: "artifact_id", value: meta.id } },
      imageBytes: headBytes,
      warnings
    };
  }

  private async loadFromDataUrl(imageRef: ImageRef): Promise<LoadedImage> {
    const warnings: string[] = [];
    const parsed = parseDataUrl(imageRef.value);
    const sha256 = createHash("sha256").update(parsed.bytes).digest("hex");
    const mime = imageRef.mimeType ?? parsed.mimeType;
    const dims = extractDimensions(parsed.bytes);

    warnings.push(...checkFileSize(parsed.bytes.length, this.warnFileSizeMb));
    if (dims) warnings.push(...checkImageDimensions(dims.width, dims.height, this.maxImageDimension));

    void this.artifactStore.putBytes(parsed.bytes, { mimeType: mime }).catch(() => {});

    void this.auditLog?.append({
      type: "image_load",
      package: "glasses",
      operation: "load_image",
      metadata: { kind: "data_url", sha256, bytes: parsed.bytes.length, mimeType: mime, width: dims?.width, height: dims?.height }
    });

    return {
      meta: { sha256, bytes: parsed.bytes.length, mimeType: mime, width: dims?.width, height: dims?.height, source: { kind: "data_url", value: "[redacted]" } },
      imageBytes: parsed.bytes,
      warnings
    };
  }

  private async loadFromUrl(_imageRef: ImageRef): Promise<LoadedImage> {
    if (!this.allowHttpImageLoading) {
      throw Object.assign(
        new Error("HTTP(S) image loading is disabled. Set modules.glasses.allowHttpImageLoading: true in vel.config.yaml to enable."),
        { code: "HTTP_URL_DISABLED" }
      );
    }
    throw Object.assign(
      new Error("HTTP URL image fetching is not yet implemented."),
      { code: "HTTP_URL_UNSUPPORTED" }
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Utility functions                                                  */
/* ------------------------------------------------------------------ */

function parseDataUrl(value: string): DataUrlParsed {
  const parts = value.split(",");
  const header = parts[0];
  const isBase64 = header.includes(";base64");
  const mimeMatch = header.match(/^data:([^;]+)/);
  const payload = parts.slice(1).join(",");
  return {
    mimeType: mimeMatch?.[1],
    bytes: isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload))
  };
}

function detectMimeFromFilename(filename: string): string | undefined {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    tiff: "image/tiff",
    tif: "image/tiff"
  };
  return ext ? map[ext] : undefined;
}

function extractDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 10) return null;

  // PNG: 8-byte sig + IHDR at offset 16
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes.length >= 24) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }

  // JPEG: SOI marker 0xFFD8, scan for SOFn
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    let offset = 2;
    while (offset + 9 <= bytes.length) {
      if (bytes[offset] !== 0xFF) break;
      const marker = bytes[offset + 1];
      if (marker === 0xDA) break; // SOS — past dimensions
      if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xCF)) {
        if (marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
          return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
        }
      }
      offset += 2 + bytes.readUInt16BE(offset + 2);
    }
    return null;
  }

  // GIF: header at offset 6-10
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes.length >= 10) {
    return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  }

  // WebP: RIFF container
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 && bytes.length >= 30) {
    if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38) {
      if (bytes[15] === 0x20) {
        // VP8 lossy
        const w = bytes.readUInt16LE(26) & 0x3FFF;
        const h = bytes.readUInt16LE(28) & 0x3FFF;
        return { width: w, height: h };
      }
      if (bytes[15] === 0x4C && bytes.length >= 25) {
        // VP8L lossless
        const bits = bytes.readUInt32LE(21);
        return { width: (bits & 0x3FFF) + 1, height: ((bits >> 14) & 0x3FFF) + 1 };
      }
      if (bytes[15] === 0x58 && bytes.length >= 30) {
        // VP8X extended
        return { width: (bytes.readUInt32LE(24) & 0xFFFFFF) + 1, height: (bytes.readUInt32LE(27) & 0xFFFFFF) + 1 };
      }
    }
    return null;
  }

  // BMP
  if (bytes[0] === 0x42 && bytes[1] === 0x4D && bytes.length >= 26) {
    return { width: bytes.readInt32LE(18), height: Math.abs(bytes.readInt32LE(22)) };
  }

  return null;
}
