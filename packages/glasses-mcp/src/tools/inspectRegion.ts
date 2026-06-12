import { envelope, toMcpJsonResult, type VelToolSpec } from "@vel/mcp-base";
import { InspectRegionInputSchema } from "../schemas.js";
import type { ProviderRouter } from "../providers/providerRouter.js";
import type { ImageLoader } from "../services/imageLoader.js";
import { RegionCropper } from "../services/regionCropper.js";
import type { ArtifactStore } from "@vel/core";

export function inspectRegionTool(
  router: ProviderRouter,
  imageLoader: ImageLoader,
  artifactStore: ArtifactStore
): VelToolSpec<typeof InspectRegionInputSchema.shape> {
  const cropper = new RegionCropper(artifactStore);

  return {
    name: "glasses.inspect_region",
    title: "Inspect image region",
    description: "Crop a specific normalized image region, store it as an artifact, and run visual inspection on the crop. Returns observations and coordinate provenance.",
    inputSchema: InspectRegionInputSchema.shape,
    handler: async (input) => {
      const loaded = await imageLoader.load(input.image);
      if (!loaded.meta.width || !loaded.meta.height) {
        throw new Error("Image dimensions required for region cropping");
      }

      const crop = await cropper.cropRegion(
        loaded.imageBytes,
        loaded.meta.mimeType ?? "image/png",
        loaded.meta.width,
        loaded.meta.height,
        input.regionNorm1000
      );

      const provider = router.getForTool("inspect_region", input.provider);

      // Run inspect_image on the cropped region
      const inspectResult = await provider.inspectImage({
        image: crop.cropArtifactRef,
        detail: input.detail ?? "high",
        includeObjects: true,
        includeText: true,
        includeLayout: true,
      });

      const observations = inspectResult.data.observations;
      if (input.query) {
        observations.unshift(`Query: ${input.query}`);
      }

      const parentArtifactId = loaded.meta.source.kind === "artifact_id" ? loaded.meta.source.value : undefined;

      return toMcpJsonResult(envelope({
        observations,
        region: {
          label: input.query || "selected region",
          bboxNorm1000: crop.parentRegionNorm1000,
          bboxPx: crop.parentRegionPx,
          confidence: 1,
          evidence: {
            cropArtifactId: crop.cropArtifactId,
            parentImageArtifactId: parentArtifactId,
          },
        },
      }, {
        provider: inspectResult.provider,
        timingMs: inspectResult.timingMs,
        warnings: [
          ...loaded.warnings,
          ...crop.warnings,
          ...inspectResult.warnings,
        ],
      }));
    },
  };
}
