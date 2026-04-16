import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare as bcryptCompare, hash as bcryptHash } from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { AppConfigService } from '../../core/config/app-config.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { UserRole, UserSocials } from '../users/schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthTokensDto } from './dto/auth-tokens.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { JwtPayload, RefreshJwtPayload } from './types/jwt-payload.type';

function generateSixDigitOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function otpExpiresAtEpochMs(expiresAt: unknown): number {
  if (expiresAt instanceof Date) {
    return expiresAt.getTime();
  }
  if (typeof expiresAt === 'string') {
    const t = new Date(expiresAt).getTime();
    return Number.isNaN(t) ? Number.NaN : t;
  }
  if (typeof expiresAt === 'number' && Number.isFinite(expiresAt)) {
    return expiresAt;
  }
  return Number.NaN;
}

async function hashSecret(plain: string, saltRounds: number): Promise<string> {
  return bcryptHash(plain, saltRounds);
}

async function compareSecret(plain: string, digest: string): Promise<boolean> {
  return bcryptCompare(plain, digest);
}

type SafeUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  emailVerified: boolean;
  isOnboarded: boolean;
  totalXp: number;
  username: string | null;
  dateOfBirth: string | null;
  avatar: string | null;
  profileImages: string[];
  socials: UserSocials;
};

type AuthResponse = {
  user: SafeUser;
  tokens: AuthTokensDto;
};

type RegisterResponse = {
  message: string;
  user: SafeUser;
};

const GENERIC_EMAIL_SENT =
  'If an account exists for this email, we sent a message.';

