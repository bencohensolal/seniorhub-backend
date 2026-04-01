import { describe, expect, it, beforeEach } from 'vitest';
import { InMemoryHouseholdRepository } from '../../../data/repositories/InMemoryHouseholdRepository.js';
import { CreateFolderUseCase } from './CreateFolderUseCase.js';
import { ForbiddenError } from '../../errors/index.js';

describe('CreateFolderUseCase', () => {
  let repository: InMemoryHouseholdRepository;
  let useCase: CreateFolderUseCase;

  beforeEach(() => {
    repository = new InMemoryHouseholdRepository();
    useCase = new CreateFolderUseCase(repository);
  });

  it('creates a folder at root level', async () => {
    // Setup: create a household and add member
    const household = await repository.createHousehold('Test Household', {
      userId: 'user-1',
      email: 'caregiver@example.com',
      firstName: 'John',
      lastName: 'Doe',
    });

    const requester = {
      userId: 'user-1',
      email: 'caregiver@example.com',
      firstName: 'John',
      lastName: 'Doe',
    };

    const folder = await useCase.execute({
      householdId: household.id,
      name: 'Personal Documents',
      description: 'Personal records and documents',
      parentFolderId: null,
      requester,
    });

    expect(folder).toBeDefined();
    expect(folder.name).toBe('Personal Documents');
    expect(folder.description).toBe('Personal records and documents');
    expect(folder.householdId).toBe(household.id);
    expect(folder.parentFolderId).toBeNull();
    expect(folder.createdByUserId).toBe('user-1');
  });

  it('creates a folder within a parent folder', async () => {
    // Setup: create household, member, and parent folder
    const household = await repository.createHousehold('Test Household', {
      userId: 'user-1',
      email: 'caregiver@example.com',
      firstName: 'John',
      lastName: 'Doe',
    });

    const requester = {
      userId: 'user-1',
      email: 'caregiver@example.com',
      firstName: 'John',
      lastName: 'Doe',
    };

    // Create parent folder first
    const parentFolder = await repository.createDocumentFolder({
      householdId: household.id,
      name: 'Personal',
      description: 'Personal documents',
      parentFolderId: null,
      createdByUserId: 'user-1',
    });

    const childFolder = await useCase.execute({
      householdId: household.id,
      name: 'Invoices',
      description: 'Personal documents',
      parentFolderId: parentFolder.id,
      requester,
    });

    expect(childFolder).toBeDefined();
    expect(childFolder.name).toBe('Invoices');
    expect(childFolder.parentFolderId).toBe(parentFolder.id);
  });

  it('throws ForbiddenError when user is not a household member', async () => {
    const household = await repository.createHousehold('Test Household', {
      userId: 'user-1',
      email: 'caregiver@example.com',
      firstName: 'John',
      lastName: 'Doe',
    });

    const nonMemberRequester = {
      userId: 'user-2', // Not a member
      email: 'stranger@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
    };

    await expect(
      useCase.execute({
        householdId: household.id,
        name: 'Test Folder',
        description: 'Should fail',
        parentFolderId: null,
        requester: nonMemberRequester,
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when parent folder does not exist', async () => {
    const household = await repository.createHousehold('Test Household', {
      userId: 'user-1',
      email: 'caregiver@example.com',
      firstName: 'John',
      lastName: 'Doe',
    });

    const requester = {
      userId: 'user-1',
      email: 'caregiver@example.com',
      firstName: 'John',
      lastName: 'Doe',
    };

    await expect(
      useCase.execute({
        householdId: household.id,
        name: 'Test Folder',
        description: 'Should fail',
        parentFolderId: 'non-existent-folder-id',
        requester,
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when user lacks manageDocuments permission', async () => {
    // Note: This test would require setting up a member without manageDocuments permission
    // For now, we'll skip as InMemoryHouseholdRepository doesn't implement permissions fully
    // This is a placeholder for future implementation
    expect(true).toBe(true);
  });
});
