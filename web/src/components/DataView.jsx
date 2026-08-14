import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, isNull, isBin, isLong } from '../lib/nui';
import { toast, confirmAction, cellText, fmtCount } from '../lib/ui';
import Pager from './Pager';
import CellEditor from './modals/CellEditor';
import JsonEditor from './modals/JsonEditor';
import InsertModal from './modals/InsertModal';

export default function DataView({ table, perms, pageSizeDefault }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeDefault);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ column: null, dir: 'asc' });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  const [cellEdit, setCellEdit] = useState(null);   // { ri, ci }
  const [jsonEdit, setJsonEdit] = useState(null);   // { ri, ci }
  const [insertOpen, setInsertOpen] = useState(null); // null | { prefill }

  const searchTimer = useRef(null);

  const pkIdx = useMemo(
    () => table?.pk ? table.columns.findIndex(c => c.name === table.pk) : -1,
    [table]
  );
  const editable = !!table?.editable && perms['codysql.edit'];

  const load = useCallback(async (opts = {}) => {
    if (!table) return;
    setLoading(true);
    const res = await api('getRows', {
      table: table.name,
      page: opts.page ?? page,
      pageSize: opts.pageSize ?? pageSize,
      search: opts.search ?? search,
      sortColumn: (opts.sort ?? sort).column,
      sortDir: (opts.sort ?? sort).dir,
    });
    setLoading(false);
    if (!res.ok) { toast(res.error || 'Failed to load rows', 'err'); return; }
    setRows(res.rows);
    setTotal(res.total);
    setSelected(null);
  }, [table, page, pageSize, search, sort]);

  // Reset + load when the table changes
  useEffect(() => {
    setPage(1); setSearch(''); setSort({ column: null, dir: 'asc' }); setSelected(null);
    if (table) load({ page: 1, search: '', sort: { column: null, dir: 'asc' } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table?.name]);

  if (!table) {
    return (
      <div className="view">
        <div className="empty"><div className="big">▦</div><div>Select a table from the sidebar</div></div>
      </div>
    );
  }

  const onSearch = value => {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); load({ page: 1, search: value }); }, 350);
  };

  const onSort = col => {
    const next = sort.column === col
      ? { column: col, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
      : { column: col, dir: 'asc' };
    setSort(next);
    load({ sort: next });
  };

  const onPage = p => { setPage(p); load({ page: p }); };
  const onPageSize = n => { setPageSize(n); setPage(1); load({ page: 1, pageSize: n }); };

  const numeric = table.columns.map(c => /int|decimal|float|double|year|bit/i.test(c.type));

  const onCellDbl = (ri, ci) => {
    const v = rows[ri][ci];
    if (!editable || isBin(v)) return;
    if (isLong(v)) setJsonEdit({ ri, ci });
    else setCellEdit({ ri, ci });
  };

  const onCellClick = (ri, ci) => {
    if (isLong(rows[ri][ci])) { setJsonEdit({ ri, ci }); return; }
    setSelected(ri);
  };

  const doDelete = async () => {
    if (selected == null) { toast('Select a row first'); return; }
    const pkVal = rows[selected][pkIdx];
    const confirmed = await confirmAction({
      title: '⚠ Delete row',
      warnHtml: `Delete row <b>${table.pk} = ${cellText(pkVal)}</b> from <b>${table.name}</b>? The row is captured in the audit log before deletion.`,
      confirmLabel: 'Delete',
    });
    if (confirmed === null) return;
    const res = await api('deleteRow', { table: table.name, pkValue: pkVal });
    if (!res.ok) { toast(res.error || 'Delete failed', 'err'); return; }
    toast('Row deleted', 'ok');
    load();
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="view">
      <div className="toolbar">
        <input
          type="text" placeholder={`Search ${table.name}…`}
          value={search} onChange={e => onSearch(e.target.value)}
        />
        <button className="btn" onClick={() => load()}>⟳ Refresh</button>
        <div className="sep" />
        <button className="btn primary" disabled={!perms['codysql.insert'] || !table.editable}
          onClick={() => setInsertOpen({})}>＋ Insert Row</button>
        <button className="btn" disabled={!perms['codysql.insert'] || selected == null}
          onClick={() => setInsertOpen({ prefill: rows[selected] })}>⧉ Duplicate</button>
        <button className="btn danger" disabled={!perms['codysql.delete'] || selected == null}
          onClick={doDelete}>🗑 Delete</button>
        <span className="push note">
          {loading ? <span className="spinner" /> : table.editable ? '' : 'read-only: no primary key'}
        </span>
      </div>

      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              {table.columns.map(col => (
                <th key={col.name} onClick={() => onSort(col.name)}>
                  {col.key === 'PRI' && <span className="key">🔑</span>}
                  {col.name}
                  {sort.column === col.name && <span className="sort">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={selected === ri ? 'selected' : ''}>
                {row.map((v, ci) => (
                  <td
                    key={ci}
                    className={[
                      isNull(v) ? 'null' : isBin(v) ? 'bin' : isLong(v) ? 'long' : numeric[ci] ? 'num' : '',
                      editable && !isBin(v) ? 'editable' : '',
                    ].join(' ').trim()}
                    onClick={() => onCellClick(ri, ci)}
                    onDoubleClick={() => onCellDbl(ri, ci)}
                  >
                    {cellText(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !loading && (
          <div className="empty"><div>No rows{search ? ' match this search' : ''}</div></div>
        )}
      </div>

      <div className="grid-foot">
        <span>
          {total === 0 ? 'No rows' : <>Rows <b>{fmtCount(from)}–{fmtCount(to)}</b> of <b>{fmtCount(total)}</b></>}
        </span>
        <Pager
          page={page} pages={Math.max(1, Math.ceil(total / pageSize))}
          onPage={onPage} pageSize={pageSize} onPageSize={onPageSize}
        />
      </div>

      {cellEdit && (
        <CellEditor
          table={table} rows={rows} pkIdx={pkIdx} target={cellEdit}
          onClose={saved => { setCellEdit(null); if (saved) load(); }}
        />
      )}
      {jsonEdit && (
        <JsonEditor
          table={table} rows={rows} pkIdx={pkIdx} target={jsonEdit}
          onClose={saved => { setJsonEdit(null); if (saved) load(); }}
        />
      )}
      {insertOpen && (
        <InsertModal
          table={table} prefill={insertOpen.prefill}
          onClose={saved => { setInsertOpen(null); if (saved) load(); }}
        />
      )}
    </div>
  );
}
