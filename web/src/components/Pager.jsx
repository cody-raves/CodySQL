import React from 'react';

export default function Pager({ page, pages, onPage, pageSize, onPageSize }) {
  const span = 2;
  const lo = Math.max(1, page - span);
  const hi = Math.min(pages, page + span);
  const nums = [];
  for (let p = lo; p <= hi; p++) nums.push(p);

  return (
    <div className="pager">
      <button disabled={page === 1} onClick={() => onPage(1)}>«</button>
      <button disabled={page === 1} onClick={() => onPage(page - 1)}>‹</button>
      {lo > 1 && <span>…</span>}
      {nums.map(p => (
        <button key={p} className={p === page ? 'cur' : ''} onClick={() => p !== page && onPage(p)}>{p}</button>
      ))}
      {hi < pages && <span>…</span>}
      <button disabled={page === pages} onClick={() => onPage(page + 1)}>›</button>
      <button disabled={page === pages} onClick={() => onPage(pages)}>»</button>
      {onPageSize && (
        <select value={pageSize} onChange={e => onPageSize(+e.target.value)}>
          {[100, 250, 500].map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
      )}
    </div>
  );
}
