import { HydratedDocument, SchemaTypes } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Event } from '../../events/schemas/event.schema';

export type LynkupDocument = HydratedDocument<Lynkup>;

export const LYNKUP_STATUSES = ['open', 'closed', 'full'] as const;
export type LynkupStatus = (typeof LYNKUP_STATUSES)[number];

export type LynkupParticipantGender = 'male' | 'female';

@Schema({ timestamps: true, versionKey: false })
export class Lynkup {
  @Prop({ type: String, required: true, index: true })
  creatorId: string;

  @Prop({ required: true, trim: true, maxlength: 200 })
  title: string;

  @Prop({ type: String, default: null, trim: true, maxlength: 5000 })
  description: string | null;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: Event.name,
    required: true,
    index: true,
  })
  eventId: string;

  @Prop({ type: Number, required: true, min: 2, max: 6 })
  maxParticipants: number;

  @Prop({
    type: String,
    enum: ['male', 'female'],
    default: null,
  })
  participantGender: LynkupParticipantGender | null;

  @Prop({ type: [String], required: true })
  participants: string[];

  @Prop({ required: true, enum: LYNKUP_STATUSES, default: 'open' })
  status: LynkupStatus;
}

export const LynkupSchema = SchemaFactory.createForClass(Lynkup);
