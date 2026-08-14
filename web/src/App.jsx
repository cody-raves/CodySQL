import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, nui, IN_GAME } from './lib/nui';
import { toast } from './lib/ui';
import Sidebar from './components/Sidebar';
import DataView from './components/DataView';
import StructureView from './components/StructureView';
import QueryView from './components/QueryView';
import FilesView from './components/FilesView';
import BackupsView from './components/BackupsView';
import AuditView from './components/AuditView';
import SettingsView from './components/SettingsView';
import Toasts from './components/Toasts';
import ConfirmHost from './components/modals/ConfirmModal';

const TABS = [
  { id: 'data', label: 'Data', perm: 'codysql.read' },
  { id: 'structure', label: 'Structure', perm: 'codysql.read' },
  { id: 'query', label: 'Query', perm: 'codysql.rawsql' },
  { id: 'files', label: 'SQL Files', perm: 'codysql.sqlfiles' },
  { id: 'backups', label: 'Backups', perm: 'codysql.backup' },
  { id: 'audit', label: 'Audit Log', perm: 'codysql.audit' },
  { id: 'settings', label: 'Settings', perm: 'codysql.open' },
];

export default function App() {
  const [visible, setVisible] = useState(!IN_GAME);
  const [theme, setThemeState] = useState('midnight');
  const [session, setSession] = useState(null); // init payload
  const [tables, setTables] = useState([]);
  const [tab, setTab] = useState('data');
  const [table, setTable] = useState(null);     // getTable result

  const setTheme = useCallback((t, persist = true) => {
    setThemeState(t);
    if (t === 'midnight') document.body.removeAttribute('data-theme');
    else document.body.setAttribute('data-theme', t);
    if (persist) nui('setTheme', { theme: t });
  }, []);

  const boot = useCallback(async () => {
    const res = await api('init');
    if (!res.ok) { toast(res.error || 'Failed to initialize', 'err'); return; }
    setSession(res);
    setTables(res.tables || []);
  }, []);

  useEffect(() => {
    const onMsg = e => {
      const msg = e.data || {};
      if (msg.type === 'open') {
        if (msg.theme) setTheme(msg.theme, false);
        setVisible(true);
        boot();
      } else if (msg.type === 'close') {
        setVisible(false);
      }
    };
    window.addEventListener('message', onMsg);
    if (!IN_GAME) boot();
    return () => window.removeEventListener('message', onMsg);
  }, [boot, setTheme]);

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') nui('close');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const refreshTables = useCallback(async () => {
    const res = await api('refreshSchema');
    if (res.ok) setTables(res.tables);
  }, []);

  const openTable = useCallback(async name => {
    const res = await api('getTable', { table: name });
    if (!res.ok) { toast(res.error || 'Failed to open table', 'err'); return; }
    setTable(res);
    setTab('data');
  }, []);

  const perms = session?.permissions || {};
  const isOwner = perms['codysql.drop'] && perms['codysql.backup'];

  if (!visible) return null;

  return (
    <div className="window">
      <div className="titlebar">
        <div className="logo"><img className="mark" src="logo.png" alt="" /> CodySQL</div>
        <div className="db-chip"><span className="dot" /> {session?.db || '…'}</div>
        <div className="spacer" />
        <div className="user-chip">
          {session?.user}
          {isOwner && <span className="badge">OWNER</span>}
        </div>
        <button className="close-btn" title="Close (ESC)" onClick={() => nui('close')}>✕</button>
      </div>

      <div className="body">
        <Sidebar tables={tables} active={table?.name} onOpen={openTable} />

        <div className="main">
          <div className="tabs">
            {TABS.map(t => {
              const locked = !perms[t.perm];
              return (
                <div
                  key={t.id}
                  className={'tab' + (tab === t.id ? ' active' : '') + (locked ? ' locked' : '')}
                  title={locked ? 'Missing ' + t.perm : undefined}
                  onClick={() => !locked && setTab(t.id)}
                >
                  {t.label}{locked ? ' 🔒' : ''}
                </div>
              );
            })}
          </div>

          {tab === 'data' && (
            <DataView table={table} perms={perms} pageSizeDefault={session?.config?.pageSize || 100} />
          )}
          {tab === 'structure' && (
            <StructureView
              table={table} perms={perms}
              onSchemaChange={async newName => {
                setTable(null);
                await refreshTables();
                if (newName) openTable(newName);
              }}
            />
          )}
          {tab === 'query' && <QueryView onSchemaChange={refreshTables} />}
          {tab === 'files' && <FilesView onSchemaChange={refreshTables} />}
          {tab === 'backups' && <BackupsView />}
          {tab === 'audit' && <AuditView />}
          {tab === 'settings' && <SettingsView perms={perms} theme={theme} setTheme={setTheme} />}
        </div>
      </div>

      <Toasts />
      <ConfirmHost />
    </div>
  );
}
