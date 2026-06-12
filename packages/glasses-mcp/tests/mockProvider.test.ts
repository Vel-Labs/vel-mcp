import { describe, it, expect } from "vitest";
import { MockVisionProvider } from "../src/providers/mockVisionProvider.js";

describe("MockVisionProvider", () => {
  const provider = new MockVisionProvider();

  it("has correct id", () => {
    expect(provider.id).toBe("mock");
  });

  it("health check returns ok with warnings", async () => {
    const health = await provider.healthCheck!();
    expect(health.ok).toBe(true);
    expect(health.warnings).toHaveLength(1);
  });

  it("locate returns deterministic result with query-aware response", async () => {
    const result = await provider.locate({
      image: { kind: "file_path", value: "test.png" },
      query: "search",
      targetType: "any",
      outputType: "box",
      maxResults: 10,
      includeRawModelOutput: false
    });
    expect(result.data.matches).toHaveLength(1);
    expect(result.data.matches[0].label).toBe("search");
    expect(result.data.matches[0].bboxNorm1000).toEqual([700, 80, 940, 150]);
  });

  it("inspectImage includes text and objects when enabled", async () => {
    const result = await provider.inspectImage({
      image: { kind: "file_path", value: "test.png" },
      detail: "medium",
      includeText: true,
      includeObjects: true,
      includeLayout: false
    });
    expect(result.data.observations.length).toBeGreaterThan(0);
  });

  it("all tools return provider metadata", async () => {
    const result = await provider.locate({
      image: { kind: "file_path", value: "t.png" },
      query: "x",
      targetType: "any",
      outputType: "box",
      maxResults: 1,
      includeRawModelOutput: false
    });
    expect(result.provider.name).toBe("mock");
    expect(result.timingMs).toBeGreaterThanOrEqual(0);
  });
});

describe("MockVisionProvider OCR (G5)", () => {
  const provider = new MockVisionProvider();

  it("localized with mergeLines merges same-row spans", async () => {
    const result = await provider.ocr({
      image: { kind: "file_path", value: "test.png" },
      mode: "localized",
      mergeLines: true
    });
    expect(result.data.spans).toHaveLength(2);
    expect(result.data.spans[0].text).toBe("Search");
    expect(result.data.spans[0].readingOrder).toBe(1);
    expect(result.data.spans[1].text).toBe("Cancel Submit");
    expect(result.data.spans[1].readingOrder).toBe(2);
  });

  it("mergeLines=false returns spans as-is", async () => {
    const result = await provider.ocr({
      image: { kind: "file_path", value: "test.png" },
      mode: "localized",
      mergeLines: false
    });
    expect(result.data.spans).toHaveLength(3);
    expect(result.data.spans[0].text).toBe("Search");
    expect(result.data.spans[2].text).toBe("Cancel");
  });

  it("text_only returns text but empty spans", async () => {
    const result = await provider.ocr({
      image: { kind: "file_path", value: "test.png" },
      mode: "text_only",
      mergeLines: true
    });
    expect(result.data.spans).toHaveLength(0);
    expect(result.data.text).toContain("Search");
    expect(result.data.text).toContain("Submit");
  });

  it("layout mode uses y-band reading order", async () => {
    const result = await provider.ocr({
      image: { kind: "file_path", value: "test.png" },
      mode: "layout",
      mergeLines: false
    });
    expect(result.data.spans).toHaveLength(3);
    expect(result.data.spans[0].text).toBe("Search");
    expect(result.data.spans[0].readingOrder).toBe(1);
    expect(result.data.spans[1].text).toBe("Cancel");
    expect(result.data.spans[1].readingOrder).toBe(2);
    expect(result.data.spans[2].text).toBe("Submit");
    expect(result.data.spans[2].readingOrder).toBe(3);
  });

  it("regionNorm1000 filters spans to intersecting region", async () => {
    const result = await provider.ocr({
      image: { kind: "file_path", value: "test.png" },
      mode: "localized",
      mergeLines: false,
      regionNorm1000: [650, 50, 1000, 200]
    });
    expect(result.data.spans).toHaveLength(1);
    expect(result.data.spans[0].text).toBe("Search");
  });

  it("regionNorm1000 with no matches returns empty", async () => {
    const result = await provider.ocr({
      image: { kind: "file_path", value: "test.png" },
      mode: "localized",
      mergeLines: false,
      regionNorm1000: [0, 0, 50, 50]
    });
    expect(result.data.spans).toHaveLength(0);
    expect(result.data.text).toBe("");
  });
});
