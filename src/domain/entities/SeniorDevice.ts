export type SeniorDeviceStatus = 'active' | 'revoked';

export interface SeniorDevice {
  id: string;
  householdId: string;
  memberId: string;
  name: string;
  tokenHash: string;
  status: SeniorDeviceStatus;
  createdBy: string;
  createdAt: string;
  lastActiveAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
}

export interface SeniorDeviceWithToken extends Omit<SeniorDevice, 'tokenHash'> {
  token: string;
}

export interface CreateSeniorDeviceInput {
  householdId: string;
  memberId: string;
  name: string;
  createdBy: string;
}

export interface SeniorDeviceAuthInfo {
  householdId: string;
  householdName: string;
  memberId: string;
  userId: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
}

export interface SeniorDeviceAuthResult extends SeniorDeviceAuthInfo {
  sessionToken: string;
  refreshToken: string;
  expiresAt: string;
}
