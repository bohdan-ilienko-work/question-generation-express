import { ServiceResponse } from "@/common/models/serviceResponse";
import { logger } from "@/server";
import OpenAI from "openai";
// import { questionService } from "../question/questionService";
import { v4 as uuidv4 } from "uuid";
import type { GenerateQuestionsOpenAIDto } from "../question/dto/generate-questions-openai.dto";
import type { GenerateQuestionsDto } from "../question/dto/generate-questions.dto";
import { CategoryModel } from "../question/models/category.model";
import { type ILocaleSchema, type IQuestion, QuestionType } from "../question/models/question.model";

export class OpenAiService {
  private openAi: OpenAI;

  constructor() {
    this.openAi = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  async generateQuestionsV1(
    prompt: string,
    maxTokens: number | undefined,
    count: number,
    category: string | undefined,
  ): Promise<{
    questions: IQuestion[];
    totalTokensUsed: number;
    completionTokensUsed: number;
  }> {
    try {
      const response = await this.openAi.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "user",
            content: `Generate ${count} multiple-choice questions using the prompt: "${prompt}". Each question must have one correct and three incorrect answers in the "${category}" category.`,
          },
        ],
        functions: [
          {
            name: "create_questions",
            description: "Generate a list of structured multiple-choice questions",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      language: {
                        type: "string",
                        description: "Language of the question (e.g., en)",
                      },
                      question: {
                        type: "string",
                        description: "The text of the question",
                      },
                      correct: {
                        type: "string",
                        description: "The correct answer",
                      },
                      wrong: {
                        type: "array",
                        items: { type: "string" },
                        description: "List of incorrect answers",
                      },
                    },
                    required: ["language", "question", "correct", "wrong"],
                  },
                },
              },
              required: ["questions"],
            },
          },
        ],
        function_call: { name: "create_questions" },
        max_tokens: maxTokens,
      });

      logger.info(`OpenAI API Response: ${JSON.stringify(response, null, 2)}`);

      // Check if the response contains the function call arguments
      if (!response.choices[0]?.message?.function_call?.arguments) {
        throw new Error("No valid function response received from OpenAI.");
      }

      const functionArgs = JSON.parse(response.choices[0].message.function_call.arguments);

      // Validate the structure of the parsed arguments
      if (!functionArgs.questions || !Array.isArray(functionArgs.questions)) {
        throw new Error("Invalid function response structure.");
      }

      return {
        questions: functionArgs.questions.map((question: ILocaleSchema) => {
          return {
            // categoryId: category,
            status: "pending",
            type: QuestionType.OneChoice,
            difficulty: 3,
            requiredLanguages: ["en"], // TODO: Discuss with the team if we need by default to have multiple languages
            tags: [],
            locales: [
              {
                ...question,
                isValid: false,
              },
            ],
            isValid: false,
          };
        }),
        totalTokensUsed: response.usage?.total_tokens || 0,
        completionTokensUsed: response.usage?.completion_tokens || 0,
      };
    } catch (error) {
      logger.error(`Error generating questions: ${(error as Error).message}`);
      throw new Error("Failed to generate questions.");
    }
  }

  // async generateQuestionsV2(
  //   generateQuestionsDto: GenerateQuestionsDto,
  // ): Promise<{ questions: IQuestion[]; totalTokensUsed: number; completionTokensUsed: number }> {
  //   try {
  //     const {
  //       prompt,
  //       count,
  //       category,
  //       temperature,
  //       model,
  //       requiredLanguages: [locale],
  //     } = generateQuestionsDto;

  //     const response = await this.openAi.chat.completions.create({
  //       model,
  //       messages: [
  //         {
  //           role: "user",
  //           content: `Generate ${count} questions based on the prompt: "${prompt}".
  //                     Each question must belong to the "${category}" category and be in "${locale}".

  //                     Include reliable sources (e.g., Wikipedia, Britannica, government sites) for fact-checking, preferably with direct links.`,
  //         },
  //       ],
  //       functions: [
  //         {
  //           name: "create_questions",
  //           description: "Generate a list of structured multiple-choice questions with fact-checking sources",
  //           parameters: {
  //             type: "object",
  //             properties: {
  //               questions: {
  //                 type: "array",
  //                 items: {
  //                   type: "object",
  //                   properties: {
  //                     language: { type: "string", description: "Question language (e.g., en, de, pl)" },
  //                     question: { type: "string", description: "The question text" },
  //                     correct: {
  //                       type: "string",
  //                       description: "The correct answer(s)",
  //                     },
  //                     wrong: {
  //                       type: "array",
  //                       items: { type: "string" },
  //                       description: "List of incorrect answers",
  //                     },
  //                     sources: {
  //                       type: "array",
  //                       items: { type: "string" },
  //                       description: "List of URLs or references for fact-checking the question",
  //                     },
  //                   },
  //                   required: ["language", "question", "correct", "sources"],
  //                 },
  //               },
  //             },
  //             required: ["questions"],
  //           },
  //         },
  //       ],
  //       function_call: { name: "create_questions" },
  //       temperature,
  //     });

  //     logger.info(`OpenAI API Response: ${JSON.stringify(response, null, 2)}`);

  //     if (!response.choices[0]?.message?.function_call?.arguments) {
  //       throw new Error("No valid function response received from OpenAI.");
  //     }

  //     const functionArgs = JSON.parse(response.choices[0].message.function_call.arguments);

  //     if (!functionArgs.questions || !Array.isArray(functionArgs.questions)) {
  //       throw new Error("Invalid function response structure.");
  //     }

  //     return {
  //       questions: functionArgs.questions.map((question: ILocaleSchema) => ({
  //         id: uuidv4(),
  //         categoryId: category,
  //         status: "pending",
  //         type: QuestionType.OneChoice,
  //         difficulty: 3,
  //         requiredLanguages: [locale],
  //         tags: [],
  //         locales: [
  //           {
  //             ...question,
  //             isValid: false,
  //           },
  //         ],
  //         isValid: false,
  //       })),
  //       totalTokensUsed: response.usage?.total_tokens || 0,
  //       completionTokensUsed: response.usage?.completion_tokens || 0,
  //     };
  //   } catch (error) {
  //     logger.error(`Error generating questions: ${(error as Error).message}`);
  //     throw new Error("Failed to generate questions.");
  //   }
  // }

  async generateQuestionsV2(
    generateQuestionsDto: GenerateQuestionsDto,
  ): Promise<{ questions: IQuestion[]; totalTokensUsed: number; completionTokensUsed: number }> {
    try {
      const {
        category: categoryId,
        type,
        requiredLanguages: [locale],
      } = generateQuestionsDto;

      const category = await CategoryModel.findById(categoryId).lean();

      // 1️⃣ Build the prompt based on the question type
      const prompt = this.buildPrompt({
        ...generateQuestionsDto,
        category: category?.name || "",
      });

      // 2️⃣ Send a request to OpenAI
      const response = await this.fetchOpenAIResponse(prompt, generateQuestionsDto);

      // 3️⃣ Parse OpenAI's response and return structured questions
      const parsedQuestions = this.parseOpenAIResponse(response, categoryId, type, locale);

      return parsedQuestions;
    } catch (error) {
      logger.error(`Error generating questions: ${(error as Error).message}`);
      throw new Error("Failed to generate questions.");
    }
  }

  /**
   * Builds a prompt dynamically based on the question type.
   */
  private buildPrompt(generateQuestionsDto: GenerateQuestionsOpenAIDto): string {
    const {
      prompt,
      count,
      category,
      type,
      requiredLanguages: [locale],
    } = generateQuestionsDto;

    let basePrompt = `Generate ${count} questions based on the prompt: "${prompt}".  
                      Each question must belong to the "${category}" category and be in "${locale}".  
                      Include reliable sources (Wikipedia, Britannica, or Google Maps).`;

    if (type === "map") {
      basePrompt += ` Each question must involve identifying a specific location on a map.
                      The correct answer should be a pair of coordinates [latitude, longitude].
                      Do not generate incorrect answers.`;
    }

    return basePrompt;
  }

  /**
   * Sends a request to OpenAI.
   */
  private async fetchOpenAIResponse(prompt: string, generateQuestionsDto: GenerateQuestionsDto) {
    const { model, temperature, type } = generateQuestionsDto;

    return await this.openAi.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      functions: [
        {
          name: "create_questions",
          description: "Generate structured questions, including map-based questions with coordinates",
          parameters: {
            type: "object",
            properties: {
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    language: { type: "string", description: "Language of the question" },
                    question: { type: "string", description: "The question text" },
                    correct:
                      type === "map"
                        ? {
                            type: "array",
                            items: { type: "number" },
                            minItems: 2,
                            maxItems: 2,
                            description: "Latitude and longitude coordinates for the correct location",
                          }
                        : { type: "string", description: "The correct answer" },
                    wrong:
                      type === "map"
                        ? undefined
                        : {
                            type: "array",
                            items: { type: "string" },
                            description: "List of incorrect answers",
                          },
                    sources: {
                      type: "array",
                      items: { type: "string" },
                      description: "URLs for fact-checking (Wikipedia, Britannica, Google Maps)",
                    },
                  },
                  required:
                    type === "map"
                      ? ["language", "question", "correct", "sources"]
                      : ["language", "question", "correct", "wrong", "sources"],
                },
              },
            },
            required: ["questions"],
          },
        },
      ],
      function_call: { name: "create_questions" },
      temperature,
    });
  }

  /**
   * Parses OpenAI's response and extracts the generated questions.
   */
  private parseOpenAIResponse(
    response: any,
    category: number,
    type: QuestionType,
    locale: string,
  ): { questions: IQuestion[]; totalTokensUsed: number; completionTokensUsed: number } {
    logger.info(`OpenAI API Response: ${JSON.stringify(response, null, 2)}`);

    if (!response.choices[0]?.message?.function_call?.arguments) {
      throw new Error("No valid function response received from OpenAI.");
    }

    const functionArgs = JSON.parse(response.choices[0].message.function_call.arguments);

    if (!functionArgs.questions || !Array.isArray(functionArgs.questions)) {
      throw new Error("Invalid function response structure.");
    }

    return {
      questions: functionArgs.questions.map((question: any) => ({
        id: uuidv4(),
        categoryId: category,
        status: "pending",
        type,
        difficulty: 3,
        requiredLanguages: [locale],
        tags: [],
        locales: [
          {
            ...question,
            isValid: false,
          },
        ],
        isValid: false,
      })),
      totalTokensUsed: response.usage?.total_tokens || 0,
      completionTokensUsed: response.usage?.completion_tokens || 0,
    };
  }
}

export const openaiService = new OpenAiService();
