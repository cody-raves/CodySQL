CodySQL = CodySQL or {}
local B = {}
CodySQL.backups = B

local U = CodySQL.util
local A = CodySQL.audit

local running = false

local function backupDir()
    return GetResourcePath(GetCurrentResourceName()) .. '/backups/manual'
end

local function indexPath()
    return backupDir() .. '/index.json'
end

-- We maintain our own index.json rather than shelling out for directory
-- listings — CodySQL creates every backup, so it can record every backup.
local function readIndex()
    local f = io.open(indexPath(), 'r')
    if not f then return {} end
    local raw = f:read('*a')
    f:close()
    local ok, data = pcall(json.decode, raw)
    return (ok and type(data) == 'table') and data or {}
end

local function writeIndex(entries)
    local f = io.open(indexPath(), 'w')
    if not f then return false end
    f:write(json.encode(entries))
    f:close()
    return true
end

function B.list()
    return { ok = true, running = running, backups = readIndex() }
end

-- ---------------------------------------------------------------------------
-- Dump
-- Streams straight to disk in chunks so large databases never have to fit
-- in memory: SHOW CREATE TABLE per table, then batched INSERTs.
-- ---------------------------------------------------------------------------

function B.create(src, _payload)
    if not Config.Backups.allowManual then
        return { ok = false, error = 'Manual backups are disabled in config.' }
    end
    if running then
        return { ok = false, error = 'A backup is already running.' }
    end
    running = true

    local started = GetGameTimer()
    local dbName = MySQL.scalar.await('SELECT DATABASE()')
    local filename = ('codysql_manual_%s.sql'):format(U.now())
    local path = backupDir() .. '/' .. filename

    local ok, err = pcall(function()
        local f = assert(io.open(path, 'w'), 'could not open backup file for writing — does backups/manual/ exist?')
        local tables = MySQL.query.await('SHOW TABLES') or {}
        local tableNames = {}
        for _, row in ipairs(tables) do
            for _, v in pairs(row) do tableNames[#tableNames + 1] = v end
        end
        table.sort(tableNames)

        f:write(('-- CodySQL backup of `%s`\n-- Created %s\n\nSET FOREIGN_KEY_CHECKS = 0;\n\n')
            :format(dbName, os.date('%Y-%m-%d %H:%M:%S')))

        local totalRows = 0
        for _, tbl in ipairs(tableNames) do
            local createRow = MySQL.single.await(('SHOW CREATE TABLE `%s`'):format(tbl))
            local createSql = createRow and (createRow['Create Table'] or createRow['Create View'])
            if createSql then
                f:write(('DROP TABLE IF EXISTS `%s`;\n%s;\n\n'):format(tbl, createSql))

                -- Column order for stable INSERTs
                local cols = MySQL.query.await(('SHOW COLUMNS FROM `%s`'):format(tbl)) or {}
                local colNames = {}
                for _, c in ipairs(cols) do colNames[#colNames + 1] = c.Field end
                local colList = '`' .. table.concat(colNames, '`, `') .. '`'

                local offset = 0
                local chunk = Config.Backups.chunkSize or 500
                while true do
                    local rows = MySQL.query.await(
                        ('SELECT * FROM `%s` LIMIT ? OFFSET ?'):format(tbl), { chunk, offset })
                    if not rows or #rows == 0 then break end

                    local values = {}
                    for i, r in ipairs(rows) do
                        local vals = {}
                        for j, colName in ipairs(colNames) do
                            vals[j] = U.sqlLiteral(r[colName])
                        end
                        values[i] = '(' .. table.concat(vals, ', ') .. ')'
                    end
                    f:write(('INSERT INTO `%s` (%s) VALUES\n%s;\n')
                        :format(tbl, colList, table.concat(values, ',\n')))

                    totalRows = totalRows + #rows
                    offset = offset + #rows
                    if #rows < chunk then break end
                    Wait(0) -- yield so a big dump never starves the server tick
                end
                f:write('\n')
            end
        end

        f:write('SET FOREIGN_KEY_CHECKS = 1;\n')
        f:close()

        -- Verify the file landed and is non-trivial
        local check = assert(io.open(path, 'r'), 'backup verification failed: file missing')
        local size = check:seek('end')
        check:close()
        assert(size and size > 0, 'backup verification failed: empty file')

        local who = src and CodySQL.perms.identity(src).name or 'System'
        local index = readIndex()
        table.insert(index, 1, {
            file = filename,
            createdAt = os.date('%Y-%m-%d %H:%M:%S'),
            createdBy = who,
            db = dbName,
            tables = #tableNames,
            rows = totalRows,
            size = size,
        })
        writeIndex(index)

        A.log(src, 'BACKUP_CREATE', {
            file = filename, affected = totalRows,
            durationMs = GetGameTimer() - started,
        })
    end)

    running = false
    if not ok then
        A.log(src, 'BACKUP_CREATE', {
            file = filename, success = false, error = tostring(err),
            durationMs = GetGameTimer() - started,
        })
        return { ok = false, error = tostring(err) }
    end

    return { ok = true, file = filename, durationMs = GetGameTimer() - started }
end
