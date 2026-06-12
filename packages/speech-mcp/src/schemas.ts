import { z } from "zod";
export const SynthesizeInputSchema = z.object({
  text: z.string().min(1),
  voice: z.string().optional(),
  format: z.enum(["wav", "mp3", "ogg"]).default("wav"),
  speed: z.number().positive().optional()
}).strict();
export const ListVoicesInputSchema = z.object({ provider: z.string().optional() }).strict();
