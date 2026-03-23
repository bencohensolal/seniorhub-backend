import { createHmac } from 'node:crypto';
import { env } from '../../config/env.js';

const SESSION_TTL_HOURS = 48;

interface SeniorDeviceSessionPayload {
  deviceId: string;
  householdId: string;
  memberId: string;
  userId: string;
  role: string;
  permissions: string[];
  exp: number;
}

export const generateSeniorDeviceSessionToken = (
  deviceId: string,
  householdId: string,
  memberId: string,
  userId: string,
  role: string,
): string => {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + SESSION_TTL_HOURS * 3600;

  const payload: SeniorDeviceSessionPayload = {
    deviceId,
    householdId,
    memberId,
    userId,
    role,
    permissions: ['read', 'write'],
    exp,
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', env.TOKEN_SIGNING_SECRET)
    .update(payloadStr)
    .digest('base64url');

  return `${payloadStr}.${signature}`;
};

export const verifySeniorDeviceSessionToken = (token: string): SeniorDeviceSessionPayload | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return null;
    }

    const [payloadStr, signature] = parts;
    if (!payloadStr || !signature) {
      return null;
    }

    const expectedSignature = createHmac('sha256', env.TOKEN_SIGNING_SECRET)
      .update(payloadStr)
      .digest('base64url');

    if (signature !== expectedSignature) {
      return null;
    }

    const payload: SeniorDeviceSessionPayload = JSON.parse(
      Buffer.from(payloadStr, 'base64url').toString('utf-8'),
    );

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      return null;
    }

    if (!payload.deviceId || !payload.householdId || !payload.memberId || !payload.userId || !Array.isArray(payload.permissions)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};

export const SESSION_TTL_MS = SESSION_TTL_HOURS * 3600 * 1000;
