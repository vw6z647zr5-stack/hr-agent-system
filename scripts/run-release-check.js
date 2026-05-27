#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);
const live = args.includes('--live');
const full = args.includes('--full');
const skipVerify = args.includes('--skip-verify');
const npmCommand = 'npm';

const steps = [];

if (!skipVerify) {
  steps.push({
    name: '基础静态验收',
    command: npmCommand,
    args: ['run', 'verify'],
  });
}

steps.push({
  name: '基础商用配置验收',
  command: npmCommand,
  args: ['run', 'verify:commercial'],
});

if (live) {
  steps.push({
    name: '在线就绪验收',
    command: npmCommand,
    args: ['run', 'verify:commercial', '--', '--live'],
  });
}

if (full) {
  steps.push({
    name: '完整业务流验收',
    command: npmCommand,
    args: ['run', 'verify:full'],
  });
}

function runStep(step) {
  console.log('');
  console.log(`== ${step.name} ==`);
  console.log(`${step.command} ${step.args.join(' ')}`);

  const startedAt = Date.now();
  const executable = resolveExecutable(step);
  const result = spawnSync(executable.command, executable.args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    windowsHide: true,
  });

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${step.name} 失败，退出码 ${result.status}`);
  }

  console.log(`完成：${step.name}，耗时 ${seconds}s`);
}

function resolveExecutable(step) {
  if (process.platform !== 'win32') {
    return step;
  }

  const commandLine = [step.command, ...step.args].map(quoteCmdArg).join(' ');
  return {
    command: process.env.ComSpec || 'cmd.exe',
    args: ['/d', '/s', '/c', commandLine],
  };
}

function quoteCmdArg(value) {
  if (/^[\w:./-]+$/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '\\"')}"`;
}

function main() {
  console.log('发布候选验收开始。');
  console.log(`在线检查：${live ? '开启' : '关闭'}`);
  console.log(`完整业务流：${full ? '开启' : '关闭'}`);

  for (const step of steps) {
    runStep(step);
  }

  console.log('');
  console.log('发布候选验收通过。');
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
