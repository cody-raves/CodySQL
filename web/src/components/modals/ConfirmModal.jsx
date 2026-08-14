import React, { useEffect, useRef, useState } from 'react';
import { onConfirm } from '../../lib/ui';

// Single host rendered once in App; confirmAction() from anywhere resolves
// with the typed input (or '') on confirm, null on cancel.
export default function ConfirmHost() {
  const [req, setReq] = useState(null);
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  useEffect(() => onConfirm(r => { setReq(r); setInput(''); }), []);
  useEffect(() => { if (req && inputRef.current) inputRef.current.focus(); }, [req]);

  if (!req) return null;

  const needsInput = req.typed !== undefined || req.label;
  // Case/whitespace-insensitive: the label is uppercased by CSS, so users may
  // type the name in either case. The safety is in typing the name at all.
  const blocked = req.typed !== undefined
    && input.trim().toLowerCase() !== req.typed.toLowerCase();

  const done = value => { req.resolve(value); setReq(null); };

  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && done(null)}>
      <div className={'modal' + (req.danger === false ? '' : ' danger')}>
        <div className="modal-head">{req.title}</div>
        <div className="modal-body">
          <div className="warn-box" dangerouslySetInnerHTML={{ __html: req.warnHtml }} />
          {needsInput && (
            <div className="field">
              <label>
                {req.label || <>Type <span className="literal">{req.typed}</span> to confirm</>}
              </label>
              <input
                ref={inputRef} type="text" value={input} autoComplete="off"
                placeholder={req.typed}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !blocked && done(input)}
              />
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={() => done(null)}>Cancel</button>
          <button
            className={'btn ' + (req.danger === false ? 'primary' : 'danger')}
            disabled={blocked}
            onClick={() => done(input)}
          >
            {req.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
