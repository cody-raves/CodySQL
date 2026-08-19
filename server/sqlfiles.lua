CodySQL = CodySQL or {}
local S = {}
CodySQL.sqlfiles = S

local U = CodySQL.util
local A = CodySQL.audit

-- ---------------------------------------------------------------------------
-- Listing
-- Uses the sandboxed io.readdir() resource-directory API with a resource mount
-- path (@codysql/sql), so no OS commands are ever executed. If readdir is
-- unavailable, create sql/_index.txt with one filename per line as a fallback.
-- ---------------------------------------------------------------------------

local function listDir()
    local names = {}
    local resource = GetCurrentResourceName()

    -- Guard the whole read: io.readdir is missing on older builds, and a failed
    -- iteration must fall through to _index.txt rather than error the request.
    pcall(function()
        local dir = io.readdir(('@%s/sql'):format(resource))
        if not dir then return end
        for entry in dir:lines() do
            names[#names + 1] = U.trim(entry)
        end
        dir:close()
    end)

    if #names == 0 then
        -- Fallback: manifest file maintained by hand
        local index = LoadResourceFile(resource, 'sql/_index.txt')
        if index then
            for line in index:gmatch('[^\r\n]+') do
                names[#names + 1] = U.trim(line)
            end
        end
    end

    local out = {}
    for _, name in ipairs(names) do
        if name:lower():sub(-4) == '.sql' and U.validIdent(name:sub(1, -5):gsub('%.', '_')) ~= nil then
            -- keep it strict: letters/digits/underscore/dash/dot only
            if name:match('^[%w_%-%.]+$') then out[#out + 1] = name end
        end
    end
    table.sort(out)
    return out
end

local function readFile(name)
    if type(name) ~= 'string' or not name:match('^[%w_%-%.]+%.sql$') then
        return nil, 'Invalid filename.'
    end
    local content = LoadResourceFile(GetCurrentResourceName(), 'sql/' .. name)
    if not content then return nil, 'File not found.' end
    return content
end

function S.list()
    local files = {}
    for _, name in ipairs(listDir()) do
        local content = readFile(name)
        if content then
            local statements = U.splitStatements(content)
            local lastRun = MySQL.single.await(
                'SELECT `ts`,`success`,`affected` FROM `codysql_audit` WHERE `action` = ? AND `file` = ? ORDER BY `id` DESC LIMIT 1',
                { 'SQL_FILE', name }
            )
            files[#files + 1] = {
                name = name,
                size = #content,
                statementCount = #statements,
                lastRun = lastRun,
            }
        end
    end
    return { ok = true, files = files }
end

function S.get(payload)
    local content, err = readFile(payload.name)
    if not content then return { ok = false, error = err } end
    return {
        ok = true,
        name = payload.name,
        content = content,
        statements = U.splitStatements(content),
    }
end

-- ---------------------------------------------------------------------------
-- Execution
-- ---------------------------------------------------------------------------

function S.run(src, payload)
    local content, err = readFile(payload.name)
    if not content then return { ok = false, error = err } end

    local statements = U.splitStatements(content)
    if #statements == 0 then return { ok = false, error = 'File contains no statements.' } end

    -- Same blocked-statement policy as the raw editor: a privilege statement is
    -- refused whether it's typed by hand or shipped inside a .sql file.
    for i, stmt in ipairs(statements) do
        local blocked = U.blockedStatement(stmt)
        if blocked then
            A.log(src, 'SQL_BLOCKED', {
                file = payload.name, sql = stmt, success = false,
                error = ('blocked: %s (statement %d)'):format(blocked, i),
            })
            return {
                ok = false,
                error = ('%s statements are blocked in CodySQL (statement %d of %s).')
                    :format(blocked, i, payload.name),
            }
        end
    end

    local started = GetGameTimer()

    if payload.transaction then
        -- All-or-nothing via oxmysql's transaction API (single connection).
        local queries = {}
        for i, stmt in ipairs(statements) do queries[i] = { query = stmt } end
        local okTx = MySQL.transaction.await(queries)
        local duration = GetGameTimer() - started
        A.log(src, 'SQL_FILE', {
            file = payload.name, sql = content,
            success = okTx and true or false,
            error = okTx and nil or 'transaction rolled back',
            affected = #statements, durationMs = duration,
        })
        return {
            ok = true, transaction = true, success = okTx and true or false,
            statementCount = #statements, durationMs = duration,
        }
    end

    -- Sequential mode: run each statement, report per-statement results,
    -- stop at the first failure.
    local results = {}
    local failed = false
    for i, stmt in ipairs(statements) do
        local t0 = GetGameTimer()
        local okRun, res = pcall(function() return MySQL.query.await(stmt) end)
        local entry = {
            index = i,
            preview = stmt:sub(1, 120),
            ok = okRun,
            durationMs = GetGameTimer() - t0,
        }
        if okRun and type(res) == 'table' and res.affectedRows then
            entry.affected = res.affectedRows
        elseif not okRun then
            entry.error = tostring(res)
            failed = true
        end
        results[#results + 1] = entry
        if failed then break end
    end

    local duration = GetGameTimer() - started
    A.log(src, 'SQL_FILE', {
        file = payload.name, sql = content,
        success = not failed, error = failed and results[#results].error or nil,
        affected = #results, durationMs = duration,
    })

    CodySQL.db.refresh()
    return {
        ok = true, transaction = false, success = not failed,
        results = results, statementCount = #statements, durationMs = duration,
    }
end
