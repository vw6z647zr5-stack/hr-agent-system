# SME 试用流程指南

## 快速启动

### 方式一：一键启动（推荐）

```bash
# Windows
start-all.cmd

# 或者
node scripts/start-all.js
```

### 方式二：手动启动

```bash
# 1. 启动基础设施
docker compose up postgres redis -d

# 2. 启动后端 API
npm run dev:api

# 3. 启动前端 Web
npm run dev:web
```

---

## 访问地址

| 服务 | 地址 |
|------|------|
| 前端界面 | http://127.0.0.1:5173 |
| 后端 API | http://127.0.0.1:3000/api |
| 候选人门户 | http://127.0.0.1:5173/career |

---

## 试用配置

### 试用期参数

```typescript
// apps/api/src/company/company.service.ts
const defaultTrialDays = 30;      // 试用天数
const defaultMaxUsers = 20;       // 最大用户数
```

### 默认功能开关

```typescript
const defaultFeatures = {
  recruitment: true,    // 招聘模块
  attendance: true,     // 考勤模块
  performance: true,    // 绩效模块
  payroll: false,       // 薪酬模块（试用期默认关闭）
  aiAgent: true,        // AI 助手
};
```

---

## 试用流程

### 步骤 1：注册企业

1. 访问 http://127.0.0.1:5173/register
2. 填写企业信息：
   - 企业名称
   - 行业
   - 企业规模
   - 联系人信息
3. 设置管理员账号：
   - 管理员用户名（至少3个字符）
   - 管理员姓名
   - 管理员邮箱
   - 管理员密码（至少8位）
4. 点击「开通试用」

### 步骤 2：登录系统

注册成功后会自动登录，也可以手动访问 http://127.0.0.1:5173/login

**演示账号**（如有种子数据）：
- 管理员：admin / <密码>
- 人力资源：hr_admin / <密码>
- 经理：manager_zhang / <密码>
- 员工：employee_li / <密码>

### 步骤 3：体验功能

#### 管理员/人力资源功能

1. **组织管理**
   - 部门管理
   - 岗位管理
   - 员工档案
   - 合同管理

2. **招聘协同**
   - 职位发布
   - 候选人管理
   - 简历解析（AI）
   - 匹配评分（AI）

3. **考勤假期**
   - 考勤记录
   - 请假申请
   - 假期余额
   - 加班管理

4. **绩效评估**
   - 绩效周期
   - 目标管理
   - 绩效评审

5. **知识中心**
   - 知识库文章
   - 文档导入
   - 公司基础信息

#### 员工功能

1. **员工自助**
   - 个人信息查看
   - 假期余额
   - 工资单查看
   - 请假申请

2. **AI 助手**
   - 政策咨询
   - 假期查询
   - 流程指引

#### 候选人功能

1. **候选人门户**
   - 职位浏览
   - 简历投递
   - 申请状态查询
   - 职位匹配

---

## 试用期管理

### 试用状态检查

访问 API 端点：
```bash
GET /api/companies/me/trial
Authorization: Bearer <token>
```

响应示例：
```json
{
  "trialEndsAt": "2026-06-03T00:00:00.000Z",
  "daysRemaining": 30,
  "isExpired": false,
  "status": "trial",
  "maxUsers": 20,
  "userCount": 1,
  "features": {
    "recruitment": true,
    "attendance": true,
    "performance": true,
    "payroll": false,
    "aiAgent": true
  }
}
```

### 试用期横幅

系统会在仪表盘顶部显示试用期状态：

- **正常试用**：显示剩余天数（蓝色信息框）
- **即将到期**：剩余 ≤7 天（黄色警告框）
- **已过期**：试用结束（红色错误框，只读模式）

---

## 试用限制

### 用户数量限制

- 最大用户数：20
- 超出限制时无法创建新用户

### 功能限制