function isAtLeast18YearsOld(date: Date): boolean {
  const now = new Date();
  const threshold = new Date(
    now.getFullYear() - 18,
    now.getMonth(),
    now.getDate(),
  );
  return date <= threshold;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly appConfig: AppConfigService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async register(registerDto: RegisterDto): Promise<RegisterResponse> {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await hashSecret(registerDto.password, 12);
    const otp = generateSixDigitOtp();
    const otpHash = await hashSecret(otp, 10);
    const expiresAt = this.buildOtpExpiryDate();

    const createdUser = await this.usersService.createUser({
      email: registerDto.email.toLowerCase(),
      name: registerDto.name.trim(),
      passwordHash,
      emailVerified: false,
      emailVerificationOtpHash: otpHash,
      emailVerificationOtpExpiresAt: expiresAt,
    });

    try {
      await this.mailService.sendVerificationOtp(createdUser.email, otp);
    } catch (error) {
      // Email delivery is required for onboarding, so rollback pending account.
      await this.usersService.deleteUserById(createdUser.id);
      this.logger.warn(
        `Rolled back unverified user ${createdUser.email} due to OTP email failure`,
      );
      throw error;
    }

    this.notificationsService.notifyRegistrationPending(createdUser.id);

    return {
      message:
        'Account created. Check your email for a 6-digit code to verify your address.',
      user: this.toSafeUser(createdUser),
    };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(
      verifyEmailDto.email,
      true,
    );
    if (!user) {
      throw new BadRequestException('Invalid email or code');
    }
    if (user.emailVerified) {
      throw new ConflictException('Email is already verified');
    }
    if (!user.emailVerificationOtpHash || !user.emailVerificationOtpExpiresAt) {
      throw new BadRequestException(
        'No verification code pending for this account',
      );
    }
    if (otpExpiresAtEpochMs(user.emailVerificationOtpExpiresAt) < Date.now()) {
      throw new BadRequestException('Verification code has expired');
    }

    const storedEmailOtpHash = user.emailVerificationOtpHash;
    if (typeof storedEmailOtpHash !== 'string') {
      throw new BadRequestException('Invalid email or code');
    }

    const otpOk = await compareSecret(verifyEmailDto.otp, storedEmailOtpHash);
    if (!otpOk) {
      throw new BadRequestException('Invalid email or code');
    }

    await this.usersService.markEmailVerified(user.id);

    const refreshed = await this.usersService.findById(user.id);
    if (!refreshed) {
      throw new UnauthorizedException('User no longer exists');
    }

    const tokens = await this.generateTokens({
      sub: refreshed.id,
      email: refreshed.email,
      role: refreshed.role,
    });
    await this.usersService.setRefreshTokenHash(
      refreshed.id,
      await hashSecret(tokens.refreshToken, 12),
    );

    this.notificationsService.notifyEmailVerified(
      refreshed.id,
      refreshed.email,
    );

    return { user: this.toSafeUser(refreshed), tokens };
  }

  async resendVerificationOtp(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user || user.emailVerified) {
      return { message: GENERIC_EMAIL_SENT };
    }

    const otp = generateSixDigitOtp();
    const otpHash = await hashSecret(otp, 10);
    const expiresAt = this.buildOtpExpiryDate();
    await this.usersService.setEmailVerificationOtp(
      user.id,
      otpHash,
      expiresAt,
    );
    await this.mailService.sendVerificationOtp(user.email, otp);

    return { message: GENERIC_EMAIL_SENT };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(loginDto.email, true);
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before signing in',
      );
    }

    const isPasswordValid = await compareSecret(
      loginDto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    await this.usersService.setRefreshTokenHash(
      user.id,
      await hashSecret(tokens.refreshToken, 12),
    );

    this.notificationsService.notifyLoginSuccess(user.id);

    return { user: this.toSafeUser(user), tokens };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (user) {
      const otp = generateSixDigitOtp();
      const otpHash = await hashSecret(otp, 10);
      const expiresAt = this.buildOtpExpiryDate();
      await this.usersService.setPasswordResetOtp(user.id, otpHash, expiresAt);
      await this.mailService.sendPasswordResetOtp(user.email, otp);
      this.notificationsService.notifyPasswordResetRequested(user.id);
    }
    return { message: GENERIC_EMAIL_SENT };
  }

  async resendPasswordResetOtp(email: string): Promise<{ message: string }> {
    return this.forgotPassword(email);
  }

  async checkUsernameAvailability(
    username: string,
  ): Promise<{ username: string; available: boolean }> {
    const normalizedUsername = username.trim().toLowerCase();
    const existing = await this.usersService.findByUsername(normalizedUsername);
    return {
      username: normalizedUsername,
      available: !existing,
    };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(
      resetPasswordDto.email,
      true,
    );
    if (!user?.passwordResetOtpHash || !user.passwordResetOtpExpiresAt) {
      throw new BadRequestException('Invalid email or code');
    }
    if (otpExpiresAtEpochMs(user.passwordResetOtpExpiresAt) < Date.now()) {
      throw new BadRequestException('Reset code has expired');
    }

    const storedResetOtpHash = user.passwordResetOtpHash;
    if (typeof storedResetOtpHash !== 'string') {
      throw new BadRequestException('Invalid email or code');
    }

    const otpOk = await compareSecret(resetPasswordDto.otp, storedResetOtpHash);
    if (!otpOk) {
      throw new BadRequestException('Invalid email or code');
    }

    const passwordHash = await hashSecret(resetPasswordDto.newPassword, 12);
    await this.usersService.updatePasswordAndInvalidateSessions(
      user.id,
      passwordHash,
    );

    this.notificationsService.notifyPasswordResetSuccess(user.id, user.email);

    return { message: 'Password was reset successfully' };
  }

  async completeOnboarding(
    userId: string,
    dto: CompleteOnboardingDto,
  ): Promise<{ user: SafeUser; message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    if (user.isOnboarded) {
      throw new ConflictException('Onboarding is already completed');
    }

    const normalizedUsername = dto.username.trim().toLowerCase();
    const existingWithUsername =
      await this.usersService.findByUsername(normalizedUsername);
    if (existingWithUsername && existingWithUsername.id !== userId) {
      throw new ConflictException('Username is already taken');
    }

    const dob = new Date(dto.dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      throw new BadRequestException('dateOfBirth must be a valid date');
    }
    if (!isAtLeast18YearsOld(dob)) {
      throw new BadRequestException('You must be at least 18 years old');
    }

    const socials: UserSocials = {
      x: dto.socials?.x?.trim() || '',
      instagram: dto.socials?.instagram?.trim() || '',
      tiktok: dto.socials?.tiktok?.trim() || '',
    };
    if (!socials.x && !socials.instagram && !socials.tiktok) {
      throw new BadRequestException(
        'At least one social handle is required (x, instagram, or tiktok)',
      );
    }

    await this.usersService.completeOnboarding(userId, {
      username: normalizedUsername,
      dateOfBirth: dob,
      avatar: dto.avatar.trim(),
      profileImages: dto.profileImages ?? [],
      socials,
    });

    this.notificationsService.notifyOnboardingCompleted(userId);

    const refreshed = await this.usersService.findById(userId);
    if (!refreshed) {
      throw new UnauthorizedException('User no longer exists');
    }

    return {
      message: 'Onboarding completed successfully',
      user: this.toSafeUser(refreshed),
    };
  }

  async refreshTokens(payload: RefreshJwtPayload): Promise<AuthTokensDto> {
    const user = await this.usersService.findById(payload.sub, true);
    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    const isMatch = await compareSecret(
      payload.refreshToken,
      user.refreshTokenHash,
    );
    if (!isMatch) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    await this.usersService.setRefreshTokenHash(
      user.id,
      await hashSecret(tokens.refreshToken, 12),
    );

    return tokens;
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.usersService.setRefreshTokenHash(userId, null);
    this.notificationsService.notifyLogout(userId);
    return { message: 'Logged out successfully' };
  }

  async me(userId: string): Promise<SafeUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return this.toSafeUser(user);
  }

  private buildOtpExpiryDate(): Date {
    const minutes = this.appConfig.getOtpExpiresMinutes();
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  private async generateTokens(payload: JwtPayload): Promise<AuthTokensDto> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.appConfig.getJwtAccessSecret(),
        expiresIn: this.appConfig.getJwtAccessExpiresInSeconds(),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.appConfig.getJwtRefreshSecret(),
        expiresIn: this.appConfig.getJwtRefreshExpiresInSeconds(),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private toSafeUser(user: {
    id: string;
    email: string;
    name: string;
    role?: UserRole;
    emailVerified?: boolean;
    isOnboarded?: boolean;
    totalXp?: number;
    username?: string | null;
    dateOfBirth?: Date | string | null;
    avatar?: string | null;
    profileImages?: string[];
    socials?: UserSocials;
  }): SafeUser {
    const dobValue = user.dateOfBirth;
    const dobIso =
      dobValue instanceof Date
        ? dobValue.toISOString()
        : typeof dobValue === 'string'
          ? dobValue
          : null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role ?? 'user',
      emailVerified: user.emailVerified === true,
      isOnboarded: user.isOnboarded === true,
      totalXp: user.totalXp ?? 0,
      username: user.username ?? null,
      dateOfBirth: dobIso,
      avatar: user.avatar ?? null,
      profileImages: user.profileImages ?? [],
      socials: user.socials ?? { x: '', instagram: '', tiktok: '' },
    };
  }
}
