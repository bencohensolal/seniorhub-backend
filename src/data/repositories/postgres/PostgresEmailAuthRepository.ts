import { randomUUID, scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Pool } from 'pg';
import type {
  EmailAccount,
  EmailAccountWithHash,
  EmailAuthSessionRecord,
} from '../../../domain/entities/EmailAccount.js';
import { generateDisplayTabletToken, hashDisplayTabletToken } from '../../../domain/security/displayTabletToken.js';
import { nowIso } from './helpers.js';

const scryptAsync = promisify(scrypt);

const SCRYPT_KEYLEN = 64;
const REFRESH_TOKEN_TTL_DAYS = 90;

export const hashEmailPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
};

export const verifyEmailPassword = async (password: string, stored: string): Promise<boolean> => {
  const [salt, hex] = stored.split(':');
  if (!salt || !hex) return false;
  const storedHash = Buffer.from(hex, 'hex');
  const derivedHash = (await scryptAsync(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return storedHash.length === derivedHash.length && timingSafeEqual(storedHash, derivedHash);
};

const mapAccount = (row: {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  user_id: string;
  created_at: string | Date;
  password_hash?: string;
}): EmailAccount & { passwordHash?: string } => ({
  id: row.id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  userId: row.user_id,
  createdAt: typeof row.created_at === 'string' ? row.created_at : row.created_at.toISOString(),
  ...(row.password_hash !== undefined && { passwordHash: row.password_hash }),
});

export class PostgresEmailAuthRepository {
  constructor(protected readonly pool: Pool) {}

  async findEmailAccountByEmail(email: string): Promise<EmailAccountWithHash | null> {
    const result = await this.pool.query<{
      id: string; email: string; first_name: string; last_name: string;
      user_id: string; created_at: string; password_hash: string;
    }>(
      `SELECT id, email, first_name, last_name, user_id, created_at, password_hash
       FROM email_password_accounts
       WHERE email = $1`,
      [email.toLowerCase().trim()],
    );
    if (!result.rows[0]) return null;
    const mapped = mapAccount(result.rows[0]);
    return { ...mapped, passwordHash: result.rows[0].password_hash } as EmailAccountWithHash;
  }

  async findEmailAccountById(id: string): Promise<EmailAccount | null> {
    const result = await this.pool.query<{
      id: string; email: string; first_name: string; last_name: string;
      user_id: string; created_at: string;
    }>(
      `SELECT id, email, first_name, last_name, user_id, created_at
       FROM email_password_accounts
       WHERE id = $1`,
      [id],
    );
    if (!result.rows[0]) return null;
    return mapAccount(result.rows[0]) as EmailAccount;
  }

  async findEmailAccountByUserId(userId: string): Promise<EmailAccount | null> {
    const result = await this.pool.query<{
      id: string; email: string; first_name: string; last_name: string;
      user_id: string; created_at: string;
    }>(
      `SELECT id, email, first_name, last_name, user_id, created_at
       FROM email_password_accounts
       WHERE user_id = $1`,
      [userId],
    );
    if (!result.rows[0]) return null;
    return mapAccount(result.rows[0]) as EmailAccount;
  }

  async createEmailAccount(input: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
  }): Promise<EmailAccount> {
    const userId = `email_${randomUUID()}`;
    const normalizedEmail = input.email.toLowerCase().trim();

    const result = await this.pool.query<{
      id: string; email: string; first_name: string; last_name: string;
      user_id: string; created_at: string;
    }>(
      `INSERT INTO email_password_accounts (email, password_hash, first_name, last_name, user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, first_name, last_name, user_id, created_at`,
      [normalizedEmail, input.passwordHash, input.firstName, input.lastName, userId],
    );

    return mapAccount(result.rows[0]!) as EmailAccount;
  }

  async createEmailAuthSession(accountId: string): Promise<{ refreshToken: string }> {
    const rawToken = generateDisplayTabletToken(); // 32 random bytes → 64 hex chars
    const tokenHash = hashDisplayTabletToken(rawToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    await this.pool.query(
      `INSERT INTO email_auth_sessions (account_id, refresh_token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [accountId, tokenHash, expiresAt],
    );

    return { refreshToken: rawToken };
  }

  async findEmailAuthSession(refreshToken: string): Promise<EmailAuthSessionRecord | null> {
    const tokenHash = hashDisplayTabletToken(refreshToken);
    const result = await this.pool.query<{
      id: string; account_id: string; expires_at: string;
    }>(
      `SELECT id, account_id, expires_at
       FROM email_auth_sessions
       WHERE refresh_token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash],
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      accountId: row.account_id,
      expiresAt: row.expires_at,
    };
  }

  async rotateEmailAuthSession(sessionId: string, accountId: string): Promise<{ refreshToken: string }> {
    const now = nowIso();
    const rawToken = generateDisplayTabletToken();
    const tokenHash = hashDisplayTabletToken(rawToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Revoke old session and create new one atomically
    await this.pool.query('BEGIN');
    try {
      await this.pool.query(
        `UPDATE email_auth_sessions SET revoked_at = $2 WHERE id = $1`,
        [sessionId, now],
      );
      await this.pool.query(
        `INSERT INTO email_auth_sessions (account_id, refresh_token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [accountId, tokenHash, expiresAt],
      );
      await this.pool.query('COMMIT');
    } catch (err) {
      await this.pool.query('ROLLBACK');
      throw err;
    }

    return { refreshToken: rawToken };
  }
}
