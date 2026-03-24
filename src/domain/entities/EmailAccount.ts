export interface EmailAccount {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** 'email_<UUID>' — stored in household_members.user_id */
  userId: string;
  createdAt: string;
}

export interface EmailAccountWithHash extends EmailAccount {
  passwordHash: string;
}

export interface EmailAuthSessionRecord {
  id: string;
  accountId: string;
  expiresAt: string;
}

export interface EmailAuthResult {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  refreshToken: string;
}
