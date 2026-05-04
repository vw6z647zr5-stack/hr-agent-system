#!/usr/bin/env node

/**
 * 批量重算所有候选人的智能匹配分并写入数据库。
 *
 * 用法:
 *   node scripts/recalculate-all-scores.js
 *
 * 前置条件：API 服务已启动（`npm start` 或 `npm run dev:api`）。
 */

const API = 'http://127.0.0.1:3000';
const ADMIN_USERNAME = process.env.HR_ADMIN_USERNAME || 'hr_admin';
const ADMIN_PASSWORD = process.env.HR_DEMO_PASSWORD || process.env.HR_ADMIN_PASSWORD;

async function main() {
  if (!ADMIN_PASSWORD) {
    console.error('请通过 HR_DEMO_PASSWORD 或 HR_ADMIN_PASSWORD 提供管理员密码。');
    process.exit(1);
  }

  // 1. 登录并获取 JWT 令牌。
  console.log('[1/3] 登录获取认证令牌...');
  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
  });

  if (!loginRes.ok) {
    console.error('登录失败。请确认 API 服务已启动且默认账号可用。');
    process.exit(1);
  }

  const { accessToken } = await loginRes.json();
  console.log('  令牌获取成功\n');

  // 2. 触发批量重算。
  console.log('[2/3] 正在重算全部候选人智能匹配分...\n');
  const startTime = Date.now();
  const recalcRes = await fetch(`${API}/api/agent/recruitment/recalculate-all-scores`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });

  if (!recalcRes.ok) {
    console.error('批量重算请求失败:', recalcRes.status, recalcRes.statusText);
    process.exit(1);
  }

  const results = await recalcRes.json();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // 3. 输出重算结果。
  console.log(`[3/3] 完成 (${elapsed}s)\n`);
  console.log('姓名                智能匹配分');
  console.log('─'.repeat(35));

  let success = 0;
  let failed = 0;
  for (const r of results) {
    const name = (r.name ?? '?').padEnd(18);
    if (r.score >= 0) {
      console.log(`${name} ${r.score}`);
      success++;
    } else {
      console.log(`${name} ERROR`);
      failed++;
    }
  }

  console.log('─'.repeat(35));
  console.log(`成功 ${success} 人，失败 ${failed} 人`);
  console.log('\n所有候选人的 ai_match_score 已更新到数据库。');
}

main().catch((err) => {
  console.error('执行失败:', err.message);
  process.exit(1);
});
