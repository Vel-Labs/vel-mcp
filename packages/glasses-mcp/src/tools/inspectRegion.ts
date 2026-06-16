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

      const regionNorm1000 = resolveRegionNorm1000(input.regionNorm1000, input.regionPx, loaded.meta.width, loaded.meta.height);
      const crop = await cropper.cropRegion(
        loaded.imageBytes,
        loaded.meta.mimeType ?? "image/png",
        loaded.meta.width,
        loaded.meta.height,
        regionNorm1000
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

      const matches = input.query
        ? await locateAndRemapMatches(provider, cropper, crop, input.query)
        : [];
      const parentArtifactId = loaded.meta.source.kind === "artifact_id" ? loaded.meta.source.value : undefined;

      return toMcpJsonResult(envelope({
        observations,
        matches,
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
        parentImage: {
          sha256: loaded.meta.sha256,
          width: loaded.meta.width,
          height: loaded.meta.height,
          source: loaded.meta.source,
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

function resolveRegionNorm1000(
  regionNorm1000: [number, number, number, number] | undefined,
  regionPx: [number, number, number, number] | undefined,
  width: number,
  height: number
): [number, number, number, number] {
  if (regionNorm1000) return regionNorm1000;
  if (!regionPx) throw new Error("Either regionNorm1000 or regionPx is required for inspect_region.");
  const [x1, y1, x2, y2] = regionPx;
  return [
    Math.round((x1 / width) * 1000),
    Math.round((y1 / height) * 1000),
    Math.round((x2 / width) * 1000),
    Math.round((y2 / height) * 1000),
  ];
}

async function locateAndRemapMatches(
  provider: ReturnType<ProviderRouter["getForTool"]>,
  cropper: RegionCropper,
  crop: Awaited<ReturnType<RegionCropper["cropRegion"]>>,
  query: string
) {
  const located = await provider.locate({
    image: crop.cropArtifactRef,
    query,
    targetType: "any",
    outputType: "both",
    maxResults: 10,
    includeRawModelOutput: false,
  });

  return located.data.matches.map((match) => ({
    ...match,
    bboxNorm1000: match.bboxNorm1000 ? cropper.mapChildToParent(match.bboxNorm1000, crop) : undefined,
    centerNorm1000: match.centerNorm1000 ? cropper.mapChildPointToParent(match.centerNorm1000, crop) : undefined,
    evidence: {
      ...match.evidence,
      cropArtifactId: crop.cropArtifactId,
    },
  }));
}
