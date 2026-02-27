import type { AuthenticatedRequester } from '../entities/Household.js';
import type { HouseholdRole } from '../entities/Member.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';

export interface AutoAcceptResult {
  acceptedCount: number;
  households: Array<{
    householdId: string;
    role: HouseholdRole;
  }>;
}

/**
 * Auto-accept all pending invitations for authenticated user's email
 * 
 * This is called automatically when user opens app after clicking invitation link.
 * It accepts ALL pending invitations matching user's email, creating memberships.
 */
export class AutoAcceptPendingInvitationsUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    requester: AuthenticatedRequester;
  }): Promise<AutoAcceptResult> {
    console.log('[AutoAcceptInvitations] Checking pending invitations for:', {
      email: input.requester.email,
      userId: input.requester.userId,
    });

    // Get all pending invitations for this email
    const pendingInvitations = await this.repository.listPendingInvitationsByEmail(
      input.requester.email,
    );

    console.log('[AutoAcceptInvitations] Found pending invitations:', {
      count: pendingInvitations.length,
      invitations: pendingInvitations.map(inv => ({
        id: inv.id,
        householdId: inv.householdId,
        role: inv.assignedRole,
      })),
    });

    if (pendingInvitations.length === 0) {
      return {
        acceptedCount: 0,
        households: [],
      };
    }

    // Accept each invitation
    const results: Array<{ householdId: string; role: HouseholdRole }> = [];

    for (const invitation of pendingInvitations) {
      try {
        const result = await this.repository.acceptInvitation({
          requester: input.requester,
          invitationId: invitation.id,
        });

        results.push(result);

        console.log('[AutoAcceptInvitations] Accepted invitation:', {
          invitationId: invitation.id,
          householdId: result.householdId,
          role: result.role,
        });
      } catch (error) {
        console.error('[AutoAcceptInvitations] Failed to accept invitation:', {
          invitationId: invitation.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue with other invitations even if one fails
      }
    }

    console.log('[AutoAcceptInvitations] Auto-acceptance complete:', {
      total: pendingInvitations.length,
      accepted: results.length,
      failed: pendingInvitations.length - results.length,
    });

    return {
      acceptedCount: results.length,
      households: results,
    };
  }
}
