type Listener = () => void;

const listeners = new Set<Listener>();

/** Tells the screens that read local scans that the table changed. */
export function emitScanChange() {
  listeners.forEach((l) => l());
}

export function onScanChange(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
