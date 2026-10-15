/**
 * Stores read their data from the services when their module loads. When the services are REPLACED afterwards (a test that swaps them, hot reload, a future sign-in that switches
 * between tenants) every store has to read again from the new ones: each store registers one function here that does that, and `setServices` runs them all (`reinitStores`).
 * Leave `withoutSaving` around the `setState` of such a function: what was just read must not be handed back to the service as if the person had changed it.
 */
const inits = new Set<() => void>();
export function registerStoreInit(init: () => void) {
  inits.add(init);
}
/** Make every registered store read its data again from the current services. */
export function reinitStores() {
  inits.forEach((init) => init());
}
