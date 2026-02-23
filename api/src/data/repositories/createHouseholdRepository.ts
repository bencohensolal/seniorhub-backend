import { env } from '../../config/env.js';
import type { HouseholdRepository } from '../../domain/repositories/HouseholdRepository.js';
import { InMemoryHouseholdRepository } from './InMemoryHouseholdRepository.js';
import { PostgresHouseholdRepository } from './PostgresHouseholdRepository.js';
import { getPostgresPool } from '../db/postgres.js';

export const createHouseholdRepository = (): HouseholdRepository => {
  if (env.PERSISTENCE_DRIVER === 'postgres') {
    return new PostgresHouseholdRepository(getPostgresPool());
  }

  return new InMemoryHouseholdRepository();
};
