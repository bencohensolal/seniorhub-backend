import { z } from 'zod';

const optionalUrlFromEnv = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
}, z.string().url().optional());

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(4000),
    HOST: z.string().default('0.0.0.0'),
    PERSISTENCE_DRIVER: z.enum(['in-memory', 'postgres']).default('in-memory'),
    DATABASE_URL: optionalUrlFromEnv,
    TOKEN_SIGNING_SECRET: z.string().min(16).default('seniorhub-dev-signing-secret'),
    INVITATION_WEB_FALLBACK_URL: optionalUrlFromEnv,
    EMAIL_JOB_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
    EMAIL_JOB_RETRY_DELAY_MS: z.coerce.number().int().min(10).max(60_000).default(1000),
    EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.PERSISTENCE_DRIVER === 'postgres' && !value.DATABASE_URL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL is required when PERSISTENCE_DRIVER=postgres.',
      });
    }

    if (value.EMAIL_PROVIDER === 'resend') {
      if (!value.RESEND_API_KEY) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['RESEND_API_KEY'],
          message: 'RESEND_API_KEY is required when EMAIL_PROVIDER=resend.',
        });
      }
      if (!value.EMAIL_FROM) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['EMAIL_FROM'],
          message: 'EMAIL_FROM is required when EMAIL_PROVIDER=resend.',
        });
      }
    }
  });

export const env = envSchema.parse(process.env);
