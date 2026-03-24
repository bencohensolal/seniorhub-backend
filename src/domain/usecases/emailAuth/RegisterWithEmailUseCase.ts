import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { ConflictError } from '../../errors/index.js';
import { hashEmailPassword } from '../../../data/repositories/postgres/PostgresEmailAuthRepository.js';
import type { EmailAuthResult } from '../../entities/EmailAccount.js';

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class RegisterWithEmailUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<EmailAuthResult> {
    const email = input.email.toLowerCase().trim();

    if (!EMAIL_REGEX.test(email)) {
      throw new Error('Invalid email address.');
    }

    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }

    if (!input.firstName.trim() || !input.lastName.trim()) {
      throw new Error('First name and last name are required.');
    }

    // Check email uniqueness
    const existing = await this.repository.findEmailAccountByEmail(email);
    if (existing) {
      throw new ConflictError('An account with this email address already exists.');
    }

    const passwordHash = await hashEmailPassword(input.password);

    const account = await this.repository.createEmailAccount({
      email,
      passwordHash,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
    });

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
