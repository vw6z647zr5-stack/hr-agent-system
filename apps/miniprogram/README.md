# 智能人事小程序

这是智能人事系统的微信小程序 MVP，使用原生小程序语法实现，不依赖额外构建工具。

## 官方框架对齐

当前工程按微信小程序官方框架组织，参考入口：

- 框架文档：`https://developers.weixin.qq.com/miniprogram/dev/framework/`
- 小程序全局配置：`app.json`
- 小程序全局逻辑：`app.js`
- 小程序全局样式：`app.wxss`
- 页面四件套：`index.json`、`index.js`、`index.wxml`、`index.wxss`

`app.json` 中的 `pages` 声明页面路由，第一项 `pages/home/index` 为默认首页；`tabBar` 声明底部五个主入口；`sitemapLocation` 指向 `sitemap.json`。

## 当前范围

- 账号登录：复用后端 `/api/auth/login`
- 首页：根据角色展示员工自助或候选人投递摘要
- 员工自助：提交请假、加班、资料变更，查看最近申请
- 知识问答：调用员工服务问答智能体
- 职位投递：查看开放职位并上传简历
- 我的：查看账号信息并配置后端接口地址

## 本地运行

1. 启动后端服务，默认地址为 `http://127.0.0.1:3000/api`。
2. 打开微信开发者工具。
3. 导入目录：`apps/miniprogram`。
4. 本地联调时关闭开发者工具里的“校验合法域名”。
5. 真机或正式版需要把后端接口换成 HTTPS 域名，并在微信公众平台配置请求合法域名。

## 常用账号

- 员工：`employee_li`
- 经理：`manager_zhang`
- 人力资源：`hr_admin`
- 候选人：`candidate_demo`

默认密码：`Password@123`

## 校验

```powershell
npm run check:miniprogram
```

该命令会检查小程序配置、页面文件完整性、脚本语法和疑似乱码。
