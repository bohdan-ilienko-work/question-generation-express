import { ServiceResponse } from "@/common/models/serviceResponse";
import { logger } from "@/server";
import type { Metadata } from "@grpc/grpc-js";
import { StatusCodes } from "http-status-codes";
import { v4 as uuidv4 } from "uuid";
import { createImageCompressClient } from "../../grpc/imagecompress.client"; // +++ NEW +++
import { createImageLinksClient } from "../../grpc/imagelinks.client";

import { Binary } from "bson";
import { Types } from "mongoose";
import {
  QuestionType as DbQuestionType,
  type ILocaleSchema,
  type IQuestion,
  type ISuggestedImage,
  QuestionModel,
} from "../question/models/question.model";

import { ImageModel } from "./models/image.model";

export type VariantFormat = { ext: string; mime: string };
export type VariantMetadata = { format: VariantFormat; width: number; height: number; size: number };
export type Variant = { data: Buffer; metadata: VariantMetadata };

type ChoiceReq = {
  type: "CHOICE";
  language: string;
  question: string;
  correctText: string;
  wrong: string[];
  questionId: string;
  limit?: number;
  model?: string;
  rank?: boolean;
  validate?: boolean;
};
type NumericalReq = {
  type: "NUMERICAL";
  language: string;
  question: string;
  correctNumber: number;
  questionId: string;
  limit?: number;
  model?: string;
  rank?: boolean;
  validate?: boolean;
};
type MapReq = {
  type: "MAP";
  language: string;
  question: string;
  correctCoords: { lat: number; lon: number };
  questionId: string;
  limit?: number;
  model?: string;
  rank?: boolean;
  validate?: boolean;
};
export type FindLinksGrpcRequest = ChoiceReq | NumericalReq | MapReq;

export type PlanOptions = {
  limit?: number;
  model?: string;
  rank?: boolean;
  validate?: boolean;
};

export type BatchJobResultItem = {
  questionId: string;
  jobId?: string;
  status?: "queued" | "processing" | "done" | "error";
  error?: string;
};

export class ImagesService {
  grpcClient!: Awaited<ReturnType<typeof createImageLinksClient>>;
  isInitialized = false;

  compressClient!: Awaited<ReturnType<typeof createImageCompressClient>>;
  isCompressInitialized = false;

  constructor() {
    this.init();
  }

  async init() {
    try {
      const addr = process.env.IMAGE_LINKS_GRPC_ADDR || "localhost:50031";
      this.grpcClient = await createImageLinksClient(addr);
      this.isInitialized = true;
      console.log(`✅ gRPC client to image-links initialized @ ${addr}`);
      //   logger.info(`✅ gRPC client to image-links initialized @ ${addr}`);
    } catch (error) {
      console.error(`Failed to initialize gRPC client: ${error}`);
      //   logger.info(`Failed to initialize gRPC client: ${error}`);
    }

    // +++ init compress gRPC client +++
    try {
      const caddr =
        process.env.IMAGE_COMPRESS_GRPC_ADDR ||
        process.env.IMAGE_COMPRESS_GRPC_URL ||
        process.env.IMAGE_LINKS_GRPC_ADDR || // допускаем общий адрес
        "localhost:50031";
      this.compressClient = await createImageCompressClient(caddr);
      this.isCompressInitialized = true;
      console.log(`✅ gRPC client to image-compress initialized @ ${caddr}`);
    } catch (error) {
      console.error(`Failed to initialize gRPC image-compress client: ${error}`);
    }
  }

  async acceptImage(payload: {
    questionId: string;
    url: string;
    name?: string;
    highWidth?: number;
    lowWidth?: number;
    quality?: number;
  }) {
    if (!this.isCompressInitialized) {
      return ServiceResponse.failure("compress gRPC client not initialized", null, StatusCodes.SERVICE_UNAVAILABLE);
    }
    try {
      const md = this.compressClient.makeMeta(this.apiKeyCompress());
      const res = await this.compressClient.CreateJob(payload, md);
      return ServiceResponse.success("Job created", res);
    } catch (error: any) {
      const code =
        error?.code === this.compressClient.status.INVALID_ARGUMENT
          ? StatusCodes.BAD_REQUEST
          : error?.code === this.compressClient.status.NOT_FOUND
            ? StatusCodes.NOT_FOUND
            : StatusCodes.INTERNAL_SERVER_ERROR;
      return ServiceResponse.failure(error?.details || error?.message || "gRPC error", null, code);
    }
  }

