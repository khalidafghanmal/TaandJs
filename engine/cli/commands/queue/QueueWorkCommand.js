import { runQueueWork } from '../../runners/queue.js';

export class QueueWorkCommand {
  name = 'queue:work';
  description = 'Run the queue worker';
  usage = 'queue:work [--queue=default] [--connection=database] [--sleep=1] [--once]';
  options = [
    { flag: '--queue=<name>', description: 'Queue name (default: default)' },
    { flag: '--connection=<name>', description: 'Queue connection (default: config default)' },
    { flag: '--sleep=<seconds>', description: 'Sleep time when queue is empty (default: 1)' },
    { flag: '--once', description: 'Process one job and exit' },
  ];
  examples = ['Taand queue:work --connection=database --queue=emails', 'Taand queue:work --once'];

  async run({ argv }) {
    // argv is full user argv; extract after command name for runner
    const rest = argv.slice(1);
    return runQueueWork(rest);
  }
}

