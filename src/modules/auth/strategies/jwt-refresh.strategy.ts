import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AppConfigService } from '../../../core/config/app-config.service';
import { JwtPayload } from '../types/jwt-payload.type';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(appConfig: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: appConfig.getJwtRefreshSecret(),
      passReqToCallback: true,
    });
  }

  validate(
    request: Request,
    payload: JwtPayload,
  ): {
    userId: string;
    email: string;
    role: 'user' | 'admin';
    refreshToken: string;
  } {
    const authHeader = request.get('authorization');
    const refreshToken = authHeader?.replace(/^Bearer\s+/i, '').trim();

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      refreshToken,
    };
  }
}
