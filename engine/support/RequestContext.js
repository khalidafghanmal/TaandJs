import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();

/**
 * Request-scoped context — helpers can resolve the current Request without passing it explicitly.
 */
export function runWithRequest(request, fn) {
  return storage.run({ request }, fn);
}

export function currentRequest() {
  return storage.getStore()?.request ?? null;
}
