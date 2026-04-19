import { HydratedDocument, SchemaTypes } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { LynkDmConversation } from './lynk-dm-conversation.schema';

export type LynkDmMessageDocument = HydratedDocument<LynkDmMessage>;

@Schema({ timestamps: true, versionKey: false })
export class LynkDmMessage {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: LynkDmConversation.name,
    required: true,
    index: true,
  })
  conversationId: string;

  @Prop({ type: String, required: true, index: true })
  senderId: string;

  @Prop({ required: true, trim: true, maxlength: 2000 })
  body: string;

  createdAt: Date;
  updatedAt: Date;
}

export const LynkDmMessageSchema = SchemaFactory.createForClass(LynkDmMessage);

LynkDmMessageSchema.index({ conversationId: 1, createdAt: -1 });
