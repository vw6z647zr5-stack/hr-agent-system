#!/usr/bin/env node

const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const env = loadEnv(join(root, '.env'));
const args = process.argv.slice(2);
const command = parseCommand(args);
const migrationsDir = join(root, 'infra', 'postgres', 'migrations');

const schemaMigrationsSql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  name text NOT NULL,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);`.trim();

function loadEnv(path) {
  const values = {};
  if (!existsSync(path)) {
    return values;
  }

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    values[key] = value;
  }

  return values;
}

function parseCommand(argv) {
  const positional = argv.find((item) => !item.startsWith('--'));
  if (['status', 'up', 'baseline', 'dry-run'].includes(positional)) {
    return positional;
  }

  if (argv.includes('--up')) {
    return 'up';
  }

  if (argv.includes('--baseline')) {
    return 'baseline';
  }

  if (argv.includes('--dry-run')) {
    return 'dry-run';
  }

  return 'status';
}

function requireEnv(name) {
  const value = process.env[name] || env[name];
  if (!value) {
    throw new Error(`${name} 需要在 .env 中配置`);
  }

  return value;
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function runPsql(script) {
  const result = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      requireEnv('POSTGRES_USER'),
      '-d',
      requireEnv('POSTGRES_DB'),
      '-v',
      'ON_ERROR_STOP=1',
      '-X',
      '-qAt',
      '-F',
      '\t',
      '-f',
      '-',
    ],
    {
      cwd: root,
      input: script,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 50 * 1024 * 1024,
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const output = (result.stderr || result.stdout || '').trim();
    throw new Error(formatPsqlError(output || `psql 退出码 ${result.status}`));
  }

  return result.stdout || '';
}

function formatPsqlError(output) {
  if (/docker API|dockerDesktopLinuxEngine|daemon is running|Cannot connect to the Docker daemon/i.test(output)) {
    return 'Docker Desktop 未启动或当前终端无法访问 Docker。请先启动 Docker Desktop，并确认 `docker compose up postgres -d` 已运行。';
  }

  if (/service "postgres" is not running|No such container|is not running/i.test(output)) {
    return 'PostgreSQL 容器未运行。请先执行 `docker compose up postgres -d`，再运行迁移命令。';
  }

  return output;
}

function loadMigrations() {
  if (!existsSync(migrationsDir)) {
    throw new Error(`未找到迁移目录：${migrationsDir}`);
  }

  const migrations = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => {
      const match = entry.name.match(/^(\d+)-(.+)\.sql$/);
      if (!match) {
        throw new Error(`迁移文件命名不合法：${entry.name}`);
      }

      const filePath = join(migrationsDir, entry.name);
      const sql = readFileSync(filePath, 'utf8');
      return {
        version: match[1],
        name: entry.name,
        filePath,
        sql,
        checksum: sha256(sql),
        hasOwnTransaction: /\bBEGIN\s*;/i.test(sql) || /\bCOMMIT\s*;/i.test(sql),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));

  if (migrations.length === 0) {
    throw new Error(`迁移目录为空：${migrationsDir}`);
  }

  const seenVersions = new Set();
  for (const migration of migrations) {
    if (seenVersions.has(migration.version)) {
      throw new Error(`发现重复的迁移版本：${migration.version}`);
    }
    seenVersions.add(migration.version);
  }

  return migrations;
}

function migrationTableExists() {
  const output = runPsql(`
SELECT CASE WHEN to_regclass('public.schema_migrations') IS NULL THEN 'false' ELSE 'true' END;`).trim();
  return output === 'true';
}

function queryAppliedMigrations() {
  const output = runPsql(`
