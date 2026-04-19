import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  CORS_ORIGIN: Joi.string().default('*'),
  MONGO_URI: Joi.string()
    .uri({ scheme: ['mongodb', 'mongodb+srv'] })
    .required(),
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  RESEND_API_KEY: Joi.string().allow('').optional(),
  MAIL_FROM: Joi.string().default('Sidequestz <onboarding@resend.dev>'),
  OTP_EXPIRES_MINUTES: Joi.number().integer().min(1).max(60).default(10),
  REDIS_URL: Joi.string().optional(),
  LYNKFINDER_RADIUS_M: Joi.number().integer().min(50).max(5000).optional(),
  LYNKFINDER_PRESENCE_TTL_SECONDS: Joi.number()
    .integer()
    .min(15)
    .max(600)
    .optional(),
  LYNKFINDER_MIN_UPDATE_INTERVAL_MS: Joi.number()
    .integer()
    .min(500)
    .max(60_000)
    .optional(),
});
