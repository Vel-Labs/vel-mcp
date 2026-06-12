import { describe, it, expect, beforeEach } from "vitest";
import { resolve, join } from "node:path";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { tmpdir } from "node:os";
import { ArtifactStore, PathPolicy, AuditLog } from "@vel/core";
import { ImageLoader } from "../src/services/imageLoader.js";

const TEST_BASE = join(tmpdir(), "vel-glasses-test-" + process.pid);
const ARTIFACT_DIR = join(TEST_BASE, "artifacts");
const AUDIT_DIR = join(TEST_BASE, "audit");
const INPUT_DIR = join(TEST_BASE, "inputs");

async function pngDataUrl(w = 16, h = 16): Promise<string> {
  // minimal valid PNG: black 1x1 pixel
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w, 0);
  ihdrData.writeUInt32BE(h, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit
  ihdrData.writeUInt8(2, 9); // RGB
  ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;
  const ihdr = chunk("IHDR", ihdrData);
  // IDAT — compressed empty RGB data (just deflate stream)
  const idatData = Buffer.from("789C62F8CFC00000000062", "hex");
  const idat = chunk("IDAT", idatData);
  const iend = chunk("IEND", Buffer.alloc(0));
  const png = Buffer.concat([sig, ihdr, idat, iend]);
  return "data:image/png;base64," + png.toString("base64");
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBytes = Buffer.from(type, "ascii");
  const crcIn = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);

  let c = 0xFFFFFFFF;
  for (let i = 0; i < crcIn.length; i++) {
    c ^= crcIn[i];
    for (let j = 0; j < 8; j++) {
      if (c & 1) c = 0xEDB88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
  }
  crc.writeUInt32BE((c ^ 0xFFFFFFFF) >>> 0, 0);

  return Buffer.concat([len, typeBytes, data, crc]);
}

