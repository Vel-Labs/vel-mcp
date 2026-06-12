import { z } from "zod";
export const BrainSearchInputSchema = z.object({ query: z.string().min(1), scope: z.string().optional(), maxResults: z.number().int().min(1).max(50).default(10) }).strict();
export const BrainReadInputSchema = z.object({ noteId: z.string().min(1) }).strict();
export const BrainProposeWriteInputSchema = z.object({ title: z.string().min(1), body: z.string().min(1), tags: z.array(z.string()).default([]), source: z.string().optional() }).strict();
