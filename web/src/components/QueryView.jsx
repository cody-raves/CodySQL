import React, { useRef, useState } from 'react';
import { api, isNull, isBin } from '../lib/nui';
import { toast, cellText, fmtCount } from '../lib/ui';
import Sql from '../lib/sqlHighlight';

const HISTORY_KEY = 'codysql:history';

export default function QueryView({ onSchemaChange }) {
  const [sql, setSql] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null); // { summary: [], select, totalMs, error }
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  });
  const hlRef = useRef(null);

  const pushHistory = q => {
    const next = [q, ...history.filter(h => h !== q)].slice(0, 25);
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  };

  const run = async () => {
    const q = sql.trim();
    if (!q || running) return;
    setRunning(true);
    const res = await api('rawQuery', { sql: q });
    setRunning(false);

    if (!res.ok) { setResult({ error: res.error || 'Query failed' }); return; }
    pushHistory(q);

    let select = null;
    const summary = res.results.map(r => {
      if (!r.ok) return { ok: false, text: `#${r.index}: ${r.error}` };
      if (r.columns) {
        select = r;
        return { ok: true, text: `#${r.index}: ${fmtCount(r.rowCount)} rows${r.truncated ? ' (truncated)' : ''} · ${r.durationMs} ms` };
      }
      return { ok: true, text: `#${r.index}: ${fmtCount(r.affected || 0)} affected · ${r.durationMs} ms` };
    });
    setResult({ summary, select, totalMs: res.durationMs });

    if (/\b(create|drop|alter|rename)\b/i.test(q)) onSchemaChange();
  };

  return (
    <div className="view">
      <div className="toolbar">
        <button className="btn primary" onClick={run} disabled={running}>
          {running ? <><span className="spinner" /> Running…</> : '▶ Run'}
        </button>
        <button className="btn ghost" onClick={() => setSql('')}>Clear</button>
        <span className="push note">Ctrl+Enter to run · statements are split and run in order</span>
      </div>

      <div className="editor-stack">
        <pre className="editor-hl" aria-hidden ref={hlRef}><Sql code={sql} />{'\n'}</pre>
        <textarea
          className="editor-input" spellCheck={false}
          placeholder={"SELECT * FROM `players` WHERE `citizenid` = 'ABC12345';"}
          value={sql}
          onChange={e => setSql(e.target.value)}
          onScroll={e => {
            if (hlRef.current) {
              hlRef.current.scrollTop = e.target.scrollTop;
              hlRef.current.scrollLeft = e.target.scrollLeft;
            }
          }}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); } }}
        />
      </div>

      {result && (
        <div className="q-results-head">
          {result.error
            ? <span className="err">✗ {result.error}</span>
            : <>
                {result.summary.map((s, i) => (
                  <span key={i} className={s.ok ? 'ok' : 'err'}>{s.ok ? '✓' : '✗'} <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>{s.text}</span></span>
                ))}
                <span style={{ marginLeft: 'auto' }}>{result.totalMs} ms total</span>
              </>}
        </div>
      )}

      <div className="grid-wrap">
        {result?.select ? (
          <table className="grid">
            <thead>
              <tr>{result.select.columns.map(c => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {result.select.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((v, ci) => (
                    <td key={ci} className={isNull(v) ? 'null' : isBin(v) ? 'bin' : ''}>{cellText(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty"><div className="big">⌘</div><div>Results appear here</div></div>
        )}
      </div>

      {history.length > 0 && (
        <div className="history-strip">
          <span className="hs-label">History</span>
          {history.map((h, i) => (
            <div key={i} className="hist-chip" title={h} onClick={() => setSql(h)}>
              {h.replace(/\s+/g, ' ').slice(0, 80)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
