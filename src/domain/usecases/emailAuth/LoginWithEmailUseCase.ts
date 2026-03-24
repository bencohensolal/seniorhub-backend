import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { UnauthorizedError } from '../../errors/index.js';
import { verifyEmailPassword } from '../../../data/repositories/postgres/PostgresEmailAuthRepository.js';
import type { EmailAuthResult } from '../../entities/EmailAccount.js';

export class LoginWithEmailUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: { email: string; password: string }): Promise<EmailAuthResult> {
    const email = input.email.toLowerCase().trim();

    const account = await this.repository.findEmailAccountByEmail(email);

    // Always verify to avoid timing attacks that reveal account existence
    const dummyHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const passwordOk = account
      ? await verifyEmailPassword(input.password, account.passwordHash)
      : await verifyEmailPassword(input.password, dummyHash).then(() => false);

    if (!account || !passwordOk) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const { refreshToken } = await this.repository.createEmailAuthSession(account.id);

    return {
      userId: account.userId,
      email: account.email,
      firstName: account.firstName,
      lastName: account.lastName,
      refreshToken,
    };
  }
}
