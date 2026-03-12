import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerAuthContext } from '../../plugins/authContext.js';
import { registerMedicationRoutes } from './medicationRoutes.js';

describe('registerMedicationRoutes', () => {
  it('keeps reminders in the medication list response', async () => {
    const app = Fastify();
    registerAuthContext(app);

    registerMedicationRoutes(app, {
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
            createdByUserId: 'user-2',
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
      } as any,
      createMedicationUseCase: {
        execute: async () => {
          throw new Error('not used');
        },
      } as any,
      updateMedicationUseCase: {
        execute: async () => {
          throw new Error('not used');
        },
      } as any,
      deleteMedicationUseCase: {
        execute: async () => undefined,
      } as any,
    });

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

    registerMedicationRoutes(app, {
      listHouseholdMedicationsUseCase: {
        execute: async () => [],
      } as any,
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
          createdByUserId: 'user-2',
          createdAt: '2026-03-12T20:00:00.000Z',
          updatedAt: '2026-03-12T20:00:00.000Z',
        }),
      } as any,
      updateMedicationUseCase: {
        execute: async () => {
          throw new Error('not used');
        },
      } as any,
      deleteMedicationUseCase: {
        execute: async () => undefined,
      } as any,
    });

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
        createdByUserId: 'user-2',
        createdAt: '2026-03-12T20:00:00.000Z',
        updatedAt: '2026-03-12T20:00:00.000Z',
      },
    });

    await app.close();
  });
});
