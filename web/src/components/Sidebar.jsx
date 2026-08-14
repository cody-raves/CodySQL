import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fmtCount } from '../lib/ui';

const WIDTH_KEY = 'codysql:sidebarWidth';
const MIN_W = 180;
const MAX_W = 480;

export default function Sidebar({ tables, active, onOpen }) {
  const [filter, setFilter] = useState('');
  const [width, setWidth] = useState(() => {
    const saved = +localStorage.getItem(WIDTH_KEY);
    return saved >= MIN_W && saved <= MAX_W ? saved : 260;
  });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null); // { x, width }

  useEffect(() => {
    if (!dragging) return;
    const onMove = e => {
      const w = Math.min(MAX_W, Math.max(MIN_W, dragStart.current.width + e.clientX - dragStart.current.x));
      setWidth(w);
    };
    const onUp = () => {
      setDragging(false);
      setWidth(w => { localStorage.setItem(WIDTH_KEY, w); return w; });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  const { normal, internal, totalRows } = useMemo(() => {
    const normal = tables.filter(t => !t.protected);
    const internal = tables.filter(t => t.protected);
    const totalRows = normal.reduce((n, t) => n + (t.approxRows || 0), 0);
    return { normal, internal, totalRows };
  }, [tables]);

  const shown = normal.filter(t => !filter || t.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="sidebar" style={{ width, minWidth: width }}>
      <div className="search">
        <input
          type="text" placeholder="Filter tables…"
          value={filter} onChange={e => setFilter(e.target.value)}
        />
      </div>
      <div className="table-list">
        <div className="tl-header">Tables ({normal.length})</div>
        {shown.map(t => (
          <div
            key={t.name}
            className={'table-item' + (active === t.name ? ' active' : '')}
            title={t.name}
            onClick={() => onOpen(t.name)}
          >
            <span className="ticon">▦</span>
            <span className="tname">{t.name}</span>
            <span className="rows">{fmtCount(t.approxRows)}</span>
          </div>
        ))}
        {internal.length > 0 && <div className="tl-header" style={{ marginTop: 8 }}>Internal</div>}
        {internal.map(t => (
          <div key={t.name} className="table-item internal" title={t.name}>
            <span className="ticon">▦</span>
            <span className="tname">{t.name}</span>
            <span className="lock">🔒</span>
          </div>
        ))}
      </div>
      <div className="foot">
        <span>{tables.length} tables</span>
        <span>~{fmtCount(totalRows)} rows</span>
      </div>
      <div
        className={'sb-resize' + (dragging ? ' dragging' : '')}
        onMouseDown={e => { e.preventDefault(); dragStart.current = { x: e.clientX, width }; setDragging(true); }}
        title="Drag to resize"
      />
    </div>
  );
}
