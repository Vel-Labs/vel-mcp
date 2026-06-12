import { describe, it, expect } from "vitest";
import { validateToolName } from "../src/server.js";

describe("validateToolName", () => {
  it("accepts valid tool names", () => {
    expect(() => validateToolName("glasses.locate")).not.toThrow();
    expect(() => validateToolName("speech.synthesize")).not.toThrow();
    expect(() => validateToolName("vel.status")).not.toThrow();
    expect(() => validateToolName("glasses.inspect_image")).not.toThrow();
  });

  it("rejects names without dot", () => {
    expect(() => validateToolName("locate")).toThrow("Invalid VEL tool name");
  });

  it("rejects names with uppercase", () => {
    expect(() => validateToolName("Glasses.locate")).toThrow("Invalid VEL tool name");
  });

  it("rejects names starting with underscore", () => {
    expect(() => validateToolName("_glasses.locate")).toThrow("Invalid VEL tool name");
  });

  it("rejects overly long names", () => {
    expect(() => validateToolName("a." + "b".repeat(200))).toThrow("Tool name too long");
  });
});
