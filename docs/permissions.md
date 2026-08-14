# Permissions

CodySQL uses FiveM's built-in ACE permission system. Every action in the UI maps to one permission, and the **server re-checks the permission on every single request** — what the UI shows or hides is cosmetic.

## The full list

| Permission | Allows | Risk |
|---|---|---|
| `codysql.open` | Opening the UI at all | — |
| `codysql.read` | Browsing tables and rows | Low — but they can read *everything*, including player data |
| `codysql.audit` | Viewing the audit log | Low |
| `codysql.edit` | Editing cell and row values | Medium |
| `codysql.insert` | Inserting and duplicating rows | Medium |
| `codysql.delete` | Deleting rows | Medium — deleted rows are captured in the audit log first |
| `codysql.backup` | Creating manual backups | Medium — writes a full DB dump to the server's disk |
| `codysql.sqlfiles` | Running `.sql` files from `codysql/sql/` | High — runs whatever is in the folder |
| `codysql.rawsql` | The raw SQL editor | High — arbitrary SQL (privilege statements are still blocked) |
| `codysql.structure` | Renaming and emptying tables | High |
| `codysql.drop` | Dropping tables | Highest |

## Suggested tiers

**Owner** — everything (see the README for the full block).

**Trusted developer** — everything except drop:

```cfg
add_ace group.dev codysql.open allow
add_ace group.dev codysql.read allow
add_ace group.dev codysql.edit allow
add_ace group.dev codysql.insert allow
add_ace group.dev codysql.delete allow
add_ace group.dev codysql.rawsql allow
add_ace group.dev codysql.sqlfiles allow
add_ace group.dev codysql.audit allow
```

**Support staff** — look, don't touch:

```cfg
add_ace group.admin codysql.open allow
add_ace group.admin codysql.read allow
add_ace group.admin codysql.audit allow
```

## Things to know

- Permissions attach to whatever principal you like: a license identifier, a group (`group.admin`), or anything else ACE supports.
- `codysql.read` exposes **all data in the database** — including anything sensitive other scripts store. Treat it accordingly.
- Denied attempts are logged to the audit log, so you can see who tried what.
- CodySQL's own tables (`codysql_audit`) are protected: hidden from editing and refused by every write path, regardless of permissions.
