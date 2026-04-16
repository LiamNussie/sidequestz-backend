import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type UserDocument = HydratedDocument<User>;
export type UserRole = 'user' | 'admin';
export type UserSocials = {
  x?: string;
  instagram?: string;
  tiktok?: string;
};

@Schema({ timestamps: true, versionKey: false })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
    immutable: true,
  })
  role: UserRole;

  @Prop({ type: Boolean, default: false })
  isOnboarded: boolean;

  @Prop({ type: Number, default: 0, min: 0 })
  totalXp: number;

  /** Set whenever `totalXp` increases; used for leaderboard ties (earlier = higher rank). */
  @Prop({ type: Date, default: null })
  lastXpMilestoneAt: Date | null;

  @Prop({ type: String, trim: true, unique: true, sparse: true, default: null })
  username: string | null;

  @Prop({ type: Date, default: null })
  dateOfBirth: Date | null;

  @Prop({ type: String, default: null })
  avatar: string | null;

  @Prop({ type: [String], default: [] })
  profileImages: string[];

  @Prop({
    type: {
      x: { type: String, default: '' },
      instagram: { type: String, default: '' },
      tiktok: { type: String, default: '' },
    },
    default: { x: '', instagram: '', tiktok: '' },
  })
  socials: UserSocials;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ type: String, default: null, select: false })
  refreshTokenHash: string | null;

  @Prop({ type: Boolean, default: false })
  emailVerified: boolean;

  @Prop({ type: String, default: null, select: false })
  emailVerificationOtpHash: string | null;

  @Prop({ type: Date, default: null, select: false })
  emailVerificationOtpExpiresAt: Date | null;

  @Prop({ type: String, default: null, select: false })
  passwordResetOtpHash: string | null;

  @Prop({ type: Date, default: null, select: false })
  passwordResetOtpExpiresAt: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ totalXp: -1, lastXpMilestoneAt: 1, createdAt: 1 });
