import type { AskInput, CompareInput, DescribeInput, DetectAnomaliesInput, InspectImageInput, InspectRegionInput, LocateInput, OcrInput, ReadDocumentInput, VideoScanInput } from "../schemas.js";
import type { LocalizationResult, VisionProvider, VisionProviderResult } from "./types.js";
import { filterByRegion, mergeLinesByYBands, layoutSort } from "../services/ocrUtils.js";

const UI_FIXTURE = {
  text: "Search\nSubmit\nCancel",
  spans: [
    { text: "Search", bboxNorm1000: [700, 80, 940, 150] as [number, number, number, number], confidence: 0.9, readingOrder: 1 },
    { text: "Submit", bboxNorm1000: [700, 820, 940, 900] as [number, number, number, number], confidence: 0.91, readingOrder: 2 },
    { text: "Cancel", bboxNorm1000: [500, 820, 680, 900] as [number, number, number, number], confidence: 0.86, readingOrder: 3 }
  ]
};

const LOCATE_TARGETS: Record<string, { bboxNorm1000: [number, number, number, number]; centerNorm1000: [number, number] }> = {
  search:   { bboxNorm1000: [700, 80, 940, 150],  centerNorm1000: [820, 115] },
  submit:   { bboxNorm1000: [700, 820, 940, 900], centerNorm1000: [820, 860] },
  cancel:   { bboxNorm1000: [500, 820, 680, 900], centerNorm1000: [590, 860] },
  button:   { bboxNorm1000: [100, 200, 400, 300],  centerNorm1000: [250, 250] },
  icon:     { bboxNorm1000: [20, 20, 80, 80],       centerNorm1000: [50, 50] },
  text:     { bboxNorm1000: [200, 400, 800, 500],   centerNorm1000: [500, 450] },
  menu:     { bboxNorm1000: [0, 0, 200, 1000],      centerNorm1000: [100, 500] },
  header:   { bboxNorm1000: [0, 0, 1000, 100],      centerNorm1000: [500, 50] },
  footer:   { bboxNorm1000: [0, 900, 1000, 1000],   centerNorm1000: [500, 950] }
};

export class MockVisionProvider implements VisionProvider {
  id = "mock";
  displayName = "Mock deterministic vision provider";

  async healthCheck() {
    return { ok: true, warnings: ["Mock provider returns deterministic fake results."] };
  }

  async inspectImage(input: InspectImageInput): Promise<VisionProviderResult<{ observations: string[] }>> {
    const detail = input.detail ?? "medium";
    const obs: string[] = [];

    if (detail === "low") {
      obs.push(`Mock low-detail inspection of ${input.image.kind} image`);
      if (input.includeObjects) obs.push("Detected: mock objects present");
      if (input.includeText) obs.push("Text: some text detected");
    } else if (detail === "high") {
      obs.push(`Mock high-detail inspection of ${input.image.kind} image`);
      if (input.includeObjects) obs.push("Objects: button (confidence: 0.9), panel (confidence: 0.8), icon (confidence: 0.7)");
      if (input.includeText) obs.push("Text regions: Search (700,80-940,150), Submit (700,820-940,900), Cancel (500,820-680,900)");
      if (input.includeLayout) obs.push("Layout: top-bar (0-100px), content area (100-800px), bottom-bar (800-1000px)");
    } else {
      obs.push(`Mock medium-detail inspection of ${input.image.kind} image`);
      if (input.includeText) obs.push("Visible text may include: Search, Submit, Cancel");
      if (input.includeObjects) obs.push("Objects may include: button, panel, icon");
      if (input.includeLayout) obs.push("Layout suggests top-bar, content area, bottom-bar");
    }
    return timed("mock", { observations: obs });
  }

  async locate(input: LocateInput): Promise<VisionProviderResult<{ matches: LocalizationResult[] }>> {
    const query = (input.query ?? "").toLowerCase().trim();

    if (query === "none" || query === "nothing" || query === "empty") {
      return timed("mock", { matches: [] }, [{ type: "info", text: `Mock: no matches found for "${input.query}"` }]);
    }

    const key = Object.keys(LOCATE_TARGETS).find((k) => query.includes(k));
    const target = key ? LOCATE_TARGETS[key] : LOCATE_TARGETS.button;
    const label = input.query || "mock target";
    const confidence = query.includes("search") || query.includes("submit") ? 0.92 : 0.88;

    if (input.outputType === "point") {
      return timed("mock", { matches: [{
        label,
        centerNorm1000: target.centerNorm1000,
        confidence,
        evidence: { text: `mock point:${label}` }
      }] });
    }

    return timed("mock", { matches: [{
      label,
      bboxNorm1000: target.bboxNorm1000,
      centerNorm1000: target.centerNorm1000,
      confidence,
      evidence: { text: `mock:${label}` }
    }] });
  }

  async ocr(input: OcrInput): Promise<VisionProviderResult<{ text: string; spans: Array<{ text: string; bboxNorm1000: [number, number, number, number]; confidence: number; readingOrder: number }> }>> {
    const mode = input.mode ?? "localized";

    let spans = UI_FIXTURE.spans.map((s) => ({ ...s }));

    if (input.regionNorm1000) {
      spans = filterByRegion(spans, input.regionNorm1000 as [number, number, number, number]);
    }

    if (mode === "text_only") {
      const text = spans.map((s) => s.text).join("\n");
      return timed("mock", { text, spans: [] });
    }

    if (input.mergeLines ?? true) {
      spans = mergeLinesByYBands(spans) as typeof spans;
    }

    if (mode === "layout") {
      spans = layoutSort(spans) as typeof spans;
    } else {
      spans = spans.map((s, i) => ({ ...s, readingOrder: i + 1 }));
    }

    const text = spans.map((s) => s.text).join("\n");
    return timed("mock", { text, spans });
  }

