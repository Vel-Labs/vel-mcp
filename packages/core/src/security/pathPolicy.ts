import { homedir } from "node:os";
import { isAbsolute, resolve, relative, dirname } from "node:path";
import { existsSync, realpathSync } from "node:fs";

export function resolveHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return resolve(homedir(), path.slice(2));
  return path;
}

export function resolvePath(path: string, baseDir = process.cwd()): string {
  const expanded = resolveHome(path);
  return isAbsolute(expanded) ? resolve(expanded) : resolve(baseDir, expanded);
}

function resolveRealBest(path: string): string {
  if (existsSync(path)) {
    try { return realpathSync(path); } catch { /* fall through */ }
  }
  const parent = dirname(path);
  if (parent === path) return path;
  const parentReal = resolveRealBest(parent);
  return resolve(parentReal, basenameOnly(path));
}

function basenameOnly(p: string): string {
  const idx = p.lastIndexOf("/");
  return idx >= 0 ? p.slice(idx + 1) : p;
}

export class PathPolicy {
  private allowedRoots: string[];

  constructor(allowedRoots: string[]) {
    this.allowedRoots = allowedRoots.map((p) => resolvePath(p));
  }

  assertAllowed(path: string): string {
    const resolved = resolvePath(path);
    const real = resolveRealBest(resolved);
    const ok = this.allowedRoots.some((root) => {
      const rootReal = resolveRealBest(root);
      const rel = relative(rootReal, real);
      return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
    });
    if (!ok) throw new Error(`Path not allowed by VEL policy: ${path}`);
    return real;
  }
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function checkImageDimensions(width: number, height: number, maxDimension: number): string[] {
  const warnings: string[] = [];
  if (width > maxDimension || height > maxDimension) {
    warnings.push(`Image dimensions (${width}x${height}) exceed max dimension ${maxDimension}px. Processing may be slow.`);
  }
  return warnings;
}

export function checkFileSize(bytes: number, warnMb: number): string[] {
  const warnings: string[] = [];
  if (bytes > warnMb * 1024 * 1024) {
    warnings.push(`File size (${(bytes / 1024 / 1024).toFixed(1)}MB) exceeds warning threshold ${warnMb}MB. Processing may be slow.`);
  }
  return warnings;
}

