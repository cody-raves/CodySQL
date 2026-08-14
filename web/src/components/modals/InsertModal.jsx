import React, { useState } from 'react';
import { api, isNull, isBin, isLong } from '../../lib/nui';
import { toast } from '../../lib/ui';

export default function InsertModal({ table, prefill, onClose }) {
  const [values, setValues] = useState(() => {
    const init = {};
    table.columns.forEach((col, ci) => {
      const auto = /auto_increment/.test(col.extra || '');
      if (auto) return;
      const p = prefill?.[ci];
      if (p !== undefined && !isNull(p) && !isBin(p) && !isLong(p)) init[col.name] = String(p);
    });
    return init;
  });

  const save = async () => {
    const payload = Object.entries(values)
      .filter(([, v]) => v !== '')
      .map(([column, value]) => ({ column, value }));
    const res = await api('insertRow', { table: table.name, values: payload });
    if (!res.ok) { toast(res.error || 'Insert failed', 'err'); return; }
    toast(res.insertId ? `Row inserted (id ${res.insertId})` : 'Row inserted', 'ok');
    onClose(true);
  };

  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose(false)}>
      <div className="modal">
        <div className="modal-head">＋ Insert row — <span className="sub">{table.name}</span></div>
        <div className="modal-body">
          {table.columns.map(col => {
            const auto = /auto_increment/.test(col.extra || '');
            return (
              <div className="field" key={col.name}>
                <label>
                  {col.name}{' '}
                  <span className="colmeta">
                    {col.type}
                    {col.key === 'PRI' ? ' · PRIMARY' : ''}
                    {auto ? ' · AUTO' : ''}
                    {!col.null && !auto ? ' · NOT NULL' : ''}
                    {col.default != null ? ` · default ${col.default}` : ''}
                  </span>
                </label>
                <input
                  type="text" disabled={auto}
                  placeholder={auto ? '(auto)' : col.default != null ? `default: ${col.default}` : col.null ? 'NULL' : ''}
                  value={values[col.name] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [col.name]: e.target.value }))}
                />
              </div>
            );
          })}
          <div className="tip-box">Empty fields are left out of the INSERT — the column default (or NULL) applies.</div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={() => onClose(false)}>Cancel</button>
          <button className="btn primary" onClick={save}>Insert Row</button>
        </div>
      </div>
    </div>
  );
}
