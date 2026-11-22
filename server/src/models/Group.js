import { Schema, model } from 'mongoose';

const groupSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', trim: true, maxlength: 500 },
    emoji: { type: String, default: '👥', maxlength: 8 },
    imageUrl: { type: String, default: '' },
    members: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    archived: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  },
);

groupSchema.index({ members: 1 });
groupSchema.index({ createdBy: 1 });

export const Group = model('Group', groupSchema);
