import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerAuthContext } from '../../../plugins/authContext.js';
import { registerCaregiverTodoRoutes } from './caregiverTodoRoutes.js';

type CaregiverTodoRouteRepository = Parameters<typeof registerCaregiverTodoRoutes>[1];
type CaregiverTodoRouteUseCases = Parameters<typeof registerCaregiverTodoRoutes>[2];

const HOUSEHOLD_ID = '3617e173-d359-492b-94b7-4c32622e7526';
const TODO_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const MEMBER_ID = '11111111-2222-3333-4444-555555555555';
const MEMBER_ID_2 = '66666666-7777-8888-9999-aaaaaaaaaaaa';

const defaultHeaders = {
  'x-user-id': 'user-1',
  'x-user-email': 'alice@example.com',
  'x-user-first-name': 'Alice',
  'x-user-last-name': 'Caregiver',
};

const sampleTodo = {
  id: TODO_ID,
  householdId: HOUSEHOLD_ID,
  title: 'Appeler le plombier',
  description: 'Fuite sous évier',
  priority: 'high' as const,
  status: 'pending' as const,
  assignedTo: MEMBER_ID_2,
  dueDate: '2026-04-10',
  completedAt: null,
  completedBy: null,
  lastNudgedAt: null,
  nudgeCount: 0,
  createdAt: '2026-03-30T10:00:00.000Z',
  updatedAt: '2026-03-30T10:00:00.000Z',
  createdBy: MEMBER_ID,
};

const sampleTodoWithComments = {
  ...sampleTodo,
  comments: [
    {
      id: 'comment-1',
      todoId: TODO_ID,
      authorId: MEMBER_ID,
      content: 'J\'ai laissé un message',
      createdAt: '2026-03-30T12:00:00.000Z',
    },
  ],
};

const sampleComment = {
  id: 'comment-2',
  todoId: TODO_ID,
  authorId: MEMBER_ID,
  content: 'Test comment',
  createdAt: '2026-03-30T14:00:00.000Z',
};

const buildUseCases = (overrides: Partial<CaregiverTodoRouteUseCases>): CaregiverTodoRouteUseCases => ({
  listCaregiverTodosUseCase: {
    execute: async () => [],
  } as unknown as CaregiverTodoRouteUseCases['listCaregiverTodosUseCase'],
  createCaregiverTodoUseCase: {
    execute: async () => { throw new Error('not used'); },
  } as unknown as CaregiverTodoRouteUseCases['createCaregiverTodoUseCase'],
  updateCaregiverTodoUseCase: {
    execute: async () => { throw new Error('not used'); },
  } as unknown as CaregiverTodoRouteUseCases['updateCaregiverTodoUseCase'],
  deleteCaregiverTodoUseCase: {
    execute: async () => undefined,
  } as unknown as CaregiverTodoRouteUseCases['deleteCaregiverTodoUseCase'],
  completeCaregiverTodoUseCase: {
    execute: async () => { throw new Error('not used'); },
  } as unknown as CaregiverTodoRouteUseCases['completeCaregiverTodoUseCase'],
  nudgeCaregiverTodoUseCase: {
    execute: async () => { throw new Error('not used'); },
  } as unknown as CaregiverTodoRouteUseCases['nudgeCaregiverTodoUseCase'],
  addCaregiverTodoCommentUseCase: {
    execute: async () => { throw new Error('not used'); },
  } as unknown as CaregiverTodoRouteUseCases['addCaregiverTodoCommentUseCase'],
  ...overrides,
});

const repositoryStub: CaregiverTodoRouteRepository = {
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
        manageMedications: true,
        manageAppointments: true,
        manageTasks: true,
        manageCaregiverTodos: true,
        manageMembers: true,
        viewSensitiveInfo: true,
        viewDocuments: true,
        manageDocuments: true,
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
} as unknown as CaregiverTodoRouteRepository;

function buildApp(useCaseOverrides: Partial<CaregiverTodoRouteUseCases> = {}) {
  const app = Fastify();
  registerAuthContext(app);
  registerCaregiverTodoRoutes(app, repositoryStub, buildUseCases(useCaseOverrides));
  return app;
}

