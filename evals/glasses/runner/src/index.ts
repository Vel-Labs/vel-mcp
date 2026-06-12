export function bboxIoU(a: [number, number, number, number], b: [number, number, number, number]): number {
  const x1 = Math.max(a[0], b[0]);
  const y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[2], b[2]);
  const y2 = Math.min(a[3], b[3]);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = Math.max(0, a[2] - a[0]) * Math.max(0, a[3] - a[1]);
  const areaB = Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
  const union = areaA + areaB - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function centerDistance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function guiClickSuccess(pred: [number, number], gold: [number, number], threshold = 30): boolean {
  return centerDistance(pred, gold) <= threshold;
}

export function ocrCer(predicted: string, expected: string): number {
  const p = predicted.trim();
  const e = expected.trim();
  if (e.length === 0) return p.length === 0 ? 0 : 1;
  const dist = editDistance(p, e);
  return dist / e.length;
}

export function ocrExact(predicted: string, expected: string): boolean {
  return predicted.trim() === expected.trim();
}

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

export interface EvalTask {
  id: string;
  taskType: "locate" | "ocr" | "inspect" | "compare" | "video";
  tags?: string[];
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
  metrics: string[];
}

export interface EvalMetricResult {
  name: string;
  value: number;
  pass: boolean;
  threshold?: number;
}

export interface EvalTaskResult {
  id: string;
  taskType: string;
  pass: boolean;
  metrics: EvalMetricResult[];
  durationMs: number;
  errors: string[];
}

export interface EvalReport {
  summary: { total: number; passed: number; failed: number; skipped: number };
  tasks: EvalTaskResult[];
  meta: { runner: string; timestamp: string };
}

export function evaluateLocate(pred: Record<string, unknown>, gold: Record<string, unknown>, metrics: string[]): EvalMetricResult[] {
  const results: EvalMetricResult[] = [];
  const predMatches = (pred.matches ?? []) as Array<Record<string, unknown>>;
  const timingMs = Number(pred.timingMs);
  if (predMatches.length === 0 && metrics.some((m) => m !== "latency_ms")) {
    return metrics.map((m) => m === "latency_ms"
      ? { name: m, value: timingMs, pass: Number.isFinite(timingMs) }
      : { name: m, value: 0, pass: false });
  }

  const best = predMatches[0] as Record<string, unknown>;
  const goldBbox = gold.bboxNorm1000 as [number, number, number, number] | undefined;
  const goldCenter = gold.centerNorm1000 as [number, number] | undefined;

  for (const metric of metrics) {
    switch (metric) {
      case "bbox_iou": {
        const predBbox = best.bboxNorm1000 as [number, number, number, number] | undefined;
        const value = predBbox && goldBbox ? bboxIoU(predBbox, goldBbox) : 0;
        results.push({ name: metric, value: Math.round(value * 1000) / 1000, pass: value >= 0.5 });
        break;
      }
      case "center_distance_norm1000": {
        const predCenter = best.centerNorm1000 as [number, number] | undefined;
        const value = predCenter && goldCenter ? centerDistance(predCenter, goldCenter) : Infinity;
        results.push({ name: metric, value: Math.round(value * 100) / 100, pass: value <= 30, threshold: 30 });
        break;
      }
      case "gui_click_success": {
        const predCenter = best.centerNorm1000 as [number, number] | undefined;
        const pass = predCenter && goldCenter ? guiClickSuccess(predCenter, goldCenter) : false;
        results.push({ name: metric, value: pass ? 1 : 0, pass, threshold: 30 });
        break;
      }
      case "latency_ms": {
        results.push({ name: metric, value: timingMs, pass: Number.isFinite(timingMs) });
        break;
      }
      default:
        results.push({ name: metric, value: 0, pass: false });
    }
  }
  return results;
}

