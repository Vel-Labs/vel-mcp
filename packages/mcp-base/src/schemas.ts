import { z } from "zod";

export const ProviderOverrideSchema = z.object({
  provider: z.string().optional().describe("Optional provider override, e.g. mock or locate-anything")
});

export type ProviderOverride = z.infer<typeof ProviderOverrideSchema>;
