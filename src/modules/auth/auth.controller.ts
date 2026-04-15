import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccessTokenGuard } from './guards/access-token.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { AuthService } from './auth.service';
import { EmailDto } from './dto/email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { CheckUsernameDto } from './dto/check-username.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('verify-email')
  verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Post('resend-verification-otp')
  resendVerificationOtp(@Body() body: EmailDto) {
    return this.authService.resendVerificationOtp(body.email);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('check-username')
  checkUsernameAvailability(@Query() query: CheckUsernameDto) {
    return this.authService.checkUsernameAvailability(query.username);
  }

  @Post('forgot-password')
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('resend-password-reset-otp')
  resendPasswordResetOtp(@Body() body: EmailDto) {
    return this.authService.resendPasswordResetOtp(body.email);
  }

  @Post('reset-password')
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body);
  }

  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  refresh(
    @CurrentUser('userId') userId: string,
    @CurrentUser('email') email: string,
    @CurrentUser('role') role: 'user' | 'admin',
    @CurrentUser('refreshToken') refreshToken: string,
  ) {
    return this.authService.refreshTokens({
      sub: userId,
      email,
      role,
      refreshToken,
    });
  }

  @UseGuards(AccessTokenGuard)
  @Post('onboarding/complete')
  completeOnboarding(
    @CurrentUser('userId') userId: string,
    @Body() body: CompleteOnboardingDto,
  ) {
    return this.authService.completeOnboarding(userId, body);
  }

  @UseGuards(AccessTokenGuard)
  @Post('logout')
  logout(@CurrentUser('userId') userId: string) {
    return this.authService.logout(userId);
  }

  @UseGuards(AccessTokenGuard)
  @Get('me')
  me(@CurrentUser('userId') userId: string) {
    return this.authService.me(userId);
  }
}
