#!/usr/bin/env node

/**
 * 一键启动脚本 — 启动 hr-agent-system 全部环境
 *
 * 启动顺序:
 *   1. 检查前置条件 (.env, Docker, npm)
 *   2. 启动 infra (postgres + redis)
 *   3. 等待数据库就绪
 *   4. 并行启动 API 和 Web
 *   5. 打开浏览器
 *
 * Ctrl+C 可优雅关闭所有服务。
 */

const { spawn, execSync } = require('node:child_process');
const { existsSync, copyFileSync } = require('node:fs');
const { join } = require('node:path');
const { platform, cwd } = require('node:process');
const { createInterface } = require('node:readline');

// ── Config ────────────────────────────────────────────────
const ROOT = cwd();
const API_PORT = 3000;
const WEB_PORT = 5173;
const PG_CONTAINER = 'hr-agent-postgres';
const REDIS_CONTAINER = 'hr-agent-redis';
const DEMO_ADMIN_USERNAME = process.env.HR_ADMIN_USERNAME || 'hr_admin';
const DEMO_PASSWORD = process.env.HR_DEMO_PASSWORD || process.env.HR_ADMIN_PASSWORD || '';

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

// ── Helpers ───────────────────────────────────────────────

function log(tag, message, color = COLORS.reset) {
  const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  console.log(`${COLORS.dim}[${ts}]${COLORS.reset} ${color}[${tag}]${COLORS.reset} ${message}`);
}

function ok(message) { log('OK', message, COLORS.green); }
function info(message) { log('INFO', message, COLORS.cyan); }
function warn(message) { log('WARN', message, COLORS.yellow); }
function error(message) { log('ERR', message, COLORS.red); }

function divider() {
  console.log(COLORS.dim + '─'.repeat(60) + COLORS.reset);
}

function quoteCmdArg(value) {
  const text = String(value);
  return /^[A-Za-z0-9_@%+=:,./\\-]+$/.test(text) ? text : `"${text.replace(/(["^&|<>])/g, '^$1')}"`;
}

function resolveSpawnCommand(command, args = []) {
  if (platform === 'win32' && command === 'npm') {
    return {
      command: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', ['npm', ...args].map(quoteCmdArg).join(' ')],
    };
  }

  return { command, args };
}

function cmd(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const resolved = resolveSpawnCommand(command, args);
    const proc = spawn(resolved.command, resolved.args, { shell: false, stdio: 'pipe', ...options });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d) => { stdout += d.toString(); });
    proc.stderr?.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
    else reject(new Error(stderr.trim() || stdout.trim() || `退出码 ${code}`));
    });
    proc.on('error', reject);
  });
}

function spawnCommand(command, args = [], options = {}) {
  const resolved = resolveSpawnCommand(command, args);
  return spawn(resolved.command, resolved.args, { shell: false, ...options });
}

