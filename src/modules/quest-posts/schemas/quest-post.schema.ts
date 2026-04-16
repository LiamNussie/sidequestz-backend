import { HydratedDocument, SchemaTypes } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { QuestSubmission } from '../../quests/schemas/quest-submission.schema';

export type QuestPostDocument = HydratedDocument<QuestPost>;

@Schema({ timestamps: true, versionKey: false })
export class QuestPost {
  @Prop({ type: String, required: true, index: true })
  userId: string;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: QuestSubmission.name,
    required: true,
    unique: true,
    index: true,
  })
  submissionId: string;

  @Prop({ required: true, trim: true, maxlength: 2000 })
  caption: string;
}

export const QuestPostSchema = SchemaFactory.createForClass(QuestPost);