describe("ImageLoader", () => {
  let loader: ImageLoader;
  let artifactStore: ArtifactStore;
  let auditLog: AuditLog;

  beforeEach(async () => {
    await rm(TEST_BASE, { recursive: true, force: true }).catch(() => {});
    await mkdir(ARTIFACT_DIR, { recursive: true });
    await mkdir(INPUT_DIR, { recursive: true });
    await mkdir(AUDIT_DIR, { recursive: true });

    artifactStore = new ArtifactStore(ARTIFACT_DIR);
    auditLog = new AuditLog(AUDIT_DIR);
    loader = new ImageLoader({
      artifactStore,
      auditLog,
      pathPolicy: new PathPolicy([INPUT_DIR, process.cwd(), resolve(homedir(), "vel", "glasses", "inputs")]),
      allowHttpImageLoading: false,
      maxImageDimension: 8192,
      warnFileSizeMb: 25
    });
  });

  it("loads a PNG file_path and extracts dimensions", async () => {
    const png16x16 = await createPngFile(join(INPUT_DIR, "test16x16.png"), 16, 16);
    const result = await loader.load({ kind: "file_path", value: png16x16 });
    expect(result.meta.width).toBe(16);
    expect(result.meta.height).toBe(16);
    expect(result.meta.mimeType).toBe("image/png");
    expect(result.meta.sha256).toHaveLength(64);
    expect(result.warnings).toEqual([]);
  });

  it("loads a JPEG file_path and extracts dimensions", async () => {
    const jpg = await createJpegFile(join(INPUT_DIR, "test.jpg"), 32, 24);
    const result = await loader.load({ kind: "file_path", value: jpg });
    expect(result.meta.width).toBe(32);
    expect(result.meta.height).toBe(24);
    expect(result.meta.mimeType).toBe("image/jpeg");
  });

  it("rejects file_path outside allowed roots", async () => {
    await expect(
      loader.load({ kind: "file_path", value: "/etc/passwd" })
    ).rejects.toThrow(/not allowed/);
  });

  it("emits audit event on successful load", async () => {
    const png16x16 = await createPngFile(join(INPUT_DIR, "audit-test.png"), 8, 8);
    await loader.load({ kind: "file_path", value: png16x16 });
    const chain = await auditLog.verifyChain();
    expect(chain.ok).toBe(true);
  });

  it("blocks URL kind by default and throws HTTP_URL_DISABLED", async () => {
    await expect(
      loader.load({ kind: "url", value: "https://example.com/image.png" })
    ).rejects.toThrow(/HTTP.*disabled/);
  });

  it("decodes a base64 data URL and extracts dimensions", async () => {
    const dUrl = await pngDataUrl(10, 20);
    const result = await loader.load({ kind: "data_url", value: dUrl });
    expect(result.meta.width).toBe(10);
    expect(result.meta.height).toBe(20);
    expect(result.meta.mimeType).toBe("image/png");
  });

  it("warns on oversized dimensions", async () => {
    const tightLoader = new ImageLoader({
      artifactStore,
      auditLog,
      pathPolicy: new PathPolicy([INPUT_DIR]),
      allowHttpImageLoading: false,
      maxImageDimension: 8,
      warnFileSizeMb: 25
    });
    const png = await createPngFile(join(INPUT_DIR, "big.png"), 100, 100);
    const result = await tightLoader.load({ kind: "file_path", value: png });
    expect(result.warnings.some((w) => w.includes("dimension"))).toBe(true);
  });

  it("loads from artifact_id", async () => {
    const pngFile = await createPngFile(join(INPUT_DIR, "artifact-source.png"), 4, 4);
    const meta = await artifactStore.putFile(pngFile);
    const result = await loader.load({ kind: "artifact_id", value: meta.id });
    expect(result.meta.sha256).toBe(meta.sha256);
    expect(result.meta.bytes).toBeGreaterThan(0);
  });

  it("warns on oversized file", async () => {
    const tightLoader = new ImageLoader({
      artifactStore,
      auditLog,
      pathPolicy: new PathPolicy([INPUT_DIR]),
      allowHttpImageLoading: false,
      maxImageDimension: 8192,
      warnFileSizeMb: 0.00001  // 10 bytes
    });
    const png = await createPngFile(join(INPUT_DIR, "bigfile.png"), 10, 10);
    const result = await tightLoader.load({ kind: "file_path", value: png });
    expect(result.warnings.some((w) => w.includes("File size"))).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function createPngFile(filePath: string, w: number, h: number): Promise<string> {
  const png = createPngBytes(w, h);
  await writeFile(filePath, png);
  return filePath;
}

async function createJpegFile(filePath: string, w: number, h: number): Promise<string> {
  const jpg = createJpegBytes(w, h);
  await writeFile(filePath, jpg);
  return filePath;
}

function createPngBytes(w: number, h: number): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w, 0);
  ihdrData.writeUInt32BE(h, 4);
  ihdrData[8] = 8;  ihdrData[9] = 2;
  const ihdr = chunk("IHDR", ihdrData);
  const idat = chunk("IDAT", Buffer.from("789C62F8CFC00000000062", "hex"));
  const iend = chunk("IEND", Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

function createJpegBytes(w: number, h: number): Buffer {
  const soi = Buffer.from([0xFF, 0xD8]);
  const app0 = Buffer.alloc(18);
  app0[0] = 0xFF; app0[1] = 0xE0; app0.writeUInt16BE(16, 2);
  Buffer.from("JFIF\0", "ascii").copy(app0, 4);
  const sof = Buffer.alloc(19);
  sof[0] = 0xFF; sof[1] = 0xC0; sof.writeUInt16BE(17, 2);
  sof[4] = 8;
  sof.writeUInt16BE(h, 5);
  sof.writeUInt16BE(w, 7);
  sof[9] = 3;
  const sos = Buffer.from([0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x01, 0x01, 0x3F, 0x00]);
  const eoi = Buffer.from([0xFF, 0xD9]);
  return Buffer.concat([soi, app0, sof, sos, eoi]);
}
