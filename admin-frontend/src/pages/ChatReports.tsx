import { useState } from 'react';
import { api, type ChatReport, type ReportStatus } from '../api';
import { Badge, Empty, ErrorBox, LoadMore, usePaged } from '../ui';

const STATUSES: ReportStatus[] = ['open', 'in_progress', 'resolved', 'dismissed'];

export function ChatReports() {
  const [status, setStatus] = useState('open');
  const { items, loading, error, hasMore, more, reload } = usePaged<ChatReport>('/v1/admin/chat-reports', {
    status: status || undefined,
  });
  const [err, setErr] = useState<unknown>(null);

  const set = async (id: string, s: ReportStatus) => {
    setErr(null);
    try {
      await api('PATCH', `/v1/admin/chat-reports/${id}`, { body: { status: s } });
      reload();
    } catch (e) {
      setErr(e);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Chat reports</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <ErrorBox error={error ?? err} />
      {items.map((r) => (
        <div className="card" key={r.id}>
          <div className="row between">
            <span className="muted small">{new Date(r.created_at).toLocaleString()}</span>
            <Badge value={r.status} />
          </div>
          <p>
            <b>Q:</b> {r.question}
          </p>
          <p className="pre">
            <b>A:</b> {r.answer}
          </p>
          {r.reason && (
            <p className="danger">
              <b>Reason:</b> {r.reason}
            </p>
          )}
          <div className="row">
            {STATUSES.filter((s) => s !== r.status).map((s) => (
              <button key={s} onClick={() => set(r.id, s)}>
                → {s}
              </button>
            ))}
          </div>
        </div>
      ))}
      {!loading && items.length === 0 && <Empty title="No reports" hint="Nothing matches this filter." />}
      <LoadMore hasMore={hasMore} loading={loading} onMore={more} />
    </>
  );
}
