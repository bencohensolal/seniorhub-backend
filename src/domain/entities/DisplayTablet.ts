export type DisplayTabletStatus = 'active' | 'revoked';

export interface DisplayTablet {
  id: string;
  householdId: string;
  name: string;
  description: string | null;
  tokenHash: string; // SHA-256 hash of the token (never expose the plain token except at creation)
  createdAt: string;
  createdBy: string;
  lastActiveAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  status: DisplayTabletStatus;
}

export interface DisplayTabletWithToken extends Omit<DisplayTablet, 'tokenHash'> {
  token: string; // Plain token - ONLY returned at creation/regeneration
}

export interface CreateDisplayTabletInput {
  householdId: string;
  name: string;
  description?: string | undefined;
  createdBy: string;
}

export interface UpdateDisplayTabletInput {
  name?: string | undefined;
  description?: string | undefined;
}

export interface DisplayTabletAuthResult {
  householdId: string;
  householdName: string;
  permissions: string[];
}
