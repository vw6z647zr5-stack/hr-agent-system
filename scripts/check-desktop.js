const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { extname, join } = require('node:path');
const vm = require('node:vm');

const root = process.cwd();
const appRoot = join(root, 'apps', 'desktop');
const requiredFiles = ['package.json', 'README.md', 'src/main.js', 'src/preload.js'];
const textExtensions = new Set(['.js', '.json', '.md']);
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
    console.error(`缺少桌面客户端文件：${file}`);
    process.exit(1);
  }
}

const manifest = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8'));
if (manifest.main !== 'src/main.js') {
  console.error('桌面客户端 package.json 的 main 必须指向 src/main.js。');
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

  if (extension === '.js') {
    try {
      new vm.Script(content, { filename: file });
    } catch (error) {
      console.error(`桌面客户端脚本语法错误：${relativePath(file)}`);
      process.stderr.write(error.message || String(error));
      process.exit(1);
    }
  }
}

console.log('桌面客户端校验通过。');
