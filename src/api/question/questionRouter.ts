import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import { z } from "zod";

import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { validateRequest } from "@/common/utils/httpHandlers";
import { accessTokenGuard } from "../auth/middlewares/accessToken.middleware";
import { questionController } from "./questionController";

export const questionRegistry = new OpenAPIRegistry();
export const questionRouter: Router = express.Router();

const QuestionSchema = z.object({
  language: z.string(),
  question: z.string(),
  correct: z.string(),
  wrong: z.array(z.string()),
  category: z.string(),
});

questionRegistry.registerPath({
  method: "get",
  path: "/questions",
  tags: ["Questions"],
  responses: createApiResponse(z.array(QuestionSchema), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRouter.get("/", accessTokenGuard, questionController.getQuestions);

questionRegistry.registerPath({
  method: "post",
  path: "/questions/generate",
  tags: ["Questions"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            prompt: z.string(),
            max_tokens: z.number().optional(),
            count: z.number(),
            category: z.string(),
            difficulty: z.number().min(1).max(5).optional(),
            temperature: z.number().min(0).max(2).optional(),
            type: z.enum(["multiple_choice", "one_choice"]).optional(),
            model: z.string().default("gpt-3.5-turbo").optional(),
            requiredLanguages: z.array(
              z
                .string()
                .min(2, {
                  message: "Language code must be 2 characters",
                })
                .max(2, {
                  message: "Language code must be 2 characters",
                }),
            ),
          }),
          examples: {
            "One Choice (English with GPT-3.5 Turbo)": {
              value: {
                prompt: "Some history of the United States",
                max_tokens: 500,
                count: 5,
                model: "gpt-3.5-turbo",
                category: "history",
                difficulty: 3,
                temperature: 0.7,
                type: "one_choice",
                requiredLanguages: ["en"],
              },
              description:
                "Generate 5 one choice questions about the history of the United States by using GPT-3.5 Turbo model",
            },
            "One Choice (English with GPT-4o)": {
              value: {
                prompt: "Some history of the United States",
                max_tokens: 500,
                count: 5,
                model: "gpt-4o",
                category: "history",
                difficulty: 3,
                temperature: 1.0,
                type: "one_choice",
                requiredLanguages: ["en"],
              },
              description:
                "Generate 5 one choice questions about the history of the United States by using GPT-4o model",
            },
            "Multiple Choice (English with GPT-3.5 Turbo)": {
              value: {
                prompt: "Some history of the United States",
                max_tokens: 500,
                count: 5,
                model: "gpt-3.5-turbo",
                category: "history",
                difficulty: 3,
                temperature: 1.2,
                type: "multiple_choice",
                requiredLanguages: ["en"],
              },
              description:
                "Generate 5 multiple choice questions about the history of the United States by using GPT-3.5 Turbo model",
            },
            "Multiple Choice (English with GPT-4o)": {
              value: {
                prompt: "Some history of the United States",
                max_tokens: 500,
                count: 5,
                model: "gpt-4o",
                category: "history",
                difficulty: 3,
                temperature: 1.2,
                type: "multiple_choice",
                requiredLanguages: ["en"],
              },
            },
          },
        },
      },
    },
  },
  responses: createApiResponse(z.object({ questions: z.array(QuestionSchema) }), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRouter.post(
  "/generate",
  accessTokenGuard,
  validateRequest(
    z.object({
      body: z.object({
        prompt: z.string(),
        max_tokens: z.number().optional(),
        count: z.number(),
        category: z.string(),
        difficulty: z.number().min(1).max(5).optional(),
        temperature: z.number().min(0).max(2).optional(),
        model: z.string().default("gpt-3.5-turbo").optional(),
        type: z.enum(["multiple_choice", "one_choice"]).optional(),
        requiredLanguages: z.array(
          z
            .string()
            .min(2, {
              message: "Language code must be 2 characters",
            })
            .max(2, {
              message: "Language code must be 2 characters",
            }),
        ),
      }),
    }),
  ),
  questionController.generateQuestions,
);

questionRegistry.registerPath({
  method: "get",
  path: "/questions/generated",
  tags: ["Questions"],
  request: {
    query: z.object({
      limit: z.number().optional(),
      page: z.number().optional(),
    }),
  },
  responses: createApiResponse(z.array(QuestionSchema), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRouter.get(
  "/generated",
  accessTokenGuard,
  validateRequest(
    z.object({
      query: z.object({
        limit: z
          .string()
          .transform((v) => (v ? +v : 10))
          .optional(),
        page: z
          .string()
          .transform((v) => (v ? +v : 1))
          .optional(),
      }),
    }),
  ),
  questionController.getGeneratedQuestions,
);

questionRegistry.registerPath({
  method: "get",
  path: "/questions/{id}",
  tags: ["Questions"],
  request: {
    params: z.object({
      id: z.string().min(1, { message: "Question ID is required" }),
    }),
  },
  responses: createApiResponse(QuestionSchema, "Success"),
  security: [{ BearerAuth: [] }],
});

questionRouter.get("/:id", accessTokenGuard, questionController.getQuestion);

//TODO: optimize this validation
questionRegistry.registerPath({
  method: "put",
  path: "/questions/{id}",
  tags: ["Questions"],
  description: "Update a question",
  request: {
    params: z.object({
      id: z.string().min(1, { message: "Question ID is required" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            categoryId: z.string().optional(),
            status: z.string().optional(),
            track: z.string().optional(),
            type: z.string().optional(),
            difficulty: z.number().optional(),
            requiredLanguages: z.array(z.string()).optional(),
            audioId: z.string().optional(),
            imageId: z.string().optional(),
            authorId: z.string().optional(),
            tags: z.array(z.string()).optional(),
            locales: z.array(
              z.object({
                language: z.string(),
                question: z.string(),
                correct: z.string(),
                wrong: z.array(z.string()),
                isValid: z.boolean(),
              }),
            ),
            isValid: z.boolean().optional(),
          }),
        },
      },
    },
  },
  responses: createApiResponse(QuestionSchema, "Success"),
  security: [{ BearerAuth: [] }],
});

questionRouter.put(
  "/:id",
  accessTokenGuard,
  validateRequest(
    z.object({
      params: z.object({
        id: z.string().min(1, { message: "Question ID is required" }),
      }),
      body: z.object({
        categoryId: z.string().optional(),
        status: z.string().optional(),
        track: z.string().optional(),
        type: z.string().optional(),
        difficulty: z.number().optional(),
        requiredLanguages: z.array(z.string()).optional(),
        audioId: z.string().optional(),
        imageId: z.string().optional(),
        authorId: z.string().optional(),
        tags: z.array(z.string()).optional(),
        locales: z.array(
          z.object({
            language: z.string(),
            question: z.string(),
            correct: z.string(),
            wrong: z.array(z.string()),
            isValid: z.boolean(),
          }),
        ),
        isValid: z.boolean().optional(),
      }),
    }),
  ),
  questionController.updateQuestion,
);

// questionRegistry.registerPath({
//   method: "get",
//   path: "/questions/{category}/by-category",
//   tags: ["Questions"],
//   request: {
//     params: z.object({
//       category: z.string().min(1, { message: "Category is required" }),
//     }),
//   },
//   responses: createApiResponse(z.array(QuestionSchema), "Success"),
//   security: [{ BearerAuth: [] }],
// });

// questionRouter.get("/:category/by-category", accessTokenGuard, questionController.getQuestionsByCategory);

// questionRegistry.registerPath({
//   method: "patch",
//   path: "/questions/{id}/approve",
//   tags: ["Questions"],
//   description: "Approve a question (set field 'valid' to true)",
//   request: {
//     params: z.object({
//       id: z.string().min(1, { message: "Question ID is required" }),
//     }),
//   },
//   responses: createApiResponse(QuestionSchema, "Success"),
//   security: [{ BearerAuth: [] }],
// });

// questionRouter.patch("/:id/approve", accessTokenGuard, questionController.approveQuestion);

questionRegistry.registerPath({
  method: "delete",
  path: "/questions/{id}/reject",
  tags: ["Questions"],
  description: "Set field 'valid' to false",
  request: {
    params: z.object({
      id: z.string().min(1, { message: "Question ID is required" }),
    }),
  },
  responses: createApiResponse(QuestionSchema, "Success"),
  security: [{ BearerAuth: [] }],
});

questionRouter.delete("/:id/reject", accessTokenGuard, questionController.rejectQuestion);

// questionRegistry.registerPath({
//   method: "patch",
//   path: "/questions/{id}/translate/{language}/approve",
//   tags: ["Questions"],
//   description: "Approve a question translation (set field 'valid' in the locale to true)",
//   request: {
//     params: z.object({
//       id: z.string().min(1, { message: "Question ID is required" }),
//       language: z
//         .string()
//         .min(2, { message: "Language code is required" })
//         .max(2, { message: "Language code must be 2 characters" }),
//     }),
//   },
//   responses: createApiResponse(QuestionSchema, "Success"),
//   security: [{ BearerAuth: [] }],
// });

// questionRouter.patch(
//   "/:id/translate/:language/approve",
//   accessTokenGuard,
//   questionController.approveQuestionTranslation,
// );

// questionRegistry.registerPath({
//   method: "patch",
//   path: "/questions/{id}/translate/{language}/reject",
//   tags: ["Questions"],
//   description: "Reject a question translation (set field 'valid' in the locale to false)",
//   request: {
//     params: z.object({
//       id: z.string().min(1, { message: "Question ID is required" }),
//       language: z
//         .string()
//         .min(2, { message: "Language code is required" })
//         .max(2, { message: "Language code must be 2 characters" }),
//     }),
//   },
//   responses: createApiResponse(QuestionSchema, "Success"),
//   security: [{ BearerAuth: [] }],
// });

// questionRouter.patch("/:id/translate/:language/reject", accessTokenGuard, questionController.rejectQuestionTranslation);

questionRegistry.registerPath({
  method: "post",
  path: "/questions/{id}/confirm",
  tags: ["Questions"],
  description: "Save the question to the database (by default the question saved in the Redis cache only)",
  request: {
    params: z.object({
      id: z.string().min(1, { message: "Question ID is required" }),
    }),
  },
  responses: createApiResponse(QuestionSchema, "Success"),
  security: [{ BearerAuth: [] }],
});

questionRouter.post(
  "/:id/confirm",
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

questionRegistry.registerPath({
  method: "post",
  path: "/questions/translate/{questionId}",
  tags: ["Questions"],
  request: {
    params: z.object({
      questionId: z.string().min(1, { message: "Question ID is required" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            language: z.string().min(2, { message: "Language code is required" }),
          }),
          examples: {
            Deutsch: {
              value: {
                language: "de",
              },
              description: "Translate to German",
            },
            Français: {
              value: {
                language: "fr",
              },
              description: "Translate to French",
            },
            Español: {
              value: {
                language: "es",
              },
              description: "Translate to Spanish",
            },
            Ukrainian: {
              value: {
                language: "uk",
              },
              description: "Translate to Ukrainian",
            },
          },
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({
      translatedText: z.string().nullable(),
    }),
    "Success",
  ),
  security: [{ BearerAuth: [] }],
});

questionRouter.post(
  "/translate/:questionId",
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

// questionRegistry.registerPath({
//   method: "patch",
//   path: "/questions/{id}/status",
//   tags: ["Questions"],
//   request: {
//     params: z.object({
//       id: z.string().min(1, { message: "Question ID is required" }),
//     }),
//     body: {
//       content: {
//         "application/json": {
//           schema: z.object({
//             status: z.enum(["proof_reading", "approved", "rejected", "pending"]),
//           }),
//         },
//       },
//     },
//   },
//   responses: createApiResponse(QuestionSchema, "Success"),
//   security: [{ BearerAuth: [] }],
// });

// questionRouter.patch("/:id/status", accessTokenGuard, questionController.updateQuestionStatus);

questionRegistry.registerPath({
  method: "delete",
  path: "/questions/{id}",
  tags: ["Questions"],
  request: {
    params: z.object({
      id: z.string().min(1, { message: "Question ID is required" }),
    }),
  },
  responses: createApiResponse(QuestionSchema, "Success"),
  security: [{ BearerAuth: [] }],
});

questionRouter.delete("/:id", accessTokenGuard, questionController.deleteQuestion);

questionRegistry.registerPath({
  method: "delete",
  path: "/questions/{id}/translate/{language}",
  tags: ["Questions"],
  request: {
    params: z.object({
      id: z.string().min(1, { message: "Question ID is required" }),
      language: z
        .string()
        .min(2, { message: "Language code is required" })
        .max(2, { message: "Language code must be 2 characters" }),
    }),
  },
  responses: createApiResponse(QuestionSchema, "Success"),
  security: [{ BearerAuth: [] }],
});

questionRouter.delete("/:id/translate/:language", accessTokenGuard, questionController.deleteQuestionTranslation);
