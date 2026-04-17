import { Injectable } from '@nestjs/common';
import { UserDocument, UserGender, UserSocials } from './schemas/user.schema';
import { UsersRepository } from './users.repository';

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
  gender?: UserGender;
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
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  createUser(input: CreateUserInput): Promise<UserDocument> {
    return this.usersRepository.create(input);
  }

  findByEmail(
    email: string,
    includeSensitive = false,
  ): Promise<UserDocument | null> {
    return this.usersRepository.findByEmail(email, includeSensitive);
  }

  findById(id: string, includeSensitive = false): Promise<UserDocument | null> {
    return this.usersRepository.findById(id, includeSensitive);
  }

  findByUsername(username: string): Promise<UserDocument | null> {
    return this.usersRepository.findByUsername(username);
  }

  findAllUsers(input: FindAllUsersInput): Promise<{
    data: UserDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.usersRepository.findAllUsers(input);
  }

  deleteUserById(id: string): Promise<void> {
    return this.usersRepository.deleteById(id);
  }

  setRefreshTokenHash(
    id: string,
    refreshTokenHash: string | null,
  ): Promise<void> {
    return this.usersRepository.updateRefreshTokenHash(id, refreshTokenHash);
  }

  setEmailVerificationOtp(
    id: string,
    hash: string,
    expiresAt: Date,
  ): Promise<void> {
    return this.usersRepository.updateEmailVerificationOtp(id, hash, expiresAt);
  }

  markEmailVerified(id: string): Promise<void> {
    return this.usersRepository.markEmailVerifiedAndClearEmailOtp(id);
  }

  setPasswordResetOtp(
    id: string,
    hash: string,
    expiresAt: Date,
  ): Promise<void> {
    return this.usersRepository.updatePasswordResetOtp(id, hash, expiresAt);
  }

  clearPasswordResetOtp(id: string): Promise<void> {
    return this.usersRepository.clearPasswordResetOtp(id);
  }

  updatePasswordAndInvalidateSessions(
    id: string,
    passwordHash: string,
  ): Promise<void> {
    return this.usersRepository.updatePasswordHashAndClearResetAndRefresh(
      id,
      passwordHash,
    );
  }

  completeOnboarding(
    id: string,
    payload: CompleteOnboardingInput,
  ): Promise<void> {
    return this.usersRepository.completeOnboarding(id, payload);
  }

  updateProfile(
    id: string,
    payload: UpdateProfileInput,
  ): Promise<UserDocument | null> {
    return this.usersRepository.updateProfile(id, payload);
  }
}
