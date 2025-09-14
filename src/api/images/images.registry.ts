import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { BatchGenerateBodySchema } from "./validators";

/** Reusable schemas for responses */
const JobStatusEnum = z.enum(["queued", "processing", "done", "error"]);

const LinkSchema = z.object({
  url: z.string().url(),
  title: z.string().default(""),
  source: z.string().url(),
});

const ImageLinksResultSchema = z.object({
  links: z.array(LinkSchema),
});

const JobStatusSchema = z.object({
  id: z.string(),
  status: JobStatusEnum,
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  error: z.string().optional().nullable(),
  summary: z.string().optional(),
  questionId: z.string().optional(),
});

const JobListItemSchema = z.object({
  id: z.string(),
  status: JobStatusEnum,
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  summary: z.string().optional(),
  error: z.string().optional().nullable(),
  questionId: z.string().optional(),
});

const JobsListResponseSchema = z.object({
  items: z.array(JobListItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  pages: z.number().int(),
});

const BatchGenerateResultItemSchema = z.object({
  questionId: z.string(),
  jobId: z.string().optional(),
  status: JobStatusEnum.optional(),
  error: z.string().optional(),
});

const BatchGenerateResponseSchema = z.object({
  ok: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  results: z.array(BatchGenerateResultItemSchema),
});

const ListJobsQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  page: z.number().int().min(1).default(1),
  statuses: z.array(JobStatusEnum).optional(),
  q: z.string().optional(),
  createdAtFrom: z.number().optional(),
  createdAtTo: z.number().optional(),
  updatedAtFrom: z.number().optional(),
  updatedAtTo: z.number().optional(),
  hasError: z.boolean().optional(),
  questionId: z.string().optional(),
});

export const imagesRegistry = new OpenAPIRegistry();

imagesRegistry.register("Link", LinkSchema);
imagesRegistry.register("ImageLinksResult", ImageLinksResultSchema);
imagesRegistry.register("JobStatus", JobStatusSchema);
imagesRegistry.register("JobsListResponse", JobsListResponseSchema);
imagesRegistry.register("BatchGenerateBody", BatchGenerateBodySchema);
imagesRegistry.register("BatchGenerateResponse", BatchGenerateResponseSchema);

/** POST /images/find-images */
imagesRegistry.registerPath({
  method: "post",
  path: "/images/find-images",
  tags: ["Images"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: BatchGenerateBodySchema,
          examples: {
            default: {
              value: {
                ids: ["66f0b0aa8c1e3f8b1f000001", "66f0b0aa8c1e3f8b1f000002"],
                limit: 12,
                model: "gpt-4o-mini",
                rank: true,
                validate: true,
              },
            },
          },
        },
      },
    },
  },
  responses: createApiResponse(BatchGenerateResponseSchema, "Batch job creation result"),
  security: [{ BearerAuth: [] }],
});

/** GET /images/jobs/{jobId} */
imagesRegistry.registerPath({
  method: "get",
  path: "/images/jobs/{jobId}",
  tags: ["Images"],
  request: {
    params: z.object({ jobId: z.string().min(1) }),
  },
  responses: createApiResponse(JobStatusSchema, "Job status"),
  security: [{ BearerAuth: [] }],
});

/** GET /images/jobs/{jobId}/result */
imagesRegistry.registerPath({
  method: "get",
  path: "/images/jobs/{jobId}/result",
  tags: ["Images"],
  request: {
    params: z.object({ jobId: z.string().min(1) }),
  },
  responses: createApiResponse(ImageLinksResultSchema, "Final result with image links"),
  security: [{ BearerAuth: [] }],
});

/** GET /images/jobs */
imagesRegistry.registerPath({
  method: "get",
  path: "/images/jobs",
  tags: ["Images"],
  request: {
    query: ListJobsQuerySchema,
  },
  responses: createApiResponse(JobsListResponseSchema, "Paginated list of jobs"),
  security: [{ BearerAuth: [] }],
});
