import { validateRequest } from "@/common/utils/httpHandlers";
import express, { type Router } from "express";
import { z } from "zod";
import { accessTokenGuard } from "../auth/middlewares/accessToken.middleware";
import { imagesController } from "./imagesController";
import { AcceptImageBodySchema, BatchGenerateBodySchema } from "./validators";

export const imagesRouter: Router = express.Router();

imagesRouter.post(
  "/accept-image",
  accessTokenGuard,
  validateRequest(z.object({ body: AcceptImageBodySchema })),
  imagesController.acceptImage,
);

imagesRouter.post(
  "/find-images",
  accessTokenGuard,
  validateRequest(z.object({ body: BatchGenerateBodySchema })),
  imagesController.createBatchJobs,
);

imagesRouter.get(
  "/jobs/:jobId",
  accessTokenGuard,
  validateRequest(z.object({ params: z.object({ jobId: z.string().min(1) }) })),
  imagesController.getJob,
);

imagesRouter.get(
  "/jobs/:jobId/result",
  accessTokenGuard,
  validateRequest(z.object({ params: z.object({ jobId: z.string().min(1) }) })),
  imagesController.getJobResult,
);

imagesRouter.get(
  "/jobs",
  accessTokenGuard,
  // For docs we keep numbers/bools; runtime validator in validators.ts handles parsing too
  validateRequest(
    z.object({
      query: z.object({
        limit: z.coerce.number().int().min(1).max(100).optional(),
        page: z.coerce.number().int().min(1).optional(),
        statuses: z.string().optional(), // comma-separated
        q: z.string().optional(),
        createdAtFrom: z.coerce.number().optional(),
        createdAtTo: z.coerce.number().optional(),
        updatedAtFrom: z.coerce.number().optional(),
        updatedAtTo: z.coerce.number().optional(),
        hasError: z.enum(["true", "false"]).optional(),
        questionId: z.string().optional(),
      }),
    }),
  ),
  imagesController.listJobs,
);

imagesRouter.get(
  "/get-image-by-question/:questionId/:variant(low|high)",
  // accessTokenGuard, // если нужно публично — уберите guard
  validateRequest(
    z.object({
      params: z.object({
        questionId: z.string().min(1),
        variant: z.enum(["low", "high"]),
      }),
    }),
  ),
  imagesController.getImageByQuestionVariant,
);
