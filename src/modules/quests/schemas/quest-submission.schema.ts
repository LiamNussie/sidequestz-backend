import { HydratedDocument, SchemaTypes } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Quest } from './quest.schema';

export type QuestSubmissionDocument = HydratedDocument<QuestSubmission>;
export const QUEST_SUBMISSION_STATUSES = ['pending', 'completed'] as const;
export type QuestSubmissionStatus = (typeof QUEST_SUBMISSION_STATUSES)[number];

@Schema({ timestamps: true, versionKey: false })
export class QuestSubmission {
  @Prop({ type: String, required: true, index: true })
  userId: string;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: Quest.name,
    required: true,
    index: true,
  })
  questId: string;

  @Prop({ type: [String], required: true })
  imageUrls: string[];

  @Prop({ type: String, default: null })
  videoUrl: string | null;

  @Prop({ type: String, default: null })
  note: string | null;

  @Prop({
    required: true,
    enum: QUEST_SUBMISSION_STATUSES,
    default: 'completed',
  })
  status: QuestSubmissionStatus;

  @Prop({ type: Date, required: true, default: Date.now })
  submittedAt: Date;
}

export const QuestSubmissionSchema =
  SchemaFactory.createForClass(QuestSubmission);

QuestSubmissionSchema.index({ userId: 1, questId: 1 }, { unique: true });
