import { useCallback, useEffect, useState } from 'react';
import {
  api,
  NEXT_ACTIONS,
  STATUSES,
  type Action,
  type ArticleSummary,
  type ArticleVersion,
} from '../api';
import { Badge, ErrorBox, Field, Form, LoadMore, Modal, nul, toList, TransitionButtons, usePaged } from '../ui';

function VersionForm({
  version,
  articleId,
  onDone,
}: {
  version?: ArticleVersion;
  articleId?: string; // set => new version of this article; unset + no version => new article
  onDone: () => void;
}) {
  const [f, setF] = useState({
    title: version?.title ?? '',
    body: version?.body ?? '',
    search_keywords: (version?.search_keywords ?? []).join(', '),
    category: version?.category ?? '',
    disease_code: version?.disease_code ?? '',
    source_links: (version?.source_links ?? []).join('\n'),
    plant_parts: (version?.plant_parts ?? []).join(', '),
    stages: (version?.stages ?? []).join(', '),
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Form
      onSubmit={async () => {
        const body = {
          title: f.title,
          body: f.body,
          search_keywords: toList(f.search_keywords),
          category: nul(f.category),
          disease_code: nul(f.disease_code),
          source_links: toList(f.source_links),
          plant_parts: toList(f.plant_parts),
          stages: toList(f.stages),
        };
        if (version) await api('PATCH', `/v1/admin/article-versions/${version.id}`, { body });
        else if (articleId) await api('POST', `/v1/admin/articles/${articleId}/versions`, { body });
        else await api('POST', '/v1/admin/articles', { body });
        onDone();
      }}
    >
      <Field label="Title *">
        <input value={f.title} onChange={set('title')} />
      </Field>
      <Field label="Body *">
        <textarea rows={8} value={f.body} onChange={set('body')} />
      </Field>
      <Field label="Search keywords (comma separated)">
        <input value={f.search_keywords} onChange={set('search_keywords')} />
      </Field>
      <div className="grid2">
        <Field label="Disease code">
          <input value={f.disease_code} onChange={set('disease_code')} />
        </Field>
        <Field label="Category">
          <input value={f.category} onChange={set('category')} />
        </Field>
      </div>
      <Field label="Source links * (one per line)">
        <textarea rows={3} value={f.source_links} onChange={set('source_links')} />
      </Field>
      <div className="grid2">
        <Field label="Plant parts (comma separated)">
          <input value={f.plant_parts} onChange={set('plant_parts')} />
        </Field>
        <Field label="Stages (comma separated)">
          <input value={f.stages} onChange={set('stages')} />
        </Field>
      </div>
    </Form>
  );
}

function ArticleDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<{ versions: ArticleVersion[] } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [mode, setMode] = useState<string | null>(null); // `edit:<vid>` | `new`
  const load = useCallback(() => {
    api<{ versions: ArticleVersion[] }>('GET', `/v1/admin/articles/${id}`).then(setData).catch(setError);
  }, [id]);
  useEffect(load, [load]);

  const versions = [...(data?.versions ?? [])].sort((a, b) => b.version_no - a.version_no);
  const done = () => {
    setMode(null);
    load();
  };
  return (
    <Modal title="Article" onClose={onClose}>
      <ErrorBox error={error} />
      <button onClick={() => setMode(mode === 'new' ? null : 'new')}>+ New draft version</button>
      {mode === 'new' && <VersionForm articleId={id} onDone={done} />}
      {versions.map((v) => (
        <div className="card" key={v.id}>
          <div className="row between">
            <b>
              v{v.version_no} · {v.title} {v.disease_code && `· ${v.disease_code}`}
            </b>
            <div className="row">
              {v.status === 'draft' && <button onClick={() => setMode(`edit:${v.id}`)}>Edit</button>}
            </div>
          </div>
          <TransitionButtons
            status={v.status}
            actions={NEXT_ACTIONS[v.status]}
            onAct={async (a: Action) => {
              await api('POST', `/v1/admin/article-versions/${v.id}/transition`, { body: { action: a } });
              load();
            }}
          />
          {mode === `edit:${v.id}` && <VersionForm version={v} onDone={done} />}
        </div>
      ))}
    </Modal>
  );
}

export function Articles() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [qApplied, setQApplied] = useState('');
  const { items, loading, error, hasMore, more, reload } = usePaged<ArticleSummary>('/v1/admin/articles', {
    status: status || undefined,
    q: qApplied || undefined,
  });
  const [open, setOpen] = useState<string | 'new' | null>(null);

  return (
    <>
      <div className="page-head">
        <h1>Articles</h1>
        <div className="row">
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              setQApplied(q);
            }}
          >
            <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button className="primary" onClick={() => setOpen('new')}>
            + New article
          </button>
        </div>
      </div>
      <ErrorBox error={error} />
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Disease</th>
            <th>Latest</th>
            <th>Published</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id}>
              <td>{a.title ?? <span className="muted">(untitled)</span>}</td>
              <td>{a.disease_code ?? '—'}</td>
              <td>
                v{a.latest_version_no} <Badge value={a.latest_status} />
              </td>
              <td>{a.published_version_id ? '✓' : '—'}</td>
              <td>
                <button onClick={() => setOpen(a.id)}>Open</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <LoadMore hasMore={hasMore} loading={loading} onMore={more} />
      {open === 'new' && (
        <Modal title="New article" onClose={() => setOpen(null)}>
          <VersionForm
            onDone={() => {
              setOpen(null);
              reload();
            }}
          />
        </Modal>
      )}
      {open && open !== 'new' && (
        <ArticleDetail
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
