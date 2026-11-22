import { Schema, model } from 'mongoose';

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    icon: { type: String, default: 'Receipt', maxlength: 40 },
    color: { type: String, default: '#6366f1', maxlength: 20 },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  },
);

categorySchema.index({ name: 1, createdBy: 1 }, { unique: true });

export const Category = model('Category', categorySchema);
