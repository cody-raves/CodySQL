// Small shared UI utilities: formatting, toast bus, confirm bus.

export function fmtBytes(n) {
  if (n == null) return '';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}

export const fmtCount = n => Number(n || 0).toLocaleString('en-US');

import { isNull, isBin, isLong } from './nui';

export function cellText(v) {
  if (isNull(v)) return 'NULL';
  if (isBin(v)) return `[binary ${fmtBytes(v.__cs_bin)}]`;
  if (isLong(v)) return v.preview + '…';
  return String(v);
}

/* ---- toast bus ---- */
let toastListeners = [];
export function toast(msg, kind) {
  toastListeners.forEach(fn => fn({ id: Math.random().toString(36).slice(2), msg, kind }));
}
export function onToast(fn) {
  toastListeners.push(fn);
  return () => { toastListeners = toastListeners.filter(f => f !== fn); };
}

/* ---- confirm bus (promise-based) ---- */
let confirmListener = null;
export function confirmAction(opts) {
  // opts: { title, warnHtml, typed?, label?, danger? } → resolves string | null
  return new Promise(resolve => {
    if (confirmListener) confirmListener({ ...opts, resolve });
    else resolve(null);
  });
}
export function onConfirm(fn) {
  confirmListener = fn;
  return () => { if (confirmListener === fn) confirmListener = null; };
}
