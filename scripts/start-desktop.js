#!/usr/bin/env node

/**
 * 桌面客户端一键启动脚本。
 *
 * 默认（dev）：
 *   1. 检查/复用 Vite 5173 端口（未运行则自动启动 web dev）
 *   2. 等待前端就绪
 *   3. 注入 DESKTOP_DEV_SERVER_URL 启动 Electron
 *
 * --prod：
 *   1. 检查 apps/web/dist/index.html，缺失则触发 build:web
 *   2. 启动 Electron（不注入 dev server URL，加载本地 dist）
 *
 * 不会启动 API/数据库 — 桌面只承载前端壳，API 仍由 npm start 或独立部署提供。
 */

const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { platform, cwd, argv } = require('node:process');

const ROOT = cwd();
const WEB_PORT = Number(process.env.DESKTOP_WEB_PORT || 5173);
const DEV_SERVER_URL = process.env.DESKTOP_DEV_SERVER_URL || `http://127.0.0.1:${WEB_PORT}`;
const WEB_DIST = join(ROOT, 'apps', 'web', 'dist', 'index.html');
const WANT_PROD = argv.includes('--prod');

const COLORS = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', red: '\x1b[31m',
};

function log(tag, message, color = COLORS.reset) {
  const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  console.log(`${COLORS.dim}[${ts}]${COLORS.reset} ${color}[${tag}]${COLORS.reset} ${message}`);
}
const ok = (m) => log('OK', m, COLORS.green);
const info = (m) => log('INFO', m, COLORS.cyan);
const warn = (m) => log('WARN', m, COLORS.yellow);
const err = (m) => log('ERR', m, COLORS.red);
const divider = () => console.log(COLORS.dim + '─'.repeat(60) + COLORS.reset);

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

function spawnCommand(command, args = [], options = {}) {
  const resolved = resolveSpawnCommand(command, args);
  return spawn(resolved.command, resolved.args, { shell: false, ...options });
}

function runToCompletion(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const p = spawnCommand(command, args, { stdio: 'inherit', ...options });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${command} 退出码 ${code}`))));
    p.on('error', reject);
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function httpHealthCheck(url, maxRetries = 60, okStatuses = [200, 304, 401, 404]) {
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

function banner() {
  console.log('');
  console.log(COLORS.bold + COLORS.cyan + '  智能人事桌面客户端 — 一键启动' + COLORS.reset);
  console.log(COLORS.dim + `  模式: ${WANT_PROD ? '生产 (本地 dist)' : '开发 (Vite HMR)'}` + COLORS.reset);
  divider();
}

let webProc = null;

async function ensureDevServer() {
  info(`检查 Vite dev server (${DEV_SERVER_URL})...`);
  const alreadyUp = await httpHealthCheck(DEV_SERVER_URL, 1);
  if (alreadyUp) {
    ok('Vite dev server 已在运行，复用现有进程');
    return true;
  }

  info('启动 npm run dev:web...');
  webProc = spawnCommand('npm', ['run', 'dev:web'], {
    cwd: ROOT,
    stdio: 'pipe',
    env: { ...process.env, BROWSER: 'none' },
  });
  webProc.stdout?.on('data', (d) => {
    const text = d.toString();
    if (text.includes('Local:') || text.includes('ready in') || /error/i.test(text)) {
      process.stdout.write(COLORS.dim + '[web] ' + COLORS.reset + text);
    }
  });
  webProc.stderr?.on('data', (d) => {
    process.stderr.write(COLORS.red + '[web] ' + COLORS.reset + d.toString());
  });
  webProc.on('error', (e) => err(`Vite 启动失败: ${e.message}`));

  const ready = await httpHealthCheck(DEV_SERVER_URL, 60);
  if (!ready) {
    err(`Vite dev server 启动超时 (${DEV_SERVER_URL})`);
    return false;
  }
  ok(`Vite dev server 就绪 → ${DEV_SERVER_URL}`);
  return true;
}

async function ensureWebDist() {
  if (existsSync(WEB_DIST)) {
    ok(`检测到前端构建产物 → ${WEB_DIST}`);
    return true;
  }

  warn('未找到前端构建产物，开始执行 npm run build:web...');
  try {
    await runToCompletion('npm', ['run', 'build:web'], { cwd: ROOT });
  } catch (e) {
    err(`前端构建失败: ${e.message}`);
    return false;
  }

  if (!existsSync(WEB_DIST)) {
    err('前端构建结束后仍未找到 dist/index.html');
    return false;
  }
  ok('前端构建完成');
  return true;
}

async function ensureElectronInstalled() {
  const electronPkg = join(ROOT, 'node_modules', 'electron', 'package.json');
  if (existsSync(electronPkg)) return true;

  warn('未检测到 electron 依赖，正在安装 desktop 工作区依赖...');
  try {
    await runToCompletion('npm', ['install', '--workspace', '@hr-agent-system/desktop'], { cwd: ROOT });
    return existsSync(electronPkg);
  } catch (e) {
    err(`依赖安装失败: ${e.message}`);
    return false;
  }
}

let desktopProc = null;

function startElectron() {
  info('启动 Electron...');
  const env = { ...process.env };
  if (WANT_PROD) {
    delete env.DESKTOP_DEV_SERVER_URL;
    env.NODE_ENV = 'production';
  } else {
    env.DESKTOP_DEV_SERVER_URL = DEV_SERVER_URL;
    env.NODE_ENV = env.NODE_ENV || 'development';
  }

  desktopProc = spawnCommand('npm', ['--workspace', '@hr-agent-system/desktop', 'run', 'start'], {
    cwd: ROOT,
    stdio: 'inherit',
    env,
  });

  desktopProc.on('close', (code) => {
    info(`Electron 退出（code=${code ?? 0}）`);
    gracefulShutdown();
  });
  desktopProc.on('error', (e) => err(`Electron 启动失败: ${e.message}`));
}

function gracefulShutdown() {
  divider();
  log('EXIT', '正在关闭桌面客户端...', COLORS.yellow);

  for (const { p, name } of [
    { p: desktopProc, name: 'Electron' },
    { p: webProc, name: 'Vite' },
  ]) {
    if (p && !p.killed) {
      try { p.kill('SIGTERM'); log('STOP', `${name} 已终止`, COLORS.yellow); } catch { /* dead */ }
    }
  }
  process.exit(0);
}

async function main() {
  banner();
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  if (!(await ensureElectronInstalled())) process.exit(1);

  if (WANT_PROD) {
    if (!(await ensureWebDist())) process.exit(1);
  } else {
    if (!(await ensureDevServer())) process.exit(1);
  }

  startElectron();
}

main().catch((e) => {
  err(`启动失败: ${e.message}`);
  console.error(e);
  process.exit(1);
});
