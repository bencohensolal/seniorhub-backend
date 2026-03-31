import type { FastifyInstance } from 'fastify';
import type Stripe from 'stripe';
import type { HouseholdRepository } from '../../domain/repositories/HouseholdRepository.js';
import type { SubscriptionPlan } from '../../domain/entities/Subscription.js';
import { getStripe, getStripeWebhookSecret } from '../../config/stripe.js';

/**
 * Extract period dates from Stripe subscription items.
 * In newer Stripe API versions, period fields are on SubscriptionItem, not Subscription.
 */
function extractPeriodDates(stripeSub: Stripe.Subscription): {
  currentPeriodStart: string;
  currentPeriodEnd: string;
} {
  const firstItem = stripeSub.items?.data?.[0];
  if (firstItem) {
    return {
      currentPeriodStart: new Date(firstItem.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(firstItem.current_period_end * 1000).toISOString(),
    };
  }
  // Fallback: use subscription created date
  return {
    currentPeriodStart: new Date(stripeSub.created * 1000).toISOString(),
    currentPeriodEnd: new Date(stripeSub.created * 1000).toISOString(),
  };
}

/**
 * Extract subscription ID from an invoice.
 * In newer Stripe API versions, subscription is in parent.subscription_details.
 */
function extractSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | undefined {
  const subDetails = invoice.parent?.subscription_details;
  if (!subDetails) return undefined;
  return typeof subDetails.subscription === 'string'
    ? subDetails.subscription
    : subDetails.subscription?.id;
}

/**
 * Stripe webhook handler.
 * Processes subscription lifecycle events from Stripe.
 *
 * Required env vars:
 * - STRIPE_SECRET_KEY
 * - STRIPE_WEBHOOK_SECRET
 */
export function registerStripeWebhookRoute(
  fastify: FastifyInstance,
  repository: HouseholdRepository,
): void {
  fastify.post(
    '/v1/webhooks/stripe',
    {
      config: {
        rawBody: true,
      },
      schema: {
        tags: ['Webhooks'],
        hide: true,
      },
    },
    async (request, reply) => {
      const stripe = getStripe();
      const webhookSecret = getStripeWebhookSecret();

      // If Stripe is not configured, just acknowledge silently
      if (!stripe || !webhookSecret) {
        request.log.warn('Stripe webhook received but Stripe is not configured. Ignoring.');
        return reply.status(200).send({ received: true });
      }

      const signature = request.headers['stripe-signature'] as string;
      if (!signature) {
        return reply.status(400).send({ error: 'Missing stripe-signature header' });
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          request.body as string | Buffer,
          signature,
          webhookSecret,
        );
      } catch (err) {
        request.log.error({ err }, 'Stripe webhook signature verification failed');
        return reply.status(400).send({ error: 'Invalid signature' });
      }

      request.log.info({ type: event.type, id: event.id }, 'Processing Stripe webhook event');

      try {
        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            const householdId = session.metadata?.householdId;
            const plan = session.metadata?.plan as SubscriptionPlan | undefined;
            const stripeSubscriptionId = typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription?.id;
            const stripeCustomerId = typeof session.customer === 'string'
              ? session.customer
              : session.customer?.id;

            if (!householdId || !plan || !stripeSubscriptionId) {
              request.log.error({ metadata: session.metadata }, 'Missing metadata in checkout session');
              break;
            }

            const sub = await repository.ensureDefaultSubscription(householdId);

            await repository.updateSubscription(sub.id, {
              plan,
              status: 'active',
              stripeSubscriptionId,
              stripeCustomerId: stripeCustomerId ?? sub.stripeCustomerId,
            });

            // Fetch subscription from Stripe to get period dates
            const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
            const period = extractPeriodDates(stripeSub);
            await repository.updateSubscription(sub.id, {
              currentPeriodStart: period.currentPeriodStart,
              currentPeriodEnd: period.currentPeriodEnd,
            });

            request.log.info({ householdId, plan }, 'Subscription activated via checkout');
            break;
          }

          case 'invoice.paid': {
            const invoice = event.data.object as Stripe.Invoice;
            const stripeSubId = extractSubscriptionIdFromInvoice(invoice);

            if (!stripeSubId) break;

            const sub = await repository.getSubscriptionByStripeSubscriptionId(stripeSubId);
            if (!sub) {
              request.log.warn({ stripeSubId }, 'No subscription found for paid invoice');
              break;
            }

            const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
            const period = extractPeriodDates(stripeSub);
            await repository.updateSubscription(sub.id, {
              status: 'active',
              currentPeriodStart: period.currentPeriodStart,
              currentPeriodEnd: period.currentPeriodEnd,
            });

            request.log.info({ subscriptionId: sub.id }, 'Subscription renewed via invoice.paid');
            break;
          }

          case 'invoice.payment_failed': {
            const invoice = event.data.object as Stripe.Invoice;
            const stripeSubId = extractSubscriptionIdFromInvoice(invoice);

            if (!stripeSubId) break;

            const sub = await repository.getSubscriptionByStripeSubscriptionId(stripeSubId);
            if (!sub) break;

            await repository.updateSubscription(sub.id, {
              status: 'past_due',
            });

            request.log.warn({ subscriptionId: sub.id }, 'Payment failed — subscription marked as past_due');
            break;
          }

          case 'customer.subscription.updated': {
            const stripeSub = event.data.object as Stripe.Subscription;
            const stripeSubId = stripeSub.id;

            const sub = await repository.getSubscriptionByStripeSubscriptionId(stripeSubId);
            if (!sub) break;

            const newPlan = stripeSub.metadata?.plan as SubscriptionPlan | undefined;
            const cancelAtPeriodEnd = stripeSub.cancel_at_period_end;
            const period = extractPeriodDates(stripeSub);

            await repository.updateSubscription(sub.id, {
              ...(newPlan && { plan: newPlan }),
              cancelAtPeriodEnd,
              currentPeriodStart: period.currentPeriodStart,
              currentPeriodEnd: period.currentPeriodEnd,
            });

            request.log.info({ subscriptionId: sub.id, newPlan, cancelAtPeriodEnd }, 'Subscription updated');
            break;
          }

          case 'customer.subscription.deleted': {
            const stripeSub = event.data.object as Stripe.Subscription;
            const stripeSubId = stripeSub.id;

            const sub = await repository.getSubscriptionByStripeSubscriptionId(stripeSubId);
            if (!sub) break;

            await repository.updateSubscription(sub.id, {
              plan: 'gratuit',
              status: 'cancelled',
              stripeSubscriptionId: null,
              cancelAtPeriodEnd: false,
            });

            request.log.info({ subscriptionId: sub.id }, 'Subscription cancelled — downgraded to gratuit');
            break;
          }

          default:
            request.log.info({ type: event.type }, 'Unhandled Stripe event type');
        }
      } catch (err) {
        request.log.error({ err, eventType: event.type }, 'Error processing Stripe webhook event');
        return reply.status(500).send({ error: 'Webhook processing failed' });
      }

      return reply.status(200).send({ received: true });
    },
  );
}
