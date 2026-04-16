import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Resend } from 'resend';
import { AppConfigService } from '../../core/config/app-config.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;

  constructor(private readonly appConfig: AppConfigService) {
    const apiKey = this.appConfig.getResendApiKey();
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async sendVerificationOtp(to: string, code: string): Promise<void> {
    const minutes = this.appConfig.getOtpExpiresMinutes();
    await this.sendTransactional({
      to,
      subject: 'Your email verification code',
      html: `<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in ${String(minutes)} minute(s).</p>`,
    });
  }

  async sendPasswordResetOtp(to: string, code: string): Promise<void> {
    const minutes = this.appConfig.getOtpExpiresMinutes();
    await this.sendTransactional({
      to,
      subject: 'Your password reset code',
      html: `<p>Your password reset code is <strong>${code}</strong>.</p><p>It expires in ${String(minutes)} minute(s).</p><p>If you did not request this, you can ignore this email.</p>`,
    });
  }

  async sendHtmlEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    await this.sendTransactional({ to, subject, html });
  }

  private async sendTransactional(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `RESEND_API_KEY is not set; email to ${params.to} was not sent. (OTP flows need Resend in non-dev or set the key.)`,
      );
      if (this.appConfig.getNodeEnv() === 'production') {
        throw new ServiceUnavailableException(
          'Email delivery is not configured',
        );
      }
      return;
    }

    const { data, error } = await this.resend.emails.send({
      from: this.appConfig.getMailFrom(),
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      this.logger.error(
        `Resend error (${String(error.name)}): ${error.message}`,
      );
      throw new ServiceUnavailableException('Failed to send email');
    }

    this.logger.log(`Email queued via Resend (id: ${data?.id ?? 'unknown'})`);
  }
}