describe('caregiverTodoRoutes', () => {
  // ─── LIST ───
  describe('GET /caregiver-todos', () => {
    it('returns empty list', async () => {
      const app = buildApp();
      const res = await app.inject({
        method: 'GET',
        url: `/v1/households/${HOUSEHOLD_ID}/caregiver-todos`,
        headers: defaultHeaders,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: 'success', data: [] });
      await app.close();
    });

    it('returns todos with comments', async () => {
      const app = buildApp({
        listCaregiverTodosUseCase: {
          execute: async () => [sampleTodoWithComments],
        } as unknown as CaregiverTodoRouteUseCases['listCaregiverTodosUseCase'],
      });
      const res = await app.inject({
        method: 'GET',
        url: `/v1/households/${HOUSEHOLD_ID}/caregiver-todos`,
        headers: defaultHeaders,
      });
      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data).toHaveLength(1);
      expect(data[0].title).toBe('Appeler le plombier');
      expect(data[0].comments).toHaveLength(1);
      await app.close();
    });

    it('passes status filter to use case', async () => {
      let capturedFilters: unknown;
      const app = buildApp({
        listCaregiverTodosUseCase: {
          execute: async (input: { filters?: unknown }) => {
            capturedFilters = input.filters;
            return [];
          },
        } as unknown as CaregiverTodoRouteUseCases['listCaregiverTodosUseCase'],
      });
      await app.inject({
        method: 'GET',
        url: `/v1/households/${HOUSEHOLD_ID}/caregiver-todos?status=in_progress`,
        headers: defaultHeaders,
      });
      expect(capturedFilters).toEqual({ status: 'in_progress' });
      await app.close();
    });
  });

  // ─── CREATE ───
  describe('POST /caregiver-todos', () => {
    it('creates a todo and returns 201', async () => {
      const app = buildApp({
        createCaregiverTodoUseCase: {
          execute: async () => sampleTodo,
        } as unknown as CaregiverTodoRouteUseCases['createCaregiverTodoUseCase'],
      });
      const res = await app.inject({
        method: 'POST',
        url: `/v1/households/${HOUSEHOLD_ID}/caregiver-todos`,
        headers: defaultHeaders,
        payload: { title: 'Appeler le plombier', priority: 'high' },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.status).toBe('success');
      expect(body.data.id).toBe(TODO_ID);
      expect(body.data.title).toBe('Appeler le plombier');
      expect(body.data.priority).toBe('high');
      await app.close();
    });

    it('rejects missing title', async () => {
      const app = buildApp();
      const res = await app.inject({
        method: 'POST',
        url: `/v1/households/${HOUSEHOLD_ID}/caregiver-todos`,
        headers: defaultHeaders,
        payload: { priority: 'normal' },
      });
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      await app.close();
    });
  });

  // ─── UPDATE ───
  describe('PATCH /caregiver-todos/:todoId', () => {
    it('updates a todo', async () => {
      const updated = { ...sampleTodo, title: 'Updated', status: 'in_progress' as const };
      const app = buildApp({
        updateCaregiverTodoUseCase: {
          execute: async () => updated,
        } as unknown as CaregiverTodoRouteUseCases['updateCaregiverTodoUseCase'],
      });
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/households/${HOUSEHOLD_ID}/caregiver-todos/${TODO_ID}`,
        headers: defaultHeaders,
        payload: { title: 'Updated', status: 'in_progress' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.title).toBe('Updated');
      expect(res.json().data.status).toBe('in_progress');
      await app.close();
    });
  });

  // ─── DELETE ───
  describe('DELETE /caregiver-todos/:todoId', () => {
    it('deletes and returns 204', async () => {
      const app = buildApp({
        deleteCaregiverTodoUseCase: {
          execute: async () => undefined,
        } as unknown as CaregiverTodoRouteUseCases['deleteCaregiverTodoUseCase'],
      });
      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/households/${HOUSEHOLD_ID}/caregiver-todos/${TODO_ID}`,
        headers: defaultHeaders,
      });
      expect(res.statusCode).toBe(204);
      await app.close();
    });
  });

  // ─── COMPLETE ───
  describe('POST /caregiver-todos/:todoId/complete', () => {
    it('completes a todo', async () => {
      const completed = { ...sampleTodo, status: 'completed' as const, completedAt: '2026-03-30T15:00:00.000Z', completedBy: MEMBER_ID };
      const app = buildApp({
        completeCaregiverTodoUseCase: {
          execute: async () => completed,
        } as unknown as CaregiverTodoRouteUseCases['completeCaregiverTodoUseCase'],
      });
      const res = await app.inject({
        method: 'POST',
        url: `/v1/households/${HOUSEHOLD_ID}/caregiver-todos/${TODO_ID}/complete`,
        headers: defaultHeaders,
        payload: {},
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe('completed');
      expect(res.json().data.completedAt).toBeTruthy();
      await app.close();
    });
  });

  // ─── NUDGE ───
  describe('POST /caregiver-todos/:todoId/nudge', () => {
    it('nudges a todo', async () => {
      const nudged = { ...sampleTodo, lastNudgedAt: '2026-03-30T15:00:00.000Z', nudgeCount: 1 };
      const app = buildApp({
        nudgeCaregiverTodoUseCase: {
          execute: async () => nudged,
        } as unknown as CaregiverTodoRouteUseCases['nudgeCaregiverTodoUseCase'],
      });
      const res = await app.inject({
        method: 'POST',
        url: `/v1/households/${HOUSEHOLD_ID}/caregiver-todos/${TODO_ID}/nudge`,
        headers: defaultHeaders,
        payload: {},
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.lastNudgedAt).toBeTruthy();
      expect(res.json().data.nudgeCount).toBe(1);
      await app.close();
    });
  });

  // ─── COMMENTS ───
  describe('POST /caregiver-todos/:todoId/comments', () => {
    it('adds a comment and returns 201', async () => {
      const app = buildApp({
        addCaregiverTodoCommentUseCase: {
          execute: async () => sampleComment,
        } as unknown as CaregiverTodoRouteUseCases['addCaregiverTodoCommentUseCase'],
      });
      const res = await app.inject({
        method: 'POST',
        url: `/v1/households/${HOUSEHOLD_ID}/caregiver-todos/${TODO_ID}/comments`,
        headers: defaultHeaders,
        payload: { content: 'Test comment' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().data.content).toBe('Test comment');
      await app.close();
    });

    it('rejects empty comment', async () => {
      const app = buildApp();
      const res = await app.inject({
        method: 'POST',
        url: `/v1/households/${HOUSEHOLD_ID}/caregiver-todos/${TODO_ID}/comments`,
        headers: defaultHeaders,
        payload: { content: '' },
      });
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      await app.close();
    });
  });
});
