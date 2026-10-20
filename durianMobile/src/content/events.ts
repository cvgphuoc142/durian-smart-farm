type Listener = () => void;

const listeners = new Set<Listener>();

/** Tells the screens that read the content pack that a new release was installed. */
export function emitContentChange() {
  listeners.forEach((l) => l());
}

export function onContentChange(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
