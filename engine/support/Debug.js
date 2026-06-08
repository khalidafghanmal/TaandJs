import util from 'node:util';

/**
 * Debug helpers — peek() logs, halt() stops with a dump (debug only).
 */
export class HaltError extends Error {
  constructor(payload = undefined) {
    super('[Taand] Halted');
    this.name = 'HaltError';
    this.payload = payload;
  }
}

export function isDebugEnabled() {
  return process.env.TAAND_DEBUG === 'true' || process.env.TAAND_DEBUG === '1';
}

export function peek(...values) {
  if (!isDebugEnabled()) {
    return values.length <= 1 ? values[0] : values;
  }

  const label = '[peek]';
  if (values.length === 1) {
    console.log(label, util.inspect(values[0], { depth: null, colors: true }));
  } else {
    console.log(label, ...values.map((v) => util.inspect(v, { depth: null, colors: true })));
  }

  return values.length <= 1 ? values[0] : values;
}

export function halt(...values) {
  if (!isDebugEnabled()) {
    throw new Error('[Taand] halt() is only available when TAAND_DEBUG=true');
  }

  const payload = values.length <= 1 ? values[0] : values;
  if (values.length) peek(payload);
  throw new HaltError(payload);
}

export function formatHaltPayload(payload) {
  return util.inspect(payload, { depth: null, colors: false });
}
