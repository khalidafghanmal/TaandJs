import { runQueueFailed } from '../../runners/queue.js';

export class QueueFailedCommand {
  name = 'queue:failed';
  description = 'List failed queue jobs';
  usage = 'queue:failed';

  async run() {
    return runQueueFailed();
  }
}