  async generateImagesForQuestions(ids: string[], opts?: PlanOptions) {
    if (!this.isInitialized) {
      return ServiceResponse.failure("gRPC client not initialized", null, StatusCodes.SERVICE_UNAVAILABLE);
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return ServiceResponse.failure("ids must be a non-empty array", null, StatusCodes.BAD_REQUEST);
    }

    try {
      const questions = await QuestionModel.find({ _id: { $in: ids } }).lean<IQuestion[]>();
      const byId = new Map<string, IQuestion>();
      for (const q of questions) byId.set(String(q._id), q);

      const tasks = ids.map((qid) => async (): Promise<BatchJobResultItem> => {
        const qDoc = byId.get(qid);
        if (!qDoc) return { questionId: qid, error: "Question not found" };

        let req: FindLinksGrpcRequest;
        try {
          req = this.mapQuestionToGrpcRequest(qDoc, qid, opts);
        } catch (e: any) {
          return { questionId: qid, error: e?.message || "Failed to map question" };
        }

        try {
          const meta = this.makeMeta(qid);
          const res = await this.grpcClient.CreateJob(req, meta);
          if (res?.id) {
            logger.info(`Image job created for Q=${qid}: ${res.id}`);
            return { questionId: qid, jobId: res.id, status: res.status as any };
          }
          return { questionId: qid, error: "CreateJob returned empty id" };
        } catch (err: any) {
          return { questionId: qid, error: err?.details || err?.message || "gRPC error" };
        }
      });

      const concurrency = Number(process.env.IMG_LINKS_BATCH_CONCURRENCY || 5);
      const results = await this.runWithConcurrency(tasks, concurrency);
      const ok = results.filter((r) => r.jobId).length;
      const failed = results.length - ok;

      return ServiceResponse.success("Batch processed", { ok, failed, results });
    } catch (error: any) {
      logger.error("Batch generateImagesForQuestions failed:", error);
      return ServiceResponse.failure(error?.message || "Internal error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async getJob(jobId: string) {
    if (!this.isInitialized) {
      return ServiceResponse.failure("gRPC client not initialized", null, StatusCodes.SERVICE_UNAVAILABLE);
    }
    try {
      const res = await this.grpcClient.GetJob({ id: jobId }, this.grpcClient.makeMeta(this.apiKey()));
      return ServiceResponse.success("OK", res);
    } catch (error: any) {
      const code =
        error?.code === this.grpcClient.status.NOT_FOUND ? StatusCodes.NOT_FOUND : StatusCodes.INTERNAL_SERVER_ERROR;
      return ServiceResponse.failure(error?.details || "gRPC error", null, code);
    }
  }

  async getJobResult(jobId: string) {
    if (!this.isInitialized) {
      return ServiceResponse.failure("gRPC client not initialized", null, StatusCodes.SERVICE_UNAVAILABLE);
    }
    try {
      const res = await this.grpcClient.GetJobResult({ id: jobId }, this.grpcClient.makeMeta(this.apiKey()));
      return ServiceResponse.success("OK", res);
    } catch (error: any) {
      let code = StatusCodes.INTERNAL_SERVER_ERROR;
      if (error?.code === this.grpcClient.status.NOT_FOUND) code = StatusCodes.NOT_FOUND;
      if (error?.code === this.grpcClient.status.FAILED_PRECONDITION) code = StatusCodes.BAD_REQUEST;
      return ServiceResponse.failure(error?.details || "gRPC error", null, code);
    }
  }

  async listJobs(query: {
    limit: number;
    page: number;
    statuses?: string[];
    q?: string;
    createdAtFrom?: number;
    createdAtTo?: number;
    updatedAtFrom?: number;
    updatedAtTo?: number;
    hasError?: boolean;
    questionId?: string;
  }) {
    if (!this.isInitialized) {
      return ServiceResponse.failure("gRPC client not initialized", null, StatusCodes.SERVICE_UNAVAILABLE);
    }
    try {
      const res = await this.grpcClient.ListJobs(query, this.grpcClient.makeMeta(this.apiKey()));
      return ServiceResponse.success("OK", res);
    } catch (error: any) {
      return ServiceResponse.failure(error?.details || "gRPC error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  private makeMeta(questionId?: string): Metadata {
    const md = this.grpcClient.makeMeta(this.apiKey());
    if (questionId) md.add("x-question-id", String(questionId));
    return md;
  }

  private apiKeyCompress() {
    return (
      process.env.IMAGE_COMPRESS_GRPC_API_KEY || process.env.IMAGE_LINKS_GRPC_API_KEY || process.env.GRPC_API_KEY || ""
    );
  }

  private apiKey() {
    return process.env.IMAGE_LINKS_GRPC_API_KEY || process.env.GRPC_API_KEY || "";
  }

  private mapQuestionToGrpcRequest(qDoc: IQuestion, questionId: string, opts?: PlanOptions): FindLinksGrpcRequest {
    const rawType = String(qDoc.type || "").toLowerCase();
    const locale = this.pickLocale(qDoc.locales);
    const language = locale?.language || "en";
    const questionText = locale?.question || "";

    const baseOpts = {
      questionId: String(questionId),
      limit: opts?.limit,
      model: opts?.model,
      rank: opts?.rank,
      validate: opts?.validate,
    };

    if (typeof (locale?.correct as any) === "number" || rawType === "numerical" || rawType === "number") {
      const correctNumber = Number(locale?.correct);
      if (!Number.isFinite(correctNumber)) throw new Error('Numerical question must have numeric "correct"');
      if (!questionText) throw new Error("Question text is empty");
      const payload: NumericalReq = {
        type: "NUMERICAL",
        language,
        question: questionText,
        correctNumber,
        ...baseOpts,
      };
      return payload;
    }

    if (rawType === DbQuestionType.Choice || rawType === "choice") {
      const correctText = typeof locale?.correct === "string" ? locale.correct : String(locale?.correct ?? "");
      const wrong = Array.isArray(locale?.wrong) ? locale!.wrong! : [];
      if (!correctText) throw new Error("Choice question has empty correctText");
      if (!questionText) throw new Error("Question text is empty");
      const payload: ChoiceReq = {
        type: "CHOICE",
        language,
        question: questionText,
        correctText,
        wrong,
        ...baseOpts,
      };
      return payload;
    }

    const coords = this.extractCoords(locale?.correct as [number, number]);
    if (!coords) throw new Error("Map question must have [lat, lon] in locale.correct");
    const payload: MapReq = {
      type: "MAP",
      language,
      question: questionText || "Locate on map",
      correctCoords: coords,
      ...baseOpts,
    };
    return payload;
  }

  private pickLocale(locales: ILocaleSchema[] = []): ILocaleSchema | undefined {
    if (!Array.isArray(locales) || locales.length === 0) return undefined;
    const en = locales.find((l) => l.language?.toLowerCase() === "en");
    return en || locales[0];
  }

  private extractCoords(correct: ILocaleSchema["correct"]): { lat: number; lon: number } | null {
    if (Array.isArray(correct) && correct.length >= 2) {
      const lat = Number(correct[0]);
      const lon = Number(correct[1]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }
    return null;
  }

  private async runWithConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
    const results: T[] = new Array(tasks.length);
    let next = 0;
    async function worker() {
      while (true) {
        const index = next++;
        if (index >= tasks.length) return;
        try {
          results[index] = await tasks[index]();
        } catch (e: any) {
          results[index] = e;
        }
      }
    }
    const workers = Math.max(1, Math.min(limit || 1, tasks.length));
    await Promise.all(Array.from({ length: workers }, () => worker()));
    return results;
  }

  async saveSuggestedLinks(
    questionId: string,
    links: Array<{ url: string; title?: string; source?: string }>,
    origin?: string,
  ) {
    try {
      if (!questionId) {
        return ServiceResponse.failure("questionId is required", null, StatusCodes.BAD_REQUEST);
      }
      if (!Array.isArray(links) || links.length === 0) {
        return ServiceResponse.failure("links must be a non-empty array", null, StatusCodes.BAD_REQUEST);
      }

      const q = await QuestionModel.findById(questionId).select("suggestedImages").lean<IQuestion | null>();
      if (!q) {
        return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
      }

      const existing = new Set((q.suggestedImages || []).map((x) => (x.url || "").trim()));
      const toInsert: ISuggestedImage[] = links
        .map((l) => ({
          id: uuidv4(),
          url: String(l.url || "").trim(),
          title: l.title,
          source: l.source,
          origin: origin || "image-links",
          createdAt: new Date(),
        }))
        .filter((x) => x.url && !existing.has(x.url));

      if (toInsert.length === 0) {
        return ServiceResponse.success("No new links to insert", {
          inserted: 0,
          total: (q.suggestedImages || []).length,
        });
      }

      const updated = await QuestionModel.findByIdAndUpdate(
        questionId,
        { $push: { suggestedImages: { $each: toInsert } } },
        { new: true, projection: { suggestedImages: 1 } },
      ).lean<IQuestion | null>();

      logger.info(
        { questionId, added: toInsert.length, total: updated?.suggestedImages?.length ?? "n/a" },
        "suggestedImages saved",
      );

      return ServiceResponse.success("Saved", {
        inserted: toInsert.length,
        total: updated?.suggestedImages?.length ?? 0,
        items: toInsert,
      });
    } catch (err: any) {
      logger.error({ err, questionId }, "saveSuggestedLinks failed");
      return ServiceResponse.failure(err?.message || "Internal error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async deleteSuggestedImage(questionId: string, imageId: string) {
    try {
      if (!questionId || !imageId) {
        return ServiceResponse.failure("questionId and imageId are required", null, StatusCodes.BAD_REQUEST);
      }

      const res = await QuestionModel.findByIdAndUpdate(
        questionId,
        { $pull: { suggestedImages: { id: imageId } } },
        { new: true, projection: { suggestedImages: 1 } },
      ).lean<IQuestion | null>();

      if (!res) {
        return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
      }

      return ServiceResponse.success("Deleted", {
        questionId,
        imageId,
        total: res.suggestedImages?.length ?? 0,
      });
    } catch (err: any) {
      logger.error({ err, questionId, imageId }, "deleteSuggestedImage failed");
      return ServiceResponse.failure(err?.message || "Internal error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async saveCompressedImage(payload: {
    questionId: string;
    name: string;
    hash: string;
    high: Variant;
    low: Variant;
    origin?: string;
    uploaderId?: string;
  }) {
    try {
      const { questionId, name, hash, high, low, uploaderId } = payload;

      if (!questionId) {
        return ServiceResponse.failure("questionId is required", null, StatusCodes.BAD_REQUEST);
      }
      if (!high?.data?.length || !low?.data?.length) {
        return ServiceResponse.failure("high and low variants are required", null, StatusCodes.BAD_REQUEST);
      }

      const q = await QuestionModel.findById(questionId).select("_id").lean();
      if (!q) {
        return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
      }

      const uploader = "67d7f80144f2170026f243a0";
      const uploaderObjId = uploader ? new Types.ObjectId(uploader) : undefined;

      const doc = await ImageModel.create({
        uploaderId: uploaderObjId,
        high: {
          data: high.data,
          metadata: {
            format: { ext: high.metadata.format.ext, mime: high.metadata.format.mime },
            width: high.metadata.width,
            height: high.metadata.height,
            size: high.metadata.size,
          },
        },
        low: {
          data: low.data,
          metadata: {
            format: { ext: low.metadata.format.ext, mime: low.metadata.format.mime },
            width: low.metadata.width,
            height: low.metadata.height,
            size: low.metadata.size,
          },
        },
        name,
        hash,
      });

      await QuestionModel.findByIdAndUpdate(
        questionId,
        { $set: { imageId: doc._id } },
        { new: true, projection: { _id: 1, imageId: 1 } },
      ).lean();

      logger.info({ questionId, imageId: String(doc._id) }, "compressed image saved and linked");
      return ServiceResponse.success("Stored", { imageId: String(doc._id) });
    } catch (err: any) {
      logger.error({ err, ctx: "saveCompressedImage" }, "failed to store compressed image");
      return ServiceResponse.failure(err?.message || "Internal error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async getImageVariantByQuestion(questionId: string, variant: "low" | "high") {
    try {
      if (!questionId) {
        return ServiceResponse.failure("questionId is required", null, 400);
      }

      const q = await QuestionModel.findById(questionId).select("imageId").lean();
      if (!q) return ServiceResponse.failure("Question not found", null, 404);

      const imgId = (q as any).imageId as Types.ObjectId | undefined | null;
      if (!imgId) return ServiceResponse.failure("Question has no imageId", null, 404);

      const projection =
        variant === "high"
          ? { name: 1, hash: 1, updatedAt: 1, "high.data": 1, "high.metadata": 1 }
          : { name: 1, hash: 1, updatedAt: 1, "low.data": 1, "low.metadata": 1 };

      const doc = await ImageModel.findById(imgId, projection).exec();
      if (!doc) return ServiceResponse.failure("Image document not found", null, 404);

      const node: any = variant === "high" ? (doc as any).high : (doc as any).low;
      if (!node?.data) return ServiceResponse.failure(`Image ${variant} variant not found`, null, 404);

      let buf: Buffer;
      const raw = node.data;
      if (Buffer.isBuffer(raw)) {
        buf = raw;
      } else if (raw?.buffer instanceof ArrayBuffer) {
        buf = Buffer.from(raw.buffer, raw.byteOffset || 0, raw.byteLength || raw.length || 0);
      } else if (Array.isArray(raw?.data)) {
        buf = Buffer.from(raw.data);
      } else if (raw instanceof Binary) {
        // @ts-ignore
        buf = Buffer.from(raw.buffer);
      } else {
        buf = Buffer.from(raw);
      }

      const mime = node?.metadata?.format?.mime || "image/png";
      const ext = node?.metadata?.format?.ext || "png";
      const base = doc.get("name") || String(doc._id);
      const filename = `${base}_${variant}.${ext}`;
      const size = buf.byteLength;

      const etag = `${(doc.get("hash") as string) || String(doc._id)}-${variant}-${size}`;

      return ServiceResponse.success("OK", {
        data: buf,
        mime,
        filename,
        etag,
        size,
        lastModified: doc.get("updatedAt") as Date | undefined,
      });
    } catch (err: any) {
      logger.error({ err, questionId, variant }, "getImageVariantByQuestion failed");
      return ServiceResponse.failure(err?.message || "Internal error", null, 500);
    }
  }
}

export const imagesService = new ImagesService();
