import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { ApiError, api, type Action, type Page, type Status } from './api';

export const errText = (e: unknown) =>
  e instanceof ApiError
    ? `${e.code}${e.field ? ` (${e.field})` : ''}: ${e.message}${e.requestId ? ` [${e.requestId}]` : ''}`
    : String(e);

export const Badge = ({ value }: { value: string }) => <span className={`badge b-${value}`}>{value}</span>;

export const Empty = ({ title, hint }: { title: string; hint?: string }) => (
  <div className="empty">
    <strong>{title}</strong>
    {hint}
  </div>
);

export const ErrorBox = ({ error }: { error: unknown }) =>
  error ? <div className="error">{errText(error)}</div> : null;

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="field">
    <span>{label}</span>
    {children}
  </label>
);

/** Comma/newline separated text <-> string[] */
export const toList = (s: string) =>
  s
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);
export const nul = (s: string) => (s.trim() === '' ? null : s.trim());

/** Cursor paginated list: reloads when `deps` change, `more()` appends the next page. */
export function usePaged<T>(path: string, query: Record<string, string | undefined>) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const key = JSON.stringify(query);

  const load = useCallback(
    async (after?: string) => {
      setLoading(true);
      setError(null);
      try {
        const page = await api<Page<T>>('GET', path, { query: { ...query, limit: 25, cursor: after } });
        setItems((prev) => (after ? [...prev, ...page.items] : page.items));
        setCursor(page.next_cursor);
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, key],
  );
  useEffect(() => {
    void load();
  }, [load]);
  return { items, loading, error, hasMore: cursor !== null, more: () => cursor && load(cursor), reload: () => load() };
}

export function LoadMore({ hasMore, loading, onMore }: { hasMore: boolean; loading: boolean; onMore: () => void }) {
  return (
    <div className="row center">
      {loading && <span className="muted">Loading…</span>}
      {hasMore && !loading && <button onClick={onMore}>Load more</button>}
    </div>
  );
}

export function TransitionButtons({
  status,
  actions,
  onAct,
}: {
  status: Status;
  actions: Action[];
  onAct: (a: Action) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = async (a: Action) => {
    if (a === 'unpublish' && !confirm('Unpublish this content?')) return;
    setBusy(true);
    setError(null);
    try {
      await onAct(a);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <div className="row">
        <Badge value={status} />
        {actions.map((a) => (
          <button key={a} disabled={busy} className={a === 'publish' ? 'primary' : ''} onClick={() => run(a)}>
            {a.replace(/_/g, ' ')}
          </button>
        ))}
      </div>
      <ErrorBox error={error} />
    </div>
  );
}

/** Small form wrapper: handles busy + error and calls onSubmit. */
export function Form({
  onSubmit,
  submitLabel = 'Save',
  children,
}: {
  onSubmit: () => Promise<void>;
  submitLabel?: string;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await onSubmit();
        } catch (err) {
          setError(err);
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      <ErrorBox error={error} />
      <div className="row">
        <button className="primary" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
