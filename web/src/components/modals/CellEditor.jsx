import React, { useEffect, useRef, useState } from 'react';
import { api, isNull, NULL_SENTINEL } from '../../lib/nui';
import { toast, cellText } from '../../lib/ui';
import Sql from '../../lib/sqlHighlight';

export default function CellEditor({ table, rows, pkIdx, target, onClose }) {
  const col = table.columns[target.ci];
  const pkVal = rows[target.ri][pkIdx];
  const current = rows[target.ri][target.ci];
  const originalNull = isNull(current);
  const originalText = originalNull ? '' : cellText(current);

  const [value, setValue] = useState(originalText);
  const [nulled, setNulled] = useState(originalNull);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const sqlPreview =
    `UPDATE \`${table.name}\`\nSET \`${col.name}\` = ${nulled ? 'NULL' : `'${value.replace(/'/g, "\\'")}'`}\nWHERE \`${table.pk}\` = ${cellText(pkVal)} LIMIT 1;`;

  const save = async () => {
    const res = await api('updateCell', {
      table: table.name,
      column: col.name,
      pkValue: pkVal,
      value: nulled ? NULL_SENTINEL : value,
    });
    if (!res.ok) { toast(res.error || 'Update failed', 'err'); return; }
    toast('Cell updated', 'ok');
    onClose(true);
  };

  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose(false)}>
      <div className="modal">
        <div className="modal-head">✎ Edit cell — <span className="sub">{table.name}.{col.name}</span></div>
        <div className="modal-body">
          <div className="field">
            <label>Row identity</label>
            <div className="meta" style={{ margin: 0 }}>
              WHERE `{table.pk}` = {cellText(pkVal)} <span style={{ color: 'var(--amber)' }}>(PRIMARY)</span> · LIMIT 1
            </div>
          </div>
          <div className={'field' + (nulled ? ' nulled' : '')}>
            <label>
              Value <span className="colmeta">{col.type}{col.null ? ' · NULL allowed' : ' · NOT NULL'}</span>
            </label>
            <input
              ref={inputRef} type="text"
              value={nulled ? '' : value}
              placeholder={nulled ? 'NULL' : ''}
              onChange={e => { setValue(e.target.value); setNulled(false); }}
              onKeyDown={e => e.key === 'Enter' && save()}
            />
            <div className="meta">
              was: {originalNull ? 'NULL' : originalText} ·{' '}
              <a onClick={() => col.null ? setNulled(true) : toast('Column does not allow NULL', 'err')}>set NULL</a> ·{' '}
              <a onClick={() => { setValue(originalText); setNulled(originalNull); }}>revert</a>
            </div>
          </div>
          <div className="field">
            <label>Generated SQL</label>
            <div className="sql-preview"><Sql code={sqlPreview} /></div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={() => onClose(false)}>Cancel</button>
          <button className="btn primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
