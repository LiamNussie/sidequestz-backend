import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  getPort(): number {
    return this.configService.getOrThrow<number>('app.port');
  }

  getCorsOrigin(): string {
    return this.configService.getOrThrow<string>('app.corsOrigin');
  }

  getMongoUri(): string {
    return this.configService.getOrThrow<string>('db.mongoUri');
  }

  getJwtAccessSecret(): string {
    return this.configService.getOrThrow<string>('jwt.accessSecret');
  }

  getJwtAccessExpiresInSeconds(): number {
    return this.configService.getOrThrow<number>('jwt.accessExpiresInSeconds');
  }

  getJwtRefreshSecret(): string {
    return this.configService.getOrThrow<string>('jwt.refreshSecret');
  }

  getJwtRefreshExpiresInSeconds(): number {
    return this.configService.getOrThrow<number>('jwt.refreshExpiresInSeconds');
  }

  getNodeEnv(): string {
    return this.configService.get<string>('NODE_ENV') ?? 'development';
  }

  getResendApiKey(): string | undefined {
    const key = this.configService.get<string>('mail.resendApiKey');
    return key && key.length > 0 ? key : undefined;
  }

  getMailFrom(): string {
    return this.configService.getOrThrow<string>('mail.mailFrom');
  }

  getRedisUrl(): string {
    return this.configService.getOrThrow<string>('redis.url');
  }

  getLynkFinderRadiusM(): number {
    return this.configService.getOrThrow<number>('lynkFinder.radiusM');
  }

  getLynkFinderPresenceTtlSeconds(): number {
    return this.configService.getOrThrow<number>('lynkFinder.presenceTtlSeconds');
  }

  getLynkFinderMinUpdateIntervalMs(): number {
    return this.configService.getOrThrow<number>(
      'lynkFinder.minUpdateIntervalMs',
    );
  }

  getOtpExpiresMinutes(): number {
    const raw: unknown = this.configService.get('mail.otpExpiresMinutes');
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return Math.min(60, Math.max(1, Math.floor(raw)));
    }
    if (typeof raw === 'string') {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed)) {
        return Math.min(60, Math.max(1, parsed));
      }
    }
    return 10;
  }
}
