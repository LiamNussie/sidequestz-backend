import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type LynkupChatMessageDocument = HydratedDocument<LynkupChatMessage>;

@Schema({ timestamps: true, versionKey: false })
export class LynkupChatMessage {
  @Prop({ type: String, required: true, index: true })
  lynkupId: string;

  @Prop({ type: String, required: true, index: true })
  senderId: string;

  @Prop({ required: true, trim: true, maxlength: 2000 })
  body: string;

  createdAt: Date;
  updatedAt: Date;
}

export const LynkupChatMessageSchema =
  SchemaFactory.createForClass(LynkupChatMessage);

LynkupChatMessageSchema.index({ lynkupId: 1, createdAt: -1 });
