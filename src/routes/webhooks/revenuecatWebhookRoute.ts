import type { FastifyInstance } from 'fastify';
import type { HouseholdRepository } from '../../domain/repositories/HouseholdRepository.js';
import type { SubscriptionPlan } from '../../domain/entities/Subscription.js';
import { getEmailProvider } from '../../data/services/email/emailProvider.js';

/**
 * Map a RevenueCat product_id to a SeniorHub plan.
 */
function mapProductToPlan(productId: string): SubscriptionPlan {
  if (productId.startsWith('serenite') || productId.startsWith('serenity')) return 'serenite';
  if (productId.startsWith('famille') || productId.startsWith('family')) return 'famille';
  return 'gratuit';
}

/**
 * RevenueCat webhook handler.
 * Processes subscription lifecycle events from RevenueCat.
 *
 * Required env var: REVENUECAT_WEBHOOK_AUTH_KEY
 *
 * RevenueCat sends a JSON body with shape:
 * {
 *   "api_version": "1.0",
 *   "event": {
 *     "type": "INITIAL_PURCHASE" | "RENEWAL" | "CANCELLATION" | ...,
 *     "app_user_id": string,          // = householdId
 *     "product_id": string,            // e.g. "famille_monthly"
 *     "entitlement_ids": string[],     // e.g. ["famille"]
 *     "period_type": "NORMAL" | "TRIAL" | "INTRO",
 *     "expiration_at_ms": number,
 *     "purchase_date_ms": number,
 *     "original_transaction_id": string,
 *     ...
 *   }
 * }
 */
export function registerRevenueCatWebhookRoute(
  fastify: FastifyInstance,
  repository: HouseholdRepository,
): void {
  const webhookAuthKey = process.env.REVENUECAT_WEBHOOK_AUTH_KEY ?? '';

  fastify.post(
    '/v1/webhooks/revenuecat',
    {
      schema: {
        tags: ['Webhooks'],
        hide: true,
      },
    },
    async (request, reply) => {
      // Verify authorization
      if (webhookAuthKey) {
        const authHeader = request.headers.authorization ?? '';
        if (authHeader !== `Bearer ${webhookAuthKey}`) {
          request.log.warn('RevenueCat webhook: invalid authorization');
          return reply.status(401).send({ error: 'Unauthorized' });
        }
      }

      const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
      const event = body?.event;

      if (!event || !event.type) {
        return reply.status(400).send({ error: 'Missing event' });
      }

      const {
        type,
        app_user_id: appUserId,
        product_id: productId,
        original_transaction_id: originalTransactionId,
        expiration_at_ms: expirationAtMs,
        purchase_date_ms: purchaseDateMs,
      } = event;

      request.log.info({ type, appUserId, productId }, 'Processing RevenueCat webhook event');

      if (!appUserId) {
        request.log.warn({ type }, 'RevenueCat webhook: missing app_user_id');
        return reply.status(200).send({ received: true });
      }

      try {
        // app_user_id = householdId (set via Purchases.logIn(householdId) in the app)
        const sub = await repository.ensureDefaultSubscription(appUserId);

        switch (type) {
          case 'INITIAL_PURCHASE':
          case 'NON_RENEWING_PURCHASE': {
            const plan = mapProductToPlan(productId ?? '');
            await repository.updateSubscription(sub.id, {
              plan,
              status: 'active',
              rcAppUserId: appUserId,
              rcOriginalTransactionId: originalTransactionId ?? null,
              rcProductId: productId ?? null,
              currentPeriodStart: purchaseDateMs ? new Date(purchaseDateMs).toISOString() : null,
              currentPeriodEnd: expirationAtMs ? new Date(expirationAtMs).toISOString() : null,
              cancelAtPeriodEnd: false,
            });
            request.log.info({ appUserId, plan }, 'Subscription activated');
            break;
          }

          case 'RENEWAL': {
            await repository.updateSubscription(sub.id, {
              status: 'active',
              currentPeriodEnd: expirationAtMs ? new Date(expirationAtMs).toISOString() : null,
              cancelAtPeriodEnd: false,
            });
            request.log.info({ appUserId }, 'Subscription renewed');
            break;
          }

          case 'PRODUCT_CHANGE': {
            const newPlan = mapProductToPlan(productId ?? '');
            await repository.updateSubscription(sub.id, {
              plan: newPlan,
              rcProductId: productId ?? null,
            });
            request.log.info({ appUserId, newPlan }, 'Subscription plan changed');
            break;
          }

          case 'CANCELLATION': {
            await repository.updateSubscription(sub.id, {
              cancelAtPeriodEnd: true,
            });
            request.log.info({ appUserId }, 'Subscription cancellation scheduled');
            break;
          }

          case 'UNCANCELLATION': {
            await repository.updateSubscription(sub.id, {
              cancelAtPeriodEnd: false,
            });
            request.log.info({ appUserId }, 'Subscription uncancelled');
            break;
          }

          case 'BILLING_ISSUE': {
            await repository.updateSubscription(sub.id, {
              status: 'past_due',
            });
            request.log.warn({ appUserId }, 'Billing issue — subscription marked as past_due');

            // Send payment failure notification to household caregivers
            try {
              const members = await repository.listHouseholdMembers(appUserId);
              const caregiverEmails = members
                .filter((m) => m.role !== 'senior' && m.email)
                .map((m) => m.email!);

              if (caregiverEmails.length > 0) {
                const emailProvider = getEmailProvider();
                for (const email of caregiverEmails) {
                  await emailProvider.send({
                    to: email,
                    subject: '[SeniorHub] Votre paiement a échoué',
                    body: [
                      'Bonjour,',
                      '',
                      'Le paiement de votre abonnement SeniorHub a échoué.',
                      '',
                      'Mettez à jour votre moyen de paiement depuis les réglages',
                      'de votre compte App Store ou Google Play pour conserver',
                      'votre abonnement.',
                      '',
                      'Si le problème persiste, votre abonnement sera automatiquement',
                      'résilié et vous passerez au plan Gratuit.',
                      '',
                      "L'équipe SeniorHub",
                    ].join('\n'),
                  });
                }
                request.log.info(
                  { appUserId, recipientCount: caregiverEmails.length },
                  'Payment failure notification emails sent',
                );
              }
            } catch (emailErr) {
              request.log.error({ err: emailErr }, 'Failed to send payment failure notification emails');
            }
            break;
          }

          case 'EXPIRATION': {
            await repository.updateSubscription(sub.id, {
              plan: 'gratuit',
              status: 'cancelled',
              rcOriginalTransactionId: null,
              rcProductId: null,
              cancelAtPeriodEnd: false,
            });
            request.log.info({ appUserId }, 'Subscription expired — downgraded to gratuit');
            break;
          }

          default:
            request.log.info({ type }, 'Unhandled RevenueCat event type');
        }
      } catch (err) {
        request.log.error({ err, eventType: type }, 'Error processing RevenueCat webhook event');
        return reply.status(500).send({ error: 'Webhook processing failed' });
      }

      return reply.status(200).send({ received: true });
    },
  );
}
