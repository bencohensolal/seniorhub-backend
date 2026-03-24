import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { UnauthorizedError, NotFoundError } from '../../errors/index.js';
import type { EmailAuthResult } from '../../entities/EmailAccount.js';

export class RefreshEmailSessionUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: { refreshToken: string }): Promise<EmailAuthResult> {
    const session = await this.repository.findEmailAuthSession(input.refreshToken);
    if (!session) {
      throw new UnauthorizedError('Invalid or expired refresh token.');
    }

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      throw new UnauthorizedError('Refresh token has expired. Please log in again.');
    }

    const account = await this.repository.findEmailAccountById(session.accountId);

    if (!account) {
      throw new NotFoundError('Account not found.');
    }

    // Rotate the session (revoke old, create new)
    const { refreshToken: newRefreshToken } = await this.repository.rotateEmailAuthSession(
      session.id,
      session.accountId,
    );

    return {
      userId: account.userId,
      email: account.email,
      firstName: account.firstName,
      lastName: account.lastName,
      refreshToken: newRefreshToken,
    };
  }
}
