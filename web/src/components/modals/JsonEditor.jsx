import React, { useEffect, useState } from 'react';
import { api, isNull } from '../../lib/nui';
import { toast, cellText, fmtBytes } from '../../lib/ui';

export default function JsonEditor({ table, rows, pkIdx, target, onClose }) {
  const col = table.columns[target.ci];
  const pkVal = rows[target.ri][pkIdx];

  const [value, setValue] = useState(null);   // null = loading
  const [original, setOriginal] = useState('');

  useEffect(() => {
    (async () => {
      const res = await api('getCell', { table: table.name, column: col.name, pkValue: pkVal });
      if (!res.ok) { toast(res.error || 'Failed to load value', 'err'); onClose(false); return; }
      const v = isNull(res.value) ? '' : String(res.value);
      setValue(v);
      setOriginal(v);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let jsonValid = false;
  try { JSON.parse(value ?? ''); jsonValid = true; } catch { /* plain text */ }

  const reformat = minify => {
    try { setValue(JSON.stringify(JSON.parse(value), null, minify ? undefined : 2)); }
    catch { toast('Not valid JSON', 'err'); }
  };

  const save = async () => {
    const res = await api('updateCell', {
      table: table.name, column: col.name, pkValue: pkVal, value,
    });
    if (!res.ok) { toast(res.error || 'Update failed', 'err'); return; }
    toast('Value updated', 'ok');
    onClose(true);
  };

  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose(false)}>
      <div className="modal wide">
        <div className="modal-head">
          ✎ Edit value — <span className="sub">{table.name}.{col.name}</span>
          <span className="faint">WHERE {table.pk} = {cellText(pkVal)}</span>
        </div>
        <div className="json-bar">
          <div className="seg">
            <button onClick={() => reformat(false)}>Format</button>
            <button onClick={() => reformat(true)}>Minify</button>
          </div>
          <span className={'valid-badge' + (jsonValid ? ' ok' : '')}>
            {jsonValid ? '✓ Valid JSON' : 'plain text'}
          </span>
          <span className="note">{value != null && fmtBytes(new Blob([value]).size)}</span>
        </div>
        {value == null
          ? <div className="empty"><span className="spinner" /></div>
          : <textarea
              className="json-editor" spellCheck={false}
              value={value} onChange={e => setValue(e.target.value)}
            />}
        <div className="modal-foot">
          <button className="btn ghost" onClick={() => setValue(original)}>↺ Revert</button>
          <span className="push" />
          <button className="btn" onClick={() => onClose(false)}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={value == null}>Save</button>
        </div>
      </div>
    </div>
  );
}
