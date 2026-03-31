import type { FastifyInstance } from 'fastify';
import type { HouseholdRepository } from '../../domain/repositories/HouseholdRepository.js';

/**
 * Stripe webhook handler.
 * Processes subscription lifecycle events from Stripe.
 *
 * TODO: Full implementation requires:
 * 1. Add `stripe` npm package
 * 2. Configure STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET env vars
 * 3. Verify webhook signature with stripe.webhooks.constructEvent()
 * 4. Handle events: checkout.session.completed, invoice.paid, invoice.payment_failed,
 *    customer.subscription.updated, customer.subscription.deleted
 */
export function registerStripeWebhookRoute(
  fastify: FastifyInstance,
  repository: HouseholdRepository,
): void {
  fastify.post(
    '/v1/webhooks/stripe',
    {
      config: {
        // Stripe webhooks need raw body for signature verification
        rawBody: true,
      },
      schema: {
        tags: ['Webhooks'],
        hide: true, // Don't show in Swagger
      },
    },
    async (request, reply) => {
      // TODO: Implement Stripe webhook processing
      // const sig = request.headers['stripe-signature'];
      // const event = stripe.webhooks.constructEvent(request.rawBody, sig, STRIPE_WEBHOOK_SECRET);
      //
      // switch (event.type) {
      //   case 'checkout.session.completed': {
      //     // User completed checkout — activate subscription
      //     // Extract householdId from metadata, update subscription record
      //     break;
      //   }
      //   case 'invoice.paid': {
      //     // Recurring payment succeeded — update period dates
      //     break;
      //   }
      //   case 'invoice.payment_failed': {
      //     // Payment failed — mark subscription as past_due
      //     break;
      //   }
      //   case 'customer.subscription.updated': {
      //     // Plan changed or subscription updated
      //     break;
      //   }
      //   case 'customer.subscription.deleted': {
      //     // Subscription cancelled — downgrade to gratuit
      //     const sub = await repository.getSubscriptionByStripeSubscriptionId(stripeSubId);
      //     if (sub) {
      //       await repository.updateSubscription(sub.id, { plan: 'gratuit', status: 'cancelled' });
      //     }
      //     break;
      //   }
      // }

      return reply.status(200).send({ received: true });
    },
  );
}
