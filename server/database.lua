CodySQL = CodySQL or {}
local DB = {}
CodySQL.db = DB

local U = CodySQL.util
local A = CodySQL.audit

-- Discovered schema cache: table name -> { columns, indexes, pk, rowCount, ... }
local schema = { db = nil, tables = {}, order = {} }

local function isProtected(tbl)
    if tbl == 'codysql_audit' then return true end
    for _, name in ipairs(Config.ProtectedTables or {}) do
        if name == tbl then return true end
    end
    return false
end

-- ---------------------------------------------------------------------------
-- Discovery
-- ---------------------------------------------------------------------------

function DB.refresh()
    schema.db = MySQL.scalar.await('SELECT DATABASE()')
    schema.tables = {}
    schema.order = {}

    local status = MySQL.query.await('SHOW TABLE STATUS') or {}
    for _, t in ipairs(status) do
        local name = t.Name
        schema.tables[name] = {
            name = name,
            engine = t.Engine,
            collation = t.Collation,
            approxRows = tonumber(t.Rows) or 0,
            protected = isProtected(name),
        }
        schema.order[#schema.order + 1] = name
    end
    table.sort(schema.order)
end

local function requireTable(tbl)
    if not U.validIdent(tbl) or not schema.tables[tbl] then
        error(('unknown table %q'):format(tostring(tbl)), 0)
    end
    return schema.tables[tbl]
end

-- Loads (and caches) column + index detail for one table.
local function tableDetail(tbl)
    local info = requireTable(tbl)
    if info.columns then return info end

    local cols = MySQL.query.await(('SHOW FULL COLUMNS FROM `%s`'):format(tbl)) or {}
    info.columns = {}
    info.colByName = {}
    info.pk = nil
    for _, c in ipairs(cols) do
        local col = {
            name = c.Field,
            type = c.Type,
            null = c.Null == 'YES',
            key = c.Key,             -- 'PRI' | 'UNI' | 'MUL' | ''
            default = c.Default,
            extra = c.Extra,         -- e.g. auto_increment
            comment = c.Comment,
            collation = c.Collation,
        }
        info.columns[#info.columns + 1] = col
        info.colByName[col.name] = col
        if c.Key == 'PRI' and not info.pk then info.pk = c.Field end
    end

    local idx = MySQL.query.await(('SHOW INDEX FROM `%s`'):format(tbl)) or {}
    local indexes, byName = {}, {}
    for _, r in ipairs(idx) do
        local e = byName[r.Key_name]
        if not e then
            e = { name = r.Key_name, unique = r.Non_unique == 0, columns = {} }
            byName[r.Key_name] = e
            indexes[#indexes + 1] = e
        end
        e.columns[#e.columns + 1] = r.Column_name
    end
    info.indexes = indexes
    return info
end

local function requireColumn(info, colName)
    if not info.colByName or not info.colByName[colName] then
        error(('unknown column %q on table %q'):format(tostring(colName), info.name), 0)
    end
    return info.colByName[colName]
end

-- ---------------------------------------------------------------------------
-- Public: overview + table detail
-- ---------------------------------------------------------------------------

function DB.overview()
    local list = {}
    for _, name in ipairs(schema.order) do
        local t = schema.tables[name]
        list[#list + 1] = {
            name = t.name,
            approxRows = t.approxRows,
            protected = t.protected,
        }
    end
    return { db = schema.db, tables = list }
end

function DB.getTable(payload)
    local info = tableDetail(payload.table)
    return {
        ok = true,
        name = info.name,
        engine = info.engine,
        collation = info.collation,
        approxRows = info.approxRows,
        columns = info.columns,
        indexes = info.indexes,
        pk = info.pk,
        protected = info.protected,
        editable = info.pk ~= nil and not info.protected,
    }
end

-- ---------------------------------------------------------------------------
-- Rows (paged browse)
-- ---------------------------------------------------------------------------

function DB.getRows(payload)
    local info = tableDetail(payload.table)
    if info.protected then
        return { ok = false, error = 'This table is protected.' }
    end

    local size = math.min(tonumber(payload.pageSize) or Config.TablePageSize, Config.MaxPageSize)
    local page = math.max(1, tonumber(payload.page) or 1)

    local where, params = {}, {}
    if payload.search and payload.search ~= '' then
        local parts = {}
        for _, col in ipairs(info.columns) do
            parts[#parts + 1] = ('CAST(`%s` AS CHAR)'):format(col.name)
        end
        where[#where + 1] = ('CONCAT_WS(0x1f, %s) LIKE ?'):format(table.concat(parts, ', '))
        params[#params + 1] = '%' .. payload.search .. '%'
    end
    if type(payload.filters) == 'table' then
        for _, f in ipairs(payload.filters) do
            local col = requireColumn(info, f.column)
            where[#where + 1] = ('CAST(`%s` AS CHAR) LIKE ?'):format(col.name)
            params[#params + 1] = '%' .. tostring(f.value) .. '%'
        end
    end
    local whereSql = #where > 0 and (' WHERE ' .. table.concat(where, ' AND ')) or ''

    local orderSql = ''
    if payload.sortColumn and payload.sortColumn ~= '' then
        local col = requireColumn(info, payload.sortColumn)
        local dir = payload.sortDir == 'desc' and 'DESC' or 'ASC'
        orderSql = (' ORDER BY `%s` %s'):format(col.name, dir)
    elseif info.pk then
        orderSql = (' ORDER BY `%s` ASC'):format(info.pk)
    end

    local total = MySQL.scalar.await(
        ('SELECT COUNT(*) FROM `%s`%s'):format(info.name, whereSql), params
    )

    params[#params + 1] = size
    params[#params + 1] = (page - 1) * size
    local raw = MySQL.query.await(
        ('SELECT * FROM `%s`%s%s LIMIT ? OFFSET ?'):format(info.name, whereSql, orderSql),
        params
    ) or {}

    -- Rows go to the NUI as arrays aligned with the column list, with NULL /
    -- binary / oversized values wrapped in sentinel objects.
    local rows = {}
    for i, r in ipairs(raw) do
        local out = {}
        for j, col in ipairs(info.columns) do
            out[j] = U.encodeValue(r[col.name], Config.MaxCellPreview)
        end
        rows[i] = out
    end

    return { ok = true, rows = rows, total = total, page = page, pageSize = size }
end

-- Full, untruncated value of a single cell (for the JSON / long-text editor).
function DB.getCell(payload)
    local info = tableDetail(payload.table)
    if not info.pk then return { ok = false, error = 'Table has no primary key.' } end
    local col = requireColumn(info, payload.column)
    local v = MySQL.scalar.await(
        ('SELECT `%s` FROM `%s` WHERE `%s` = ? LIMIT 1'):format(col.name, info.name, info.pk),
        { payload.pkValue }
    )
    return { ok = true, value = U.encodeValue(v, nil) }
end

-- ---------------------------------------------------------------------------
-- Writes
-- ---------------------------------------------------------------------------

local function writable(info)
    if info.protected then return false, 'This table is protected.' end
    if not info.pk then return false, 'Table has no primary key; editing is disabled.' end
    return true
end

function DB.updateCell(src, payload)
    local info = tableDetail(payload.table)
    local ok, err = writable(info)
    if not ok then return { ok = false, error = err } end
    local col = requireColumn(info, payload.column)

    local oldValue = MySQL.scalar.await(
        ('SELECT `%s` FROM `%s` WHERE `%s` = ? LIMIT 1'):format(col.name, info.name, info.pk),
        { payload.pkValue }
    )

    local newValue = U.isNullSentinel(payload.value) and nil or payload.value
    local started = GetGameTimer()
    local affected
    if newValue == nil then
        affected = MySQL.update.await(
            ('UPDATE `%s` SET `%s` = NULL WHERE `%s` = ? LIMIT 1'):format(info.name, col.name, info.pk),
            { payload.pkValue }
        )
    else
        affected = MySQL.update.await(
            ('UPDATE `%s` SET `%s` = ? WHERE `%s` = ? LIMIT 1'):format(info.name, col.name, info.pk),
            { newValue, payload.pkValue }
        )
    end

    A.log(src, 'CELL_EDIT', {
        tbl = info.name,
        rowRef = ('%s=%s'):format(info.pk, tostring(payload.pkValue)),
        col = col.name,
        oldValue = oldValue, newValue = newValue,
        affected = affected, durationMs = GetGameTimer() - started,
    })
    return { ok = true, affected = affected }
end

function DB.insertRow(src, payload)
    local info = tableDetail(payload.table)
    if info.protected then return { ok = false, error = 'This table is protected.' } end
    if type(payload.values) ~= 'table' then return { ok = false, error = 'No values.' } end

    local cols, marks, params = {}, {}, {}
    for _, entry in ipairs(payload.values) do
        local col = requireColumn(info, entry.column)
        cols[#cols + 1] = ('`%s`'):format(col.name)
        if U.isNullSentinel(entry.value) then
            marks[#marks + 1] = 'NULL'
        else
            marks[#marks + 1] = '?'
            params[#params + 1] = entry.value
        end
    end
    if #cols == 0 then return { ok = false, error = 'No values.' } end

    local sql = ('INSERT INTO `%s` (%s) VALUES (%s)'):format(
        info.name, table.concat(cols, ', '), table.concat(marks, ', '))
    local started = GetGameTimer()
    local insertId = MySQL.insert.await(sql, params)

    A.log(src, 'ROW_INSERT', {
        tbl = info.name,
        rowRef = insertId and tostring(insertId) or nil,
        sql = sql, affected = 1, durationMs = GetGameTimer() - started,
    })
    return { ok = true, insertId = insertId }
end

function DB.deleteRow(src, payload)
    local info = tableDetail(payload.table)
    local ok, err = writable(info)
    if not ok then return { ok = false, error = err } end

    -- Capture the row for the audit log before it disappears.
    local row = MySQL.single.await(
        ('SELECT * FROM `%s` WHERE `%s` = ? LIMIT 1'):format(info.name, info.pk),
        { payload.pkValue }
    )

    local started = GetGameTimer()
    local affected = MySQL.update.await(
        ('DELETE FROM `%s` WHERE `%s` = ? LIMIT 1'):format(info.name, info.pk),
        { payload.pkValue }
    )

    A.log(src, 'ROW_DELETE', {
        tbl = info.name,
        rowRef = ('%s=%s'):format(info.pk, tostring(payload.pkValue)),
        oldValue = row and json.encode(row) or nil,
        affected = affected, durationMs = GetGameTimer() - started,
    })
    return { ok = true, affected = affected }
end

-- ---------------------------------------------------------------------------
-- Structure operations (v1: rename / empty / drop)
-- ---------------------------------------------------------------------------

function DB.renameTable(src, payload)
    local info = tableDetail(payload.table)
    if info.protected then return { ok = false, error = 'This table is protected.' } end
    local newName = payload.newName
    if not U.validIdent(newName) then return { ok = false, error = 'Invalid new name.' } end
    if schema.tables[newName] then return { ok = false, error = 'A table with that name already exists.' } end

    MySQL.query.await(('RENAME TABLE `%s` TO `%s`'):format(info.name, newName))
    A.log(src, 'TABLE_RENAME', { tbl = info.name, newValue = newName })
    DB.refresh()
    return { ok = true }
end

function DB.emptyTable(src, payload)
    local info = tableDetail(payload.table)
    if info.protected then return { ok = false, error = 'This table is protected.' } end
    if U.trim(payload.confirmName or ''):lower() ~= info.name:lower() then
        return { ok = false, error = 'Confirmation text did not match.' }
    end
    local before = MySQL.scalar.await(('SELECT COUNT(*) FROM `%s`'):format(info.name))
    MySQL.query.await(('TRUNCATE TABLE `%s`'):format(info.name))
    A.log(src, 'TABLE_EMPTY', { tbl = info.name, affected = before })
    return { ok = true, affected = before }
end

function DB.dropTable(src, payload)
    local info = tableDetail(payload.table)
    if info.protected then return { ok = false, error = 'This table is protected.' } end
    if U.trim(payload.confirmName or ''):lower() ~= info.name:lower() then
        return { ok = false, error = 'Confirmation text did not match.' }
    end
    local rows = MySQL.scalar.await(('SELECT COUNT(*) FROM `%s`'):format(info.name))
    MySQL.query.await(('DROP TABLE `%s`'):format(info.name))
    A.log(src, 'TABLE_DROP', { tbl = info.name, affected = rows })
    DB.refresh()
    return { ok = true }
end

-- ---------------------------------------------------------------------------
-- Raw SQL
-- ---------------------------------------------------------------------------

function DB.rawQuery(src, payload)
    local script = tostring(payload.sql or '')
    if U.trim(script) == '' then return { ok = false, error = 'Empty query.' } end

    local statements = U.splitStatements(script)
    if #statements == 0 then return { ok = false, error = 'Empty query.' } end
    if #statements > 25 then return { ok = false, error = 'Too many statements (max 25 per run).' } end

    for _, stmt in ipairs(statements) do
        local blocked = U.blockedStatement(stmt)
        if blocked then
            A.log(src, 'SQL_BLOCKED', { sql = stmt, success = false, error = 'blocked: ' .. blocked })
            return { ok = false, error = ('%s statements are blocked in CodySQL.'):format(blocked) }
        end
    end

    local results = {}
    local started = GetGameTimer()
    for i, stmt in ipairs(statements) do
        local t0 = GetGameTimer()
        local okRun, res = pcall(function() return MySQL.query.await(stmt) end)
        if not okRun then
            results[#results + 1] = { index = i, ok = false, error = tostring(res), sql = stmt }
            A.log(src, 'SQL_RAW', {
                sql = stmt, success = false, error = tostring(res),
                durationMs = GetGameTimer() - t0,
            })
            return { ok = true, results = results, durationMs = GetGameTimer() - started }
        end

        local entry = { index = i, ok = true, durationMs = GetGameTimer() - t0, sql = stmt }
        if type(res) == 'table' and res[1] ~= nil then
            -- Result set: cap rows, encode as columns + row arrays
            local columns, rows = {}, {}
            for k in pairs(res[1]) do columns[#columns + 1] = k end
            table.sort(columns)
            local cap = math.min(#res, Config.MaxQueryRows)
            for r = 1, cap do
                local out = {}
                for c, colName in ipairs(columns) do
                    out[c] = U.encodeValue(res[r][colName], Config.MaxCellPreview)
                end
                rows[r] = out
            end
            entry.columns = columns
            entry.rows = rows
            entry.rowCount = #res
            entry.truncated = #res > cap
        elseif type(res) == 'table' then
            entry.affected = res.affectedRows
            entry.insertId = res.insertId
            entry.rowCount = 0
        end
        results[#results + 1] = entry

        A.log(src, 'SQL_RAW', {
            sql = stmt, affected = entry.affected,
            durationMs = entry.durationMs,
        })
    end

    -- Structure may have changed (CREATE/DROP/ALTER); refresh cheaply
    local upper = script:upper()
    if upper:find('CREATE%s') or upper:find('DROP%s') or upper:find('ALTER%s') or upper:find('RENAME%s') then
        DB.refresh()
    end

    return { ok = true, results = results, durationMs = GetGameTimer() - started }
end
