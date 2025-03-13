import { validateRequest } from "@/common/utils/httpHandlers";
import express, { type Router } from "express";
import { z } from "zod";
import { accessTokenGuard } from "../auth/middlewares/accessToken.middleware";
import { questionController } from "./questionController";
import { validateGenerateQuestions, validateGetGeneratedQuestions, validateUpdateQuestion } from "./validators";

export const questionRouter: Router = express.Router();

questionRouter.get("/history", accessTokenGuard, questionController.getQuestions);

//#region Question Routes - (not generated)
questionRouter.post(
  "/generate",
  accessTokenGuard,
  validateRequest(validateGenerateQuestions),
  questionController.generateQuestions,
);

questionRouter.get(
  "/generated",
  accessTokenGuard,
  validateRequest(validateGetGeneratedQuestions),
  questionController.getGeneratedQuestions,
);

questionRouter.get("/:id", accessTokenGuard, questionController.getQuestion);

questionRouter.put(
  "/history/:id",
  accessTokenGuard,
  validateRequest(validateUpdateQuestion),
  questionController.updateQuestion,
);

questionRouter.post(
  "/history/translate/:questionId",
  accessTokenGuard,
  validateRequest(
    z.object({
      body: z.object({
        language: z
          .string()
          .min(2, { message: "Language code is required" })
          .max(2, { message: "Language code must be 2 characters" }),
      }),
      params: z.object({
        questionId: z.string(),
      }),
    }),
  ),
  questionController.translateQuestion,
);

questionRouter.post(
  "/history/confirm",
  accessTokenGuard,
  validateRequest(
    z.object({
      body: z.object({
        ids: z.array(z.string()),
      }),
    }),
  ),
  questionController.confirmQuestions,
);

questionRouter.post(
  "/history/:id/confirm",
  accessTokenGuard,
  validateRequest(
    z.object({
      params: z.object({
        id: z.string().min(1, { message: "Question ID is required" }),
      }),
    }),
  ),
  questionController.confirmQuestion,
);

questionRouter.delete(
  "/history/reject",
  accessTokenGuard,
  validateRequest(
    z.object({
      body: z.object({
        ids: z.array(z.string()),
      }),
    }),
  ),
  questionController.rejectQuestions,
);

questionRouter.delete(
  "/history/:id/reject",
  accessTokenGuard,
  validateRequest(
    z.object({
      params: z.object({
        id: z.string().min(1, { message: "Question ID is required" }),
      }),
    }),
  ),
  questionController.rejectQuestion,
);

questionRouter.delete("/:id", accessTokenGuard, questionController.deleteQuestion);

//#endregion

//#region Generated Question Routes

questionRouter.get(
  "/generated/:id",
  accessTokenGuard,
  validateRequest(
    z.object({
      params: z.object({
        id: z.string().min(1, { message: "Question ID is required" }),
      }),
    }),
  ),
  questionController.getGeneratedQuestion,
);

questionRouter.put(
  "/generated/:id",
  accessTokenGuard,
  validateRequest(validateUpdateQuestion),
  questionController.updateGeneratedQuestion,
);

questionRouter.post(
  "/generated/confirm",
  accessTokenGuard,
  validateRequest(
    z.object({
      body: z.object({
        ids: z.array(z.string()),
      }),
    }),
  ),
  questionController.confirmGeneratedQuestions,
);

questionRouter.delete(
  "/generated/reject",
  accessTokenGuard,
  validateRequest(
    z.object({
      body: z.object({
        ids: z.array(z.string()),
      }),
    }),
  ),
  questionController.rejectGeneratedQuestions,
);

questionRouter.delete("/generated/:id/reject", accessTokenGuard, questionController.rejectGeneratedQuestion);

questionRouter.post(
  "/generated/:id/confirm",
  accessTokenGuard,
  validateRequest(
    z.object({
      params: z.object({
        id: z.string().min(1, { message: "Question ID is required" }),
      }),
    }),
  ),
  questionController.confirmGeneratedQuestion,
);

questionRouter.post(
  "/generated/translate/:questionId",
  accessTokenGuard,
  validateRequest(
    z.object({
      body: z.object({
        language: z
          .string()
          .min(2, { message: "Language code is required" })
          .max(2, { message: "Language code must be 2 characters" }),
      }),
      params: z.object({
        questionId: z.string(),
      }),
    }),
  ),
  questionController.translateGeneratedQuestion,
);
//#endregion
