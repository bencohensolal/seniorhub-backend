import { createHmac, randomBytes } from 'node:crypto';

const computeSignature = (payload: string, secret: string): string =>
  createHmac('sha256', secret).update(payload).digest('hex');

export const signInvitationToken = (invitationId: string, secret: string): string => {
  const nonce = randomBytes(16).toString('hex');
  const payload = `${invitationId}.${nonce}`;
  const signature = computeSignature(payload, secret);
  return `${payload}.${signature}`;
};

export const isInvitationTokenValid = (token: string, secret: string): boolean => {
  const segments = token.split('.');
  if (segments.length !== 3) {
    return false;
  }

  const [invitationId, nonce, signature] = segments;
  if (!invitationId || !nonce || !signature) {
    return false;
  }

  const payload = `${invitationId}.${nonce}`;
  const expectedSignature = computeSignature(payload, secret);
  return signature === expectedSignature;
};
