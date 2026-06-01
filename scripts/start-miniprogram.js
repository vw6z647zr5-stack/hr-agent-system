#!/usr/bin/env node

const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { platform } = require('node:process');

const ROOT = join(__dirname, '..');
const MINIPROGRAM_ROOT = join(ROOT, 'apps', 'miniprogram');
const DEFAULT_API_BASE = process.env.MINIPROGRAM_API_BASE || 'http://127.0.0.1:3000/api';
const APP_ID = process.env.WECHAT_MINIPROGRAM_APPID || 'wx36e26fbf55b1d542';

function quoteCmdArg(value) {
  const text = String(value);
  return /^[A-Za-z0-9_@%+=:,./\\-]+$/.test(text) ? text : `"${text.replace(/(["^&|<>])/g, '^$1')}"`;
}

function candidateCliPaths() {
  const paths = [];
  if (process.env.WECHAT_DEVTOOLS_CLI) paths.push(process.env.WECHAT_DEVTOOLS_CLI);

  if (platform === 'win32') {
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env.LOCALAPPDATA || '';
    paths.push(
      join(programFilesX86, 'Tencent', '微信web开发者工具', 'cli.bat'),
      join(programFiles, 'Tencent', '微信web开发者工具', 'cli.bat'),
      join(programFilesX86, 'Tencent', '微信开发者工具', 'cli.bat'),
      join(programFiles, 'Tencent', '微信开发者工具', 'cli.bat'),
      join(localAppData, 'Tencent', '微信web开发者工具', 'cli.bat'),
      join(localAppData, 'Tencent', '微信开发者工具', 'cli.bat'),
      join(localAppData, '微信web开发者工具', 'cli.bat'),
      join(localAppData, '微信开发者工具', 'cli.bat'),
    );
  } else if (platform === 'darwin') {
    paths.push(
      '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      '/Applications/微信开发者工具.app/Contents/MacOS/cli',
      '/Applications/微信web开发者工具.app/Contents/MacOS/cli',
    );
  } else {
    paths.push('/usr/local/bin/wechat-devtools-cli', '/usr/bin/wechat-devtools-cli');
  }

  return [...new Set(paths.filter(Boolean))];
}

function findWechatDevtoolsCli() {
  return candidateCliPaths().find((path) => existsSync(path)) || '';
}

function getMiniprogramLaunchInfo() {
  return {
    appId: APP_ID,
    apiBase: DEFAULT_API_BASE,
    cliPath: findWechatDevtoolsCli(),
    projectRoot: MINIPROGRAM_ROOT,
  };
}

function launchMiniprogram() {
  const info = getMiniprogramLaunchInfo();
  if (!existsSync(info.projectRoot)) {
    return { ...info, ok: false, reason: 'missing-project' };
  }

  if (!info.cliPath) {
    return { ...info, ok: false, reason: 'missing-cli' };
  }

  try {
    let child;
    if (platform === 'win32' && /\.(bat|cmd)$/i.test(info.cliPath)) {
      const command = `${quoteCmdArg(info.cliPath)} open --project ${quoteCmdArg(info.projectRoot)}`;
      child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], {
        detached: true,
        stdio: 'ignore',
      });
    } else {
      child = spawn(info.cliPath, ['open', '--project', info.projectRoot], {
        detached: true,
        stdio: 'ignore',
      });
    }
    child.unref();
    return { ...info, ok: true };
  } catch (error) {
    return { ...info, ok: false, reason: 'launch-failed', error };
  }
}

function printResult(result) {
  console.log(`小程序工程: ${result.projectRoot}`);
  console.log(`后端接口: ${result.apiBase}`);
  console.log(`AppID: ${result.appId}`);

  if (result.ok) {
    console.log(`微信开发者工具已打开: ${result.cliPath}`);
    return;
  }

  if (result.reason === 'missing-cli') {
    console.warn('未找到微信开发者工具 CLI。');
    console.warn('请打开微信开发者工具，手动导入上面的小程序工程目录。');
    console.warn('如已安装但路径不同，可设置 WECHAT_DEVTOOLS_CLI 指向 cli.bat。');
    return;
  }

  if (result.reason === 'missing-project') {
    console.error('小程序工程目录不存在。');
    return;
  }

  console.error(`微信开发者工具启动失败: ${result.error?.message || result.reason}`);
}

if (require.main === module) {
  const result = launchMiniprogram();
  printResult(result);
  process.exit(result.ok ? 0 : 1);
}

module.exports = {
  getMiniprogramLaunchInfo,
  launchMiniprogram,
};
