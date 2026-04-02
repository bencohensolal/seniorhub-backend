import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerAuthContext } from '../../../plugins/authContext.js';
import { registerJournalRoutes } from './journalRoutes.js';

type JournalRouteRepository = Parameters<typeof registerJournalRoutes>[1];
type JournalRouteUseCases = Parameters<typeof registerJournalRoutes>[2];
type JournalRouteJournalRepository = Parameters<typeof registerJournalRoutes>[3];

const HOUSEHOLD_ID = '3617e173-d359-492b-94b7-4c32622e7526';
const ENTRY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const MEMBER_ID = '11111111-2222-3333-4444-555555555555';
const SENIOR_ID_1 = '22222222-2222-4222-8222-222222222222';
const SENIOR_ID_2 = '77777777-7777-4777-9777-777777777777';

const defaultHeaders = {
  'x-user-id': 'user-1',
  'x-user-email': 'alice@example.com',
  'x-user-first-name': 'Alice',
  'x-user-last-name': 'Caregiver',
};

const sampleEntry = {
  id: ENTRY_ID,
  householdId: HOUSEHOLD_ID,
  seniorIds: [SENIOR_ID_1, SENIOR_ID_2],
  authorId: MEMBER_ID,
  content: 'Note de test',
  category: 'general' as const,
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-01T10:00:00.000Z',
};

const repositoryStub: JournalRouteRepository = {
  findActiveMemberByUserInHousehold: async () => ({
    id: MEMBER_ID,
    householdId: HOUSEHOLD_ID,
    userId: 'user-1',
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Caregiver',
    role: 'caregiver',
    status: 'active',
    joinedAt: '2026-03-12T20:00:00.000Z',
    createdAt: '2026-03-12T20:00:00.000Z',
  }),
  getHouseholdSettings: async () => ({
    householdId: HOUSEHOLD_ID,
    memberPermissions: {
      [MEMBER_ID]: {
        viewJournal: true,
        manageJournal: true,
        deleteJournal: true,
        viewAppointments: true,
        manageAppointments: true,
        deleteAppointments: true,
        viewTasks: true,
        manageTasks: true,
        deleteTasks: true,
        viewCaregiverTodos: true,
        manageCaregiverTodos: true,
        deleteCaregiverTodos: true,
        viewDocuments: true,
        manageDocuments: true,
        deleteDocuments: true,
        manageMembers: true,
        inviteMembers: true,
        editMemberRoles: true,
        archiveMembers: true,
        manageMemberPermissions: true,
        viewDisplayTablets: true,
        manageDisplayTablets: true,
        deleteDisplayTablets: true,
        viewSensitiveInfo: true,
      },
    },
    notifications: { enabled: true, memberUpdates: true, invitations: true },
    seniorMenuPin: null,
    createdAt: '2026-03-12T20:00:00.000Z',
    updatedAt: '2026-03-12T20:00:00.000Z',
  }),
  getUserPrivacySettings: async () => null,
  listHouseholdMembers: async () => [],
  getBulkPrivacySettings: async () => new Map(),
} as unknown as JournalRouteRepository;

const buildUseCases = (overrides: Partial<JournalRouteUseCases> = {}): JournalRouteUseCases => ({
  listJournalEntriesUseCase: {
    execute: async () => [],
  } as unknown as JournalRouteUseCases['listJournalEntriesUseCase'],
  createJournalEntryUseCase: {
    execute: async () => { throw new Error('not used'); },
  } as unknown as JournalRouteUseCases['createJournalEntryUseCase'],
  updateJournalEntryUseCase: {
    execute: async () => { throw new Error('not used'); },
  } as unknown as JournalRouteUseCases['updateJournalEntryUseCase'],
  deleteJournalEntryUseCase: {
    execute: async () => undefined,
  } as unknown as JournalRouteUseCases['deleteJournalEntryUseCase'],
  ...overrides,
});

const journalRepositoryStub: JournalRouteJournalRepository = {
  archive: async () => { throw new Error('not used'); },
  unarchive: async () => { throw new Error('not used'); },
} as unknown as JournalRouteJournalRepository;

function buildApp(useCaseOverrides: Partial<JournalRouteUseCases> = {}) {
  const app = Fastify();
  registerAuthContext(app);
  registerJournalRoutes(app, repositoryStub, buildUseCases(useCaseOverrides), journalRepositoryStub);
  return app;
}

