#!/usr/bin/env node

const { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { spawn } = require('node:child_process');

const root = process.cwd();
const env = loadEnv(join(root, '.env'));
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupRoot = resolve(root, process.env.BACKUP_DIR || 'backups', timestamp);
const dbDumpPath = join(backupRoot, 'database.dump');

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

function runPgDump() {
  const user = requireEnv('POSTGRES_USER');
  const db = requireEnv('POSTGRES_DB');

  return new Promise((resolvePromise, reject) => {
    const dump = spawn('docker', ['compose', 'exec', '-T', 'postgres', 'pg_dump', '-U', user, '-d', db, '-Fc'], {
      cwd: root,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const out = createWriteStream(dbDumpPath);
    let stderr = '';

    dump.stdout.pipe(out);
    dump.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    dump.on('error', reject);
    dump.on('close', (code) => {
      out.end();
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(stderr.trim() || `pg_dump 退出码 ${code}`));
      }
    });
  });
}

function copyIfExists(source, targetName) {
  const sourcePath = join(root, source);
  if (!existsSync(sourcePath)) {
    return false;
  }

  cpSync(sourcePath, join(backupRoot, targetName), {
    recursive: true,
    force: true,
    errorOnExist: false,
  });
  return true;
}

async function main() {
  mkdirSync(backupRoot, { recursive: true });
  await runPgDump();

  const copied = {
    uploads: copyIfExists('uploads', 'uploads'),
    managedCompanyDocs: copyIfExists('docs/company/managed', 'docs/company/managed'),
    managedPolicyDocs: copyIfExists('docs/policies/managed', 'docs/policies/managed'),
    documentHistory: copyIfExists('docs/.history', 'docs/.history'),
  };

  writeFileSync(
    join(backupRoot, 'manifest.json'),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        database: requireEnv('POSTGRES_DB'),
        dockerService: 'postgres',
        dump: 'database.dump',
        copied,
      },
      null,
      2,
    ),
  );

  console.log(`备份已创建：${backupRoot}`);
  console.log('数据库备份文件：database.dump');
  console.log('恢复前请先阅读 docs/operations.md。');
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
