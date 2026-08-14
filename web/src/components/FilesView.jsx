import React, { useEffect, useState } from 'react';
import { api } from '../lib/nui';
import { toast, confirmAction, fmtBytes } from '../lib/ui';
import Sql from '../lib/sqlHighlight';

export default function FilesView({ onSchemaChange }) {
  const [files, setFiles] = useState([]);
  const [active, setActive] = useState(null);   // { name, content, statements }
  const [transaction, setTransaction] = useState(false);
  const [running, setRunning] = useState(false);
  const [execResult, setExecResult] = useState(null);

  const load = async () => {
    const res = await api('getSqlFiles');
    if (!res.ok) { toast(res.error || 'Failed to list files', 'err'); return; }
    setFiles(res.files);
  };

  useEffect(() => { load(); }, []);

  const open = async name => {
    const res = await api('getSqlFile', { name });
    if (!res.ok) { toast(res.error || 'Failed to read file', 'err'); return; }
    setActive(res);
    setExecResult(null);
  };

  const run = async () => {
    if (!active || running) return;
    const confirmed = await confirmAction({
      title: '▶ Execute SQL file',
      warnHtml:
        `Run <b>${active.name}</b> (${active.statements.length} statements) against the live database?` +
        (transaction ? '<br>Transaction mode: all statements succeed or all roll back.' : ''),
      confirmLabel: 'Execute',
    });
    if (confirmed === null) return;

    setRunning(true);
    const res = await api('runSqlFile', { name: active.name, transaction });
    setRunning(false);
    setExecResult(res);
    if (!res.ok) { toast(res.error || 'Execution failed', 'err'); return; }
    load();
    onSchemaChange();
  };

  return (
    <div className="view">
      <div className="toolbar">
        <span className="note">
          Folder: <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>codysql/sql/</span>
        </span>
        <button className="btn" onClick={load}>⟳ Rescan</button>
        <span className="push note">{files.length} file{files.length === 1 ? '' : 's'}</span>
      </div>

      <div className="files-split">
        <div className="files-list">
          {files.length === 0 && (
            <div className="empty">Drop .sql files into codysql/sql/ and hit Rescan</div>
          )}
          {files.map(f => {
            const okRun = f.lastRun && (f.lastRun.success === 1 || f.lastRun.success === true);
            return (
              <div
                key={f.name}
                className={'file-card' + (active?.name === f.name ? ' active' : '')}
                onClick={() => open(f.name)}
              >
                <div className="fname">📄 {f.name}</div>
                <div className="fmeta">
                  <span>{fmtBytes(f.size)}</span>
                  <span>{f.statementCount} statement{f.statementCount === 1 ? '' : 's'}</span>
                </div>
                <div className={'fstatus ' + (f.lastRun ? (okRun ? 'ok' : 'fail') : 'never')}>
                  {f.lastRun ? `${okRun ? '✓' : '✗'} Last run: ${f.lastRun.ts || ''}` : 'Never executed'}
                </div>
              </div>
            );
          })}
        </div>

        <div className="file-preview">
          {!active ? (
            <div className="empty"><div className="big">📄</div><div>Select a .sql file to preview it</div></div>
          ) : (
            <>
              <div className="toolbar">
                <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{active.name}</span>
                <div className="push" />
                <label className="check">
                  <input
                    type="checkbox" checked={transaction}
                    onChange={e => setTransaction(e.target.checked)}
                  /> run as transaction
                </label>
                <button className="btn primary" onClick={run} disabled={running}>
                  {running ? <><span className="spinner" /> Running…</> : '▶ Execute'}
                </button>
              </div>
              <div className="code"><Sql code={active.content} /></div>
              {execResult && execResult.ok && (
                <div className="exec-result">
                  {execResult.transaction ? (
                    execResult.success
                      ? <div className="ok">✓ Transaction committed — {execResult.statementCount} statements in {execResult.durationMs} ms</div>
                      : <div className="fail">✗ Transaction rolled back — check statement syntax</div>
                  ) : (
                    <>
                      {execResult.results.map(r => (
                        <div key={r.index}>
                          <span className={r.ok ? 'ok' : 'fail'}>{r.ok ? '✓' : '✗'}</span>{' '}
                          {r.index}. {r.preview}
                          <span style={{ color: 'var(--text-faint)' }}>
                            {' '}— {r.durationMs} ms{r.affected != null ? ` · ${r.affected} rows` : ''}
                          </span>
                          {!r.ok && <div className="fail" style={{ marginLeft: 20 }}>{r.error}</div>}
                        </div>
                      ))}
                      <div className="sum">
                        {execResult.success ? 'Completed' : 'Stopped at first failure'} ·{' '}
                        {execResult.results.length}/{execResult.statementCount} run ·{' '}
                        {execResult.durationMs} ms total · logged to audit
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
