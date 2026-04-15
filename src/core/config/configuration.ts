const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toDurationInSeconds = (
  value: string | undefined,
  fallbackInSeconds: number,
): number => {
  if (!value) {
    return fallbackInSeconds;
  }

  const match = value.trim().match(/^(\d+)([smhd])?$/i);
  if (!match) {
    return fallbackInSeconds;
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = (match[2] ?? 's').toLowerCase();

  const multiplier =
    unit === 'd' ? 86400 : unit === 'h' ? 3600 : unit === 'm' ? 60 : 1;

  return amount * multiplier;
};

export default () => ({
  app: {
    port: toNumber(process.env.PORT, 3000),
    corsOrigin: process.env.CORS_ORIGIN ?? '*',
  },
  db: {
    mongoUri:
      process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/sidequestz-backend',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'change-me-access-secret',
    accessExpiresInSeconds: toDurationInSeconds(
      process.env.JWT_ACCESS_EXPIRES_IN,
      900,
    ),
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh-secret',
    refreshExpiresInSeconds: toDurationInSeconds(
      process.env.JWT_REFRESH_EXPIRES_IN,
      604800,
    ),
  },
  mail: {
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    mailFrom: process.env.MAIL_FROM ?? 'Sidequestz <onboarding@resend.dev>',
    otpExpiresMinutes: toNumber(process.env.OTP_EXPIRES_MINUTES, 10),
  },
});
