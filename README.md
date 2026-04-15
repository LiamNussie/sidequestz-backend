# Sidequestz Backend

NestJS + MongoDB backend scaffold with a production-style authentication baseline (access + refresh JWT tokens), modular architecture, and clean separation of concerns.

## Stack

- NestJS 11
- MongoDB with Mongoose
- JWT authentication (`access` + `refresh`)
- Validation with `class-validator` + global pipes
- Config management with `@nestjs/config` + Joi env validation
- Transactional email via [Resend](https://resend.com) (verification + password reset OTP)

## Project Structure

```text
src/
  core/
    config/
    filters/
    interceptors/
  common/
    decorators/
  modules/
    auth/
    users/
    mail/
    health/
```

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Update `.env` values: Mongo URI, JWT secrets, and `RESEND_API_KEY` (set `MAIL_FROM` to a domain you have verified in Resend; `onboarding@resend.dev` works for Resend’s own test sends).

## Running

```bash
# development
pnpm run start:dev

# production build
pnpm run build
pnpm run start:prod
```

## API Endpoints

- `POST /auth/register` — creates account and emails a 6-digit verification code (no JWT until verified)
- `POST /auth/verify-email` — body: `email`, `otp` — returns JWT pair on success
- `POST /auth/resend-verification-otp` — body: `email`
- `POST /auth/login` — requires verified email
- `POST /auth/forgot-password` — body: `email` — emails reset code if account exists
- `POST /auth/resend-password-reset-otp` — body: `email`
- `POST /auth/reset-password` — body: `email`, `otp`, `newPassword`
- `POST /auth/refresh` (send refresh token in `Authorization: Bearer <token>`)
- `POST /auth/logout`
- `GET /auth/me`
- `GET /health`

## Scripts

- `pnpm run start`
- `pnpm run start:dev`
- `pnpm run build`
- `pnpm run lint`
- `pnpm run test`
