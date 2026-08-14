// NUI bridge. In game, this talks to client/main.lua; in a normal browser
// (vite dev / preview) it serves mock data so the UI can be developed and
// showcased without a FiveM server.

export const IN_GAME = navigator.userAgent.includes('CitizenFX');

const RESOURCE =
  (window.GetParentResourceName && window.GetParentResourceName()) || 'codysql';

export async function nui(cb, data) {
  if (!IN_GAME) return mock(cb, data);
  const res = await fetch(`https://${RESOURCE}/${cb}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data || {}),
  });
  return res.json();
}

export function api(action, payload) {
  return nui('api', { action, payload });
}

export const isNull = v => !!v && typeof v === 'object' && v.__cs_null === true;
export const isBin = v => !!v && typeof v === 'object' && typeof v.__cs_bin === 'number';
export const isLong = v => !!v && typeof v === 'object' && typeof v.__cs_long === 'number';
export const NULL_SENTINEL = { __cs_null: true };

/* ------------------------------------------------------------------------ */
/* Dev-preview mock data                                                    */
/* ------------------------------------------------------------------------ */

const NUL = { __cs_null: true };

const MOCK_TABLES = {
  players: {
    columns: [
      { name: 'id', type: 'int(11)', null: false, key: 'PRI', default: null, extra: 'auto_increment' },
      { name: 'citizenid', type: 'varchar(50)', null: false, key: 'UNI', default: null, extra: '' },
      { name: 'firstname', type: 'varchar(50)', null: true, key: '', default: null, extra: '' },
      { name: 'lastname', type: 'varchar(50)', null: true, key: '', default: null, extra: '' },
      { name: 'bank', type: 'int(11)', null: true, key: '', default: '0', extra: '' },
    ],
    rows: [
      [41, 'ABC12345', 'Marcus', 'Holloway', 15000],
      [42, 'DEF92831', 'Alex', 'Johnson', 4200],
      [43, 'GHI55210', 'Sam', 'Reed', 890],
    ],
  },
  player_vehicles: {
    columns: [
      { name: 'id', type: 'int(11)', null: false, key: 'PRI', default: null, extra: 'auto_increment' },
      { name: 'citizenid', type: 'varchar(50)', null: true, key: 'MUL', default: null, extra: '' },
      { name: 'plate', type: 'varchar(15)', null: false, key: 'UNI', default: null, extra: '' },
      { name: 'vehicle', type: 'varchar(50)', null: true, key: '', default: null, extra: '' },
      { name: 'garage', type: 'varchar(50)', null: true, key: 'MUL', default: 'pillboxgarage', extra: '' },
      { name: 'fuel', type: 'int(11)', null: true, key: '', default: '100', extra: '' },
      { name: 'mods', type: 'longtext', null: true, key: '', default: null, extra: '' },
    ],
    rows: [
      [478, 'ABC12345', 'HJK 429', 'sultan', 'pillboxgarage', 86, { __cs_long: 1421, preview: '{"engine":3,"turbo":true' }],
      [479, 'DEF92831', 'QRS 810', 'elegy2', NUL, 42, { __cs_long: 980, preview: '{"engine":1,"brakes":2' }],
      [482, 'ABC12345', 'ZXC 552', 't20', 'impound', 12, { __cs_long: 1204, preview: '{"engine":4,"suspension":2' }],
      [483, 'GHI55210', 'BNM 934', 'police3', 'pdgarage', 77, NUL],
    ],
  },
  jobs: {
    columns: [
      { name: 'name', type: 'varchar(50)', null: false, key: 'PRI', default: null, extra: '' },
      { name: 'label', type: 'varchar(50)', null: false, key: '', default: null, extra: '' },
      { name: 'whitelisted', type: 'tinyint(1)', null: false, key: '', default: '0', extra: '' },
    ],
    rows: [
      ['ambulance', 'EMS', 1], ['cardealer', 'Car Dealer', 0], ['dj', 'Radio DJ', 0],
      ['mechanic', 'Mechanic', 0], ['police', 'Police Officer', 1], ['unemployed', 'Unemployed', 0],
    ],
  },
};

const MOCK_JSON = JSON.stringify(
  { engine: 4, suspension: 2, turbo: true, colors: [12, 0], wheels: 7, extras: { 1: true, 5: false } },
  null, 2
);

async function mock(cb, data) {
  await new Promise(r => setTimeout(r, 120)); // simulate latency
  if (cb !== 'api') return { ok: true };
  const { action, payload = {} } = data;
  const t = MOCK_TABLES[payload.table];

  switch (action) {
    case 'init':
      return {
        ok: true,
        db: 'project_canvas',
        user: 'Admin',
        permissions: Object.fromEntries([
          'codysql.open', 'codysql.read', 'codysql.edit', 'codysql.insert', 'codysql.delete',
          'codysql.rawsql', 'codysql.structure', 'codysql.drop', 'codysql.sqlfiles',
          'codysql.audit', 'codysql.backup',
        ].map(p => [p, true])),
        tables: [
          { name: 'jobs', approxRows: 6, protected: false },
          { name: 'player_vehicles', approxRows: 4, protected: false },
          { name: 'players', approxRows: 3, protected: false },
          { name: 'codysql_audit', approxRows: 1204, protected: true },
        ],
        config: { pageSize: 100, maxPageSize: 500 },
      };
    case 'refreshSchema':
      return (await mock('api', { action: 'init' })).tables
        ? { ok: true, tables: (await mock('api', { action: 'init' })).tables }
        : { ok: false };
    case 'getTable':
      if (!t) return { ok: false, error: 'unknown table' };
      return {
        ok: true, name: payload.table, engine: 'InnoDB', collation: 'utf8mb4_general_ci',
        approxRows: t.rows.length, columns: t.columns,
        indexes: [{ name: 'PRIMARY', unique: true, columns: [t.columns[0].name] }],
        pk: t.columns.find(c => c.key === 'PRI')?.name || null,
        protected: false, editable: true,
      };
    case 'getRows':
      if (!t) return { ok: false, error: 'unknown table' };
      return { ok: true, rows: t.rows, total: t.rows.length, page: 1, pageSize: 100 };
    case 'getCell':
      return { ok: true, value: MOCK_JSON };
    case 'updateCell': case 'insertRow': case 'deleteRow':
    case 'renameTable': case 'emptyTable': case 'dropTable':
      return { ok: true, affected: 1, insertId: 484 };
    case 'rawQuery':
      return {
        ok: true, durationMs: 4,
        results: [{
          index: 1, ok: true, durationMs: 4, rowCount: 1, truncated: false,
          columns: ['id', 'plate', 'vehicle', 'garage'],
          rows: [[482, 'ZXC 552', 't20', 'impound']],
        }],
      };
    case 'getSqlFiles':
      return {
        ok: true,
        files: [
          { name: 'example-install.sql', size: 981, statementCount: 4, lastRun: null },
          { name: 'rs-radio.sql', size: 4230, statementCount: 8, lastRun: { ts: '2026-08-11 14:21:39', success: 1 } },
        ],
      };
    case 'getSqlFile':
      return {
        ok: true, name: payload.name,
        content: "-- example installer\nCREATE TABLE IF NOT EXISTS `rs_radio_stations` (\n  `id` INT AUTO_INCREMENT PRIMARY KEY,\n  `name` VARCHAR(64) NOT NULL\n);\n\nINSERT INTO `rs_radio_stations` (`name`) VALUES ('Los Santos FM');",
        statements: ['CREATE TABLE …', 'INSERT …'],
      };
    case 'runSqlFile':
      return {
        ok: true, transaction: !!payload.transaction, success: true, statementCount: 2, durationMs: 42,
        results: [
          { index: 1, preview: 'CREATE TABLE IF NOT EXISTS `rs_radio_stations` …', ok: true, durationMs: 8 },
          { index: 2, preview: "INSERT INTO `rs_radio_stations` (`name`) VALUES ('Los Santos FM')", ok: true, durationMs: 2, affected: 1 },
        ],
      };
    case 'getBackups':
      return {
        ok: true, running: false,
        backups: [{ file: 'codysql_manual_2026-08-11_220412.sql', createdAt: '2026-08-11 22:04:12', createdBy: 'Admin', db: 'project_canvas', tables: 14, rows: 71900, size: 50462310 }],
      };
    case 'createBackup':
      return { ok: true, file: 'codysql_manual_dev.sql', durationMs: 900 };
    case 'getAudit':
      return {
        ok: true, total: 3, page: 1, pageSize: 50,
        admins: [{ admin: 'Admin' }, { admin: 'Alex' }],
        rows: [
          { ts: '2026-08-13 14:32:18', admin: 'Admin', action: 'CELL_EDIT', tbl: 'player_vehicles', row_ref: 'id=482', col: 'garage', old_value: 'impound', new_value: 'legionsquare', success: 1 },
          { ts: '2026-08-13 14:28:04', admin: 'Alex', action: 'TABLE_DROP', tbl: 'test_inventory', success: 1 },
          { ts: '2026-08-13 14:25:51', admin: 'Alex', action: 'DENIED', error: 'action rawQuery requires codysql.rawsql', success: 0 },
        ],
      };
    default:
      return { ok: false, error: 'mock: unknown action ' + action };
  }
}
