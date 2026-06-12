import { describe, it, expect } from "vitest";
import { PathPolicy, resolveHome } from "../src/security/pathPolicy.js";

describe("resolveHome", () => {
  it("resolves ~ to homedir", () => {
    expect(resolveHome("~")).not.toBe("~");
    expect(resolveHome("~")).not.toContain("~");
  });

  it("resolves ~/ path", () => {
    const result = resolveHome("~/test");
    expect(result).not.toContain("~");
    expect(result.endsWith("/test")).toBe(true);
  });

  it("leaves non-tilde paths alone", () => {
    expect(resolveHome("/tmp/test")).toBe("/tmp/test");
  });
});

describe("PathPolicy", () => {
  const policy = new PathPolicy(["/tmp"]);

  it("allows paths inside allowed roots", () => {
    expect(() => policy.assertAllowed("/tmp/foo/bar")).not.toThrow();
  });

  it("rejects paths outside allowed roots", () => {
    expect(() => policy.assertAllowed("/etc/passwd")).toThrow("not allowed");
  });
});
