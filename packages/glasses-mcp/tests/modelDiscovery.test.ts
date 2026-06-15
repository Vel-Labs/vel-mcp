import { describe, expect, it } from "vitest";
import { discoverModels } from "../src/services/modelDiscovery.js";

describe("model discovery", () => {
  it("includes grounding and general VLM candidates with role-specific setup env", () => {
    const result = discoverModels();

    const locateAnything = result.models.find((model) => model.id === "mlx-community/LocateAnything-3B-bf16");
    const qwen = result.models.find((model) => model.id === "mlx-community/Qwen3-VL-4B-Instruct-5bit");
    const qwenQuality = result.models.find((model) => model.id === "mlx-community/Qwen3-VL-4B-Instruct-8bit");

    expect(locateAnything?.role).toBe("spatial-grounding");
    expect(locateAnything?.setupInstructions.join(" ")).toContain("VEL_VISION_MODEL");
    expect(qwen?.role).toBe("vision-language-reasoning");
    expect(qwen?.taskAffinity).toContain("inspect_image");
    expect(qwen?.setupInstructions.join(" ")).toContain("VEL_VISION_VLM_MODEL");
    expect(qwenQuality?.displayName).toContain("quality");
  });
});
