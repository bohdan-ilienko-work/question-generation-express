import mongoose, { Schema, type Document, type Types } from "mongoose";

export type ImageFormat = {
  ext: string; // e.g. "png"
  mime: string; // e.g. "image/png"
};

export type ImageVariantMetadata = {
  format: ImageFormat;
  width: number;
  height: number;
  size: number; // bytes
};

export type ImageVariant = {
  data: Buffer;
  metadata: ImageVariantMetadata;
};

export interface IImage extends Document {
  uploaderId?: Types.ObjectId;
  high: ImageVariant;
  low: ImageVariant;
  name: string;
  hash: string;
  createdAt: Date;
  updatedAt: Date;
}

const ImageFormatSchema = new Schema<ImageFormat>(
  {
    ext: { type: String, required: true },
    mime: { type: String, required: true },
  },
  { _id: false },
);

const ImageVariantMetadataSchema = new Schema<ImageVariantMetadata>(
  {
    format: { type: ImageFormatSchema, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    size: { type: Number, required: true },
  },
  { _id: false },
);

const ImageVariantSchema = new Schema<ImageVariant>(
  {
    data: { type: Buffer, required: true },
    metadata: { type: ImageVariantMetadataSchema, required: true },
  },
  { _id: false },
);

const ImageSchema = new Schema<IImage>(
  {
    uploaderId: { type: Schema.Types.ObjectId, required: false },
    high: { type: ImageVariantSchema, required: true },
    low: { type: ImageVariantSchema, required: true },
    name: { type: String, required: true },
    hash: { type: String, required: true, index: true },
  },
  { timestamps: true },
);

export const ImageModel = mongoose.model<IImage>("Image", ImageSchema);
