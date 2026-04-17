import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type EventDocument = HydratedDocument<Event>;

@Schema({ timestamps: true, versionKey: false })
export class Event {
  @Prop({ required: true, trim: true, maxlength: 200 })
  name: string;

  @Prop({ type: String, default: null, trim: true, maxlength: 5000 })
  description: string | null;

  @Prop({ type: Date, required: true, index: true })
  date: Date;

  @Prop({ required: true, trim: true, maxlength: 2000 })
  bannerUrl: string;

  @Prop({ type: String, default: null, trim: true, maxlength: 500 })
  location: string | null;

  @Prop({ type: String, default: null, trim: true, maxlength: 2000 })
  ticketLink: string | null;
}

export const EventSchema = SchemaFactory.createForClass(Event);
