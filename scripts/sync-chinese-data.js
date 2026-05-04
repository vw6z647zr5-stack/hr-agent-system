const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('请先设置 DATABASE_URL。');
  process.exit(1);
}

const sql = `
BEGIN;

UPDATE departments
SET
  name = CASE id
    WHEN '10000000-0000-4000-8000-000000000001' THEN '总部'
    WHEN '10000000-0000-4000-8000-000000000002' THEN '人力资源部'
    WHEN '10000000-0000-4000-8000-000000000003' THEN '工程部'
    WHEN '10000000-0000-4000-8000-000000000004' THEN '销售部'
    ELSE name
  END,
  description = CASE id
    WHEN '10000000-0000-4000-8000-000000000001' THEN '公司总部'
    WHEN '10000000-0000-4000-8000-000000000002' THEN '负责人力运营与招聘'
    WHEN '10000000-0000-4000-8000-000000000003' THEN '负责产品研发与平台交付'
    WHEN '10000000-0000-4000-8000-000000000004' THEN '负责销售拓展与收入运营'
    ELSE description
  END
WHERE id IN (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004'
);

UPDATE positions
SET
  name = CASE id
    WHEN '20000000-0000-4000-8000-000000000001' THEN '人力资源经理'
    WHEN '20000000-0000-4000-8000-000000000002' THEN '招聘专员'
    WHEN '20000000-0000-4000-8000-000000000003' THEN '工程经理'
    WHEN '20000000-0000-4000-8000-000000000004' THEN '软件工程师'
    ELSE name
  END,
  description = CASE id
    WHEN '20000000-0000-4000-8000-000000000001' THEN '负责整体人力运营'
    WHEN '20000000-0000-4000-8000-000000000002' THEN '负责人才招聘与渠道运营'
    WHEN '20000000-0000-4000-8000-000000000003' THEN '负责工程团队管理'
    WHEN '20000000-0000-4000-8000-000000000004' THEN '负责产品功能研发'
    ELSE description
  END
WHERE id IN (
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000004'
);

UPDATE users
SET display_name = CASE id
  WHEN '30000000-0000-4000-8000-000000000001' THEN '系统管理员'
  WHEN '30000000-0000-4000-8000-000000000002' THEN '王璇'
  WHEN '30000000-0000-4000-8000-000000000003' THEN '张衡'
  WHEN '30000000-0000-4000-8000-000000000004' THEN '李岚'
  ELSE display_name
END
WHERE id IN (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000003',
  '30000000-0000-4000-8000-000000000004'
);

UPDATE employees
SET
  full_name = CASE id
    WHEN '40000000-0000-4000-8000-000000000001' THEN '王璇'
    WHEN '40000000-0000-4000-8000-000000000002' THEN '张衡'
    WHEN '40000000-0000-4000-8000-000000000003' THEN '李岚'
    ELSE full_name
  END,
  education = CASE id
    WHEN '40000000-0000-4000-8000-000000000001' THEN '人力资源管理硕士'
    WHEN '40000000-0000-4000-8000-000000000002' THEN '计算机科学学士'
    WHEN '40000000-0000-4000-8000-000000000003' THEN '软件工程学士'
    ELSE education
  END,
  certificates = CASE id
    WHEN '40000000-0000-4000-8000-000000000001' THEN '["一级人力资源管理师"]'::jsonb
    WHEN '40000000-0000-4000-8000-000000000002' THEN '["PMP 项目管理认证","AWS 解决方案架构师认证"]'::jsonb
    WHEN '40000000-0000-4000-8000-000000000003' THEN '["Oracle Java SE 11 认证"]'::jsonb
    ELSE certificates
  END,
  address = CASE id
    WHEN '40000000-0000-4000-8000-000000000001' THEN '上海浦东新区'
    WHEN '40000000-0000-4000-8000-000000000002' THEN '上海闵行区'
    WHEN '40000000-0000-4000-8000-000000000003' THEN '上海徐汇区'
    ELSE address
  END,
  emergency_contact = CASE id
    WHEN '40000000-0000-4000-8000-000000000001' THEN '{"name":"王家属","phone":"13888880001"}'::jsonb
    WHEN '40000000-0000-4000-8000-000000000002' THEN '{"name":"张配偶","phone":"13888880002"}'::jsonb
    WHEN '40000000-0000-4000-8000-000000000003' THEN '{"name":"李家属","phone":"13888880003"}'::jsonb
    ELSE emergency_contact
  END,
  profile_summary = CASE id
    WHEN '40000000-0000-4000-8000-000000000001' THEN '负责人力运营、招聘与员工关系。'
    WHEN '40000000-0000-4000-8000-000000000002' THEN '负责后端与平台工程团队管理。'
    WHEN '40000000-0000-4000-8000-000000000003' THEN '专注于人力资源平台服务的后端工程师。'
    ELSE profile_summary
  END
WHERE id IN (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003'
);

UPDATE employee_contracts
SET notes = CASE id
  WHEN '50000000-0000-4000-8000-000000000001' THEN '人力资源经理主合同'
  WHEN '50000000-0000-4000-8000-000000000002' THEN '工程经理劳动合同'
  WHEN '50000000-0000-4000-8000-000000000003' THEN '软件工程师劳动合同'
  ELSE notes
END
WHERE id IN (
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000003'
);

UPDATE job_postings
SET
  title = '高级后端工程师',
  location = '上海 / 混合办公',
  description = '负责构建人力资源工作流与智能编排服务。',
  requirements = '熟悉 Node.js、NestJS、PostgreSQL、分布式系统以及系统设计。'
WHERE id = '60000000-0000-4000-8000-000000000001';

UPDATE candidates
SET
  full_name = '陈晨',
  current_company = '技流科技',
  notes = '后端基础扎实，并具备相关智能工作流经验。'
WHERE id = '70000000-0000-4000-8000-000000000001';

UPDATE resumes
SET
  file_name = '陈晨_简历.pdf',
  parsed_text = '陈晨，具备 6.5 年后端开发经验，熟悉 NestJS、PostgreSQL、Redis、LangChain。',
  parsed_profile = '{"name":"陈晨","phone":"13900000001","email":"chen.candidate@example.com","skills":["NestJS","PostgreSQL","Redis","LangChain"],"workExperience":[{"company":"技流科技","years":4},{"company":"云轴科技","years":2.5}]}'::jsonb
WHERE id = '71000000-0000-4000-8000-000000000001';

UPDATE interviews
SET feedback = '技术轮面试，重点确认微服务设计与数据建模能力。'
WHERE id = '72000000-0000-4000-8000-000000000001';

UPDATE offers
SET notes = '录用方案已准备，待最终面试结果确认后推进。'
WHERE id = '73000000-0000-4000-8000-000000000001';

UPDATE attendances
SET anomaly_reason = CASE id
  WHEN '80000000-0000-4000-8000-000000000001' THEN '轻微迟到'
  WHEN '80000000-0000-4000-8000-000000000002' THEN '迟到并早退'
  WHEN '80000000-0000-4000-8000-000000000004' THEN '交通延误'
  ELSE anomaly_reason
END
WHERE id IN (
  '80000000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000002',
  '80000000-0000-4000-8000-000000000004'
);

UPDATE leave_requests
SET reason = '家庭事务'
WHERE id = '82000000-0000-4000-8000-000000000001';

UPDATE overtime_requests
SET reason = '版本发布保障'
WHERE id = '83000000-0000-4000-8000-000000000001';

UPDATE performance_cycles
SET name = CASE id
  WHEN '90000000-0000-4000-8000-000000000001' THEN '2026 年第一季度评估'
  WHEN '90000000-0000-4000-8000-000000000002' THEN '2026 年第二季度评估'
  ELSE name
END
WHERE id IN (
  '90000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000002'
);

UPDATE performance_goals
SET
  title = CASE id
    WHEN '91000000-0000-4000-8000-000000000001' THEN '交付智能招聘评分服务'
    WHEN '91000000-0000-4000-8000-000000000002' THEN '提升研发交付可预测性'
    ELSE title
  END,
  target_value = CASE id
    WHEN '91000000-0000-4000-8000-000000000001' THEN '上线生产服务'
    WHEN '91000000-0000-4000-8000-000000000002' THEN '按时交付率 >= 90%'
    ELSE target_value
  END,
  current_value = CASE id
    WHEN '91000000-0000-4000-8000-000000000001' THEN 'API 与前端界面已完成，正在进行用户验收测试'
    WHEN '91000000-0000-4000-8000-000000000002' THEN '当前预测为 92%'
    ELSE current_value
  END,
  description = CASE id
    WHEN '91000000-0000-4000-8000-000000000001' THEN '负责后端服务与工作台集成。'
    WHEN '91000000-0000-4000-8000-000000000002' THEN '优化迭代计划与依赖项跟踪。'
    ELSE description
  END
WHERE id IN (
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002'
);

UPDATE performance_reviews
SET
  strengths = CASE id
    WHEN '92000000-0000-4000-8000-000000000001' THEN '主人翁意识强，交付节奏快。'
    WHEN '92000000-0000-4000-8000-000000000002' THEN '团队带领能力强，技术架构能力扎实。'
    ELSE strengths
  END,
  improvements = CASE id
    WHEN '92000000-0000-4000-8000-000000000001' THEN '跨团队依赖风险需要更早升级沟通。'
    WHEN '92000000-0000-4000-8000-000000000002' THEN '可进一步提升与利益相关方的沟通节奏。'
    ELSE improvements
  END,
  summary = CASE id
    WHEN '92000000-0000-4000-8000-000000000001' THEN '具备较高潜力，整体交付稳定。'
    WHEN '92000000-0000-4000-8000-000000000002' THEN '技术执行力稳定，是可靠的团队管理者。'
    ELSE summary
  END
WHERE id IN (
  '92000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000002'
);

UPDATE knowledge_base_articles
SET
  title = CASE id
    WHEN 'b0000000-0000-4000-8000-000000000001' THEN '年假余额查询'
    WHEN 'b0000000-0000-4000-8000-000000000002' THEN '加班审批流程'
    WHEN 'b0000000-0000-4000-8000-000000000003' THEN '工资单查看'
    ELSE title
  END,
  question = CASE id
    WHEN 'b0000000-0000-4000-8000-000000000001' THEN '如何查看我的年假余额？'
    WHEN 'b0000000-0000-4000-8000-000000000002' THEN '加班申请的审批流程是什么？'
    WHEN 'b0000000-0000-4000-8000-000000000003' THEN '我可以在哪里下载工资单？'
    ELSE question
  END,
  answer = CASE id
    WHEN 'b0000000-0000-4000-8000-000000000001' THEN '打开员工自助看板，或直接询问员工服务助手。系统会实时从 leave_balances 表读取你的假期余额。'
    WHEN 'b0000000-0000-4000-8000-000000000002' THEN '提交加班申请时需要填写日期、开始时间、结束时间和原因。直属经理审批通过后，薪酬模块会在生成工资记录时引用这些已批准的加班数据。'
    WHEN 'b0000000-0000-4000-8000-000000000003' THEN '已发布的工资单可以在员工看板的薪酬区域查看。是否对员工可见由 payslips.visible_to_employee 字段控制。'
    ELSE answer
  END,
  tags = CASE id
    WHEN 'b0000000-0000-4000-8000-000000000001' THEN '["请假","余额","员工自助"]'::jsonb
    WHEN 'b0000000-0000-4000-8000-000000000002' THEN '["加班","审批","流程"]'::jsonb
    WHEN 'b0000000-0000-4000-8000-000000000003' THEN '["薪酬","工资单","福利"]'::jsonb
    ELSE tags
  END
WHERE id IN (
  'b0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000003'
);

UPDATE profile_change_requests
SET changes = '{"address":"上海静安区","phone":"13800009999"}'::jsonb
WHERE id = 'c0000000-0000-4000-8000-000000000001';

COMMIT;
`;

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(sql);
    console.log('中文种子数据同步完成。');
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
