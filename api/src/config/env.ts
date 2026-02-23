import { z } from 'zod';

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(4000),
    HOST: z.string().default('0.0.0.0'),
    PERSISTENCE_DRIVER: z.enum(['in-memory', 'postgres']).default('in-memory'),
    DATABASE_URL: z.string().url().optional(),
  })
  .superRefine((value, context) => {
    if (value.PERSISTENCE_DRIVER === 'postgres' && !value.DATABASE_URL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL is required when PERSISTENCE_DRIVER=postgres.',
      });
    }
  });

export const env = envSchema.parse(process.env);
