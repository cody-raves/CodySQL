CodySQL = CodySQL or {}
local P = {}
CodySQL.perms = P

-- Every ACE permission CodySQL understands. The UI receives this map on init
-- and locks/hides what the player doesn't have; the server re-checks on every
-- single request regardless of what the UI shows.
P.ALL = {
    'codysql.open',      -- open the UI at all
    'codysql.read',      -- browse tables and rows
    'codysql.edit',      -- edit cells / rows
    'codysql.insert',    -- insert & duplicate rows
    'codysql.delete',    -- delete rows
    'codysql.rawsql',    -- raw SQL editor
    'codysql.structure', -- rename / empty tables
    'codysql.drop',      -- drop tables
    'codysql.sqlfiles',  -- run .sql files from the sql/ folder
    'codysql.audit',     -- view the audit log
    'codysql.backup',    -- create manual backups
}

function P.has(src, perm)
    return IsPlayerAceAllowed(src, perm)
end

function P.map(src)
    local out = {}
    for _, perm in ipairs(P.ALL) do
        out[perm] = IsPlayerAceAllowed(src, perm) or false
    end
    return out
end

-- Identity used for audit entries.
function P.identity(src)
    local name = GetPlayerName(src) or ('server-id ' .. tostring(src))
    local license, discord
    for i = 0, GetNumPlayerIdentifiers(src) - 1 do
        local id = GetPlayerIdentifier(src, i)
        if id:sub(1, 8) == 'license:' then license = id
        elseif id:sub(1, 8) == 'discord:' then discord = id end
    end
    return { name = name, license = license, discord = discord }
end
