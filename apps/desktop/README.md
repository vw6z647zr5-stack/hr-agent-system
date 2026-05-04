# 智能人事桌面客户端

桌面客户端基于 Electron，复用 `apps/web` 的 React 构建产物。

## 功能范围

- Windows 桌面壳
- 加载现有管理端 Web 工作台
- 支持桌面菜单、外链拦截、运行时信息桥接
- 开发模式可连接 Vite 开发服务器
- 生产模式加载 `apps/web/dist/index.html`

## 运行方式

安装桌面端依赖后执行：

```powershell
npm --workspace @hr-agent-system/desktop run start
```

开发模式可先启动 Web：

```powershell
npm run dev:web
$env:DESKTOP_DEV_SERVER_URL='http://127.0.0.1:5173'
npm --workspace @hr-agent-system/desktop run start
```

生产模式先构建 Web：

```powershell
npm run build:web
npm --workspace @hr-agent-system/desktop run start
```

## 打包

```powershell
npm --workspace @hr-agent-system/desktop run dist
```

当前仓库未预装 Electron 依赖。需要执行 `npm install` 后才能启动和打包。
