import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile, copyFile, symlink, access, unlink } from "node:fs/promises";
import { basename, extname, join, dirname } from "node:path";

export interface ArtifactMetadata {
  id: string;
  sha256: string;
  bytes: number;
  mimeType?: string;
  originalName?: string;
  createdAt: string;
  origin: "file" | "bytes" | "generated" | "remote";
  logicalPath?: string;
  extra?: Record<string, unknown>;
}

const EXT_MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".txt": "text/plain",
  ".json": "application/json",
  ".yaml": "application/x-yaml",
  ".yml": "application/x-yaml",
  ".xml": "application/xml",
  ".html": "text/html",
  ".pdf": "application/pdf"
};

function detectMimeType(filename: string): string | undefined {
  const ext = extname(filename).toLowerCase();
  return EXT_MIME_MAP[ext];
}

export class ArtifactStore {
  constructor(private readonly rootDir: string) {}

  async ensure(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
  }

  async putBytes(bytes: Buffer, metadata: Omit<Partial<ArtifactMetadata>, "id" | "sha256" | "bytes" | "createdAt"> = {}): Promise<ArtifactMetadata> {
    await this.ensure();
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const id = `sha256-${sha256}`;
    const dataPath = join(this.rootDir, `${id}.bin`);
    const metaPath = join(this.rootDir, `${id}.json`);

    const originalName = metadata.originalName;
    const detectedMime = originalName ? detectMimeType(originalName) : undefined;
    const mimeType = metadata.mimeType ?? detectedMime;

    const meta: ArtifactMetadata = {
      id,
      sha256,
      bytes: bytes.length,
      createdAt: new Date().toISOString(),
      origin: metadata.origin ?? "bytes",
      mimeType,
      originalName,
      logicalPath: metadata.logicalPath,
      extra: metadata.extra
    };
    await writeFile(dataPath, bytes);
    await writeFile(metaPath, JSON.stringify(meta, null, 2));
    return meta;
  }

  async putFile(path: string, metadata: Omit<Partial<ArtifactMetadata>, "id" | "sha256" | "bytes" | "createdAt"> = {}): Promise<ArtifactMetadata> {
    await this.ensure();
    const bytes = await readFile(path);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const id = `sha256-${sha256}`;
    const dataPath = join(this.rootDir, `${id}.bin`);
    const metaPath = join(this.rootDir, `${id}.json`);
    const st = await stat(path);
    const originalName = metadata.originalName ?? basename(path);
    const detectedMime = detectMimeType(originalName);
    const mimeType = metadata.mimeType ?? detectedMime;

    const meta: ArtifactMetadata = {
      id,
      sha256,
      bytes: st.size,
      createdAt: new Date().toISOString(),
      origin: metadata.origin ?? "file",
      mimeType,
      originalName,
      logicalPath: metadata.logicalPath,
      extra: metadata.extra
    };
    await copyFile(path, dataPath);
    await writeFile(metaPath, JSON.stringify(meta, null, 2));
    return meta;
  }

  async getMetadata(id: string): Promise<ArtifactMetadata> {
    const metaPath = join(this.rootDir, `${id}.json`);
    return JSON.parse(await readFile(metaPath, "utf8")) as ArtifactMetadata;
  }

  dataPath(id: string): string {
    return join(this.rootDir, `${id}.bin`);
  }

  openReadStream(id: string) {
    return createReadStream(this.dataPath(id));
  }

  async organize(id: string, logicalPath: string): Promise<void> {
    const meta = await this.getMetadata(id);
    const target = join(logicalPath, meta.originalName ?? `${id}.bin`);
    await mkdir(dirname(target), { recursive: true });
    const dataFile = this.dataPath(id);
    try {
      await access(target);
    } catch {
      await symlink(dataFile, target);
    }
    meta.logicalPath = logicalPath;
    const metaPath = join(this.rootDir, `${id}.json`);
    await writeFile(metaPath, JSON.stringify(meta, null, 2));
  }

  async evict(opts: { maxCount?: number; maxAgeHours?: number }): Promise<string[]> {
    const entries = await readdir(this.rootDir);
    const metaFiles = entries.filter((e) => e.endsWith(".json")).sort();
    if (metaFiles.length === 0) return [];

    const now = Date.now();
    const evicted: string[] = [];
    const maxAgeMs = (opts.maxAgeHours ?? 0) * 3600_000;
    const maxCount = opts.maxCount ?? 0;

    for (const mf of metaFiles) {
      if (maxCount > 0 && (metaFiles.length - evicted.length) <= maxCount) break;

      const metaPath = join(this.rootDir, mf);
      try {
        const meta = JSON.parse(await readFile(metaPath, "utf8")) as ArtifactMetadata;
        const ageMs = now - new Date(meta.createdAt).getTime();

        if ((maxCount > 0) || (maxAgeMs > 0 && ageMs > maxAgeMs)) {
          const id = meta.id;
          await unlink(join(this.rootDir, `${id}.bin`)).catch(() => {});
          await unlink(metaPath).catch(() => {});
          evicted.push(id);
        }
      } catch {
        // corrupt metadata, skip
      }
    }
    return evicted;
  }
}
