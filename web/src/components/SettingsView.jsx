import React from 'react';

const THEME_META = [
  { id: 'midnight', name: 'Midnight', sub: 'Default', dots: ['#12161d', '#171c25', '#4da3ff'] },
  { id: 'carbon', name: 'Carbon', sub: 'Black · green', dots: ['#0d0d0f', '#121214', '#4ade80'] },
  { id: 'ocean', name: 'Ocean', sub: 'Deep teal', dots: ['#071c24', '#0a232d', '#2dd4bf'] },
  { id: 'synthwave', name: 'Synthwave', sub: 'Purple · magenta', dots: ['#150c22', '#1b112d', '#e879f9'] },
  { id: 'daylight', name: 'Daylight', sub: 'Light', dots: ['#ffffff', '#f4f6f9', '#2563eb'] },
];

export default function SettingsView({ perms, theme, setTheme }) {
  // Hovering a card previews its theme instantly; leaving restores the
  // committed one. Clicking commits (and persists) as before.
  const preview = id => {
    if (id === 'midnight') document.body.removeAttribute('data-theme');
    else document.body.setAttribute('data-theme', id);
  };

  return (
    <div className="view">
      <div className="pad-wrap settings-wrap">
        <div className="panel">
          <div className="panel-head">Appearance</div>
          <div className="theme-cards">
            {THEME_META.map(t => (
              <div
                key={t.id}
                className={'theme-card' + (theme === t.id ? ' on' : '')}
                onClick={() => setTheme(t.id)}
                onMouseEnter={() => preview(t.id)}
                onMouseLeave={() => preview(theme)}
              >
                <div className="tc-strip">
                  {t.dots.map((d, i) => <span key={i} className="tc-dot" style={{ background: d }} />)}
                </div>
                <div className="tc-name">{t.name}</div>
                <div className="tc-sub">{t.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">Your permissions</div>
          <div className="panel-body" style={{ fontFamily: 'var(--mono)' }}>
            {Object.entries(perms).sort(([a], [b]) => a.localeCompare(b)).map(([perm, has]) => (
              <div key={perm}>
                <span className={has ? 'yes' : 'no'}>{has ? '✓' : '✗'}</span> {perm}
              </div>
            ))}
          </div>
        </div>

        <div className="panel about-panel">
          <div className="panel-head">About</div>
          <div className="panel-body">
            CodySQL — open-source in-game database manager for FiveM.<br />
            Docs, issues and updates:{' '}
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>github.com/cody-raves/CodySQL</span>
          </div>
        </div>
      </div>
    </div>
  );
}
