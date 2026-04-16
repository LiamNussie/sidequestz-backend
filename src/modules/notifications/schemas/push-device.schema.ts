import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type PushDeviceDocument = HydratedDocument<PushDevice>;

export const PUSH_PLATFORMS = ['ios', 'android', 'web', 'expo'] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

@Schema({ timestamps: true, versionKey: false })
export class PushDevice {
  @Prop({ type: String, required: true, index: true })
  userId: string;

  @Prop({ required: true, trim: true })
  token: string;

  @Prop({ required: true, enum: PUSH_PLATFORMS })
  platform: PushPlatform;
}

export const PushDeviceSchema = SchemaFactory.createForClass(PushDevice);

PushDeviceSchema.index({ userId: 1, token: 1 }, { unique: true });
