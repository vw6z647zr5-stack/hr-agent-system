# 测试报告

## API 构建

命令：

```powershell
npm run build:api
```

结果：通过。

关键输出：

```text
> hr-agent-system@1.0.0 build:api
> npm --workspace @hr-agent-system/api run build

> @hr-agent-system/api@1.0.0 build
> node --max-old-space-size=8192 ../../node_modules/typescript/bin/tsc -p tsconfig.build.json
```

## 商业化就绪检查

命令：

```powershell
npm run verify:commercial
```

结果：通过，0 个失败，2 个警告。

警告：

1. `HR_DEMO_PASSWORD` 未设置。
2. 未启用 `--live`，在线就绪检查被跳过。

关键输出：

```text
基础商用就绪检查：0 个失败，2 个警告
```

## 未执行项

未启动完整服务做 live smoke test。本轮变更集中在后端 TypeScript 契约和文档，已用 API 构建与商业化检查覆盖。
