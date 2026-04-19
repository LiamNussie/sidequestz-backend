import { HydratedDocument, SchemaTypes } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type LynkRequestDocument = HydratedDocument<LynkRequest>;

export const LYNK_REQUEST_STATUSES = ['pending', 'accepted', 'declined'] as const;
export type LynkRequestStatus = (typeof LYNK_REQUEST_STATUSES)[number];

@Schema({ timestamps: true, versionKey: false })
export class LynkRequest {
  @Prop({ type: String, required: true, index: true })
  fromUserId: string;

  @Prop({ type: String, required: true, index: true })
  toUserId: string;

  @Prop({
    type: String,
    required: true,
    enum: LYNK_REQUEST_STATUSES,
    default: 'pending',
  })
  status: LynkRequestStatus;

  createdAt: Date;
  updatedAt: Date;
}

export const LynkRequestSchema = SchemaFactory.createForClass(LynkRequest);

LynkRequestSchema.index(
  { fromUserId: 1, toUserId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' },
  },
);
