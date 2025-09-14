import { z } from "zod";

/** Options shared by batch endpoint */
const Options = z.object({
  limit: z.number().int().min(1).max(50).optional(),
  model: z.string().min(1).optional(),
  rank: z.boolean().optional(),
  validate: z.boolean().optional(),
});

export const BatchGenerateBodySchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1, { message: "ids must contain at least one id" }),
  })
  .merge(Options);

export const BatchGenerateRequestValidator = z.object({
  body: BatchGenerateBodySchema,
});

export const JobIdParamsValidator = z.object({
  params: z.object({
    jobId: z.string().min(1),
  }),
});

const JobStatusEnum = z.enum(["queued", "processing", "done", "error"]);

export const ListJobsQueryValidator = z.object({
  query: z.object({
    limit: z.preprocess((v) => Number(v), z.number().int().min(1).max(100)).default(20 as any),
    page: z.preprocess((v) => Number(v), z.number().int().min(1)).default(1 as any),
    statuses: z.preprocess((v) => {
      if (typeof v !== "string") return undefined;
      const arr = v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return arr.length ? arr : undefined;
    }, z.array(JobStatusEnum).optional()),
    q: z.string().optional(),
    createdAtFrom: z.preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().optional()),
    createdAtTo: z.preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().optional()),
    updatedAtFrom: z.preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().optional()),
    updatedAtTo: z.preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().optional()),
    hasError: z.preprocess((v) => (v === undefined ? undefined : String(v) === "true"), z.boolean().optional()),
    questionId: z.string().optional(),
  }),
});
