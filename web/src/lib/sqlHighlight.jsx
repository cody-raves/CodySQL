import React from 'react';

// Tiny dependency-free SQL highlighter. Tokenizes into comments, strings,
// backtick identifiers, numbers, and keywords; everything else passes through.

const KEYWORDS = new Set((
  'select from where insert into values update set delete create table if not exists ' +
  'drop alter add column index primary key unique foreign references constraint ' +
  'auto_increment default null join left right inner outer cross on as and or limit ' +
  'offset order by group having distinct like in is between union all case when then ' +
  'else end truncate rename to show describe explain engine charset collate character ' +
  'varchar char int integer tinyint smallint mediumint bigint decimal numeric float ' +
  'double text longtext mediumtext tinytext blob longblob timestamp datetime date time ' +
  'year boolean bool bit enum json unsigned signed zerofill current_timestamp ' +
  'begin commit rollback transaction start replace ignore duplicate asc desc using ' +
  'count sum avg min max concat coalesce ifnull now interval database'
).split(' '));

export function tokenizeSql(code) {
  const tokens = [];
  let i = 0;
  const n = code.length;
  let plain = '';

  const flush = () => { if (plain) { tokens.push({ cls: '', text: plain }); plain = ''; } };
  const push = (cls, text) => { flush(); tokens.push({ cls, text }); };

  while (i < n) {
    const c = code[i];
    const nc = code[i + 1];

    // comments
    if (c === '-' && nc === '-') {
      let j = code.indexOf('\n', i);
      if (j === -1) j = n;
      push('sql-cmt', code.slice(i, j));
      i = j;
    } else if (c === '#') {
      let j = code.indexOf('\n', i);
      if (j === -1) j = n;
      push('sql-cmt', code.slice(i, j));
      i = j;
    } else if (c === '/' && nc === '*') {
      let j = code.indexOf('*/', i + 2);
      j = j === -1 ? n : j + 2;
      push('sql-cmt', code.slice(i, j));
      i = j;
    // strings
    } else if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < n) {
        if (code[j] === '\\') j += 2;
        else if (code[j] === c) { j += 1; break; }
        else j += 1;
      }
      push('sql-str', code.slice(i, j));
      i = j;
    // backtick identifiers
    } else if (c === '`') {
      let j = code.indexOf('`', i + 1);
      j = j === -1 ? n : j + 1;
      push('sql-ident', code.slice(i, j));
      i = j;
    // numbers
    } else if (/\d/.test(c) && !/[\w$]/.test(code[i - 1] || '')) {
      let j = i;
      while (j < n && /[\d.]/.test(code[j])) j += 1;
      push('sql-num', code.slice(i, j));
      i = j;
    // words (keywords or plain identifiers)
    } else if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < n && /[\w$]/.test(code[j])) j += 1;
      const word = code.slice(i, j);
      if (KEYWORDS.has(word.toLowerCase())) push('sql-kw', word);
      else plain += word;
      i = j;
    } else {
      plain += c;
      i += 1;
    }
  }
  flush();
  return tokens;
}

export default function Sql({ code }) {
  return (
    <>
      {tokenizeSql(String(code ?? '')).map((t, i) =>
        t.cls ? <span key={i} className={t.cls}>{t.text}</span> : t.text
      )}
    </>
  );
}
