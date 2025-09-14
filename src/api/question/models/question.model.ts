import mongoose, { Schema, type Document } from "mongoose";
import type { ICategory } from "./category.model";

export type QuestionStatus = "generated" | "proof_reading" | "approved" | "rejected" | "pending" | "in_progress";

export interface ILocaleSchema {
  language: string;
  question: string;
  correct: string | [number, number];
  wrong?: string[];
  isValid: boolean;
}

export enum QuestionType {
  Choice = "choice",
  Map = "map",
}

/** Suggested image metadata saved from the microservice */
export interface ISuggestedImage {
  id: string; // uuid v4
  url: string;
  title?: string;
  source?: string;
  origin?: string; // e.g. "image-links"
  createdAt: Date;
}

export interface IQuestion extends Document {
  categoryId: number | ICategory;
  status: QuestionStatus;
  mainDbId?: number;
  track?: string;
  type: QuestionType;
  difficulty: number; // 1-5
  requiredLanguages: string[];
  audioId?: string;
  imageId?: string;
  authorId?: mongoose.Schema.Types.ObjectId;
  tags: string[];
  locales: ILocaleSchema[];
  isValid: boolean;
  createdAt: Date;
  updatedAt: Date;
  source?: string;

  /** New: suggested image links proposed by the microservice */
  suggestedImages: ISuggestedImage[];
}

const LocaleSchema = new Schema<ILocaleSchema>({
  language: { type: String, required: true },
  question: { type: String, required: true },
  correct: { type: Schema.Types.Mixed, required: true },
  wrong: { type: [String], required: false },
  isValid: { type: Boolean, default: false },
});

/** Embedded subdocument without own _id; we use our string id */
const SuggestedImageSchema = new Schema<ISuggestedImage>(
  {
    id: { type: String, required: true }, // uuid v4
    url: { type: String, required: true },
    title: { type: String },
    source: { type: String },
    origin: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const QuestionSchema = new Schema<IQuestion>(
  {
    categoryId: { type: Number, ref: "Category", required: true },
    mainDbId: { type: Number, required: false },
    status: {
      type: String,
      enum: ["generated", "proof_reading", "approved", "rejected", "pending", "in_progress"],
      required: true,
    },
    track: { type: String },
    type: { type: String, enum: Object.values(QuestionType), required: true, default: QuestionType.Choice },
    difficulty: { type: Number, min: 1, max: 5, required: true },
    requiredLanguages: { type: [String], required: true },
    audioId: { type: String },
    imageId: { type: String },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "Author", required: false },
    tags: { type: [String], required: true },
    locales: { type: [LocaleSchema], required: true },
    isValid: { type: Boolean, default: false },
    source: { type: String },

    /** New: where we store proposed links */
    suggestedImages: { type: [SuggestedImageSchema], default: [] },
  },
  { timestamps: true },
);

export const QuestionModel = mongoose.model<IQuestion>("Question", QuestionSchema);