| 模块 | 试用期 | 正式版 |
|------|--------|--------|
| 组织管理 | ✅ | ✅ |
| 招聘协同 | ✅ | ✅ |
| 考勤假期 | ✅ | ✅ |
| 绩效评估 | ✅ | ✅ |
| 薪酬管理 | ❌ | ✅ |
| AI 助手 | ✅ | ✅ |

### 数据保留

- 试用期数据完整保留
- 升级正式版后数据无缝迁移

---

## 候选人试用流程

### 公开职位浏览

1. 访问 http://127.0.0.1:5173/career
2. 浏览已发布的职位
3. 查看职位详情

### 候选人注册

1. 访问 http://127.0.0.1:5173/career/register
2. 填写注册信息：
   - 姓名
   - 邮箱
   - 用户名
   - 密码
3. 完成注册

### 投递简历

1. 登录候选人门户 http://127.0.0.1:5173/career/me
2. 选择职位
3. 上传简历（PDF/DOCX）
4. 提交申请

### 查看匹配结果

系统会自动：
1. 解析简历内容
2. 计算匹配分数
3. 生成匹配摘要

---

## API 试用接口

### 企业注册

```bash
POST /api/companies/register
Content-Type: application/json

{
  "companyName": "测试科技有限公司",
  "industry": "it",
  "size": "1-50",
  "contactName": "张三",
  "contactEmail": "zhangsan@test.com",
  "contactPhone": "13800138000",
  "adminUsername": "admin",
  "adminEmail": "admin@test.com",
  "adminPassword": "password123",
  "adminDisplayName": "系统管理员"
}
```

### 用户登录

```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password123"
}
```

### 获取试用状态

```bash
GET /api/companies/me/trial
Authorization: Bearer <access_token>
```

---

## 常见问题

### Q: 试用期结束后会怎样？

A: 系统进入只读模式，用户可以查看数据但无法进行修改操作。

### Q: 如何延长试用期？

A: 联系系统管理员修改数据库中的 `trial_ends_at` 字段。

### Q: 如何开通薪酬模块？

A: 联系系统管理员将 `features.payroll` 设置为 `true`。

### Q: 数据会丢失吗？

A: 不会，所有数据在试用期和正式版之间完整保留。

### Q: 如何重置试用？

A: 删除企业记录并重新注册，或修改数据库中的试用状态。

---

## 技术架构

### 试用期控制流程

```
用户请求 → JWT认证 → 租户隔离 → 功能检查 → 试用期检查 → 业务处理
```

### 关键代码位置

| 功能 | 文件路径 |
|------|----------|
| 企业注册 | `apps/api/src/company/company.service.ts` |
| 试用状态 | `apps/api/src/company/company.service.ts:getTrialStatus()` |
| 功能开关 | `apps/api/src/tenant/feature-guard.ts` |
| 试用横幅 | `apps/web/src/components/TrialBanner.tsx` |
| 注册页面 | `apps/web/src/pages/CompanyRegisterPage.tsx` |

---

## 调试技巧

### 查看试用配置

```bash
# 连接数据库
docker exec -it hr-agent-postgres psql -U hr_admin -d hr_agent

# 查询企业试用信息
SELECT id, name, status, trial_ends_at, max_users, features FROM companies;
```

### 修改试用期

```sql
-- 延长试用期30天
UPDATE companies 
SET trial_ends_at = NOW() + INTERVAL '30 days' 
WHERE id = '<company_id>';
```

### 开通薪酬模块

```sql
-- 开通薪酬功能
UPDATE companies 
SET features = features || '{"payroll": true}'::jsonb 
WHERE id = '<company_id>';
```

---

## 下一步

1. **体验完整流程**：注册 → 添加员工 → 发布职位 → 处理申请
2. **测试 AI 功能**：简历解析、匹配评分、智能助手
3. **查看数据看板**：仪表盘、招聘漏斗、人员结构
4. **评估升级需求**：联系销售获取正式版授权

---

**文档版本**: 1.0  
**最后更新**: 2026年5月4日
