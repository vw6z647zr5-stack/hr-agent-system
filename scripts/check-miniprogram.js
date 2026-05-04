const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { join, extname } = require('node:path');
const vm = require('node:vm');

const root = process.cwd();
const appRoot = join(root, 'apps', 'miniprogram');
const ignoredDirectories = new Set(['.vscode', 'node_modules', 'dist']);
const requiredFiles = [
  'project.config.json',
  'app.json',
  'app.js',
  'app.wxss',
  'sitemap.json',
  'utils/api.js',
  'utils/auth.js',
  'utils/config.js',
  'utils/format.js',
  'utils/services.js',
  'pages/login/index.js',
  'pages/login/index.wxml',
  'pages/home/index.js',
  'pages/home/index.wxml',
  'pages/self-service/index.js',
  'pages/self-service/index.wxml',
  'pages/knowledge/index.js',
  'pages/knowledge/index.wxml',
  'pages/career/index.js',
  'pages/career/index.wxml',
  'pages/profile/index.js',
  'pages/profile/index.wxml',
];

const textExtensions = new Set(['.js', '.json', '.wxml', '.wxss', '.md']);
const jsonExtensions = new Set(['.json']);
const jsExtensions = new Set(['.js']);
const badTextPattern = new RegExp(
  [
    '\\uFFFD',
    '\\u00C3',
    '\\u00C2',
    '\\u00E2\\u20AC',
    '\\u00E2\\u20AC\\u2122',
    '\\u00E2\\u20AC\\u0153',
    '\\u00E2\\u20AC\\uFFFD',
    '\\u9225',
    '\\u951F',
  ].join('|'),
);

function walk(directory, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

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
    console.error(`缺少小程序文件：${file}`);
    process.exit(1);
  }
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

  if (jsonExtensions.has(extension)) {
    try {
      JSON.parse(content);
    } catch (error) {
      console.error(`JSON 格式错误：${relativePath(file)} ${(error && error.message) || error}`);
      process.exit(1);
    }
  }

  if (jsExtensions.has(extension)) {
    try {
      new vm.Script(content, { filename: file });
    } catch (error) {
      console.error(`脚本语法错误：${relativePath(file)}`);
      process.stderr.write(error.message || String(error));
      process.exit(1);
    }
  }
}

const appConfig = JSON.parse(readFileSync(join(appRoot, 'app.json'), 'utf8'));
const pages = appConfig.pages || [];
if (!pages.length) {
  console.error('app.json 必须配置 pages。');
  process.exit(1);
}

if (!appConfig.sitemapLocation) {
  console.error('app.json 必须配置 sitemapLocation。');
  process.exit(1);
}

for (const page of pages) {
  for (const extension of ['.js', '.json', '.wxml', '.wxss']) {
    const file = join(appRoot, `${page}${extension}`);
    if (!existsSync(file)) {
      console.error(`页面文件不完整：${page}${extension}`);
      process.exit(1);
    }
  }
}

if (appConfig.tabBar) {
  const tabPages = appConfig.tabBar.list || [];
  if (tabPages.length < 2 || tabPages.length > 5) {
    console.error('tabBar 的 list 数量必须为 2 到 5 个。');
    process.exit(1);
  }

  for (const tab of tabPages) {
    if (!tab.pagePath || !tab.text) {
      console.error('tabBar 每一项都必须包含 pagePath 和 text。');
      process.exit(1);
    }

    if (!pages.includes(tab.pagePath)) {
      console.error(`tabBar 页面未在 pages 中声明：${tab.pagePath}`);
      process.exit(1);
    }
  }
}

console.log('小程序校验通过。');
