import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { AcceptImageBodySchema, BatchGenerateBodySchema } from "./validators";

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

/** Статус задачи image-compress (есть progress и name) */
const ImageCompressJobStatusSchema = z.object({
  id: z.string(),
  status: JobStatusEnum,
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  error: z.string().optional().nullable(),
  questionId: z.string().optional(),
  name: z.string().optional(),
  progress: z.number().int().min(0).max(100).optional(),
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

/** Params для бинарной выдачи картинки по вопросу */
const GetImageByQuestionParamsSchema = z.object({
  questionId: z.string().min(1).openapi({ example: "68c42c1d6b1f3bc3fa87bbc3" }),
  variant: z.enum(["low", "high"]).openapi({ example: "low" }),
});

export const imagesRegistry = new OpenAPIRegistry();

imagesRegistry.register("Link", LinkSchema);
imagesRegistry.register("ImageLinksResult", ImageLinksResultSchema);
imagesRegistry.register("JobStatus", JobStatusSchema);
imagesRegistry.register("ImageCompressJobStatus", ImageCompressJobStatusSchema);
imagesRegistry.register("JobsListResponse", JobsListResponseSchema);
imagesRegistry.register("BatchGenerateBody", BatchGenerateBodySchema);
imagesRegistry.register("BatchGenerateResponse", BatchGenerateResponseSchema);
imagesRegistry.register("GetImageByQuestionParams", GetImageByQuestionParamsSchema);
imagesRegistry.register("AcceptImageBody", AcceptImageBodySchema);

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

/** NEW: POST /images/accept-image — создать compress-задачу по gRPC */
imagesRegistry.registerPath({
  method: "post",
  path: "/images/accept-image",
  tags: ["Images"],
  description:
    "Create an image compression job for a question (delegated to gRPC image-compress service). " +
    "On success returns initial job status.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: AcceptImageBodySchema,
          examples: {
            default: {
              value: {
                questionId: "68c42c1d6b1f3bc3fa87bbc3",
                url: "https://example.com/some-image.jpg",
                name: "venice",
                highWidth: 1600,
                lowWidth: 640,
                quality: 82,
              },
            },
          },
        },
      },
    },
  },
  responses: createApiResponse(ImageCompressJobStatusSchema, "Image compression job created"),
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

/** GET /images/get-image-by-question/{questionId}/{variant} — отдать бинарник PNG */
imagesRegistry.registerPath({
  method: "get",
  path: "/images/get-image-by-question/{questionId}/{variant}",
  tags: ["Images"],
  description:
    "Returns the image binary stored for the given question. " +
    "Variant is either **low** or **high**. Response sets `Content-Type`, `ETag`, " +
    "`Last-Modified`, `Cache-Control` and `Content-Disposition: inline` so the image opens in browser.",
  request: {
    params: GetImageByQuestionParamsSchema,
  },
  responses: {
    200: {
      description: "Image binary",
      content: {
        "image/png": {
          schema: { type: "string", format: "binary" },
        },
        "application/octet-stream": {
          schema: { type: "string", format: "binary" },
        },
      },
    },
    304: { description: "Not Modified (ETag match)" },
    400: {
      description: "Validation error",
      content: {
        "application/json": {
          schema: z.object({
            error: z.literal("VALIDATION_ERROR"),
            message: z.string().optional(),
            details: z.any().optional(),
          }),
        },
      },
    },
    401: { description: "Unauthorized" },
    404: {
      description: "Question or image not found",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().default(false),
            message: z.string(),
          }),
        },
      },
    },
    500: { description: "Internal server error" },
  },
  security: [{ BearerAuth: [] }],
});
