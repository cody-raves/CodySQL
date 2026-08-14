# Contributing to CodySQL

Thanks for wanting to help! CodySQL aims to stay small, readable, and safe. Here's what you need to know.

## Project layout

```
codysql/
├── fxmanifest.lua        FiveM resource manifest
├── config.lua            All tunables — read this first
├── client/main.lua       Thin relay: open/close + NUI↔server bridge
├── server/
│   ├── util.lua          Identifier rules, SQL statement splitter, value encoding
│   ├── permissions.lua   ACE checks + player identity
│   ├── audit.lua         Audit table schema, writes, and the Audit tab queries
│   ├── database.lua      Discovery, browsing, editing, raw SQL
│   ├── sqlfiles.lua      sql/ folder listing + execution
│   ├── backups.lua       Chunked full-database dumps
│   └── main.lua          Action router: every action + its required permission
├── web/                  React NUI (Vite)
│   ├── src/lib/nui.js    Bridge to the game + mock data for browser dev
│   ├── src/App.jsx       Shell, tabs, theming
│   └── src/components/   One file per view / modal
└── docs/
```

## Developing the UI (no FiveM needed)

The NUI runs in a normal browser with realistic mock data:

```bash
cd web
npm install
npm run dev
```

Open the printed localhost URL. Everything is clickable; writes are no-ops that return success. The mock lives in `src/lib/nui.js` — if you add a server action, add a mock for it.

## Building for the game

```bash
cd web
npm run build
```

The resource loads `web/dist/` — commit the built output so server owners can use the repo without Node.

## Testing against a real server

1. Symlink or copy the repo into your dev server's `resources/`.
2. `ensure oxmysql`, `ensure codysql`, grant yourself the ACEs (see README).
3. `restart codysql` picks up Lua changes; rebuild + `restart codysql` for UI changes.

## Ground rules for PRs

- **Security first.** Anything that builds SQL must validate identifiers against the discovered schema and parameterize values. Anything that touches the filesystem must stay inside the resource folder with whitelisted names. If in doubt, ask in the PR.
- **Every new action needs**: a permission in `server/main.lua`'s router, an audit log entry if it writes, and a mock in `nui.js`.
- **Keep the Lua dependency-free** (oxmysql only). Keep the web side to React + Vite — no UI libraries; the design system is plain CSS in `src/styles.css`.
- Match the existing style: 4-space Lua, 2-space JS, no semicolon golf.
- One feature per PR, with a clear description of what it does and how you tested it.

## Good first issues

Check the roadmap in the README — foreign-key jump and SQL syntax highlighting are both self-contained and beginner-friendly.
