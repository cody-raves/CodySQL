Config = {}

-- Chat command that opens the UI (users still need the codysql.open ACE permission)
Config.Command = 'codysql'

-- Row grid paging
Config.TablePageSize = 100   -- default rows per page
Config.MaxPageSize   = 500   -- hard cap, server enforced

-- Hard cap on rows returned by the raw SQL editor (server enforced)
Config.MaxQueryRows = 1000

-- Values longer than this are truncated in the grid (full value opens in the editor)
Config.MaxCellPreview = 256

-- Simple per-player rate limit: max requests per second across all CodySQL actions
Config.RateLimitPerSecond = 20

Config.Audit = {
    enabled = true,
    -- Also audit read-only actions (table opens, raw SELECTs). Noisy; off by default.
    logReads = false,
    -- Days of audit history kept. Cleanup runs at resource start. 0 = keep forever.
    retentionDays = 90,
}

Config.Backups = {
    -- Allow manual "Create Backup Now" from the UI (requires codysql.backup ACE)
    allowManual = true,
    -- Rows fetched per chunk while dumping a table. Larger = faster, more memory.
    chunkSize = 500,
}

-- Tables the UI hides and every write path refuses to touch.
-- CodySQL's own tables are always protected, even if removed from this list.
Config.ProtectedTables = {
    'codysql_audit',
}

-- Statement types the raw SQL editor refuses outright (case-insensitive prefix match).
-- These are account/privilege operations that have no place in an in-game tool.
Config.BlockedStatements = {
    'GRANT', 'REVOKE', 'CREATE USER', 'ALTER USER', 'DROP USER',
    'SET PASSWORD', 'SET GLOBAL', 'DROP DATABASE', 'CREATE DATABASE',
    'SHUTDOWN',
}
