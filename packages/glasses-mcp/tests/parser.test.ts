import { describe, it, expect } from "vitest";
import { parseLocateAnythingAnswer } from "../src/parsers/locateAnything.js";

describe("parseLocateAnythingAnswer", () => {
  it("parses a standard box", () => {
    const result = parseLocateAnythingAnswer('<ref>Search</ref><box><700><80><940><150></box>');
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].label).toBe("Search");
    expect(result.matches[0].bboxNorm1000).toEqual([700, 80, 940, 150]);
    expect(result.matches[0].centerNorm1000).toEqual([820, 115]);
    expect(result.matches[0].uncertainty).toBe("LocateAnything output did not include a numeric confidence score.");
  });

  it("parses multiple boxes", () => {
    const result = parseLocateAnythingAnswer(
      '<ref>A</ref><box><0><0><500><500></box><ref>B</ref><box><500><500><1000><1000></box>'
    );
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0].label).toBe("A");
    expect(result.matches[1].label).toBe("B");
  });

  it("handles none", () => {
    const result = parseLocateAnythingAnswer("<box>none</box>");
    expect(result.matches).toHaveLength(0);
    expect(result.noObject).toBe(true);
  });

  it("handles points", () => {
    const result = parseLocateAnythingAnswer('<ref>point1</ref><box><300><400></box>');
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].centerNorm1000).toEqual([300, 400]);
    expect(result.matches[0].uncertainty).toBe("LocateAnything output did not include a numeric confidence score.");
  });

  it("clamps out-of-range coordinates", () => {
    const result = parseLocateAnythingAnswer('<ref>x</ref><box><0><500><1200><500></box>');
    expect(result.matches[0].bboxNorm1000).toEqual([0, 500, 1000, 500]);
  });

  it("returns warnings for bad coordinates", () => {
    const result = parseLocateAnythingAnswer('<ref>x</ref><box><NaN><500><NaN><500></box>');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("computes pixel coordinates when image size provided", () => {
    const result = parseLocateAnythingAnswer('<ref>x</ref><box><500><500><1000><1000></box>', {
      imageSize: { width: 1920, height: 1080 }
    });
    expect(result.matches[0].bboxPx).toEqual([960, 540, 1920, 1080]);
    expect(result.matches[0].centerPx).toEqual([1440, 810]);
  });

  it("returns warning for empty output", () => {
    const result = parseLocateAnythingAnswer("garbage with no boxes");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("handles whitespace-only input", () => {
    const result = parseLocateAnythingAnswer("   \n  \t  ");
    expect(result.matches).toHaveLength(0);
    expect(result.noObject).toBe(false);
  });

  it("handles empty string", () => {
    const result = parseLocateAnythingAnswer("");
    expect(result.matches).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("parses box without ref label", () => {
    const result = parseLocateAnythingAnswer("<box><100><200><300><400></box>");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].label).toBe("object");
    expect(result.matches[0].bboxNorm1000).toEqual([100, 200, 300, 400]);
  });

  it("parses point without ref label", () => {
    const result = parseLocateAnythingAnswer("<box><500><600></box>");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].label).toBe("point");
    expect(result.matches[0].centerNorm1000).toEqual([500, 600]);
  });

  it("strips HTML from labels", () => {
    const result = parseLocateAnythingAnswer('<ref><b>button</b></ref><box><0><0><100><100></box>');
    expect(result.matches[0].label).toBe("button");
  });

  it("handles mixed point and box outputs", () => {
    const result = parseLocateAnythingAnswer(
      '<ref>A</ref><box><0><0><500><500></box><ref>B</ref><box><300><400></box>'
    );
    // REF_BOX_RE takes priority over POINT_RE; second item is a point (2 coords) but the regex for boxes expects 4 coords
    // So only the first box (4 coords) should match
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].label).toBe("A");
  });

  it("preserves raw model output when configured", () => {
    const answer = '<ref>X</ref><box><10><20><30><40></box>';
    const result = parseLocateAnythingAnswer(answer, { includeRawModelOutput: true });
    expect(result.matches[0].evidence?.rawModelOutput).toBe(answer);
  });

  it("does not include raw model output by default", () => {
    const result = parseLocateAnythingAnswer('<ref>X</ref><box><10><20><30><40></box>');
    expect(result.matches[0].evidence?.rawModelOutput).toBeUndefined();
  });

  it("handles case-insensitive none detection", () => {
    const result = parseLocateAnythingAnswer("<box>NONE</box>");
    expect(result.noObject).toBe(true);
    expect(result.matches).toHaveLength(0);
  });

  it("computes center from bbox automatically", () => {
    const result = parseLocateAnythingAnswer('<ref>test</ref><box><0><0><200><400></box>');
    expect(result.matches[0].centerNorm1000).toEqual([100, 200]);
  });
});
