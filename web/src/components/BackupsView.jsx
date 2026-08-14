import React, { useEffect, useState } from 'react';
import { api } from '../lib/nui';
import { toast, confirmAction, fmtBytes, fmtCount } from '../lib/ui';

export default function BackupsView() {
  const [backups, setBackups] = useState([]);
  const [running, setRunning] = useState(false);

  const load = async () => {
    const res = await api('getBackups');
    if (!res.ok) { toast(res.error || 'Failed to list backups', 'err'); return; }
    setBackups(res.backups);
    setRunning(res.running);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    const confirmed = await confirmAction({
      title: '⬇ Create backup',
      warnHtml: 'Dump the entire database to a single .sql file in <b>codysql/backups/manual/</b>? Large databases may take a minute.',
      danger: false,
      confirmLabel: 'Create Backup',
    });
    if (confirmed === null) return;
    setRunning(true);
    const res = await api('createBackup');
    setRunning(false);
    if (!res.ok) { toast(res.error || 'Backup failed', 'err'); return; }
    toast(`Backup created: ${res.file} (${(res.durationMs / 1000).toFixed(1)}s)`, 'ok');
    load();
  };

  return (
    <div className="view">
      <div className="toolbar">
        <button className="btn primary" onClick={create} disabled={running}>
          {running ? <><span className="spinner" /> Backing up…</> : '⬇ Create Backup Now'}
        </button>
      </div>
      <div className="bk-note">
        Backups are written to <span style={{ fontFamily: 'var(--mono)' }}>codysql/backups/manual/</span> on
        the server. Scheduled backups and in-game restore are on the roadmap — see the docs.
      </div>
      <div className="pad-wrap">
        <div className="panel">
          <div className="panel-head">Manual backups ({backups.length})</div>
          {backups.length === 0 ? (
            <div className="panel-body">No backups yet. Hit “Create Backup Now” to make your first one.</div>
          ) : (
            <table className="mini">
              <thead>
                <tr><th>File</th><th>Created</th><th>By</th><th>Tables</th><th>Rows</th><th>Size</th></tr>
              </thead>
              <tbody>
                {backups.map(b => (
                  <tr key={b.file}>
                    <td>{b.file}</td>
                    <td>{b.createdAt}</td>
                    <td>{b.createdBy}</td>
                    <td>{b.tables}</td>
                    <td>{fmtCount(b.rows)}</td>
                    <td>{fmtBytes(b.size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
