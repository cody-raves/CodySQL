import React, { useEffect, useState } from 'react';
import { onToast } from '../lib/ui';

export default function Toasts() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => onToast(t => {
    setToasts(list => [...list, t]);
    setTimeout(() => setToasts(list => list.filter(x => x.id !== t.id)), 4200);
  }), []);

  return (
    <div className="toasts">
      {toasts.map(t => (
        <div key={t.id} className={'toast' + (t.kind ? ' ' + t.kind : '')}>{t.msg}</div>
      ))}
    </div>
  );
}
