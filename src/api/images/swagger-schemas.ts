import { z } from "zod";

export const JobStatusEnum = z.enum(["queued", "processing", "done", "error"]);

export const BatchGenerateBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  limit: z.number().int().min(1).max(50).optional(),
  model: z.string().optional(),
  rank: z.boolean().optional(),
  validate: z.boolean().optional(),
});

export const BatchGenerateResultItemSchema = z.object({
  questionId: z.string(),
  jobId: z.string().optional(),
  status: JobStatusEnum.optional(),
  error: z.string().optional(),
});

export const BatchGenerateResponseSchema = z.object({
  ok: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  results: z.array(BatchGenerateResultItemSchema),
});
