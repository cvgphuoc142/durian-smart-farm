import { useCallback, useEffect, useState } from 'react';
import {
  api,
  NEXT_ACTIONS,
  type StandardDetail,
  type StandardItem,
  type StandardProfileSummary,
  type StandardVersion,
} from '../api';
import { Badge, ErrorBox, Field, Form, LoadMore, Modal, nul, toList, TransitionButtons, usePaged } from '../ui';

type Row = {
  item_key: string;
  title: string;
  body: string;
  source_link: string;
  source_checked_at: string;
  sort_order: number;
  id?: string;
};
const today = () => new Date().toISOString();

function VersionForm({
  profileId,
  version,
  items,
  base,
  onDone,
}: {
  profileId: string;
  version?: StandardVersion; // set => edit this draft
  items?: StandardItem[];
  base?: StandardVersion; // new version prefilled from the latest one
  onDone: () => void;
}) {
  const from = version ?? base;
  const [title, setTitle] = useState(from?.title ?? '');
  const [desc, setDesc] = useState(from?.description ?? '');
  const [links, setLinks] = useState((from?.source_links ?? []).join('\n'));
  const [effective, setEffective] = useState(from?.effective_on ?? '');
  const [rows, setRows] = useState<Row[]>(
    (items ?? []).map((i) => ({
      id: i.id,
      item_key: i.item_key,
      title: i.title,
      body: i.body ?? '',
      source_link: i.source_link,
      source_checked_at: i.source_checked_at,
      sort_order: i.sort_order,
    })),
  );
  const upd = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <Form
      onSubmit={async () => {
        const body = {
          title,
          description: nul(desc),
          source_links: toList(links),
          effective_on: nul(effective),
          items: rows.map((r) => ({ ...r, body: nul(r.body) })),
        };
        if (version) await api('PUT', `/v1/admin/standard-versions/${version.id}`, { body });
        else await api('POST', `/v1/admin/standards/${profileId}/versions`, { body });
        onDone();
      }}
    >
      <Field label="Checklist title *">
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Description">
        <textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
      </Field>
      <Field label="Effective on">
        <input type="date" value={effective ?? ''} onChange={(e) => setEffective(e.target.value)} />
      </Field>
      <Field label="Source links (one per line)">
        <textarea rows={2} value={links} onChange={(e) => setLinks(e.target.value)} />
      </Field>
      <h4>Items (official sources for FRESH durian only)</h4>
      {rows.map((r, i) => (
        <div className="item-row" key={i}>
          <input placeholder="item_key" value={r.item_key} onChange={(e) => upd(i, { item_key: e.target.value })} />
          <input placeholder="title *" value={r.title} onChange={(e) => upd(i, { title: e.target.value })} />
          <input placeholder="body" value={r.body} onChange={(e) => upd(i, { body: e.target.value })} />
          <input placeholder="source link" value={r.source_link} onChange={(e) => upd(i, { source_link: e.target.value })} />
          <input
            type="number"
            title="sort order"
            value={r.sort_order}
            onChange={(e) => upd(i, { sort_order: Number(e.target.value) })}
          />
          <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setRows([...rows, { item_key: '', title: '', body: '', source_link: '', source_checked_at: today(), sort_order: rows.length + 1 }])
        }
      >
        + Add item
      </button>
    </Form>
  );
}

function StandardDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<StandardDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [mode, setMode] = useState<string | null>(null); // new | edit:<vid>
  const load = useCallback(() => {
    api<StandardDetail>('GET', `/v1/admin/standards/${id}`).then(setData).catch(setError);
  }, [id]);
  useEffect(load, [load]);
  const done = () => {
    setMode(null);
    load();
  };
  const versions = [...(data?.versions ?? [])].sort((a, b) => b.version.version_no - a.version.version_no);

  return (
    <Modal
      title={data ? `${data.profile.market_code} / ${data.profile.product_form_code}` : 'Standard'}
      onClose={onClose}
    >
      <ErrorBox error={error} />
      <button onClick={() => setMode(mode === 'new' ? null : 'new')}>+ New draft version</button>
      {mode === 'new' && (
        <VersionForm
          profileId={id}
          base={versions[0]?.version}
          items={versions[0]?.items}
          onDone={done}
        />
      )}
      {versions.map(({ version: v, items }) => (
        <div className="card" key={v.id}>
          <div className="row between">
            <b>
              v{v.version_no} · {v.title} · {items.length} items {v.effective_on && `· effective ${v.effective_on}`}
            </b>
            <div className="row">
              {v.status === 'draft' && <button onClick={() => setMode(`edit:${v.id}`)}>Edit items</button>}
            </div>
          </div>
          <TransitionButtons
            status={v.status}
            actions={NEXT_ACTIONS[v.status]}
            onAct={async (a) => {
              await api('POST', `/v1/admin/standard-versions/${v.id}/transition`, { body: { action: a } });
              load();
            }}
          />
          {mode === `edit:${v.id}` && <VersionForm profileId={id} version={v} items={items} onDone={done} />}
        </div>
      ))}
    </Modal>
  );
}

export function Standards() {
  const { items, loading, error, hasMore, more, reload } = usePaged<StandardProfileSummary>('/v1/admin/standards', {});
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <h1>Standards</h1>
      <ErrorBox error={error} />
      <table>
        <thead>
          <tr>
            <th>Market</th>
            <th>Form</th>
            <th>Latest</th>
            <th>Published</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id}>
              <td>{s.market_code}</td>
              <td>{s.product_form_code}</td>
              <td>{s.latest_status ? <Badge value={s.latest_status} /> : '—'}</td>
              <td>{s.published_version_id ? '✓' : '—'}</td>
              <td>
                <button onClick={() => setOpen(s.id)}>Open</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <LoadMore hasMore={hasMore} loading={loading} onMore={more} />
      {open && (
        <StandardDetailModal
          id={open}
          onClose={() => {
            setOpen(null);
            reload();
          }}
        />
      )}
    </>
  );
}
