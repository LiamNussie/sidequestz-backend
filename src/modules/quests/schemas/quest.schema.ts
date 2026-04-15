import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type QuestDocument = HydratedDocument<Quest>;
export const QUEST_DIFFICULTIES = [
  'rookie',
  'amateur',
  'pro',
  'quester',
  'impossible',
] as const;
export type QuestDifficulty = (typeof QUEST_DIFFICULTIES)[number];

@Schema({ timestamps: true, versionKey: false })
export class Quest {
  @Prop({ required: true, trim: true, maxlength: 120 })
  title: string;

  @Prop({ required: true, trim: true, maxlength: 1500 })
  description: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ required: true, enum: QUEST_DIFFICULTIES })
  difficulty: QuestDifficulty;

  @Prop({ type: [String], default: [] })
  instructions: string[];

  @Prop({ required: true, min: 0, default: 0 })
  activePlayers: number;

  @Prop({ required: true, min: 0, default: 0 })
  completedCount: number;
}

export const QuestSchema = SchemaFactory.createForClass(Quest);
