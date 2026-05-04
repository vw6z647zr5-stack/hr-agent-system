const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('请先设置 DATABASE_URL。');
  process.exit(1);
}

const sql = `
BEGIN;

UPDATE job_postings
SET
  department_id = '10000000-0000-4000-8000-000000000003',
  position_id = '20000000-0000-4000-8000-000000000004',
  title = '后端平台工程师',
  location = '上海 / 混合办公',
  description = '负责人力资源平台后端服务、工作流编排、数据接口和智能能力接入。',
  requirements = '熟悉 Node.js、NestJS、PostgreSQL、Redis 和 TypeScript，具备中后台系统开发经验。',
  status = 'open',
  published_at = COALESCE(published_at, NOW())
WHERE id = '11ece373-ba24-477f-86ad-98d76b558229'
   OR title LIKE '%??%'
   OR description LIKE '%??%'
   OR requirements LIKE '%??%';

UPDATE candidates
SET
  full_name = '赵明',
  current_company = '星河科技',
  notes = '候选人通过门户自助注册，等待补充完整简历信息。'
WHERE full_name LIKE '%??%'
   OR current_company LIKE '%??%'
   OR notes LIKE '%??%'
   OR email = 'candidate.portal@example.com';

UPDATE candidates
SET
  full_name = '张然',
  current_company = '待补充',
  notes = '候选人通过门户自助注册，等待补充完整简历信息。'
WHERE email = 'portal.candidate@example.com'
   OR current_company LIKE '%??%';

UPDATE resumes
SET
  file_name = CASE
    WHEN candidate_id IN (
      SELECT id FROM candidates WHERE email = 'candidate.portal@example.com'
    ) THEN '赵明_简历.pdf'
    WHEN candidate_id IN (
      SELECT id FROM candidates WHERE email = 'portal.candidate@example.com'
    ) THEN '张然_简历.pdf'
    WHEN file_name LIKE '%??%' THEN '候选人_简历.pdf'
    ELSE file_name
  END,
  parsed_text = CASE
    WHEN candidate_id IN (
      SELECT id FROM candidates WHERE email = 'candidate.portal@example.com'
    ) THEN '赵明，4 年后端开发经验，熟悉 Node.js、TypeScript、PostgreSQL。'
    WHEN candidate_id IN (
      SELECT id FROM candidates WHERE email = 'portal.candidate@example.com'
    ) THEN '张然，2 年产品经验，熟悉需求分析和产品设计。'
    WHEN parsed_text LIKE '%??%' THEN '候选人简历文本待重新解析。'
    ELSE parsed_text
  END,
  parsed_profile = CASE
    WHEN candidate_id IN (
      SELECT id FROM candidates WHERE email = 'candidate.portal@example.com'
    ) THEN '{"name":"赵明","phone":"13900000006","email":"candidate.portal@example.com","skills":["Node.js","TypeScript","PostgreSQL"],"summary":"候选人门户测试账号，待补充完整简历信息。"}'::jsonb
    WHEN candidate_id IN (
      SELECT id FROM candidates WHERE email = 'portal.candidate@example.com'
    ) THEN '{"name":"张然","phone":"13900000007","email":"portal.candidate@example.com","skills":["产品设计","需求分析"],"summary":"候选人门户测试账号，待补充完整简历信息。"}'::jsonb
    WHEN parsed_profile::text LIKE '%??%' THEN '{"summary":"候选人简历待重新解析","skills":[]}'::jsonb
    ELSE parsed_profile
  END
WHERE file_name LIKE '%??%'
   OR parsed_text LIKE '%??%'
   OR parsed_profile::text LIKE '%??%'
   OR candidate_id IN (
     SELECT id FROM candidates WHERE email IN ('candidate.portal@example.com', 'portal.candidate@example.com')
   );

COMMIT;
`;

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(sql);
    console.log('招聘乱码数据修复完成。');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
