import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type SuggestedQuestDocument = HydratedDocument<SuggestedQuest>;

@Schema({ timestamps: true, versionKey: false })
export class SuggestedQuest {
  @Prop({ required: true, trim: true, maxlength: 120 })
  title: string;

  @Prop({ required: true, trim: true, maxlength: 1500 })
  description: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ required: true, index: true })
  creatorId: string;

  @Prop({ required: true, lowercase: true, trim: true })
  creatorEmail: string;

  @Prop({ required: true, min: 0, default: 0 })
  upvotes: number;

  @Prop({ required: true, min: 0, default: 0 })
  downvotes: number;

  @Prop({ type: [String], default: [], select: false })
  upvoterIds: string[];

  @Prop({ type: [String], default: [], select: false })
  downvoterIds: string[];
}

export const SuggestedQuestSchema =
  SchemaFactory.createForClass(SuggestedQuest);
