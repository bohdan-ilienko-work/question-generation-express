import type { Request, RequestHandler, Response } from "express";
import { imagesService } from "./imagesService";
import {
  AcceptImageRequestValidator,
  BatchGenerateRequestValidator,
  JobIdParamsValidator,
  ListJobsQueryValidator,
} from "./validators";

export class ImagesController {
  /** POST /images/find-images — batch CreateJob by question IDs */
  createBatchJobs: RequestHandler = async (req: Request, res: Response) => {
    const parsed = BatchGenerateRequestValidator.safeParse({ body: req.body });
    if (!parsed.success) {
      return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }
    const { ids, ...opts } = parsed.data.body;
    const result = await imagesService.generateImagesForQuestions(ids, opts);
    const httpStatus = (result as any)?.statusCode || 200;
    return res.status(httpStatus).json(result);
  };

  /** GET /images/jobs/:jobId — job status */
  getJob: RequestHandler = async (req: Request, res: Response) => {
    const parsed = JobIdParamsValidator.safeParse({ params: req.params });
    if (!parsed.success) {
      return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }
    const result = await imagesService.getJob(parsed.data.params.jobId);
    const httpStatus = (result as any)?.statusCode || 200;
    return res.status(httpStatus).json(result);
  };

  /** GET /images/jobs/:jobId/result — job result */
  getJobResult: RequestHandler = async (req: Request, res: Response) => {
    const parsed = JobIdParamsValidator.safeParse({ params: req.params });
    if (!parsed.success) {
      return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }
    const result = await imagesService.getJobResult(parsed.data.params.jobId);
    const httpStatus = (result as any)?.statusCode || 200;
    return res.status(httpStatus).json(result);
  };

  /** GET /images/jobs — list with filters (including questionId) */
  listJobs: RequestHandler = async (req: Request, res: Response) => {
    const parsed = ListJobsQueryValidator.safeParse({ query: req.query });
    if (!parsed.success) {
      return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }
    const q = parsed.data.query;
    const result = await imagesService.listJobs(q as any);
    const httpStatus = (result as any)?.statusCode || 200;
    return res.status(httpStatus).json(result);
  };

  /** GET /images/get-image-by-question/:questionId/:variant(low|high) — serve binary */
  getImageByQuestionVariant: RequestHandler = async (req: Request, res: Response) => {
    const questionId = String(req.params.questionId || "");
    const variant = String(req.params.variant || "").toLowerCase();

    if (variant !== "low" && variant !== "high") {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: 'variant must be "low" or "high"' });
    }

    const result = await imagesService.getImageVariantByQuestion(questionId, variant as "low" | "high");
    if (!result.success) {
      return res.status(result.statusCode || 404).json({ success: false, message: result.message });
    }

    const ro = result.responseObject as
      | { data: Buffer; mime: string; filename: string; etag: string; size: number; lastModified?: Date }
      | undefined;
    if (!ro?.data) {
      return res.status(500).json({ success: false, message: "No image data" });
    }

    // ETag / 304
    // imagesController.ts (фрагмент метода getImageByQuestionVariant)
    const inm = req.headers["if-none-match"];
    if (inm && inm === ro.etag) {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.status(304).end();
    }

    res.setHeader("Content-Type", ro.mime || "image/png");
    res.setHeader("Content-Length", String(ro.data.byteLength));
    res.setHeader("ETag", ro.etag);
    res.setHeader("Cache-Control", "public, max-age=86400");
    if (ro.lastModified) res.setHeader("Last-Modified", ro.lastModified.toUTCString());
    res.setHeader("Content-Disposition", `inline; filename="${ro.filename}"`);
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

    return res.status(200).end(ro.data);
  };

  acceptImage: RequestHandler = async (req: Request, res: Response) => {
    const parsed = AcceptImageRequestValidator.safeParse({ body: req.body });
    if (!parsed.success) {
      return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }
    const result = await imagesService.acceptImage(parsed.data.body);
    const httpStatus = (result as any)?.statusCode || 200;
    return res.status(httpStatus).json(result);
  };
}

export const imagesController = new ImagesController();
