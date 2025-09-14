import type { Request, RequestHandler, Response } from "express";
import { imagesService } from "./imagesService";
import { BatchGenerateRequestValidator, JobIdParamsValidator, ListJobsQueryValidator } from "./validators";

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
}

export const imagesController = new ImagesController();
