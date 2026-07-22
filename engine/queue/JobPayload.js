const CLASS_NAME_RE = /^[A-Z][A-Za-z0-9]*$/;
const MAX_PAYLOAD_BYTES = 256 * 1024;

/**
 * Safe job payload serialization — JSON only, no eval.
 */
export class JobPayload {
  static pack(job, { queue = 'default', delay = 0 } = {}) {
    const name = job.constructor?.name;
    if (!name || !CLASS_NAME_RE.test(name)) {
      throw new Error('[Taand] Job class must be a named PascalCase class');
    }

    const data = typeof job.serialize === 'function'
      ? job.serialize()
      : {};

    const payload = {
      v: 1,
      job: name,
      data,
      meta: {
        queue: job.queue ?? queue,
        tries: job.tries ?? 3,
        timeout: job.timeout ?? 60,
        backoff: job.backoff ?? [10, 30, 60],
        delay,
      },
    };

    const raw = JSON.stringify(payload);
    if (raw.length > MAX_PAYLOAD_BYTES) {
      throw new Error('[Taand] Job payload exceeds maximum size');
    }

    return payload;
  }

  static unpack(raw) {
    const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!payload?.job || payload.v !== 1) {
      throw new Error('[Taand] Invalid job payload');
    }
    return payload;
  }
}

export { CLASS_NAME_RE };
