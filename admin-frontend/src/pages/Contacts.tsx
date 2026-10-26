import { useState } from 'react';
import { api, NEXT_ACTIONS, STATUSES, type Action, type Contact } from '../api';
import { Badge, ErrorBox, Field, Form, LoadMore, Modal, nul, TransitionButtons, usePaged } from '../ui';

const empty = {
  kind: 'store' as Contact['kind'],
  name: '',
  province: '',
  locality: '',
  address: '',
  phone: '',
  zalo: '',
  contact_url: '',
  source_link: '',
  specialty: '',
  description: '',
};

function ContactForm({ contact, onDone }: { contact?: Contact; onDone: () => void }) {
  const [f, setF] = useState<typeof empty>(() => {
    if (!contact) return empty;
    const next: Record<string, unknown> = { ...empty };
    for (const k of Object.keys(empty)) next[k] = (contact as unknown as Record<string, unknown>)[k] ?? '';
    return next as typeof empty;
  });
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const text = (k: keyof typeof empty, label: string) => (
    <Field label={label}>
      <input value={f[k]} onChange={set(k)} />
    </Field>
  );
  return (
    <Form
      onSubmit={async () => {
        const body = {
          kind: f.kind,
          name: f.name.trim(),
          province: nul(f.province),
          locality: nul(f.locality),
          address: nul(f.address),
          phone: nul(f.phone),
          zalo: nul(f.zalo),
          contact_url: nul(f.contact_url),
          source_link: nul(f.source_link),
          specialty: nul(f.specialty),
          description: nul(f.description),
        };
        if (contact) await api('PATCH', `/v1/admin/contacts/${contact.id}`, { body });
        else await api('POST', '/v1/admin/contacts', { body });
        onDone();
      }}
    >
      <Field label="Kind">
        <select value={f.kind} onChange={set('kind')}>
          <option value="store">store</option>
          <option value="expert">expert</option>
        </select>
      </Field>
      {text('name', 'Name *')}
      <div className="grid2">
        {text('province', 'Province')}
        {text('locality', 'Locality')}
      </div>
      {text('address', 'Address')}
      <div className="grid2">
        {text('phone', 'Phone')}
        {text('zalo', 'Zalo')}
      </div>
      {text('contact_url', 'Contact URL')}
      {text('source_link', 'Source link')}
      {text('specialty', 'Specialty')}
      <Field label="Description">
        <textarea rows={3} value={f.description} onChange={set('description')} />
      </Field>
      <p className="muted small">At least one of phone / zalo / contact URL is required.</p>
    </Form>
  );
}

export function Contacts() {
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const { items, loading, error, hasMore, more, reload } = usePaged<Contact>('/v1/admin/contacts', {
    status: status || undefined,
    kind: kind || undefined,
  });
  const [editing, setEditing] = useState<Contact | 'new' | null>(null);

  const act = (c: Contact) => async (a: Action) => {
    await api('POST', `/v1/admin/contacts/${c.id}/transition`, { body: { action: a } });
    reload();
  };

  return (
    <>
      <div className="page-head">
        <h1>Contacts</h1>
        <div className="row">
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All kinds</option>
            <option>store</option>
            <option>expert</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button className="primary" onClick={() => setEditing('new')}>
            + New contact
          </button>
        </div>
      </div>
      <ErrorBox error={error} />
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Kind</th>
            <th>Province</th>
            <th>Channel</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.kind}</td>
              <td>{c.province ?? '—'}</td>
              <td className="small">{[c.phone, c.zalo && `zalo ${c.zalo}`, c.contact_url].filter(Boolean).join(' · ')}</td>
              <td>
                <Badge value={c.status} />
              </td>
              <td>
                <button onClick={() => setEditing(c)}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <LoadMore hasMore={hasMore} loading={loading} onMore={more} />
      {editing && (
        <Modal title={editing === 'new' ? 'New contact' : editing.name} onClose={() => setEditing(null)}>
          {editing !== 'new' && (
            <TransitionButtons
              status={editing.status}
              actions={NEXT_ACTIONS[editing.status]}
              onAct={async (a) => {
                await act(editing)(a);
                setEditing(null);
              }}
            />
          )}
          <ContactForm
            contact={editing === 'new' ? undefined : editing}
            onDone={() => {
              setEditing(null);
              reload();
            }}
          />
        </Modal>
      )}
    </>
  );
}