SELECT version, name, checksum, to_char(applied_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
FROM schema_migrations
ORDER BY version;`).trim();

  if (!output) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((line) => {
      const [version, name, checksum, appliedAt] = line.split('\t');
      return { version, name, checksum, appliedAt };
    });
}

function buildStatus(migrations, applied) {
  const appliedByVersion = new Map(applied.map((item) => [item.version, item]));
  const migrationByVersion = new Map(migrations.map((item) => [item.version, item]));
  const rows = [];
  let appliedCount = 0;
  let pendingCount = 0;
  let mismatchCount = 0;
  let orphanCount = 0;

  for (const migration of migrations) {
    const record = appliedByVersion.get(migration.version);
    if (!record) {
      pendingCount += 1;
      rows.push({ level: '待执行', name: migration.name, detail: '数据库中尚无记录' });
      continue;
    }

    if (record.checksum !== migration.checksum) {
      mismatchCount += 1;
      rows.push({
        level: '不一致',
        name: migration.name,
        detail: `数据库=${record.checksum.slice(0, 8)}，文件=${migration.checksum.slice(0, 8)}`,
      });
      continue;
    }

    appliedCount += 1;
    rows.push({ level: '已应用', name: migration.name, detail: `applied_at=${record.appliedAt}` });
  }

  for (const record of applied) {
    if (!migrationByVersion.has(record.version)) {
      orphanCount += 1;
      rows.push({
        level: '孤立',
        name: record.name || record.version,
        detail: '数据库中存在，但当前仓库没有对应迁移文件',
      });
    }
  }

  return {
    rows,
    appliedCount,
    pendingCount,
    mismatchCount,
    orphanCount,
  };
}

function assertStatusSafe(status) {
  if (status.mismatchCount > 0 || status.orphanCount > 0) {
    throw new Error('迁移记录存在校验不一致或孤立记录，请先人工处理。');
  }
}

function printStatus(migrations, applied, hasMigrationTable) {
  const status = buildStatus(migrations, applied);
  console.log('数据库迁移状态');
  if (!hasMigrationTable) {
    console.log('schema_migrations 表不存在，当前数据库尚未由迁移 runner 接管。');
  }

  for (const row of status.rows) {
    console.log(`[${row.level}] ${row.name} - ${row.detail}`);
  }

  console.log('');
  console.log(
    `总计：${migrations.length} 个，已应用 ${status.appliedCount} 个，待执行 ${status.pendingCount} 个，校验不一致 ${status.mismatchCount} 个，孤立记录 ${status.orphanCount} 个`,
  );

  if (status.mismatchCount > 0 || status.orphanCount > 0) {
    process.exitCode = 1;
  }
}

function pendingMigrations(migrations, applied) {
  const appliedByVersion = new Map(applied.map((item) => [item.version, item]));
  return migrations.filter((migration) => !appliedByVersion.has(migration.version));
}

function migrationScript(migration) {
  const body = migration.hasOwnTransaction
    ? migration.sql.trim()
    : ['BEGIN;', migration.sql.trim(), 'COMMIT;'].join('\n');

  return [
    schemaMigrationsSql,
    body,
    `INSERT INTO schema_migrations (version, name, checksum) VALUES (${sqlLiteral(migration.version)}, ${sqlLiteral(migration.name)}, ${sqlLiteral(migration.checksum)});`,
  ].join('\n\n');
}

function baselineScript(migrations) {
  const inserts = migrations.map(
    (migration) =>
      `INSERT INTO schema_migrations (version, name, checksum) VALUES (${sqlLiteral(migration.version)}, ${sqlLiteral(migration.name)}, ${sqlLiteral(migration.checksum)});`,
  );

  return [
    schemaMigrationsSql,
    'BEGIN;',
    ...inserts,
    'COMMIT;',
  ].join('\n');
}

function runBaseline(migrations, applied) {
  const status = buildStatus(migrations, applied);
  assertStatusSafe(status);

  const pending = pendingMigrations(migrations, applied);
  if (pending.length === 0) {
    console.log('数据库迁移基线已存在，无需重复写入。');
    return;
  }

  runPsql(baselineScript(pending));
  console.log(`数据库迁移基线已写入：${pending.length} 个记录。`);
}

function runDryRun(migrations, applied) {
  const status = buildStatus(migrations, applied);
  assertStatusSafe(status);

  const pending = pendingMigrations(migrations, applied);
  if (pending.length === 0) {
    console.log('没有待执行迁移。');
    return;
  }

  console.log('待执行迁移：');
  for (const migration of pending) {
    console.log(`- ${migration.name}`);
  }
}

function runUp(migrations, applied) {
  const status = buildStatus(migrations, applied);
  assertStatusSafe(status);

  const pending = pendingMigrations(migrations, applied);
  if (pending.length === 0) {
    console.log('没有待执行迁移。');
    return;
  }

  for (const migration of pending) {
    console.log(`执行迁移：${migration.name}`);
    runPsql(migrationScript(migration));
  }

  console.log(`数据库迁移执行完成：${pending.length} 个。`);
}

function main() {
  const migrations = loadMigrations();
  const hasMigrationTable = migrationTableExists();
  const applied = hasMigrationTable ? queryAppliedMigrations() : [];

  if (command === 'status') {
    printStatus(migrations, applied, hasMigrationTable);
    return;
  }

  if (command === 'dry-run') {
    runDryRun(migrations, applied);
    return;
  }

  if (command === 'baseline') {
    runBaseline(migrations, applied);
    return;
  }

  if (command === 'up') {
    runUp(migrations, applied);
    return;
  }

  throw new Error(`未知命令：${command}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  if (process.env.DEBUG && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
}