describe('journalRoutes', () => {
  describe('GET /journal - liste les entrées', () => {
    it('retourne une liste vide', async () => {
      const app = buildApp();
      const res = await app.inject({
        method: 'GET',
        url: `/v1/households/${HOUSEHOLD_ID}/journal`,
        headers: defaultHeaders,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: 'success', data: [] });
      await app.close();
    });

    it('inclut seniorIds dans les entrées retournées', async () => {
      const app = buildApp({
        listJournalEntriesUseCase: {
          execute: async () => [sampleEntry],
        } as unknown as JournalRouteUseCases['listJournalEntriesUseCase'],
      });
      const res = await app.inject({
        method: 'GET',
        url: `/v1/households/${HOUSEHOLD_ID}/journal`,
        headers: defaultHeaders,
      });
      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data).toHaveLength(1);
      // Vérification clé : seniorIds est bien sérialisé dans la liste
      expect(data[0].seniorIds).toEqual([SENIOR_ID_1, SENIOR_ID_2]);
      expect(data[0].content).toBe('Note de test');
      await app.close();
    });

    it('passe le filtre seniorId au use case', async () => {
      let capturedFilters: unknown;
      const app = buildApp({
        listJournalEntriesUseCase: {
          execute: async (input: { filters?: unknown }) => {
            capturedFilters = input.filters;
            return [];
          },
        } as unknown as JournalRouteUseCases['listJournalEntriesUseCase'],
      });
      await app.inject({
        method: 'GET',
        url: `/v1/households/${HOUSEHOLD_ID}/journal?seniorId=${SENIOR_ID_1}`,
        headers: defaultHeaders,
      });
      expect(capturedFilters).toMatchObject({ seniorId: SENIOR_ID_1 });
      await app.close();
    });
  });

  describe('POST /journal - crée une entrée', () => {
    it('crée une entrée avec seniorIds et retourne seniorIds dans la réponse', async () => {
      let capturedInput: unknown;
      const app = buildApp({
        createJournalEntryUseCase: {
          execute: async (input: unknown) => {
            capturedInput = input;
            return sampleEntry;
          },
        } as unknown as JournalRouteUseCases['createJournalEntryUseCase'],
      });
      const res = await app.inject({
        method: 'POST',
        url: `/v1/households/${HOUSEHOLD_ID}/journal`,
        headers: defaultHeaders,
        payload: {
          seniorIds: [SENIOR_ID_1, SENIOR_ID_2],
          content: 'Note de test',
          category: 'general',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.status).toBe('success');
      // Vérification clé : seniorIds est retourné dans la réponse de création
      expect(body.data.seniorIds).toEqual([SENIOR_ID_1, SENIOR_ID_2]);
      // Vérification que seniorIds est passé au use case
      expect(capturedInput).toMatchObject({ seniorIds: [SENIOR_ID_1, SENIOR_ID_2] });
      await app.close();
    });

    it('rejette une création sans seniorIds', async () => {
      const app = buildApp();
      const res = await app.inject({
        method: 'POST',
        url: `/v1/households/${HOUSEHOLD_ID}/journal`,
        headers: defaultHeaders,
        payload: { content: 'Note sans senior', category: 'general' },
      });
      expect(res.statusCode).toBe(400);
      await app.close();
    });
  });

  describe('PATCH /journal/:entryId - modifie une entrée', () => {
    it('met à jour seniorIds et retourne seniorIds dans la réponse', async () => {
      let capturedUpdates: unknown;
      const app = buildApp({
        updateJournalEntryUseCase: {
          execute: async (input: { updates: unknown }) => {
            capturedUpdates = input.updates;
            return { ...sampleEntry, seniorIds: [SENIOR_ID_1] };
          },
        } as unknown as JournalRouteUseCases['updateJournalEntryUseCase'],
      });
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/households/${HOUSEHOLD_ID}/journal/${ENTRY_ID}`,
        headers: defaultHeaders,
        payload: { seniorIds: [SENIOR_ID_1] },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('success');
      // Vérification clé : seniorIds mis à jour est retourné
      expect(body.data.seniorIds).toEqual([SENIOR_ID_1]);
      // Vérification que seniorIds est passé au use case
      expect(capturedUpdates).toMatchObject({ seniorIds: [SENIOR_ID_1] });
      await app.close();
    });
  });
});
