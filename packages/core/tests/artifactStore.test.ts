import { describe, it, expect } from "vitest";
import { ArtifactStore } from "../src/artifacts/artifactStore.js";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("ArtifactStore", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "vel-core-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("stores and retrieves bytes", async () => {
    const store = new ArtifactStore(dir);
    const meta = await store.putBytes(Buffer.from("hello"));
    expect(meta.sha256).toHaveLength(64);
    expect(meta.id).toBe(`sha256-${meta.sha256}`);
    expect(meta.bytes).toBe(5);
    expect(meta.origin).toBe("bytes");

    const retrieved = await store.getMetadata(meta.id);
    expect(retrieved.sha256).toBe(meta.sha256);
  });

  it("content address is deterministic", async () => {
    const store = new ArtifactStore(dir);
    const a = await store.putBytes(Buffer.from("hello"));
    const b = await store.putBytes(Buffer.from("hello"));
    expect(a.id).toBe(b.id);
  });

  it("different data yields different ids", async () => {
    const store = new ArtifactStore(dir);
    const a = await store.putBytes(Buffer.from("hello"));
    const b = await store.putBytes(Buffer.from("world"));
    expect(a.id).not.toBe(b.id);
  });

  it("stores with custom metadata", async () => {
    const store = new ArtifactStore(dir);
    const meta = await store.putBytes(Buffer.from("test"), {
      mimeType: "image/png",
      originalName: "test.png",
      origin: "generated",
      extra: { model: "mock" }
    });
    expect(meta.mimeType).toBe("image/png");
    expect(meta.originalName).toBe("test.png");
    expect(meta.origin).toBe("generated");
    expect(meta.extra).toEqual({ model: "mock" });
  });
});
