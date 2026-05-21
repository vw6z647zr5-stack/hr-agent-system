const apiBase = process.env.VERIFY_API_BASE || 'http://127.0.0.1:3000/api';
const defaultPassword = process.env.HR_DEMO_PASSWORD || process.env.VERIFY_DEMO_PASSWORD;
const suffix = Date.now().toString().slice(-8);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function ensureOk(response, label, expected = [200, 201]) {
  if (!expected.includes(response.status)) {
    const text = await response.text();
    throw new Error(`${label} -> ${response.status} ${text}`);
  }
  return response;
}

async function login(username) {
  if (!defaultPassword) {
    throw new Error('请通过 HR_DEMO_PASSWORD 或 VERIFY_DEMO_PASSWORD 提供演示账号密码。');
  }

  const response = await ensureOk(
    await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password: defaultPassword }),
    }),
    `login:${username}`,
  );
  return response.json();
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function request(path, token, options = {}, expected = [200, 201]) {
  const headers = new Headers(options.headers || {});
  headers.set('authorization', `Bearer ${token}`);
  if (!headers.has('content-type') && options.body) {
    headers.set('content-type', 'application/json');
  }
  const response = await ensureOk(await fetch(`${apiBase}${path}`, { ...options, headers }), path, expected);
  const text = await response.text();
  return text.trim() ? JSON.parse(text) : null;
}

async function listResource(endpoint, token, params = {}) {
  return request(`/${endpoint}${buildQuery({ page: 1, limit: 20, ...params })}`, token);
}

async function createResource(endpoint, token, payload) {
  return request(`/${endpoint}`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function updateResource(endpoint, id, token, payload) {
  return request(`/${endpoint}/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

async function removeResource(endpoint, id, token) {
  return request(`/${endpoint}/${id}`, token, { method: 'DELETE' }, [200, 204]);
}

function isoDate(days = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function main() {
  const hr = await login('hr_admin');
  const token = hr.accessToken;
  const cleanup = [];

  try {
    const departments = await listResource('departments', token);
    const positions = await listResource('positions', token);
    const department = departments.items[0];
    const position = positions.items[0];
    assert(department?.id, '缺少可用部门数据');
    assert(position?.id, '缺少可用岗位数据');

    const jobPosting = await createResource('job-postings', token, {
      departmentId: department.id,
      positionId: position.id,
      title: `流程验收岗位${suffix}`,
      employmentType: 'full_time',
      location: '上海',
      description: '用于验证招聘流程事件和入职待办。',
      requirements: 'Node.js React PostgreSQL',
      status: 'open',
      targetCount: 1,
      publishedAt: new Date().toISOString(),
      closedAt: null,
    });
    cleanup.unshift(() => removeResource('job-postings', jobPosting.id, token));

    const candidate = await createResource('candidates', token, {
      appliedJobPostingId: jobPosting.id,
      fullName: `流程候选人${suffix}`,
      email: `workflow-candidate-${suffix}@example.com`,
      phone: `136${suffix.slice(-8)}`,
      source: 'referral',
      stage: 'screening',
      status: 'active',
      currentCompany: '流程科技',
      yearsOfExperience: 4,
      skills: ['Node.js', 'React', 'PostgreSQL'],
      aiMatchScore: 82,
      notes: '流程验收候选人',
    });
    cleanup.unshift(() => removeResource('candidates', candidate.id, token));

    await updateResource('candidates', candidate.id, token, {
      stage: 'interview',
    });

    const offer = await createResource('offers', token, {
      candidateId: candidate.id,
      jobPostingId: jobPosting.id,
      approvalByEmployeeId: null,
      salaryOffered: 26000,
      status: 'draft',
      offeredAt: new Date().toISOString(),
      acceptedAt: null,
      notes: '流程验收录用',
    });
    cleanup.unshift(() => removeResource('offers', offer.id, token));

    await updateResource('offers', offer.id, token, {
      status: 'accepted',
      acceptedAt: new Date().toISOString(),
    });

    const events = await request(`/workflow/events${buildQuery({ entityType: 'candidate', entityId: candidate.id, limit: 50 })}`, token);
    assert(events.some((item) => item.category === 'candidate'), '候选人创建/阶段事件未写入时间线');
    assert(events.some((item) => item.category === 'offer'), '录用事件未写入时间线');
    assert(events.some((item) => item.category === 'onboarding'), '入职事件未写入时间线');

    const tasks = await request('/workflow/tasks?status=all&limit=100', token);
    const onboardingTasks = tasks.filter((item) => item.relatedEntityId === candidate.id && item.category === 'onboarding');
    assert(onboardingTasks.length >= 4, '录用接受后未生成完整入职待办');

    const notifications = await request('/workflow/notifications?limit=50', token);
    assert(
      notifications.some((item) => item.metadata?.candidateId === candidate.id),
      '招聘流程通知未生成或未返回',
    );

    const employees = await listResource('employees', token, { search: candidate.email });
    const generatedEmployee = employees.items.find((item) => item.email === candidate.email);
    assert(generatedEmployee?.id, '录用接受后未生成员工档案');
    cleanup.unshift(() => removeResource('employees', generatedEmployee.id, token));

    const contracts = await listResource('employee-contracts', token, { search: `ONB-${isoDate().replace(/-/g, '')}` });
    const generatedContract = contracts.items.find((item) => item.employeeId === generatedEmployee.id);
    if (generatedContract?.id) {
      cleanup.unshift(() => removeResource('employee-contracts', generatedContract.id, token));
    }

    console.log(JSON.stringify({
      ok: true,
      candidateId: candidate.id,
      offerId: offer.id,
      onboardingTaskCount: onboardingTasks.length,
      generatedEmployeeId: generatedEmployee.id,
    }, null, 2));
  } finally {
    for (const task of cleanup) {
      try {
        await task();
      } catch (error) {
        console.error(`清理失败：${(error && error.message) || error}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
