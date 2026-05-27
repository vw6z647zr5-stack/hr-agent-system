# 智能人事桌面客户端

桌面客户端基于 Electron，复用 `apps/web` 的 React 构建产物。

## 功能范围

- Windows 桌面壳
- 加载现有管理端 Web 工作台
- 支持桌面菜单、外链拦截、运行时信息桥接
- 开发模式可连接 Vite 开发服务器
- 生产模式加载 `apps/web/dist/index.html`

## 一键启动

仓库根目录已提供 `scripts/start-desktop.js`，处理依赖检查、Vite dev server 拉起、环境变量注入。

开发模式（默认）— 自动检测/启动 Vite，注入 `DESKTOP_DEV_SERVER_URL`：

```powershell
npm run dev:desktop
```

生产模式 — 检查/构建 `apps/web/dist`，加载本地文件：

```powershell
npm run start:desktop
```

也可直接通过工作区脚本：

```powershell
npm --workspace @hr-agent-system/desktop run dev
npm --workspace @hr-agent-system/desktop run start:prod
```

## 手动启动（不推荐）

```powershell
# 开发模式：先启动 web，再启动 Electron
npm run dev:web
$env:DESKTOP_DEV_SERVER_URL='http://127.0.0.1:5173'
npm --workspace @hr-agent-system/desktop run start
```

```powershell
# 生产模式：先构建 web，再启动 Electron
npm run build:web
npm --workspace @hr-agent-system/desktop run start
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DESKTOP_DEV_SERVER_URL` | `http://127.0.0.1:5173` | 开发模式加载的 Vite URL |
| `DESKTOP_WEB_PORT` | `5173` | 启动脚本探测/拉起 Vite 时使用的端口 |
| `NODE_ENV` | 由脚本注入 | `--prod` 模式强制为 `production` |

## 打包

```powershell
npm --workspace @hr-agent-system/desktop run dist
```

当前仓库未预装 Electron 依赖。首次执行 `dev:desktop` 会自动安装 desktop 工作区依赖；也可手动运行 `npm install`。
