CodySQL = CodySQL or {}
local U = {}
CodySQL.util = U

-- ---------------------------------------------------------------------------
-- Identifiers
-- ---------------------------------------------------------------------------

-- Identifiers we accept from any client, before checking them against the
-- discovered schema. Deliberately strict: letters, digits, underscore, dash.
function U.validIdent(name)
    return type(name) == 'string' and #name > 0 and #name <= 64
        and name:match('^[%w_%-]+$') ~= nil
end

function U.quoteIdent(name)
    return ('`%s`'):format(name)
end

-- ---------------------------------------------------------------------------
-- Value handling
-- ---------------------------------------------------------------------------

-- msgpack/JSON drop nil table members, so NULLs are sent as a sentinel object.
U.NULL = { __cs_null = true }

function U.isNullSentinel(v)
    return type(v) == 'table' and v.__cs_null == true
end

-- Values that would break JSON encoding (raw binary) become a marker object.
local function looksBinary(s)
    return s:find('[%z\1-\8\11\12\14-\31]') ~= nil
end

function U.encodeValue(v, maxLen)
    if v == nil then return U.NULL end
    if type(v) == 'string' then
        if looksBinary(v) then
            return { __cs_bin = #v }
        end
        if maxLen and #v > maxLen then
            return { __cs_long = #v, preview = v:sub(1, maxLen) }
        end
    end
    return v
end

-- Escape a value into a SQL literal (used only by the backup dumper, which
-- writes files; every live query path uses parameterized values instead).
function U.sqlLiteral(v)
    if v == nil then return 'NULL' end
    local t = type(v)
    if t == 'number' then return tostring(v) end
    if t == 'boolean' then return v and '1' or '0' end
    local s = tostring(v)
    s = s:gsub('\\', '\\\\'):gsub("'", "\\'"):gsub('\n', '\\n')
         :gsub('\r', '\\r'):gsub('\0', '\\0'):gsub('\26', '\\Z')
    return "'" .. s .. "'"
end

-- ---------------------------------------------------------------------------
-- SQL statement splitter
-- Splits a script into individual statements, respecting single/double/backtick
-- quotes, escapes, `--`, `#` and `/* */` comments, and semicolons in strings.
-- (DELIMITER blocks / stored procedures are out of scope for v1 — documented.)
-- ---------------------------------------------------------------------------

function U.splitStatements(script)
    local statements = {}
    local buf = {}
    local i, len = 1, #script
    local state = nil -- nil | "'" | '"' | '`' | 'line' | 'block'

    while i <= len do
        local c = script:sub(i, i)
        local nc = script:sub(i + 1, i + 1)

        if state == 'line' then
            if c == '\n' then state = nil end
            i += 1
        elseif state == 'block' then
            if c == '*' and nc == '/' then state = nil; i += 2 else i += 1 end
        elseif state == "'" or state == '"' or state == '`' then
            buf[#buf + 1] = c
            if c == '\\' and state ~= '`' then
                buf[#buf + 1] = nc
                i += 2
            else
                if c == state then state = nil end
                i += 1
            end
        else
            if c == '-' and nc == '-' then
                state = 'line'; i += 2
            elseif c == '#' then
                state = 'line'; i += 1
            elseif c == '/' and nc == '*' then
                state = 'block'; i += 2
            elseif c == "'" or c == '"' or c == '`' then
                state = c
                buf[#buf + 1] = c
                i += 1
            elseif c == ';' then
                local stmt = table.concat(buf):match('^%s*(.-)%s*$')
                if #stmt > 0 then statements[#statements + 1] = stmt end
                buf = {}
                i += 1
            else
                buf[#buf + 1] = c
                i += 1
            end
        end
    end

    local tail = table.concat(buf):match('^%s*(.-)%s*$')
    if #tail > 0 then statements[#statements + 1] = tail end
    return statements
end

-- First keyword of a statement, uppercased ("CREATE TABLE" style two-worders
-- are matched by callers with prefix checks against the full upper string).
function U.statementUpper(stmt)
    return stmt:upper():match('^%s*(.-)%s*$')
end

-- ---------------------------------------------------------------------------
-- Misc
-- ---------------------------------------------------------------------------

function U.now()
    return os.date('%Y-%m-%d_%H%M%S')
end

function U.trim(s)
    return (s or ''):match('^%s*(.-)%s*$')
end
