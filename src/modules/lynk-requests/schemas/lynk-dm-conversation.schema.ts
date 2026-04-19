import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type LynkDmConversationDocument = HydratedDocument<LynkDmConversation>;

@Schema({ timestamps: true, versionKey: false })
export class LynkDmConversation {
  /** Exactly two user ids, sorted lexicographically for uniqueness. */
  @Prop({ type: [String], required: true })
  participants: string[];
}

export const LynkDmConversationSchema =
  SchemaFactory.createForClass(LynkDmConversation);

LynkDmConversationSchema.index({ participants: 1 }, { unique: true });
