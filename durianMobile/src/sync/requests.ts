type Listener = () => void;

const listeners = new Set<Listener>();

/** Asks the sync host to run the outbox now (after a save, or the "Sync now" button). */
export function requestSync() {
  listeners.forEach((l) => l());
}

export function onSyncRequest(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
