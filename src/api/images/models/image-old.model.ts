// src/api/images/models/image.model.ts
/* eslint-disable @typescript-eslint/no-var-requires */
const mongooseOld = require(require.resolve("mongoose-old", { paths: ["./mongoose-legacy/node_modules"] }));

const { Schema, model, Document, Model } = mongooseOld;

/** Types */
export interface IImageVariantFormat {
  ext: string;
  mime: string;
}

export interface IImageVariantMetadata {
  format: IImageVariantFormat;
  width: number;
  height: number;
  size: number;
}

export interface IImageVariant {
  data: Buffer;
  metadata: IImageVariantMetadata;
}

export interface IImage extends Document {
  uploaderId: typeof Schema.Types.ObjectId;
  high: IImageVariant;
  low: IImageVariant;
  name: string;
  hash: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Subschemas */
const ImageVariantFormatSchema = new Schema(
  {
    ext: { type: String, required: true },
    mime: { type: String, required: true },
  },
  { _id: false },
);

const ImageVariantMetadataSchema = new Schema(
  {
    format: { type: ImageVariantFormatSchema, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    size: { type: Number, required: true },
  },
  { _id: false },
);

const ImageVariantSchema = new Schema(
  {
    data: { type: Buffer, required: true },
    metadata: { type: ImageVariantMetadataSchema, required: true },
  },
  { _id: false },
);

/** Root schema */
const ImageSchema = new Schema(
  {
    uploaderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    high: { type: ImageVariantSchema, required: true },
    low: { type: ImageVariantSchema, required: true },
    name: { type: String, required: true },
    hash: { type: String, required: true, index: true }, // set unique: true if you want to dedupe
  },
  { timestamps: true },
);

export const OldImageModel: typeof Model = model("Image", ImageSchema);
