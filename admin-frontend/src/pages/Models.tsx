import { useState } from 'react';
import { api, type ModelEntry, type ModelVersion } from '../api';
import { Badge, Empty, ErrorBox, Field, Form, LoadMore, Modal, nul, TransitionButtons, usePaged } from '../ui';

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** PUT the file to the presigned URL, reporting progress (fetch cannot). */
function putFile(url: string, file: File, onProgress: (done: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: HTTP ${xhr.status}`));
    xhr.onerror = () =>
      reject(new Error('Upload blocked. The storage bucket must allow PUT from this origin (CORS).'));
    xhr.send(file);
  });
}

/** Sends the file and tells the server to verify it. */
async function uploadAndComplete(
  id: string,
  url: string,
  file: File,
  onProgress: (done: number) => void,
): Promise<void> {
  await putFile(url, file, onProgress);
  await api('POST', `/v1/admin/models/${id}/complete`);
}

function Progress({ done, total }: { done: number; total: number }) {
  if (!total) return null;
  return (
    <p className="muted small">
      Uploading {mb(done)} / {mb(total)}
    </p>
  );
}

const SAMPLE = `{
  "model_id": "durianos_leaf",
  "version": "…",
  "plant_part": "leaf",
  "part_labels": { "vi": "Lá", "en": "Leaf" },
  "pipeline_version": "…", "threshold_version": "…",
  "input": { … }, "output": { … },
  "classes": [ … ], "rules": { … }
}`;

function UploadForm({ onDone, onCreated }: { onDone: () => void; onCreated: () => void }) {
  const [json, setJson] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [maturity, setMaturity] = useState<'stable' | 'beta'>('beta');
  const [limitations, setLimitations] = useState('');
  const [minApp, setMinApp] = useState('');
  const [progress, setProgress] = useState(0);

  return (
    <Form
      submitLabel="Upload"
      onSubmit={async () => {
        if (!file) throw new Error('Choose the .onnx file');
        let entry: Record<string, unknown>;
        try {
          entry = JSON.parse(json);
        } catch {
          throw new Error('The model entry is not valid JSON');
        }
        // The file decides `artifact`; a pasted app-manifest entry may still carry one.
        delete entry.artifact;
        const classes = (entry.classes as { kind: string }[] | undefined) ?? [];
        const body = {
          entry: {
            ...entry,
            runtime: 'onnx',
            release_notes: notes.trim(),
            maturity,
            supports_healthy: classes.some((c) => c.kind === 'healthy'),
            limitations: nul(limitations) ?? undefined,
            min_app_version: nul(minApp) ?? undefined,
          },
          sha256: await sha256Hex(file),
          size_bytes: file.size,
        };
        const created = await api<{ model: ModelVersion; upload_url: string }>('POST', '/v1/admin/models', { body });
        try {
          await uploadAndComplete(created.model.id, created.upload_url, file, setProgress);
        } catch (e) {
          // The draft exists; it can be uploaded again from its row.
          onCreated();
          throw new Error(
            `The draft was created but the upload failed (${e instanceof Error ? e.message : e}). ` +
              'Close this window and open the draft to upload the file again.',
          );
        }
        onDone();
      }}
    >
      <Field label="Model entry (JSON, without the file) *">
        <textarea rows={10} placeholder={SAMPLE} value={json} onChange={(e) => setJson(e.target.value)} />
      </Field>
      <Field label="Model file (.onnx) *">
        <input type="file" accept=".onnx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </Field>
      <Field label="Release notes (Vietnamese, shown to farmers) *">
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} required />
      </Field>
      <div className="grid2">
        <Field label="Maturity">
          <select value={maturity} onChange={(e) => setMaturity(e.target.value as 'stable' | 'beta')}>
            <option value="beta">beta (shows “still being improved”)</option>
            <option value="stable">stable</option>
          </select>
        </Field>
        <Field label="Minimum app version">
          <input placeholder="e.g. 1.0.0" value={minApp} onChange={(e) => setMinApp(e.target.value)} />
        </Field>
      </div>
      <Field label="Limitations (Vietnamese, shown under the result)">
        <textarea rows={2} value={limitations} onChange={(e) => setLimitations(e.target.value)} />
      </Field>
      <Progress done={progress} total={file?.size ?? 0} />
      <p className="muted small">
        “Supports healthy” is taken from the classes: it is on only when one of them has kind “healthy”.
      </p>
    </Form>
  );
}

function EditForm({ m, onDone }: { m: ModelVersion; onDone: () => void }) {
  const e = m.entry;
  const [notes, setNotes] = useState(e.release_notes);
  const [maturity, setMaturity] = useState(e.maturity);
  const [limitations, setLimitations] = useState(e.limitations ?? '');
  const [minApp, setMinApp] = useState(e.min_app_version ?? '');
  return (
    <Form
      onSubmit={async () => {
        await api('PATCH', `/v1/admin/models/${m.id}`, {
          body: {
            release_notes: notes.trim(),
            maturity,
            limitations: nul(limitations),
            clear_limitations: nul(limitations) === null,
            min_app_version: nul(minApp),
            clear_min_app_version: nul(minApp) === null,
          },
        });
        onDone();
      }}
    >
      <Field label="Release notes (Vietnamese) *">
        <textarea rows={2} value={notes} onChange={(x) => setNotes(x.target.value)} required />
      </Field>
      <div className="grid2">
        <Field label="Maturity">
          <select value={maturity} onChange={(x) => setMaturity(x.target.value as 'stable' | 'beta')}>
            <option value="beta">beta</option>
            <option value="stable">stable</option>
          </select>
        </Field>
        <Field label="Minimum app version">
          <input value={minApp} onChange={(x) => setMinApp(x.target.value)} />
        </Field>
      </div>
      <Field label="Limitations (Vietnamese)">
        <textarea rows={2} value={limitations} onChange={(x) => setLimitations(x.target.value)} />
      </Field>
      <p className="muted small">
        Phones that already hold this file refresh these texts without downloading anything.
      </p>
    </Form>
  );
}

function Detail({ m, onDone }: { m: ModelVersion; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const e: ModelEntry = m.entry;

  const retry = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ upload_url: string | null }>('POST', `/v1/admin/models/${m.id}/upload-url`);
      if (r.upload_url) await uploadAndComplete(m.id, r.upload_url, file, setProgress);
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const ready = m.artifact.status === 'ready';
  return (
    <>
      <TransitionButtons
        status={m.status}
        actions={m.status === 'published' ? ['unpublish'] : ready ? ['publish'] : []}
        onAct={async (a) => {
          await api('POST', `/v1/admin/models/${m.id}/transition`, { body: { action: a } });
          onDone();
        }}
      />
      {!ready && (
        <div className="error">
          The file has not been verified yet. Choose the same file again to upload it.
          <div className="row">
            <input type="file" accept=".onnx" onChange={(x) => setFile(x.target.files?.[0] ?? null)} />
            <button className="primary" disabled={!file || busy} onClick={retry}>
              {busy ? 'Uploading…' : 'Upload'}
            </button>
          </div>
          <Progress done={progress} total={busy ? (file?.size ?? 0) : 0} />
          <ErrorBox error={error} />
        </div>
      )}
      <p className="small">
        <strong>Labels the farmer will see:</strong>{' '}
        {e.classes
          .filter((c) => c.kind !== 'other')
          .map((c) => (c.kind === 'healthy' ? 'Khỏe' : (c.labels.vi ?? c.labels.en ?? c.disease_code)))
          .join(' · ')}
      </p>
      <p className="muted small">
        {e.model_id} · {e.version} · {mb(m.artifact.size_bytes)} · sha256 {m.artifact.sha256.slice(0, 12)}…
      </p>
      <EditForm m={m} onDone={onDone} />
      {m.status === 'draft' && m.published_at === null && (
        <div className="row">
          <button
            onClick={async () => {
              if (!confirm('Delete this draft and its file?')) return;
              await api('DELETE', `/v1/admin/models/${m.id}`);
              onDone();
            }}
          >
            Delete draft
          </button>
        </div>
      )}
    </>
  );
}

export function Models() {
  const [part, setPart] = useState('');
  const { items, loading, error, hasMore, more, reload } = usePaged<ModelVersion>('/v1/admin/models', {
    plant_part: part || undefined,
  });
  const [open, setOpen] = useState<ModelVersion | 'new' | null>(null);

  return (
    <>
      <div className="page-head">
        <h1>Scan models</h1>
        <div className="row">
          <input placeholder="Body part (leaf, stem…)" value={part} onChange={(e) => setPart(e.target.value.trim())} />
          <button className="primary" onClick={() => setOpen('new')}>
            + Upload model
          </button>
        </div>
      </div>
      <p className="muted small">
        One version per body part is live. Publishing a version replaces the live one of the same part; a new body
        part, new labels or a healthy class appear in the app after publishing, with no app release.
      </p>
      <ErrorBox error={error} />
      {items.length === 0 && !loading && <Empty title="No model uploaded yet" />}
      {items.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Part</th>
              <th>Model</th>
              <th>Maturity</th>
              <th>Healthy</th>
              <th>Size</th>
              <th>File</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id}>
                <td>{m.entry.part_labels.vi}</td>
                <td className="small">
                  {m.entry.model_id}
                  <br />
                  <span className="muted">{m.entry.version.slice(0, 12)}</span>
                </td>
                <td>{m.entry.maturity}</td>
                <td>{m.entry.supports_healthy ? 'yes' : 'no'}</td>
                <td>{mb(m.artifact.size_bytes)}</td>
                <td>
                  <Badge value={m.artifact.status} />
                </td>
                <td>
                  <Badge value={m.status} />
                </td>
                <td>
                  <button onClick={() => setOpen(m)}>Open</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <LoadMore hasMore={hasMore} loading={loading} onMore={more} />
      {open && (
        <Modal
          title={open === 'new' ? 'Upload scan model' : `${open.entry.part_labels.vi} · ${open.entry.version.slice(0, 8)}`}
          onClose={() => setOpen(null)}
        >
          {open === 'new' ? (
            <UploadForm
              onCreated={reload}
              onDone={() => {
                setOpen(null);
                reload();
              }}
            />
          ) : (
            <Detail
              m={open}
              onDone={() => {
                setOpen(null);
                reload();
              }}
            />
          )}
        </Modal>
      )}
    </>
  );
}
