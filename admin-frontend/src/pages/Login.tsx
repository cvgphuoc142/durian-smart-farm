import { useState } from 'react';
import { api, setToken } from '../api';
import { Field, Form } from '../ui';
import { Icons } from '../icons';

export function Login({ onDone }: { onDone: (who: string) => void }) {
  const [username, setUsername] = useState(import.meta.env.DEV ? 'admin' : '');
  const [password, setPassword] = useState(import.meta.env.DEV ? '123456' : '');

  return (
    <div className="center-screen login-wrap">
      <div className="card login">
        <div className="login-brand">
          <span className="brand-logo">{Icons.leaf}</span>
          <div>
            <h2>Durian Admin</h2>
            <p className="muted small">Sign in to manage content</p>
          </div>
        </div>
        <Form
          submitLabel="Sign in"
          onSubmit={async () => {
            const s = await api<{ token: string }>('POST', '/v1/auth/admin-login', {
              body: { username: username.trim(), password },
            });
            setToken(s.token);
            try {
              const me = await api<{ user: { id: string; display_name?: string } }>('GET', '/v1/admin/me');
              onDone(me.user.display_name ?? me.user.id);
            } catch (e) {
              setToken(null);
              throw e;
            }
          }}
        >
          <Field label="Username">
            <input autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </Field>
          <Field label="Password">
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {import.meta.env.DEV && (
            <p className="muted small">Dev seed account: admin / 123456 (run <code>make seed</code> in durianBackend).</p>
          )}
        </Form>
      </div>
    </div>
  );
}
