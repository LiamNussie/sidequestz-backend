import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserSocials } from './schemas/user.schema';

const SENSITIVE_SELECT =
  '+passwordHash +refreshTokenHash +emailVerificationOtpHash +emailVerificationOtpExpiresAt +passwordResetOtpHash +passwordResetOtpExpiresAt';

type CreateUserInput = {
  email: string;
  name: string;
  passwordHash: string;
  emailVerified: boolean;
  emailVerificationOtpHash: string;
  emailVerificationOtpExpiresAt: Date;
};

type CompleteOnboardingInput = {
  username: string;
  dateOfBirth: Date;
  avatar: string;
  profileImages: string[];
  socials: UserSocials;
};

type UpdateProfileInput = {
  name?: string;
  username?: string;
  dateOfBirth?: Date;
  avatar?: string;
  profileImages?: string[];
  socials?: UserSocials;
};

type FindAllUsersInput = {
  page: number;
  limit: number;
  search?: string;
};

@Injectable()
export class UsersRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  create(input: CreateUserInput): Promise<UserDocument> {
    return this.userModel.create(input);
  }

  findByEmail(
    email: string,
    includeSensitive = false,
  ): Promise<UserDocument | null> {
    const query = this.userModel.findOne({ email: email.toLowerCase() });
    if (includeSensitive) {
      query.select(SENSITIVE_SELECT);
    }
    return query.exec();
  }

  findById(id: string, includeSensitive = false): Promise<UserDocument | null> {
    const query = this.userModel.findById(id);
    if (includeSensitive) {
      query.select(SENSITIVE_SELECT);
    }
    return query.exec();
  }

  findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async findAllUsers(input: FindAllUsersInput): Promise<{
    data: UserDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page, limit, search } = input;
    const skip = (page - 1) * limit;

    const filter: {
      $or?: Array<{ name?: RegExp; username?: RegExp; email?: RegExp }>;
    } = {};

    const searchTerm = search?.trim();
    if (searchTerm) {
      const regex = new RegExp(searchTerm, 'i');
      filter.$or = [{ name: regex }, { username: regex }, { email: regex }];
    }

    const [data, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  deleteById(id: string): Promise<void> {
    return this.userModel
      .findByIdAndDelete(id)
      .exec()
      .then(() => undefined);
  }

  updateRefreshTokenHash(
    id: string,
    refreshTokenHash: string | null,
  ): Promise<void> {
    return this.userModel
      .findByIdAndUpdate(id, { refreshTokenHash }, { new: false })
      .exec()
      .then(() => undefined);
  }

  updateEmailVerificationOtp(
    id: string,
    emailVerificationOtpHash: string,
    emailVerificationOtpExpiresAt: Date,
  ): Promise<void> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        { emailVerificationOtpHash, emailVerificationOtpExpiresAt },
        { new: false },
      )
      .exec()
      .then(() => undefined);
  }

  markEmailVerifiedAndClearEmailOtp(id: string): Promise<void> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        {
          emailVerified: true,
          emailVerificationOtpHash: null,
          emailVerificationOtpExpiresAt: null,
        },
        { new: false },
      )
      .exec()
      .then(() => undefined);
  }

  updatePasswordResetOtp(
    id: string,
    passwordResetOtpHash: string,
    passwordResetOtpExpiresAt: Date,
  ): Promise<void> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        { passwordResetOtpHash, passwordResetOtpExpiresAt },
        { new: false },
      )
      .exec()
      .then(() => undefined);
  }

  clearPasswordResetOtp(id: string): Promise<void> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        { passwordResetOtpHash: null, passwordResetOtpExpiresAt: null },
        { new: false },
      )
      .exec()
      .then(() => undefined);
  }

  updatePasswordHashAndClearResetAndRefresh(
    id: string,
    passwordHash: string,
  ): Promise<void> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        {
          passwordHash,
          passwordResetOtpHash: null,
          passwordResetOtpExpiresAt: null,
          refreshTokenHash: null,
        },
        { new: false },
      )
      .exec()
      .then(() => undefined);
  }

  completeOnboarding(
    id: string,
    payload: CompleteOnboardingInput,
  ): Promise<void> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        {
          isOnboarded: true,
          username: payload.username,
          dateOfBirth: payload.dateOfBirth,
          avatar: payload.avatar,
          profileImages: payload.profileImages,
          socials: payload.socials,
        },
        { new: false },
      )
      .exec()
      .then(() => undefined);
  }

  updateProfile(
    id: string,
    payload: UpdateProfileInput,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
      })
      .exec();
  }
}
