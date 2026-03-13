import type { TabletDisplayConfig } from './TabletDisplayConfig.js';

export type DisplayTabletStatus = 'active' | 'revoked';

export interface DisplayTablet {
  id: string;
  householdId: string;
  name: string;
  description: string | null;
  tokenHash: string; // SHA-256 hash of the token (never expose the plain token except at creation)
  config: TabletDisplayConfig | null;
  createdAt: string;
  createdBy: string;
  lastActiveAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  status: DisplayTabletStatus;
}

export interface DisplayTabletWithToken extends Omit<DisplayTablet, 'tokenHash'> {
  token: string; // Plain setup token - ONLY returned at creation/regeneration
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

// Basic authentication result from repository (without session token)
export interface DisplayTabletAuthInfo {
  householdId: string;
  householdName: string;
  permissions: string[];
}

// Complete authentication result with session token (from use case)
export interface DisplayTabletAuthResult extends DisplayTabletAuthInfo {
  sessionToken: string; // JWT session token valid for 8 hours
  refreshToken: string; // Rotating refresh token stored on the tablet after setup
  expiresAt: string; // ISO 8601 timestamp
}