export function evaluateOcr(pred: Record<string, unknown>, gold: Record<string, unknown>, metrics: string[]): EvalMetricResult[] {
  const results: EvalMetricResult[] = [];
  const predText = String(pred.text ?? "");
  const goldText = String(gold.text ?? "");

  for (const metric of metrics) {
    switch (metric) {
      case "ocr_exact": {
        const pass = ocrExact(predText, goldText);
        results.push({ name: metric, value: pass ? 1 : 0, pass });
        break;
      }
      case "ocr_cer": {
        const value = ocrCer(predText, goldText);
        results.push({ name: metric, value: Math.round(value * 1000) / 1000, pass: value <= 0.1, threshold: 0.1 });
        break;
      }
      case "ocr_wer": {
        const predWords = predText.split(/\s+/);
        const goldWords = goldText.split(/\s+/);
        const dist = editDistance(predWords.join(" "), goldWords.join(" "));
        const value = goldWords.join(" ").length > 0 ? dist / goldWords.join(" ").length : 0;
        results.push({ name: metric, value: Math.round(value * 1000) / 1000, pass: value <= 0.2, threshold: 0.2 });
        break;
      }
      case "span_iou": {
        const predSpans = (pred.spans ?? []) as Array<Record<string, unknown>>;
        const goldSpans = (gold.spans ?? []) as Array<Record<string, unknown>>;
        const { meanIoU } = spanIoU(predSpans, goldSpans);
        const pass = meanIoU >= 0.5;
        results.push({ name: metric, value: Math.round(meanIoU * 1000) / 1000, pass, threshold: 0.5 });
        break;
      }
      case "reading_order_correlation": {
        const predSpans = (pred.spans ?? []) as Array<Record<string, unknown>>;
        const goldSpans = (gold.spans ?? []) as Array<Record<string, unknown>>;
        const corr = readingOrderCorrelation(predSpans, goldSpans);
        const pass = corr >= 0.8;
        results.push({ name: metric, value: Math.round(corr * 1000) / 1000, pass, threshold: 0.8 });
        break;
      }
      default:
        results.push({ name: metric, value: 0, pass: false });
    }
  }
  return results;
}

interface SpanRecord {
  bboxNorm1000?: [number, number, number, number];
  centerNorm1000?: [number, number];
  readingOrder?: number;
}

export function spanIoU(predSpans: SpanRecord[], goldSpans: SpanRecord[]): { meanIoU: number; matchedCount: number; totalCount: number } {
  if (goldSpans.length === 0) return { meanIoU: 0, matchedCount: 0, totalCount: 0 };

  const predWithBbox = predSpans.filter((s) => s.bboxNorm1000);
  let totalIoU = 0;
  let matched = 0;

  for (const g of goldSpans) {
    if (!g.bboxNorm1000) continue;
    const gc: [number, number] = [(g.bboxNorm1000[0] + g.bboxNorm1000[2]) / 2, (g.bboxNorm1000[1] + g.bboxNorm1000[3]) / 2];

    let bestIoU = 0;
    let bestDist = Infinity;

    for (const p of predWithBbox) {
      const pc: [number, number] = [(p.bboxNorm1000![0] + p.bboxNorm1000![2]) / 2, (p.bboxNorm1000![1] + p.bboxNorm1000![3]) / 2];
      const dist = centerDistance(gc, pc);
      if (dist < bestDist) {
        bestDist = dist;
        bestIoU = bboxIoU(g.bboxNorm1000, p.bboxNorm1000!);
      }
    }

    totalIoU += bestIoU;
    matched++;
  }

  return { meanIoU: totalIoU / matched, matchedCount: matched, totalCount: goldSpans.length };
}

export function readingOrderCorrelation(predSpans: SpanRecord[], goldSpans: SpanRecord[]): number {
  const filteredPred = predSpans.filter((s) => s.readingOrder !== undefined && s.bboxNorm1000);
  const filteredGold = goldSpans.filter((s) => s.readingOrder !== undefined && s.bboxNorm1000);

  if (filteredGold.length < 2 || filteredPred.length < 2) return 0;

  const matched: { predRank: number; goldRank: number }[] = [];

  for (const g of filteredGold) {
    const gc: [number, number] = [(g.bboxNorm1000![0] + g.bboxNorm1000![2]) / 2, (g.bboxNorm1000![1] + g.bboxNorm1000![3]) / 2];
    let bestDist = Infinity;
    let bestPred: SpanRecord | null = null;

    for (const p of filteredPred) {
      const pc: [number, number] = [(p.bboxNorm1000![0] + p.bboxNorm1000![2]) / 2, (p.bboxNorm1000![1] + p.bboxNorm1000![3]) / 2];
      const dist = centerDistance(gc, pc);
      if (dist < bestDist) {
        bestDist = dist;
        bestPred = p;
      }
    }

    if (bestPred) {
      matched.push({ predRank: bestPred.readingOrder!, goldRank: g.readingOrder! });
    }
  }

  if (matched.length < 2) return 0;

  return spearmanRank(matched.map((m) => m.predRank), matched.map((m) => m.goldRank));
}

function spearmanRank(a: number[], b: number[]): number {
  const n = a.length;
  if (n === 0) return 0;

  const rankA = rankify(a);
  const rankB = rankify(b);

  let d2 = 0;
  for (let i = 0; i < n; i++) {
    d2 += (rankA[i] - rankB[i]) ** 2;
  }

  return 1 - (6 * d2) / (n * (n * n - 1));
}

function rankify(values: number[]): number[] {
  const sorted = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(values.length).fill(0);
  for (let r = 0; r < sorted.length; r++) {
    ranks[sorted[r].i] = r + 1;
  }
  return ranks;
}
