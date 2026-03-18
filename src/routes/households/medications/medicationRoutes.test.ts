import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerAuthContext } from '../../../plugins/authContext.js';
import { registerMedicationRoutes } from './medicationRoutes.js';

type MedicationRouteRepository = Parameters<typeof registerMedicationRoutes>[1];
type MedicationRouteUseCases = Parameters<typeof registerMedicationRoutes>[2];

const buildUseCases = (overrides: Partial<MedicationRouteUseCases>): MedicationRouteUseCases => ({
  listHouseholdMedicationsUseCase: {
    execute: async () => [],
  } as unknown as MedicationRouteUseCases['listHouseholdMedicationsUseCase'],
  createMedicationUseCase: {
    execute: async () => {
      throw new Error('not used');
    },
  } as unknown as MedicationRouteUseCases['createMedicationUseCase'],
  updateMedicationUseCase: {
    execute: async () => {
      throw new Error('not used');
    },
  } as unknown as MedicationRouteUseCases['updateMedicationUseCase'],
  deleteMedicationUseCase: {
    execute: async () => undefined,
  } as unknown as MedicationRouteUseCases['deleteMedicationUseCase'],
  ...overrides,
});

const repositoryStub: MedicationRouteRepository = {
  findActiveMemberByUserInHousehold: async () => ({
    id: 'member-1',
    householdId: '3617e173-d359-492b-94b7-4c32622e7526',
    userId: 'user-2',
    email: 'ben@example.com',
    firstName: 'Ben',
    lastName: 'Martin',
    role: 'caregiver',
    status: 'active',
    joinedAt: '2026-03-12T20:00:00.000Z',
    createdAt: '2026-03-12T20:00:00.000Z',
  }),
  getHouseholdSettings: async () => ({
    householdId: '3617e173-d359-492b-94b7-4c32622e7526',
    memberPermissions: {
      'member-1': {
        manageMedications: true,
        manageAppointments: true,
        manageTasks: true,
        manageMembers: true,
        viewSensitiveInfo: true,
      },
    },
    notifications: {
      enabled: true,
      memberUpdates: true,
      invitations: true,
    },
    createdAt: '2026-03-12T20:00:00.000Z',
    updatedAt: '2026-03-12T20:00:00.000Z',
  }),
  getUserPrivacySettings: async () => ({
    id: 'privacy-1',
    userId: 'user-2',
    shareProfile: true,
    shareHealthData: true,
    shareActivityHistory: true,
    allowAnalytics: false,
    createdAt: '2026-03-12T20:00:00.000Z',
    updatedAt: '2026-03-12T20:00:00.000Z',
  }),
  listHouseholdMembers: async () => [
    {
      id: '7bdfe6e0-beb7-4684-ae6c-eb5a0b2f3d0d',
      householdId: '3617e173-d359-492b-94b7-4c32622e7526',
      userId: 'user-2',
      email: 'ben@example.com',
      firstName: 'Ben',
      lastName: 'Martin',
      role: 'senior',
      status: 'active',
      joinedAt: '2026-03-12T20:00:00.000Z',
      createdAt: '2026-03-12T20:00:00.000Z',
    },
  ],
  getBulkPrivacySettings: async () => new Map(),
} as unknown as MedicationRouteRepository;

describe('registerMedicationRoutes', () => {
  it('keeps reminders in the medication list response', async () => {
    const app = Fastify();
    registerAuthContext(app);

    registerMedicationRoutes(app, repositoryStub, buildUseCases({
      listHouseholdMedicationsUseCase: {
        execute: async () => [
          {
            id: 'medication-123',
            householdId: '3617e173-d359-492b-94b7-4c32622e7526',
            seniorId: '7bdfe6e0-beb7-4684-ae6c-eb5a0b2f3d0d',
            name: 'Doliprane',
            dosage: '1000mg',
            form: 'tablet',
            frequency: 'Once a day',
            prescribedBy: null,
            prescriptionDate: null,
            startDate: '2026-03-12T20:00:00.000Z',
            endDate: null,
            instructions: null,
            reminders: [
              {
                id: 'reminder-123',
                medicationId: 'medication-123',
                time: '08:00',
                daysOfWeek: [1, 2, 3, 4, 5],
                enabled: true,
                createdAt: '2026-03-12T20:00:00.000Z',
                updatedAt: '2026-03-12T20:00:00.000Z',
              },
            ],
            createdAt: '2026-03-12T20:00:00.000Z',
            updatedAt: '2026-03-12T20:00:00.000Z',
          },
        ],
      } as unknown as MedicationRouteUseCases['listHouseholdMedicationsUseCase'],
    }));

    const response = await app.inject({
      method: 'GET',
      url: '/v1/households/3617e173-d359-492b-94b7-4c32622e7526/medications',
      headers: {
        'x-user-id': 'user-2',
        'x-user-email': 'ben@example.com',
        'x-user-first-name': 'Ben',
        'x-user-last-name': 'Martin',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data[0].reminders).toEqual([
      {
        id: 'reminder-123',
        medicationId: 'medication-123',
        time: '08:00',
        daysOfWeek: [1, 2, 3, 4, 5],
        enabled: true,
        createdAt: '2026-03-12T20:00:00.000Z',
        updatedAt: '2026-03-12T20:00:00.000Z',
      },
    ]);

    await app.close();
  });
  it('returns the created medication payload with its id', async () => {
    const app = Fastify();
    registerAuthContext(app);

    registerMedicationRoutes(app, repositoryStub, buildUseCases({
      createMedicationUseCase: {
        execute: async () => ({
          id: 'medication-123',
          householdId: '3617e173-d359-492b-94b7-4c32622e7526',
          seniorId: '7bdfe6e0-beb7-4684-ae6c-eb5a0b2f3d0d',
          name: 'Doliprane',
          dosage: '1000mg',
          form: 'tablet',
          frequency: 'Once a day',
          prescribedBy: null,
          prescriptionDate: null,
          startDate: '2026-03-12T20:00:00.000Z',
          endDate: null,
          instructions: null,
          createdAt: '2026-03-12T20:00:00.000Z',
          updatedAt: '2026-03-12T20:00:00.000Z',
        }),
      } as unknown as MedicationRouteUseCases['createMedicationUseCase'],
    }));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/households/3617e173-d359-492b-94b7-4c32622e7526/medications',
      headers: {
        'x-user-id': 'user-2',
        'x-user-email': 'ben@example.com',
        'x-user-first-name': 'Ben',
        'x-user-last-name': 'Martin',
      },
      payload: {
        seniorId: '7bdfe6e0-beb7-4684-ae6c-eb5a0b2f3d0d',
        name: 'Doliprane',
        dosage: '1000mg',
        form: 'tablet',
        frequency: 'Once a day',
        startDate: '2026-03-12T20:00:00.000Z',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      status: 'success',
      data: {
        id: 'medication-123',
        householdId: '3617e173-d359-492b-94b7-4c32622e7526',
        seniorId: '7bdfe6e0-beb7-4684-ae6c-eb5a0b2f3d0d',
        name: 'Doliprane',
        dosage: '1000mg',
        form: 'tablet',
        frequency: 'Once a day',
        prescribedBy: null,
        prescriptionDate: null,
        startDate: '2026-03-12T20:00:00.000Z',
        endDate: null,
        instructions: null,
        createdAt: '2026-03-12T20:00:00.000Z',
        updatedAt: '2026-03-12T20:00:00.000Z',
      },
    });

    await app.close();
  });
});
