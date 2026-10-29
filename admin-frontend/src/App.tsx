import { useEffect, useState } from 'react';
import { api, getToken, setToken, setUnauthenticatedHandler } from './api';
import { Login } from './pages/Login';
import { Articles } from './pages/Articles';
import { Standards } from './pages/Standards';
import { Contacts } from './pages/Contacts';
import { ChatReports } from './pages/ChatReports';
import { Models } from './pages/Models';
import { Icons } from './icons';

const TABS = {
  articles: ['Articles', Articles],
  standards: ['Standards', Standards],
  contacts: ['Contacts', Contacts],
  models: ['Scan models', Models],
  reports: ['Chat reports', ChatReports],
} as const;
type Tab = keyof typeof TABS;

export function App() {
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(!!getToken());
  const [tab, setTab] = useState<Tab>('articles');

  const signOut = () => {
    setToken(null);
    setEmail(null);
  };

  useEffect(() => {
    setUnauthenticatedHandler(signOut);
    if (!getToken()) return;
    api<{ user: { id: string; display_name?: string } }>('GET', '/v1/admin/me')
      .then((r) => setEmail(r.user.display_name ?? r.user.id))
      .catch(signOut)
      .finally(() => setChecking(false));
  }, []);

  if (checking) return <div className="center-screen muted">Loading…</div>;
  if (!email) return <Login onDone={setEmail} />;

  const Page = TABS[tab][1];
  return (
    <div className="layout">
      <aside>
        <div className="brand">
          <span className="brand-logo">{Icons.leaf}</span>
          <div>
            Durian Admin
            <small>Content console</small>
          </div>
        </div>
        <div className="nav-label">Manage</div>
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <button key={t} className={`nav ${t === tab ? 'active' : ''}`} onClick={() => setTab(t)}>
            {Icons[t]}
            {TABS[t][0]}
          </button>
        ))}
        <div className="spacer" />
        <div className="user">
          <span className="avatar">{email.charAt(0)}</span>
          <span className="user-name" title={email}>
            {email}
          </span>
          <button
            className="ghost"
            title="Sign out"
            aria-label="Sign out"
            onClick={async () => {
              await api('POST', '/v1/auth/logout').catch(() => {});
              signOut();
            }}
          >
            {Icons.logout}
          </button>
        </div>
      </aside>
      <main>
        <Page key={tab} />
      </main>
    </div>
  );
}