function cmdShell(command, options = {}) {
  if (platform === 'win32') {
    return cmd(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], options);
  }

  return cmd('sh', ['-lc', command], options);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function isPortOpen(port) {
  try {
    // Windows: netstat, Unix: lsof fallback
    const isWin = platform === 'win32';
    if (isWin) {
      const out = await cmdShell(`netstat -ano | findstr :${port}`);
      return out.includes('LISTENING');
    }
    await cmd('bash', ['-c', `echo >/dev/tcp/localhost/${port}`], { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

async function httpHealthCheck(url, maxRetries = 30, okStatuses = [200, 401, 404]) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (okStatuses.includes(res.status)) return true;
    } catch { /* still waiting */ }
    await sleep(1000);
  }
  return false;
}

function openBrowser(url) {
  const isWin = platform === 'win32';
  try {
    if (isWin) execSync(`start "" "${url}"`, { shell: 'cmd.exe', stdio: 'ignore' });
    else execSync(`open "${url}" 2>/dev/null || xdg-open "${url}" 2>/dev/null`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ── Banner ────────────────────────────────────────────────

function banner() {
  console.clear();
  console.log('');
  console.log(COLORS.bold + COLORS.cyan + '  ██████╗    ██╗   ██╗    █████╗    ███╗   ██╗' + COLORS.reset);
  console.log(COLORS.bold + COLORS.cyan + '  ╚════██╗   ██║   ██║   ██╔══██╗   ████╗  ██║' + COLORS.reset);
  console.log(COLORS.bold + COLORS.cyan + '   █████╔╝   ███████║   ███████║   ██╔██╗ ██║' + COLORS.reset);
  console.log(COLORS.bold + COLORS.cyan + '   ╚═══██╗   ██╔══██║   ██╔══██║   ██║╚██╗██║' + COLORS.reset);
  console.log(COLORS.bold + COLORS.cyan + '  ██████╔╝   ██║  ██║   ██║  ██║   ██║ ╚████║' + COLORS.reset);
  console.log(COLORS.bold + COLORS.cyan + '  ╚═════╝    ╚═╝  ╚═╝   ╚═╝  ╚═╝   ╚═╝  ╚═══╝' + COLORS.reset);
  console.log('');
  console.log(COLORS.bold + '  智能人事系统 — 一键启动' + COLORS.reset);
  console.log(COLORS.dim + '  明智人力 · 企业人力资源智能平台' + COLORS.reset);
  console.log('');
  divider();
}

// ── 第 1 步：检查前置条件 ─────────────────────────────────

async function autoStartDockerDesktop() {
  const isWin = platform === 'win32';
  try {
    if (isWin) {
      // 尝试常见安装路径。
      const paths = [
        'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe',
        join(process.env.LOCALAPPDATA || '', 'Docker\\Docker Desktop.exe'),
      ];
      for (const p of paths) {
        if (existsSync(p)) {
          info(`启动 Docker Desktop: ${p}`);
          execSync(`start "" "${p}"`, { shell: 'cmd.exe', stdio: 'ignore' });
          return true;
        }
      }
      warn('未找到 Docker Desktop 可执行文件');
      return false;
    }
    // macOS 系统。
    try {
      execSync('open -a Docker', { stdio: 'ignore' });
      return true;
    } catch {
      warn('未找到 Docker Desktop 应用');
      return false;
    }
  } catch (err) {
    warn(`Docker Desktop 自动启动失败: ${err.message}`);
    return false;
  }
}

async function checkPrerequisites() {
  log('STEP', '1/5  检查前置条件', COLORS.yellow);
  divider();

  // 检查 .env 配置。
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) {
    const examplePath = join(ROOT, '.env.example');
    if (!existsSync(examplePath)) {
      error('.env.example 不存在，请先创建 .env 文件。');
      return false;
    }
    copyFileSync(examplePath, envPath);
    warn('未找到 .env，已从 .env.example 复制。请检查并配置必要的环境变量。');
  } else {
    ok('.env 已存在');
  }

  // 检查 Docker 是否可用。
  try {
    await cmd('docker', ['--version']);
    ok('Docker 可用');
  } catch {
    error('未找到 Docker，请先安装 Docker Desktop。');
    error('下载地址: https://www.docker.com/products/docker-desktop');
    return false;
  }

  // 检查 Docker 是否运行；未运行时尝试自动启动 Docker Desktop。
  try {
    await cmd('docker', ['info'], { timeout: 5000 });
    ok('Docker 引擎运行中');
  } catch {
    warn('Docker 引擎未运行，正在尝试自动启动 Docker Desktop...');
    const started = await autoStartDockerDesktop();
    if (!started) {
      error('Docker Desktop 启动失败，请手动启动后再试。');
      return false;
    }
    // 等待 Docker 引擎就绪。
    info('等待 Docker 引擎就绪...');
    let dockerReady = false;
    for (let i = 0; i < 60; i++) {
      try {
        await cmd('docker', ['info'], { timeout: 3000 });
        dockerReady = true;
        ok('Docker 引擎已就绪');
        break;
      } catch { /* still waiting */ }
      await sleep(3000);
    }
    if (!dockerReady) {
      error('Docker 引擎启动超时，请检查 Docker Desktop。');
      return false;
    }
  }

  // 检查 Node.js。
  try {
    const version = await cmd('node', ['--version']);
    ok(`Node.js 可用 (${version})`);
  } catch {
    error('未找到 Node.js 20+，请先安装。');
    return false;
  }

  // 检查 npm 依赖。
  if (!existsSync(join(ROOT, 'node_modules'))) {
    warn('node_modules 不存在，正在安装依赖...');
    try {
      await cmd('npm', ['install'], { cwd: ROOT, stdio: 'inherit' });
      ok('依赖安装完成');
    } catch (err) {
      error(`依赖安装失败: ${err.message}`);
      return false;
    }
  } else {
    ok('node_modules 存在');
  }

  console.log('');
  return true;
}

// ── 第 2 步：启动基础设施 ───────────────────────────────────

async function startInfrastructure() {
  log('STEP', '2/5  启动基础设施 (PostgreSQL + Redis)', COLORS.yellow);
  divider();

  // 先让 Compose 对齐当前配置；容器已运行时这是幂等操作，端口配置变更时会自动重建。
  info('启动 Docker Compose 服务...');
  try {
    await cmd('docker', ['compose', 'up', 'postgres', 'redis', '-d'], { cwd: ROOT, stdio: 'inherit' });
    ok('Docker Compose 服务已启动');
  } catch (err) {
    error(`Docker Compose 启动失败: ${err.message}`);
    return false;
  }

  // 等待 PostgreSQL 就绪。
  info('等待 PostgreSQL 就绪...');
  for (let i = 0; i < 30; i++) {
    try {
      const healthy = await cmd('docker', ['inspect', PG_CONTAINER, '--format', '{{.State.Health.Status}}']);
      if (healthy.trim() === 'healthy') {
        ok('PostgreSQL 就绪 ✓');
        break;
      }
    } catch { /* still waiting */ }
    if (i === 29) {
      error('PostgreSQL 启动超时，请检查 Docker 日志。');
      return false;
    }
    await sleep(2000);
  }

  // 等待 Redis 就绪。
  info('等待 Redis 就绪...');
  for (let i = 0; i < 20; i++) {
    try {
      const healthy = await cmd('docker', ['inspect', REDIS_CONTAINER, '--format', '{{.State.Health.Status}}']);
      if (healthy.trim() === 'healthy') {
        ok('Redis 就绪 ✓');
        break;
      }
    } catch { /* still waiting */ }
    if (i === 19) {
      warn('Redis 健康检查超时，继续启动...');
    }
    await sleep(2000);
  }

  console.log('');
  return true;
}

// ── 第 3 步：启动 API ─────────────────────────────────────

let apiProc = null;

async function startApi() {
  log('STEP', '3/5  启动后端 API 服务', COLORS.yellow);
  divider();

  info('启动 NestJS API (SWC 编译 + 热重载)...');

  apiProc = spawnCommand('npm', ['--workspace', '@hr-agent-system/api', 'run', 'dev'], {
    cwd: ROOT,
    stdio: 'pipe',
    env: { ...process.env },
  });

  apiProc.stdout.on('data', (d) => {
    const text = d.toString();
    // 仅显示编译、生命周期和错误日志。
    if (text.includes('Successfully compiled') || text.includes('Nest application') || text.includes('ERROR')) {
      process.stdout.write(COLORS.dim + '[api] ' + COLORS.reset + text);
    }
  });

  apiProc.stderr.on('data', (d) => {
    process.stderr.write(COLORS.red + '[api] ' + COLORS.reset + d.toString());
  });

  apiProc.on('error', (err) => {
    error(`API 进程启动失败: ${err.message}`);
  });

  const readyUrl = `http://127.0.0.1:${API_PORT}/api/health/ready`;
  const healthy = await httpHealthCheck(readyUrl, 30, [200]);
  if (healthy) {
    ok(`API 服务就绪 → ${readyUrl} ✓`);
  } else {
    error(`API 服务启动超时 (${API_PORT})`);
    error('请检查终端中的 API 输出查找错误。');
    return false;
  }

  // API 就绪后自动刷新候选人匹配分。
  info('正在刷新所有候选人智能匹配分...');
  try {
    if (!DEMO_PASSWORD) {
      warn('未设置 HR_DEMO_PASSWORD，跳过匹配分自动刷新');
      console.log('');
      return true;
    }

    const loginRes = await fetch(`http://127.0.0.1:${API_PORT}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: DEMO_ADMIN_USERNAME, password: DEMO_PASSWORD }),
    });
    if (loginRes.ok) {
      const { accessToken } = await loginRes.json();
      const recalcRes = await fetch(`http://127.0.0.1:${API_PORT}/api/agent/recruitment/recalculate-all-scores`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      });
      if (recalcRes.ok) {
        const results = await recalcRes.json();
        const count = Array.isArray(results) ? results.filter((r) => r.score >= 0).length : 0;
        ok(`${count} 位候选人匹配分已刷新`);
      } else {
        warn('匹配分刷新请求失败，将使用数据库现有分数');
      }
    } else {
      warn('登录失败，跳过匹配分刷新');
    }
  } catch {
    warn('匹配分刷新网络异常，将使用数据库现有分数');
  }

  console.log('');
  return true;
}

// ── 第 4 步：启动 Web ─────────────────────────────────────

let webProc = null;

async function startWeb() {
  log('STEP', '4/5  启动前端 Web 应用', COLORS.yellow);
  divider();

  info('启动 Vite (HMR 热更新模式)...');

  webProc = spawnCommand('npm', ['--workspace', '@hr-agent-system/web', 'run', 'dev'], {
    cwd: ROOT,
    stdio: 'pipe',
    env: { ...process.env, BROWSER: 'none' },
  });

  webProc.stdout.on('data', (d) => {
    const text = d.toString();
    if (text.includes('Local:') || text.includes('ready in') || text.includes('ERROR') || text.includes('error')) {
      process.stdout.write(COLORS.dim + '[web] ' + COLORS.reset + text);
    }
  });

  webProc.stderr.on('data', (d) => {
    process.stderr.write(COLORS.red + '[web] ' + COLORS.reset + d.toString());
  });

  webProc.on('error', (err) => {
    error(`Web 进程启动失败: ${err.message}`);
  });

  const healthy = await httpHealthCheck(`http://127.0.0.1:${WEB_PORT}`);
  if (healthy) {
    ok(`Web 应用就绪 → http://127.0.0.1:${WEB_PORT} ✓`);
  } else {
    // Vite 首次启动有时需要更久。
    await sleep(3000);
    const retry = await httpHealthCheck(`http://127.0.0.1:${WEB_PORT}`, 15);
    if (retry) {
      ok(`Web 应用就绪 → http://127.0.0.1:${WEB_PORT} ✓`);
    } else {
      error(`Web 应用启动超时 (${WEB_PORT})`);
      return false;
    }
  }

  console.log('');
  return true;
}

// ── 第 5 步：系统就绪 ─────────────────────────────────────────

function ready() {
  log('STEP', '5/5  系统就绪', COLORS.yellow);
  divider();

  ok('所有服务已启动！');
  console.log('');
  console.log(`  ${COLORS.bold}前端界面${COLORS.reset}  ${COLORS.cyan}http://127.0.0.1:${WEB_PORT}${COLORS.reset}`);
  console.log(`  ${COLORS.bold}后端接口${COLORS.reset}  ${COLORS.cyan}http://127.0.0.1:${API_PORT}/api${COLORS.reset}`);
  console.log(`  ${COLORS.bold}演示账号${COLORS.reset}  ${COLORS.dim}请查看 README，并用 HR_DEMO_PASSWORD 配置脚本密码${COLORS.reset}`);
  console.log('');

  const opened = openBrowser(`http://127.0.0.1:${WEB_PORT}`);
  if (opened) ok('浏览器已打开');
  else info(`请手动打开 http://127.0.0.1:${WEB_PORT}`);

  console.log('');
  console.log(COLORS.dim + '  按 Ctrl+C 停止所有服务...' + COLORS.reset);
  console.log('');
  divider();
}

// ── 关闭流程 ──────────────────────────────────────────────

function gracefulShutdown() {
  console.log('');
  divider();
  log('EXIT', '正在关闭所有服务...', COLORS.yellow);

  // 关闭子进程。
  const procs = [
    { p: apiProc, name: 'API (后端)' },
    { p: webProc, name: 'Web (前端)' },
  ];

  let closed = 0;
  for (const { p, name } of procs) {
    if (p && !p.killed) {
      try {
        p.kill('SIGTERM');
        log('STOP', `${name} 已终止`, COLORS.yellow);
        closed++;
      } catch { /* already dead */ }
    }
  }

  // Docker 容器默认保留运行。
  console.log('');
  log('INFO', 'Docker 容器保持运行。如需停止请执行:', COLORS.dim);
  log('INFO', '  docker compose stop', COLORS.dim);
  console.log('');

  process.exit(0);
}

// ── 主流程 ──────────────────────────────────────────────────

async function main() {
  banner();

  // 处理 Ctrl+C。
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  // 依次执行启动步骤。
  if (!(await checkPrerequisites())) process.exit(1);
  if (!(await startInfrastructure())) process.exit(1);
  if (!(await startApi())) process.exit(1);
  if (!(await startWeb())) process.exit(1);

  ready();
}

main().catch((err) => {
  error(`启动失败: ${err.message}`);
  console.error(err);
  process.exit(1);
});
