import { Schema, model } from 'mongoose';

const personSchema = new Schema(
  {
    key: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
  },
  { _id: false },
);

const paymentSchema = new Schema(
  {
    personKey: { type: String, required: true },
    amountPaise: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const entrySchema = new Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 120 },
    amountPaise: { type: Number, required: true, min: 1 },
    paidBy: { type: paymentSchema, required: true },
    participantKeys: {
      type: [String],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: 'Pick at least one person to share this expense',
      },
    },
    date: { type: Date, default: Date.now },
  },
  { _id: true },
);

const publicSplitSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    people: { type: [personSchema], default: [] },
    expenses: { type: [entrySchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        delete ret._id;
        return ret;
      },
    },
  },
);

publicSplitSchema.index({ updatedAt: -1 });

export const PublicSplit = model('PublicSplit', publicSplitSchema);
