CodySQL = CodySQL or {}
local A = {}
CodySQL.audit = A

local U = CodySQL.util
local MAX_VALUE = 4096 -- stored old/new values are truncated to this

local SCHEMA = [[
CREATE TABLE IF NOT EXISTS `codysql_audit` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `admin` VARCHAR(100) NULL,
    `license` VARCHAR(120) NULL,
    `discord` VARCHAR(120) NULL,
    `action` VARCHAR(32) NOT NULL,
    `tbl` VARCHAR(64) NULL,
    `row_ref` VARCHAR(190) NULL,
    `col` VARCHAR(64) NULL,
    `old_value` TEXT NULL,
    `new_value` TEXT NULL,
    `sql_text` MEDIUMTEXT NULL,
    `file` VARCHAR(190) NULL,
    `affected` INT NULL,
    `success` TINYINT(1) NOT NULL DEFAULT 1,
    `error` TEXT NULL,
    `duration_ms` INT NULL,
    PRIMARY KEY (`id`),
    KEY `ts` (`ts`),
    KEY `action` (`action`),
    KEY `admin` (`admin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
]]

function A.init()
    if not Config.Audit.enabled then return end
    MySQL.query.await(SCHEMA)
    local days = Config.Audit.retentionDays or 0
    if days > 0 then
        MySQL.query.await(
            'DELETE FROM `codysql_audit` WHERE `ts` < (NOW() - INTERVAL ? DAY)',
            { days }
        )
    end
end

local function clip(v)
    if v == nil then return nil end
    local s = type(v) == 'string' and v or tostring(v)
    if #s > MAX_VALUE then s = s:sub(1, MAX_VALUE) .. '…[truncated]' end
    return s
end

-- Fire-and-forget audit write. `entry` fields mirror the table columns.
function A.log(src, action, entry)
    if not Config.Audit.enabled then return end
    entry = entry or {}
    local who = src and CodySQL.perms.identity(src)
        or { name = 'System', license = nil, discord = nil }
    MySQL.insert(
        [[INSERT INTO `codysql_audit`
            (`admin`,`license`,`discord`,`action`,`tbl`,`row_ref`,`col`,
             `old_value`,`new_value`,`sql_text`,`file`,`affected`,`success`,`error`,`duration_ms`)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)]],
        {
            who.name, who.license, who.discord, action,
            entry.tbl, entry.rowRef, entry.col,
            clip(entry.oldValue), clip(entry.newValue),
            clip(entry.sql), entry.file, entry.affected,
            entry.success == false and 0 or 1,
            clip(entry.error), entry.durationMs,
        }
    )
end

-- Paged, filtered read for the Audit Log tab.
function A.fetch(payload)
    local where, params = {}, {}
    if payload.admin and payload.admin ~= '' then
        where[#where + 1] = '`admin` = ?'
        params[#params + 1] = payload.admin
    end
    if payload.action and payload.action ~= '' then
        where[#where + 1] = '`action` = ?'
        params[#params + 1] = payload.action
    end
    if payload.search and payload.search ~= '' then
        where[#where + 1] =
            "CONCAT_WS(' ', `tbl`,`row_ref`,`col`,`old_value`,`new_value`,`sql_text`,`file`,`error`) LIKE ?"
        params[#params + 1] = '%' .. payload.search .. '%'
    end
    if payload.days and tonumber(payload.days) then
        where[#where + 1] = '`ts` >= (NOW() - INTERVAL ? DAY)'
        params[#params + 1] = tonumber(payload.days)
    end

    local whereSql = #where > 0 and (' WHERE ' .. table.concat(where, ' AND ')) or ''
    local total = MySQL.scalar.await('SELECT COUNT(*) FROM `codysql_audit`' .. whereSql, params)

    local page = math.max(1, tonumber(payload.page) or 1)
    local size = 50
    params[#params + 1] = size
    params[#params + 1] = (page - 1) * size

    local rows = MySQL.query.await(
        'SELECT * FROM `codysql_audit`' .. whereSql .. ' ORDER BY `id` DESC LIMIT ? OFFSET ?',
        params
    )

    -- Distinct admin names for the filter dropdown
    local admins = MySQL.query.await(
        'SELECT DISTINCT `admin` FROM `codysql_audit` ORDER BY `admin` LIMIT 100'
    )

    return { ok = true, rows = rows, total = total, page = page, pageSize = size, admins = admins }
end
