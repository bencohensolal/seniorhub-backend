import { ConsoleEmailProvider } from './ConsoleEmailProvider.js';
import { InvitationEmailMetrics } from './InvitationEmailMetrics.js';
import { InvitationEmailQueue } from './InvitationEmailQueue.js';

const metrics = new InvitationEmailMetrics();
const provider = new ConsoleEmailProvider();
const queue = new InvitationEmailQueue(provider, metrics);

export const invitationEmailRuntime = {
  queue,
  metrics,
};
