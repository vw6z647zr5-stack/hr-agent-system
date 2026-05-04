const { createReadStream, existsSync, statSync } = require('node:fs');
const { createServer } = require('node:http');
const { extname, join, relative, resolve } = require('node:path');

const root = resolve(process.cwd(), 'apps', 'web', 'dist');
const host = process.env.STATIC_WEB_HOST || '127.0.0.1';
const port = Number(process.env.STATIC_WEB_PORT || process.env.PORT || 4173);
const indexPath = join(root, 'index.html');

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
]);

function resolveRequestPath(url) {
  let pathname = '/';
  try {
    pathname = decodeURIComponent(new URL(url, `http://${host}:${port}`).pathname);
  } catch {
    return null;
  }

  const requestedPath = resolve(root, `.${pathname}`);
  const relativeToRoot = relative(root, requestedPath);

  if (relativeToRoot.startsWith('..') || relativeToRoot === '..') {
    return null;
  }

  if (existsSync(requestedPath) && statSync(requestedPath).isFile()) {
    return requestedPath;
  }

  return indexPath;
}

if (!existsSync(indexPath)) {
  console.error('未找到前端构建产物，请先完成前端构建。');
  process.exit(1);
}

const server = createServer((request, response) => {
  const filePath = resolveRequestPath(request.url || '/');

  if (!filePath || !existsSync(filePath)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('文件不存在');
    return;
  }

  response.writeHead(200, {
    'cache-control': filePath === indexPath ? 'no-cache' : 'public, max-age=31536000, immutable',
    'content-type': contentTypes.get(extname(filePath).toLowerCase()) || 'application/octet-stream',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' http://127.0.0.1:3000 ws://127.0.0.1:3000; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  createReadStream(filePath)
    .on('error', () => {
      if (!response.headersSent) {
        response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      }
      response.end('读取文件失败');
    })
    .pipe(response);
});

server.listen(port, host, () => {
  console.log(`前端静态预览服务已启动：http://127.0.0.1:${port}`);
});
