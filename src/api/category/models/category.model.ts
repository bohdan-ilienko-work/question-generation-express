const mongooseOld = require(require.resolve("mongoose-old", { paths: ["./mongoose-legacy/node_modules"] }));

const { Schema, model, Document, Model } = mongooseOld;

export interface ICategoryLocaleSchema {
  language: string;
  value: string;
}

export interface ICategory extends Document {
  _id: number;
  name: string;
  parentId: number | null;
  ancestors: number[];
  hash?: string;
  locales: ICategoryLocaleSchema[];
}

const CategoryLocaleSchema = new Schema(
  {
    language: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false },
);

const CategorySchema = new Schema({
  _id: { type: Number, required: true },
  name: { type: String, required: true },
  parentId: { type: Number, ref: "Category", default: null },
  ancestors: { type: [Number], default: [] },
  hash: { type: String, required: false },
  locales: { type: [CategoryLocaleSchema], required: true, default: [] },
});

export const CategoryModel: typeof Model = model("Category", CategorySchema);
