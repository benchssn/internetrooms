import type { CallbackResult } from "./authContext";

/**
 * One-time codes can only be exchanged once. React may run effects twice
 * in development, so in-flight and finished exchanges are shared per code.
 */
const exchanges = new Map<string, Promise<CallbackResult>>();

export function sharedExchange(code: string, run: () => Promise<CallbackResult>): Promise<CallbackResult> {
  let pending = exchanges.get(code);
  if (!pending) {
    pending = run();
    exchanges.set(code, pending);
  }
  return pending;
}

/** For tests: forget remembered exchanges. */
export function resetAuthExchangesForTests() {
  exchanges.clear();
}
