import { randomBytes, createHash } from 'node:crypto';

/**
 * Generate a secure random token for display tablet authentication
 * @returns A 64-character hexadecimal token (256 bits of entropy)
 */
export const generateDisplayTabletToken = (): string => {
  return randomBytes(32).toString('hex');
};

/**
 * Hash a display tablet token using SHA-256
 * @param token The plain text token
 * @returns The SHA-256 hash of the token (64 hex characters)
 */
export const hashDisplayTabletToken = (token: string): string => {
  return createHash('sha256').update(token).digest('hex');
};

/**
 * Validate that a token matches the expected format
 * @param token The token to validate
 * @returns True if the token is valid (64 hex characters)
 */
export const isValidDisplayTabletTokenFormat = (token: string): boolean => {
  // Must be exactly 64 hexadecimal characters
  return /^[a-f0-9]{64}$/i.test(token);
};
