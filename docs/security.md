# Security model

CodySQL gives trusted people a lot of power over your database. This page explains exactly what protects you, and what doesn't.

## The request path

```
NUI (React, sandboxed)
  → client/main.lua        (relay only; holds no logic, no secrets)
    → server event
      → permission check   (ACE, on EVERY request)
      → rate limit
      → identifier check   (table/column must exist in the discovered schema)
      → parameterized SQL
        → oxmysql → your database
```

## What the client can never do

- **See credentials.** CodySQL uses the oxmysql connection your server already has. The connection string never leaves the server, and CodySQL itself never reads it.
- **Claim permissions.** The client sends requests; the server decides. A modified NUI can draw whatever buttons it likes — the server still checks ACE on each action.
- **Name arbitrary identifiers.** Table and column names in requests are matched against the schema the server itself discovered (`SHOW TABLE STATUS`, `SHOW FULL COLUMNS`). Unknown identifiers are rejected before any SQL is built.
- **Touch the filesystem.** SQL files are read only from `codysql/sql/` with a strict filename whitelist; backups are written only to `codysql/backups/`. No client-supplied paths, ever.
- **Run OS commands or load remote code.** Directory listing uses FiveM's sandboxed `io.readdir()` resource-directory API. CodySQL executes no shell commands, spawns no child processes, and downloads nothing at runtime.

## What the server enforces

- **Parameterized values** everywhere a value can come from a person.
- **Blocked statements** on every execution path — the raw SQL editor *and* the `.sql` file runner both refuse `GRANT`, `CREATE USER`, `DROP DATABASE`, `SET GLOBAL`, and friends (see `Config.BlockedStatements`). These have no business in an in-game tool, whether typed by hand or shipped inside a file.
- **Protected tables**: `codysql_audit` (plus anything you add to `Config.ProtectedTables`) is refused by every write path and hidden from the browser.
- **Typed confirmations** for destructive operations — dropping or emptying a table requires typing its name.
- **Rate limiting** per player, so a stuck client can't hammer the database.
- **Audit trail**: every write, every executed file, every raw statement, every denied attempt — with identity (name, license, discord), old/new values, timing, and result.

## What CodySQL does NOT protect you from

Be honest with yourself about these:

- **A malicious person you gave high permissions to.** `codysql.rawsql` is arbitrary SQL. The audit log means you'll *know* what they did, but knowing isn't undoing. Grant high-risk permissions the way you'd hand out server console access.
- **Anyone with access to the machine.** FTP, VPS panel, or database credentials bypass CodySQL entirely — including its audit log and its backups folder.
- **Data loss beyond your backups.** Local backups protect against bad edits and bad installers, not against the disk dying. Copy backups off the box.

## Reporting a vulnerability

Found a hole? Please open a **private** security advisory on GitHub (or contact the maintainer directly) rather than a public issue, so servers running CodySQL have a chance to update first.
