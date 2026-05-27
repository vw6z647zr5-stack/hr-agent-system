#!/usr/bin/env node

const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const env = loadEnv(join(root, '.env'));
const live = process.argv.includes('--live');
const results = [];

function loadEnv(path) {
  if (!existsSync(path)) {
    return {};
  }

  const values = {};
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

function record(level, name, detail) {
  results.push({ level, name, detail });
}

function pass(name, detail = '') {
  record('PASS', name, detail);
}

function warn(name, detail) {
  record('WARN', name, detail);
}

function fail(name, detail) {
  record('FAIL', name, detail);
}

function isPlaceholder(value) {
  return !value || /^(changeme|change-me|secret|admin123)$/i.test(value) || /replace|placeholder|your-|example/i.test(value);
}

function checkSecret(name, minLength = 24) {
  const value = env[name];
  if (isPlaceholder(value)) {
    fail(name, '缺少配置或仍是占位值');
    return;
  }

  if (value.length < minLength) {
    fail(name, `长度不足，至少需要 ${minLength} 个字符`);
    return;
  }

  pass(name, `length=${value.length}`);
}

function checkUrl(name, expectedPortName) {
  const raw = env[name];
  if (!raw) {
    fail(name, 'missing');
    return null;
  }

  try {
    const url = new URL(raw);
    const expectedPort = env[expectedPortName];
    if (expectedPort && url.port !== expectedPort) {
      fail(name, `端口 ${url.port || '默认端口'} 与 ${expectedPortName}=${expectedPort} 不一致`);
    } else {
      pass(name, `${url.protocol}//${url.hostname}:${url.port || '默认端口'}`);
    }

    if (url.hostname === 'localhost') {
      warn(name, 'Windows 下 localhost 可能连到其他本机服务，本地开发建议使用 127.0.0.1');
    }

    return url;
  } catch (error) {
    fail(name, error instanceof Error ? error.message : '地址格式无效');
    return null;
  }
}

function checkFiles() {
  const requiredFiles = [
    '.env',
    '.env.example',
    'docker-compose.yml',
    'apps/api/src/common/request-context.ts',
    'apps/api/src/health/health.controller.ts',
    'apps/api/src/health/health.service.ts',
    'infra/postgres/init.sql',
    'infra/postgres/seed.sql',
    'infra/postgres/migrations/001-multi-tenant.sql',
    'infra/postgres/migrations/002-covering-indexes.sql',
    'infra/postgres/migrations/003-workflow-notifications.sql',
    'infra/postgres/migrations/004-rich-demo-data.sql',
    'scripts/run-migrations.js',
  ];

  for (const file of requiredFiles) {
    if (existsSync(join(root, file))) {
      pass(file);
    } else {
      fail(file, 'missing');
    }
  }
}

function readProjectFile(file) {
  const path = join(root, file);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function checkRequestTracing() {
  const main = readProjectFile('apps/api/src/main.ts');
  const requestContext = readProjectFile('apps/api/src/common/request-context.ts');
  const exceptionFilter = readProjectFile('apps/api/src/common/filters/api-exception.filter.ts');
  const security = readProjectFile('apps/api/src/config/security.ts');
  const auditService = readProjectFile('apps/api/src/audit/audit.service.ts');

  if (main.includes('requestContextMiddleware') && requestContext.includes('X-Request-Id')) {
    pass('请求链路标识', '已生成并返回 X-Request-Id');
  } else {
    fail('请求链路标识', '未接入 X-Request-Id 中间件');
  }

  if (exceptionFilter.includes('requestId')) {
    pass('错误响应链路标识', '错误响应包含 requestId');
  } else {
    fail('错误响应链路标识', '错误响应未包含 requestId');
  }

  if (security.includes('X-Request-Id')) {
    pass('跨域链路标识', 'CORS 已允许并暴露 X-Request-Id');
  } else {
    fail('跨域链路标识', 'CORS 未暴露 X-Request-Id');
  }

  if (auditService.includes('withRequestMetadata') && auditService.includes('requestId')) {
    pass('审计链路标识', '审计 metadata 自动附带 requestId');
  } else {
    fail('审计链路标识', '审计日志未附带 requestId');
  }
}

function checkEnv() {
  checkSecret('POSTGRES_PASSWORD', 24);
  checkSecret('REDIS_PASSWORD', 24);
  checkSecret('JWT_SECRET', 32);

  checkUrl('DATABASE_URL', 'POSTGRES_PORT');
  checkUrl('REDIS_URL', 'REDIS_PORT');

  const provider = env.AI_PROVIDER || 'auto';
  if (provider === 'deepseek' && isPlaceholder(env.DEEPSEEK_API_KEY)) {
    fail('AI_PROVIDER', '已选择 deepseek，但 DEEPSEEK_API_KEY 仍是占位值');
  } else if (provider === 'openai' && isPlaceholder(env.OPENAI_API_KEY)) {
    fail('AI_PROVIDER', '已选择 openai，但 OPENAI_API_KEY 未配置');
  } else if (provider === 'auto' && isPlaceholder(env.DEEPSEEK_API_KEY) && isPlaceholder(env.OPENAI_API_KEY)) {
    warn('AI_PROVIDER', 'auto 模式会在未配置模型密钥时使用确定性规则回退');
  } else {
    pass('AI_PROVIDER', provider);
  }

  if (!env.HR_DEMO_PASSWORD && !process.env.HR_DEMO_PASSWORD) {
    warn('HR_DEMO_PASSWORD', '运行 verify:full 或 live 检查前请先设置该变量');
  }
}

function checkComposeConfig() {
  const result = spawnSync('docker', ['compose', 'config'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.error) {
    fail('docker compose config', result.error.message);
    return;
  }

  if (result.status !== 0) {
    fail('docker compose config', (result.stderr || result.stdout || '').trim());
    return;
  }

  const output = result.stdout || '';
  if (!output.includes('hr-agent-postgres') || !output.includes('hr-agent-redis')) {
    fail('Docker Compose 服务', 'postgres 或 redis 服务缺失');
  } else {
    pass('Docker Compose 服务', 'postgres、redis、api、web');
  }

  if (output.includes('published: "15432"') && output.includes('published: "16379"')) {
    pass('Docker Compose 端口', 'PostgreSQL=15432，Redis=16379');
  } else {
    fail('Docker Compose 端口', '预期暴露端口 15432 和 16379');
  }

  if (output.includes('/api/health/ready')) {
    pass('API 容器健康检查', '/api/health/ready');
  } else {
    fail('API 容器健康检查', '未接入 /api/health/ready');
  }
}

async function checkLiveApi() {
  if (!live) {
    warn('在线就绪检查', '已跳过；服务启动后运行 `npm run verify:commercial -- --live`');
    return;
  }

  const apiBase = process.env.VERIFY_API_BASE || env.VERIFY_API_BASE || `http://127.0.0.1:${env.PORT || 3000}/api`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(`${apiBase}/health/ready`, { signal: controller.signal });
    const payload = await response.text();
    if (response.ok) {
      pass('在线就绪检查', `${apiBase}/health/ready`);
    } else {
      fail('在线就绪检查', `${response.status} ${payload.slice(0, 200)}`);
    }
  } catch (error) {
    fail('在线就绪检查', error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timer);
  }
}

function printSummary() {
  const order = { FAIL: 0, WARN: 1, PASS: 2 };
  for (const item of [...results].sort((a, b) => order[a.level] - order[b.level])) {
    const detail = item.detail ? ` - ${item.detail}` : '';
    console.log(`[${item.level}] ${item.name}${detail}`);
  }

  const failures = results.filter((item) => item.level === 'FAIL').length;
  const warnings = results.filter((item) => item.level === 'WARN').length;
  console.log('');
  console.log(`基础商用就绪检查：${failures} 个失败，${warnings} 个警告`);

  if (failures > 0) {
    process.exitCode = 1;
  }
}

async function main() {
  checkFiles();
  checkRequestTracing();
  checkEnv();
  checkComposeConfig();
  await checkLiveApi();
  printSummary();
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