  async inspectRegion(input: InspectRegionInput): Promise<VisionProviderResult<{ observations: string[]; region: LocalizationResult }>> {
    const query = input.query ?? "";
    const region = input.regionNorm1000 ?? [0, 0, 1000, 1000] as [number, number, number, number];
    const obsBase = query ? `Mock region inspection for "${query}"` : "Mock region inspection";
    return timed("mock", {
      observations: [obsBase, `Region bbox: [${region.join(",")}]`, `Detail: ${input.detail ?? "high"}`],
      region: { label: query || "selected region", bboxNorm1000: region, confidence: 1 }
    });
  }

  async compare(input: CompareInput): Promise<VisionProviderResult<{ summary: string; changedRegions: LocalizationResult[] }>> {
    const mode = input.mode ?? "metadata";
    if (mode === "metadata") {
      return timed("mock", {
        summary: "Mock metadata comparison: images differ in content",
        changedRegions: [{ label: "metadata diff", confidence: 1 }]
      });
    }
    if (mode === "pixel") {
      return timed("mock", {
        summary: "Mock pixel comparison: regions differ",
        changedRegions: [
          { label: "pixel change A", bboxNorm1000: [400, 400, 600, 600], confidence: 0.95 },
          { label: "pixel change B", bboxNorm1000: [100, 100, 200, 200], confidence: 0.7 }
        ]
      });
    }
    return timed("mock", {
      summary: `Mock ${mode} comparison complete`,
      changedRegions: [{ label: "mock changed region", bboxNorm1000: [400, 400, 600, 600], confidence: 0.5 }]
    });
  }

  async videoScan(input: VideoScanInput): Promise<VisionProviderResult<{ frames: unknown[]; events: unknown[] }>> {
    const maxFrames = input.sampling?.maxFrames ?? 60;
    const interval = input.sampling?.everySeconds ?? (input.sampling?.fps ? 1 / input.sampling.fps : 2);
    const frames = [];
    for (let i = 0; i < Math.min(maxFrames, 10); i++) {
      frames.push({ frameIndex: i, timestampSec: i * interval, source: input.video.kind, artifactId: `mock-frame-${i}` });
    }
    return timed("mock", {
      frames,
      events: input.query
        ? frames.map((f) => ({
            timestampSec: f.timestampSec,
            frameIndex: f.frameIndex,
            frameArtifactId: f.artifactId,
            label: input.query,
            bboxNorm1000: [100, 200, 400, 300],
            centerNorm1000: [250, 250],
            confidence: 0.65
          }))
        : []
    });
  }

  async describe(input: DescribeInput): Promise<VisionProviderResult<{ description: string; style?: string }>> {
    const style = input.style ?? "detailed";
    const descriptions: Record<string, string> = {
      concise: "A screenshot of a web UI with a search bar and buttons.",
      detailed: "A web application interface featuring a prominent search bar at the top, followed by a content area containing three buttons labeled Search, Submit, and Cancel. The layout is clean with a header and footer region.",
      bullet: "- Search bar at top\n- Three action buttons\n- Header and footer regions\n- Clean layout",
      "alt-text": "Web interface with search functionality and action buttons.",
    };
    return timed("mock", { description: descriptions[style] ?? descriptions.detailed, style });
  }

  async ask(input: AskInput): Promise<VisionProviderResult<{ answer: string; confidence?: number }>> {
    const answers: Record<string, string> = {
      "what color is the button": "The buttons are blue with white text.",
      "how many buttons": "There are three buttons visible: Search, Submit, and Cancel.",
    };
    const answer = answers[input.question.toLowerCase()] ?? `Mock answer to: ${input.question}`;
    return timed("mock", { answer, confidence: 0.9 });
  }

  async readDocument(input: ReadDocumentInput): Promise<VisionProviderResult<{ pages: Array<{ pageNumber: number; text: string; spans?: any[] }>; metadata: { totalPages: number; mode: string } }>> {
    const mode = input.mode ?? "full";
    const pages = [{ pageNumber: 1, text: "Mock document text\nPage 1 content here.", spans: UI_FIXTURE.spans }];
    return timed("mock", { pages, metadata: { totalPages: 1, mode } });
  }

  async detectAnomalies(input: DetectAnomaliesInput): Promise<VisionProviderResult<{ anomalies: Array<{ label: string; bboxNorm1000?: [number, number, number, number]; severity: string; description: string }> }>> {
    const sensitivity = input.sensitivity ?? "medium";
    const anomalies = sensitivity === "high"
      ? [
          { label: "missing-button", bboxNorm1000: [700, 820, 940, 900] as [number, number, number, number], severity: "high", description: "Submit button is missing or moved." },
          { label: "color-shift", bboxNorm1000: [0, 0, 1000, 1000] as [number, number, number, number], severity: "medium", description: "Overall color palette shifted." },
        ]
      : [{ label: "layout-drift", bboxNorm1000: [400, 400, 600, 600] as [number, number, number, number], severity: "medium", description: "Layout differs from expected." }];
    return timed("mock", { anomalies });
  }
}

function timed<T>(providerName: string, data: T, warnings: Array<{ type?: string; text: string }> = []): VisionProviderResult<T> {
  return {
    provider: { name: providerName, version: "0.1.0" },
    timingMs: 1,
    warnings: warnings.map((w) => w.text),
    data
  };
}
