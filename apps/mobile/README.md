# 智能人事 App

移动 App 基于 Capacitor，复用 `apps/web` 的 React 构建产物，面向 Android 和 iOS。

## 功能范围

- 复用现有 Web 业务页面
- 支持移动 WebView 打包为 Android/iOS App
- 默认使用 `apps/web/dist` 作为 App 静态资源
- App 内运行时默认访问 `http://127.0.0.1:3000/api`，正式环境应通过 `VITE_API_BASE_URL` 指向 HTTPS API

## 本地准备

当前仓库未预装 Capacitor 依赖。需要执行：

```powershell
npm install
```

首次生成原生平台：

```powershell
npm --workspace @hr-agent-system/mobile exec capacitor add android
npm --workspace @hr-agent-system/mobile exec capacitor add ios
```

构建 Web 并同步到原生工程：

```powershell
$env:VITE_BASE_PATH='./'
$env:VITE_API_BASE_URL='https://你的接口域名/api'
$env:VITE_SOCKET_BASE_URL='https://你的接口域名'
npm run build:web
npm --workspace @hr-agent-system/mobile run sync
```

打开原生工程：

```powershell
npm --workspace @hr-agent-system/mobile run open:android
npm --workspace @hr-agent-system/mobile run open:ios
```

## 发布注意事项

- 正式 App 必须使用 HTTPS API。
- iOS 需要 Apple 开发者账号和签名证书。
- Android 需要配置应用签名和渠道包策略。
- 推送、生物识别、相册和文件系统能力可在后续通过 Capacitor 插件逐项接入。
