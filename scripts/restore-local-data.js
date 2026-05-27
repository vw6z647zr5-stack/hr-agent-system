#!/usr/bin/env node

const { existsSync, mkdirSync, readFileSync, rmSync, cpSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const env = loadEnv(join(root, '.env'));
const args = process.argv.slice(2);
const backupArg = args.find((item) => !item.startsWith('--'));
const confirmRestore = args.includes('--confirm-restore');
const skipSafetyBackup = args.includes('--skip-current-backup');
const filesOnly = args.includes('--files-only');
const databaseOnly = args.includes('--database-only');

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
    if (separator > 0) {
      values[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return values;
}

function requireEnv(name) {
  const value = process.env[name] || env[name];
  if (!value) {
    throw new Error(`${name} 需要在 .env 中配置`);
  }
  return value;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} 退出码 ${result.status}`);
  }
}

function readManifest(backupRoot) {
  const manifestPath = join(backupRoot, 'manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`未找到备份清单：${manifestPath}`);
  }

  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

function ensureBackupPath() {
  if (!backupArg) {
    throw new Error('请提供备份目录，例如 `npm run restore:local -- backups/2026-05-22T00-00-00-000Z`');
  }

  const backupRoot = resolve(root, backupArg);
  if (!existsSync(backupRoot)) {
    throw new Error(`备份目录不存在：${backupRoot}`);
  }

  return backupRoot;
}

function restoreDatabase(backupRoot, manifest) {
  const dumpFile = join(backupRoot, manifest.dump || 'database.dump');
  if (!existsSync(dumpFile)) {
    throw new Error(`数据库备份文件不存在：${dumpFile}`);
  }

  const user = requireEnv('POSTGRES_USER');
  const db = requireEnv('POSTGRES_DB');
  const containerDumpPath = '/tmp/hr-agent-restore.dump';

  run('docker', ['cp', dumpFile, `hr-agent-postgres:${containerDumpPath}`]);
  run('docker', [
    'compose',
    'exec',
    '-T',
    'postgres',
    'pg_restore',
    '-U',
    user,
    '-d',
    db,
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-acl',
    containerDumpPath,
  ]);
}

function replaceDirectory(source, target) {
  if (!existsSync(source)) {
    return false;
  }

  rmSync(target, { recursive: true, force: true });
  mkdirSync(resolve(target, '..'), { recursive: true });
  cpSync(source, target, { recursive: true, force: true, errorOnExist: false });
  return true;
}

function restoreFiles(backupRoot) {
  const restored = {
    uploads: replaceDirectory(join(backupRoot, 'uploads'), join(root, 'uploads')),
    managedCompanyDocs: replaceDirectory(join(backupRoot, 'docs/company/managed'), join(root, 'docs/company/managed')),
    managedPolicyDocs: replaceDirectory(join(backupRoot, 'docs/policies/managed'), join(root, 'docs/policies/managed')),
    documentHistory: replaceDirectory(join(backupRoot, 'docs/.history'), join(root, 'docs/.history')),
  };

  for (const [name, didRestore] of Object.entries(restored)) {
    console.log(`${didRestore ? '[OK]' : '[SKIP]'} ${name}`);
  }
}

function printPlan(backupRoot, manifest) {
  console.log('将执行本地恢复：');
  console.log(`备份目录：${backupRoot}`);
  console.log(`备份时间：${manifest.createdAt || '未知'}`);
  console.log(`数据库：${manifest.database || requireEnv('POSTGRES_DB')}`);
  console.log(`恢复数据库：${databaseOnly || !filesOnly ? '是' : '否'}`);
  console.log(`恢复文件：${filesOnly || !databaseOnly ? '是' : '否'}`);
  console.log(`恢复前安全备份：${skipSafetyBackup ? '跳过' : '执行'}`);
  console.log('');

  if (!confirmRestore) {
    console.log('当前为演练模式，未修改任何数据。');
    console.log('确认恢复请追加：--confirm-restore');
  }
}

async function main() {
  if (filesOnly && databaseOnly) {
    throw new Error('--files-only 和 --database-only 不能同时使用');
  }

  const backupRoot = ensureBackupPath();
  const manifest = readManifest(backupRoot);
  printPlan(backupRoot, manifest);

  if (!confirmRestore) {
    return;
  }

  if (!skipSafetyBackup) {
    console.log('恢复前创建当前数据安全备份...');
    run(process.execPath, ['scripts/backup-local-data.js']);
  }

  if (!filesOnly) {
    console.log('恢复数据库...');
    restoreDatabase(backupRoot, manifest);
  }

  if (!databaseOnly) {
    console.log('恢复文件...');
    restoreFiles(backupRoot);
  }

  console.log('恢复完成。建议立即执行 `npm run verify:commercial -- --live`。');
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
