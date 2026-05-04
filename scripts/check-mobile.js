const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { extname, join } = require('node:path');

const root = process.cwd();
const appRoot = join(root, 'apps', 'mobile');
const requiredFiles = ['package.json', 'README.md', 'capacitor.config.json'];
const textExtensions = new Set(['.json', '.md']);
const badTextPattern = new RegExp(['\\uFFFD', '\\u00C3', '\\u00C2', '\\u951F'].join('|'));

function walk(directory, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolutePath, output);
      continue;
    }
    output.push(absolutePath);
  }
  return output;
}

function relativePath(file) {
  return file.slice(appRoot.length + 1).replaceAll('\\', '/');
}

for (const file of requiredFiles) {
  if (!existsSync(join(appRoot, file))) {
    console.error(`缺少移动 App 文件：${file}`);
    process.exit(1);
  }
}

const config = JSON.parse(readFileSync(join(appRoot, 'capacitor.config.json'), 'utf8'));
if (!config.appId || !config.appName || config.webDir !== '../web/dist') {
  console.error('移动 App 的 Capacitor 配置不完整。');
  process.exit(1);
}

for (const file of walk(appRoot)) {
  const extension = extname(file);
  if (!textExtensions.has(extension)) {
    continue;
  }

  const content = readFileSync(file, 'utf8');
  if (badTextPattern.test(content)) {
    console.error(`发现疑似乱码：${relativePath(file)}`);
    process.exit(1);
  }

  if (extension === '.json') {
    JSON.parse(content);
  }
}

console.log('移动 App 校验通过。');
