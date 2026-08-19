# CodySQL - browse, edit and query your database in game [FREE] [OPEN SOURCE]

I got tired of alt-tabbing to HeidiSQL every time I installed a script, so I built this.

You know the drill. New script, the readme says run this SQL and add your job to the jobs table. So you tab out, open HeidiSQL, connect, find the table, add the row, tab back in, restart, test. Every single time.

CodySQL puts all of that in game. Type /codysql, run the SQL file, open the jobs table, insert a row, keep testing. Less alt tabbing means faster dev.

It reads the schema straight from your database, so it works with whatever framework you run. I use Qbox but it genuinely doesn't care.

## What it does

![Query editor](https://raw.githubusercontent.com/cody-raves/CodySQL/main/media/query.gif)

Query tab. Write SQL, hit run, get your results. It highlights as you type and handles multiple statements in one go.

![Cell editing](https://raw.githubusercontent.com/cody-raves/CodySQL/main/media/editing.gif)

Double click a cell to edit it. It shows you the exact UPDATE it's about to run before you save, so there are no surprises. Long JSON values like inventories or vehicle mods open in a bigger editor that formats and validates them.

![Drop table confirmation](https://raw.githubusercontent.com/cody-raves/CodySQL/main/media/drop-table.gif)

Dropping or emptying a table makes you type the table name first. Everything you do gets written to an audit log either way.

![Themes](https://raw.githubusercontent.com/cody-raves/CodySQL/main/media/themes.gif)

Five themes. Hover one to preview it before you commit.

![Resizable sidebar](https://raw.githubusercontent.com/cody-raves/CodySQL/main/media/sidebar.gif)

Drag the sidebar wider if your table names are long. It remembers where you left it.

Other stuff it does:

- Browse any table with search, sorting and paging. All of it server side, so it never dumps a whole table to the client
- Drop .sql files into codysql/sql and run them from the UI, either one statement at a time with per statement results, or as a single transaction
- Audit log records who changed what, the old value, the new value and when. Denied attempts get logged too
- Backup button dumps your whole database to a .sql file, written in chunks so it doesn't eat server memory
- 11 separate ACE permissions, so you can give a support admin read only access without handing them drop table

## Security

This is what people ask about first, so I'll get ahead of it.

It uses your existing oxmysql connection. It never sees or stores credentials and there is no database config to fill in.

Every action gets checked against ACE permissions on the server, on every request. The UI greys out what you can't do, but that's only cosmetic, the server checks anyway. Table and column names coming from the UI are validated against the real schema so you can't inject one that doesn't exist, and all values are parameterized. GRANT, CREATE USER, DROP DATABASE and friends are blocked outright, even for the owner, whether you type them or they're sitting in a .sql file.

No obfuscation, no escrow, no external licensing check. It runs no operating system commands and downloads nothing at runtime. SQL files are found using FiveM's sandboxed io.readdir().

The server side is about 1,200 lines of Lua and it's all public, so read it yourself before you trust it.

## Performance

[paste your resmon numbers here - idle with the UI closed, and open while browsing a table]

## Install

Drop the folder into resources, then in server.cfg after oxmysql:

```
ensure oxmysql
ensure codysql
```

Then give yourself access:

```
add_ace group.admin codysql.open allow
add_ace group.admin codysql.read allow
```

The full list of 11 permissions is in the readme so you can decide who gets what. Restart, join, type /codysql.

## Not finished yet

Being upfront about what's missing:

- No restore from inside the game. Backups work, restore doesn't, because restoring a live server while frameworks are holding player data in memory is a great way to lose data. For now, stop the server and import the .sql normally.
- Scheduled backups aren't in yet, only manual ones
- You can't add or edit columns from the structure tab yet
- Want to add clicking a citizenid to jump straight to that player's row

MIT licensed, so do what you like with it. Issues and PRs welcome.

Download: https://github.com/cody-raves/CodySQL

---

|                             |                                     |
|-----------------------------|-------------------------------------|
| Code is accessible          | Yes                                 |
| Subscription-based          | No                                  |
| Lines (approximately)       | ~3,200                              |
| Requirements                | oxmysql, MySQL 5.7+ / MariaDB 10.3+ |
| Support                     | Yes                                 |
