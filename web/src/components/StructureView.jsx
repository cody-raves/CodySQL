import React from 'react';
import { api } from '../lib/nui';
import { toast, confirmAction, fmtCount } from '../lib/ui';

export default function StructureView({ table, perms, onSchemaChange }) {
  if (!table) {
    return (
      <div className="view">
        <div className="empty"><div className="big">▦</div><div>Select a table to view its structure</div></div>
      </div>
    );
  }

  const rename = async () => {
    const newName = await confirmAction({
      title: '✎ Rename table',
      warnHtml: `Rename <b>${table.name}</b>? Scripts that reference the old name will break until updated.`,
      label: 'New table name',
      danger: false,
      confirmLabel: 'Rename',
    });
    if (!newName) return;
    const res = await api('renameTable', { table: table.name, newName });
    if (!res.ok) { toast(res.error || 'Rename failed', 'err'); return; }
    toast('Table renamed', 'ok');
    onSchemaChange(newName);
  };

  const empty = async () => {
    const typed = await confirmAction({
      title: '⚠ Empty table',
      warnHtml: `<b>TRUNCATE \`${table.name}\`</b><br>This permanently removes all ~${fmtCount(table.approxRows)} rows. It cannot be undone without a backup.`,
      typed: table.name,
      confirmLabel: 'Empty Table',
    });
    if (typed === null) return;
    const res = await api('emptyTable', { table: table.name, confirmName: typed });
    if (!res.ok) { toast(res.error || 'Empty failed', 'err'); return; }
    toast(`Table emptied (${fmtCount(res.affected)} rows removed)`, 'ok');
  };

  const drop = async () => {
    const typed = await confirmAction({
      title: '⚠ Drop table',
      warnHtml: `<b>DROP TABLE \`${table.name}\`</b><br>This permanently removes the table and all ~${fmtCount(table.approxRows)} contained rows. It cannot be undone without a backup.`,
      typed: table.name,
      confirmLabel: 'Drop Table',
    });
    if (typed === null) return;
    const res = await api('dropTable', { table: table.name, confirmName: typed });
    if (!res.ok) { toast(res.error || 'Drop failed', 'err'); return; }
    toast('Table dropped', 'ok');
    onSchemaChange(null);
  };

  return (
    <div className="view">
      <div className="toolbar">
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{table.name}</span>
        <span className="note">
          {table.engine} · {table.collation} · ~{fmtCount(table.approxRows)} rows
        </span>
        <div className="push" />
        <button className="btn" disabled={!perms['codysql.structure']} onClick={rename}>✎ Rename</button>
        <button className="btn danger" disabled={!perms['codysql.structure']} onClick={empty}>⌫ Empty</button>
        <button className="btn danger" disabled={!perms['codysql.drop']} onClick={drop}>🗑 Drop</button>
      </div>

      <div className="pad-wrap">
        <div className="panel">
          <div className="panel-head">Columns</div>
          <table className="mini">
            <thead>
              <tr><th>#</th><th>Name</th><th>Type</th><th>Null</th><th>Default</th><th>Extra</th><th>Keys</th></tr>
            </thead>
            <tbody>
              {table.columns.map((c, i) => (
                <tr key={c.name}>
                  <td>{i + 1}</td>
                  <td>{c.name}</td>
                  <td>{c.type}</td>
                  <td className={c.null ? 'yes' : 'no'}>{c.null ? 'YES' : 'NO'}</td>
                  <td className={c.default == null ? 'no' : ''}>{c.default == null ? '—' : c.default}</td>
                  <td>{/auto_increment/.test(c.extra || '') ? <span className="pill ai">AUTO_INC</span> : (c.extra || '')}</td>
                  <td>
                    {c.key === 'PRI' && <span className="pill pk">PRIMARY</span>}
                    {c.key === 'UNI' && <span className="pill uniq">UNIQUE</span>}
                    {c.key === 'MUL' && <span className="pill idx">INDEX</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="panel-head">Indexes</div>
          <table className="mini">
            <thead>
              <tr><th>Name</th><th>Type</th><th>Columns</th></tr>
            </thead>
            <tbody>
              {(table.indexes || []).map(ix => (
                <tr key={ix.name}>
                  <td>{ix.name}</td>
                  <td>
                    {ix.name === 'PRIMARY'
                      ? <span className="pill pk">PRIMARY</span>
                      : ix.unique ? <span className="pill uniq">UNIQUE</span> : <span className="pill idx">INDEX</span>}
                  </td>
                  <td>{ix.columns.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
