import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerAuthContext } from '../plugins/authContext.js';
import { registerUserProfileRoutes } from './userProfileRoutes.js';

type UserProfileRouteRepository = Parameters<typeof registerUserProfileRoutes>[1];

describe('registerUserProfileRoutes', () => {
  it('updates and returns the persisted profile', async () => {
    const app = Fastify();
    registerAuthContext(app);

    const repositoryStub: UserProfileRouteRepository = {
      getUserProfile: async () => null,
      updateUserProfile: async (userId: string, input: { email: string; firstName: string; lastName: string }) => ({
        userId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        updatedAt: '2026-03-13T09:00:00.000Z',
      }),
    } as unknown as UserProfileRouteRepository;

    registerUserProfileRoutes(app, repositoryStub);

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/users/me/profile',
      headers: {
        'x-user-id': 'user-2',
        'x-user-email': 'ben@example.com',
        'x-user-first-name': 'Ben',
        'x-user-last-name': 'Martin',
      },
      payload: {
        firstName: 'Benjamin',
        lastName: 'Cohen',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        email: 'ben@example.com',
        firstName: 'Benjamin',
        lastName: 'Cohen',
        updatedAt: '2026-03-13T09:00:00.000Z',
      },
    });

    await app.close();
  });
});
