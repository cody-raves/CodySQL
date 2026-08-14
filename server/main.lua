local U = CodySQL.util
local P = CodySQL.perms
local A = CodySQL.audit
local DB = CodySQL.db

-- ---------------------------------------------------------------------------
-- Boot
-- ---------------------------------------------------------------------------

CreateThread(function()
    -- Give oxmysql a moment to establish its pool, then discover the schema.
    MySQL.ready(function()
        A.init()
        DB.refresh()
        local overview = DB.overview()
        print(('[codysql] connected to `%s` — %d tables discovered')
            :format(overview.db or '?', #overview.tables))
    end)
end)

-- ---------------------------------------------------------------------------
-- Open command (ACE-gated server-side)
-- ---------------------------------------------------------------------------

RegisterCommand(Config.Command, function(src)
    if src == 0 then
        print('[codysql] this command opens the in-game UI; run it as a player.')
        return
    end
    if not P.has(src, 'codysql.open') then
        A.log(src, 'DENIED', { error = 'missing ace codysql.open' })
        return
    end
    TriggerClientEvent('codysql:open', src)
end, false)

-- ---------------------------------------------------------------------------
-- Action router
-- Every action declares the ACE permission it requires. The handler runs only
-- after the server itself has verified the caller holds that permission.
-- ---------------------------------------------------------------------------

local Actions = {
    init = {
        perm = 'codysql.open',
        handler = function(src)
            local overview = DB.overview()
            return {
                ok = true,
                db = overview.db,
                tables = overview.tables,
                permissions = P.map(src),
                user = P.identity(src).name,
                config = {
                    pageSize = Config.TablePageSize,
                    maxPageSize = Config.MaxPageSize,
                },
            }
        end,
    },
    refreshSchema = {
        perm = 'codysql.read',
        handler = function()
            DB.refresh()
            return { ok = true, tables = DB.overview().tables }
        end,
    },
    getTable   = { perm = 'codysql.read',   handler = function(_, p) return DB.getTable(p) end },
    getRows    = { perm = 'codysql.read',   handler = function(_, p) return DB.getRows(p) end },
    getCell    = { perm = 'codysql.read',   handler = function(_, p) return DB.getCell(p) end },
    updateCell = { perm = 'codysql.edit',   handler = function(s, p) return DB.updateCell(s, p) end },
    insertRow  = { perm = 'codysql.insert', handler = function(s, p) return DB.insertRow(s, p) end },
    deleteRow  = { perm = 'codysql.delete', handler = function(s, p) return DB.deleteRow(s, p) end },
    renameTable = { perm = 'codysql.structure', handler = function(s, p) return DB.renameTable(s, p) end },
    emptyTable  = { perm = 'codysql.structure', handler = function(s, p) return DB.emptyTable(s, p) end },
    dropTable   = { perm = 'codysql.drop',      handler = function(s, p) return DB.dropTable(s, p) end },
    rawQuery    = { perm = 'codysql.rawsql',    handler = function(s, p) return DB.rawQuery(s, p) end },
    getSqlFiles = { perm = 'codysql.sqlfiles',  handler = function() return CodySQL.sqlfiles.list() end },
    getSqlFile  = { perm = 'codysql.sqlfiles',  handler = function(_, p) return CodySQL.sqlfiles.get(p) end },
    runSqlFile  = { perm = 'codysql.sqlfiles',  handler = function(s, p) return CodySQL.sqlfiles.run(s, p) end },
    getAudit    = { perm = 'codysql.audit',     handler = function(_, p) return A.fetch(p) end },
    getBackups  = { perm = 'codysql.backup',    handler = function() return CodySQL.backups.list() end },
    createBackup = { perm = 'codysql.backup',   handler = function(s, p) return CodySQL.backups.create(s, p) end },
}

-- ---------------------------------------------------------------------------
-- Rate limiting: a small sliding window per player
-- ---------------------------------------------------------------------------

local windows = {}

local function rateLimited(src)
    local now = GetGameTimer()
    local w = windows[src]
    if not w or now - w.start > 1000 then
        windows[src] = { start = now, count = 1 }
        return false
    end
    w.count += 1
    return w.count > (Config.RateLimitPerSecond or 20)
end

AddEventHandler('playerDropped', function()
    windows[source] = nil
end)

-- ---------------------------------------------------------------------------
-- Request handler
-- ---------------------------------------------------------------------------

RegisterNetEvent('codysql:api', function(action, payload, reqId)
    local src = source

    local function respond(result)
        TriggerClientEvent('codysql:apiResponse', src, reqId, result)
    end

    local def = Actions[action]
    if not def then
        return respond({ ok = false, error = 'Unknown action.' })
    end
    if rateLimited(src) then
        return respond({ ok = false, error = 'Slow down — too many requests.' })
    end
    if not P.has(src, def.perm) then
        A.log(src, 'DENIED', { error = ('action %s requires %s'):format(action, def.perm) })
        return respond({ ok = false, error = ('Missing permission: %s'):format(def.perm) })
    end

    local ok, result = pcall(def.handler, src, payload or {})
    if not ok then
        respond({ ok = false, error = tostring(result) })
    else
        respond(result or { ok = false, error = 'Empty response.' })
    end
end)
