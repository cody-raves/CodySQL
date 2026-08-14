import React, { useEffect, useRef, useState } from 'react';
import { api } from '../lib/nui';
import { toast, fmtCount } from '../lib/ui';
import Pager from './Pager';

const ACTION_PILLS = {
  CELL_EDIT: ['EDITED CELL', 'edit'], ROW_INSERT: ['ROW INSERT', 'edit'],
  ROW_DELETE: ['ROW DELETE', 'drop'], TABLE_DROP: ['DROPPED TABLE', 'drop'],
  TABLE_EMPTY: ['EMPTIED TABLE', 'drop'], TABLE_RENAME: ['RENAMED TABLE', 'edit'],
  SQL_RAW: ['RAW SQL', 'sqlf'], SQL_FILE: ['SQL FILE', 'sqlf'], SQL_BLOCKED: ['BLOCKED', 'denied'],
  BACKUP_CREATE: ['BACKUP', 'backup'], DENIED: ['DENIED', 'denied'],
};

function Detail({ r }) {
  if (r.action === 'CELL_EDIT') {
    return (
      <>
        {r.tbl} · {r.row_ref} · {r.col}:{' '}
        <span className="old">{String(r.old_value ?? 'NULL').slice(0, 60)}</span> →{' '}
        <span className="new">{String(r.new_value ?? 'NULL').slice(0, 60)}</span>
      </>
    );
  }
  if (r.action === 'SQL_FILE') return <>{r.file} · {r.affected ?? '?'} statements · {r.duration_ms ?? '?'} ms</>;
  if (r.action === 'SQL_RAW' || r.action === 'SQL_BLOCKED') return <>{(r.sql_text || '').replace(/\s+/g, ' ').slice(0, 110)}</>;
  if (r.action === 'BACKUP_CREATE') return <>{r.file} · {fmtCount(r.affected)} rows</>;
  if (r.action === 'DENIED') return <>{r.error}</>;
  return <>{[r.tbl, r.row_ref, r.new_value].filter(Boolean).join(' · ')}</>;
}

export default function AuditView() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [admins, setAdmins] = useState([]);
  const [filters, setFilters] = useState({ search: '', admin: '', action: '', days: '7' });
  const timer = useRef(null);

  const load = async (p = page, f = filters) => {
    const res = await api('getAudit', {
      page: p, search: f.search, admin: f.admin, action: f.action, days: f.days || null,
    });
    if (!res.ok) { toast(res.error || 'Failed to load audit log', 'err'); return; }
    setRows(res.rows);
    setTotal(res.total);
    setPageSize(res.pageSize);
    setAdmins((res.admins || []).map(a => a.admin).filter(Boolean));
  };

  useEffect(() => { load(1); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  const setFilter = (key, value, debounce) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    setPage(1);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => load(1, next), debounce ? 300 : 0);
  };

  return (
    <div className="view">
      <div className="toolbar">
        <input
          type="text" placeholder="Search audit log…"
          value={filters.search} onChange={e => setFilter('search', e.target.value, true)}
        />
        <select value={filters.admin} onChange={e => setFilter('admin', e.target.value)}>
          <option value="">All admins</option>
          {admins.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filters.action} onChange={e => setFilter('action', e.target.value)}>
          <option value="">All actions</option>
          {Object.entries(ACTION_PILLS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <select value={filters.days} onChange={e => setFilter('days', e.target.value)}>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="">All time</option>
        </select>
        <span className="push note">{fmtCount(total)} entries</span>
      </div>

      <div className="audit-wrap">
        {rows.length === 0 && <div className="empty">No audit entries match these filters</div>}
        {rows.map((r, i) => {
          const [label, pill] = ACTION_PILLS[r.action] || [r.action, 'idx'];
          const ok = r.success === 1 || r.success === true;
          return (
            <div className="audit-entry" key={r.id ?? i}>
              <span className="a-time">{String(r.ts || '').replace('T', ' ').slice(0, 19)}</span>
              <span className="a-admin">{r.admin || '?'}</span>
              <span className="a-action"><span className={'pill ' + pill}>{label}</span></span>
              <span className="a-detail"><Detail r={r} /></span>
              <span className={'a-status ' + (ok ? 'ok' : 'fail')}>{ok ? '✓ OK' : '✗'}</span>
            </div>
          );
        })}
      </div>

      <div className="grid-foot">
        <Pager
          page={page} pages={Math.max(1, Math.ceil(total / pageSize))}
          onPage={p => { setPage(p); load(p); }}
        />
      </div>
    </div>
  );
}
