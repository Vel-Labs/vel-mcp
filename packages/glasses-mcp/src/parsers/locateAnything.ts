import type { LocalizationResult } from "../providers/types.js";

export interface ParseLocateAnythingOptions {
  imageSize?: { width: number; height: number };
  includeRawModelOutput?: boolean;
}

export interface ParseLocateAnythingResult {
  matches: LocalizationResult[];
  warnings: string[];
  noObject: boolean;
}

const REF_BOX_RE = /(?:<ref>(?<label>.*?)<\/ref>)?\s*<box><(?<x1>\d+)><(?<y1>\d+)><(?<x2>\d+)><(?<y2>\d+)><\/box>/g;
const POINT_RE = /(?:<ref>(?<label>.*?)<\/ref>)?\s*<box><(?<x>\d+)><(?<y>\d+)><\/box>/g;

export function parseLocateAnythingAnswer(answer: string, options: ParseLocateAnythingOptions = {}): ParseLocateAnythingResult {
  const warnings: string[] = [];
  if (/<box>none<\/box>/i.test(answer)) return { matches: [], warnings, noObject: true };

  const matches: LocalizationResult[] = [];
  for (const match of answer.matchAll(REF_BOX_RE)) {
    const groups = match.groups ?? {};
    const label = cleanLabel(groups.label) || "object";
    const coords = [groups.x1, groups.y1, groups.x2, groups.y2].map((v) => clampCoord(Number(v), warnings)) as [number, number, number, number];
    const result: LocalizationResult = {
      label,
      bboxNorm1000: coords,
      centerNorm1000: [Math.round((coords[0] + coords[2]) / 2), Math.round((coords[1] + coords[3]) / 2)],
      evidence: options.includeRawModelOutput ? { rawModelOutput: answer } : undefined
    };
    addPixels(result, options.imageSize);
    matches.push(result);
  }

  if (matches.length === 0) {
    for (const match of answer.matchAll(POINT_RE)) {
      const groups = match.groups ?? {};
      const label = cleanLabel(groups.label) || "point";
      const point = [clampCoord(Number(groups.x), warnings), clampCoord(Number(groups.y), warnings)] as [number, number];
      const result: LocalizationResult = {
        label,
        centerNorm1000: point,
        evidence: options.includeRawModelOutput ? { rawModelOutput: answer } : undefined
      };
      addPixels(result, options.imageSize);
      matches.push(result);
    }
  }

  if (matches.length === 0 && answer.trim()) warnings.push("No LocateAnything box/point tokens parsed from non-empty output.");
  return { matches, warnings, noObject: false };
}

function cleanLabel(label?: string): string | undefined {
  return label?.replace(/<[^>]+>/g, "").trim() || undefined;
}

function clampCoord(value: number, warnings: string[]): number {
  if (!Number.isFinite(value)) {
    warnings.push("Non-finite coordinate encountered; replaced with 0.");
    return 0;
  }
  if (value < 0 || value > 1000) warnings.push(`Coordinate ${value} outside [0,1000]; clamped.`);
  return Math.max(0, Math.min(1000, Math.round(value)));
}

function addPixels(result: LocalizationResult, imageSize?: { width: number; height: number }): void {
  if (!imageSize) return;
  if (result.bboxNorm1000) {
    const [x1, y1, x2, y2] = result.bboxNorm1000;
    result.bboxPx = [
      Math.round((x1 / 1000) * imageSize.width),
      Math.round((y1 / 1000) * imageSize.height),
      Math.round((x2 / 1000) * imageSize.width),
      Math.round((y2 / 1000) * imageSize.height)
    ];
  }
  if (result.centerNorm1000) {
    const [x, y] = result.centerNorm1000;
    result.centerPx = [Math.round((x / 1000) * imageSize.width), Math.round((y / 1000) * imageSize.height)];
  }
}
