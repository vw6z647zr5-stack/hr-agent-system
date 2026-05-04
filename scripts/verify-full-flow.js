const { Blob } = globalThis;
const { readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');

const apiBase = process.env.VERIFY_API_BASE || 'http://127.0.0.1:3000/api';
const webBase = process.env.VERIFY_WEB_BASE || 'http://127.0.0.1:4173';
const defaultPassword = process.env.HR_DEMO_PASSWORD || process.env.VERIFY_DEMO_PASSWORD;
const suffix = `${Date.now()}`;
const shortSuffix = suffix.slice(-8);

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

async function fetchWithDiagnostics(url, options = {}, label = url) {
  try {
    return await fetch(url, options);
  } catch (error) {
    const serviceHint = String(url).startsWith(webBase)
      ? `前端预览服务不可访问：${webBase}`
      : `后端接口服务不可访问：${apiBase}`;
    throw new Error(
      `${label} 请求失败。${serviceHint}。请先启动对应服务，或通过 VERIFY_WEB_BASE / VERIFY_API_BASE 指向已运行的服务。原始错误：${
        (error && error.message) || error
      }`,
    );
  }
}

async function login(username, password = defaultPassword) {
  if (!password) {
    throw new Error('请通过 HR_DEMO_PASSWORD 或 VERIFY_DEMO_PASSWORD 提供演示账号密码。');
  }

  const response = await ensureOk(
    await fetchWithDiagnostics(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }, `login:${username}`),
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

  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  if (!headers.has('content-type') && options.body && !(options.body instanceof FormData)) {
    headers.set('content-type', 'application/json');
  }

  const response = await ensureOk(
    await fetchWithDiagnostics(`${apiBase}${path}`, {
      ...options,
      headers,
    }, path),
    path,
    expected,
  );

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

async function listResource(endpoint, token, params = {}) {
  return request(`/${endpoint}${buildQuery({ page: 1, limit: 10, ...params })}`, token);
}

async function getResource(endpoint, id, token) {
  return request(`/${endpoint}/${id}`, token);
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
  return request(`/${endpoint}/${id}`, token, { method: 'DELETE' });
}

async function fetchPage(path) {
  const response = await ensureOk(await fetchWithDiagnostics(`${webBase}${path}`, {}, `page:${path}`), `page:${path}`, [200]);
  const html = await response.text();
  assert(html.includes('<div id="root"></div>'), `page:${path} 缺少前端挂载节点`);
}

async function downloadFile(path, token) {
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  const response = await ensureOk(await fetchWithDiagnostics(`${apiBase}${path}`, { headers }, `download:${path}`), `download:${path}`, [200]);
  await response.arrayBuffer();
  return response.headers.get('content-type');
}

async function expectDownloadRejected(path, token, expected = [401, 403, 404]) {
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  const response = await fetchWithDiagnostics(`${apiBase}${path}`, { headers }, `download-reject:${path}`);

  if (!expected.includes(response.status)) {
    const text = await response.text();
    throw new Error(`download-reject:${path} -> ${response.status} ${text}`);
  }

  return response.status;
}

function toIsoDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function toIsoDateTime(date) {
  return new Date(date).toISOString();
}

function nextDays(days, hour = 9, minute = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
}

async function uploadResume(candidateId, token) {
  const form = new FormData();
  const docxBuffer = readFileSync('docs/samples/candidate-resume.docx');
  form.append(
    'file',
    new Blob([docxBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }),
    `resume-${shortSuffix}.docx`,
  );

  return request(`/resumes/upload/${candidateId}`, token, {
    method: 'POST',
    body: form,
  });
}

async function previewKnowledgeImport(token, fileName = `import-policy-${shortSuffix}.docx`) {
  const form = new FormData();
  const docxBuffer = readFileSync('docs/samples/candidate-resume.docx');
  form.append(
    'file',
    new Blob([docxBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }),
    fileName,
  );

  return request('/knowledge-management/document-imports/preview', token, {
    method: 'POST',
    body: form,
  });
}

function step(summary, label) {
  summary.steps.push(label);
  console.log(label);
}

async function main() {
  execFileSync(process.execPath, ['scripts/prepare-sample-files.js'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });

  const summary = {
    steps: [],
    created: {},
    checks: {},
  };

  const created = {
    profileChangeRequestId: null,
    uploadedResumeId: null,
    uploadedResumePath: null,
    selfLeaveRequestId: null,
    selfOvertimeRequestId: null,
  };

  const routes = [
    '/',
    '/login',
    '/dashboard',
    '/knowledge-center',
    '/self-service',
    '/recruitment-workbench',
    '/profile-change-reviews',
    '/resources/departments',
    '/resources/positions',
    '/resources/employees',
    '/resources/employee-contracts',
    '/resources/job-postings',
    '/resources/candidates',
    '/resources/resumes',
    '/resources/interviews',
    '/resources/offers',
    '/resources/attendances',
    '/resources/leave-requests',
    '/resources/leave-balances',
    '/resources/overtime-requests',
    '/resources/performance-cycles',
    '/resources/performance-goals',
    '/resources/performance-reviews',
    '/resources/salary-configs',
    '/resources/salary-records',
    '/resources/payslips',
  ];

  const cleanupTasks = [];

  try {
    step(summary, '验证前端主路由可访问');
    for (const route of routes) {
      await fetchPage(route);
    }

    step(summary, '登录四类账号并获取当前用户信息');
    const admin = await login('admin');
    const hr = await login('hr_admin');
    const manager = await login('manager_zhang');
    const employee = await login('employee_li');

    const adminMe = await request('/auth/me', admin.accessToken);
    const hrMe = await request('/auth/me', hr.accessToken);
    const managerMe = await request('/auth/me', manager.accessToken);
    const employeeMe = await request('/auth/me', employee.accessToken);

    assert(adminMe.username === 'admin', 'admin auth/me 返回异常');
    assert(hrMe.username === 'hr_admin', '人力资源账号 auth/me 返回异常');
    assert(managerMe.username === 'manager_zhang', 'manager auth/me 返回异常');
    assert(employeeMe.username === 'employee_li', 'employee auth/me 返回异常');

    const hrEmployeeId = hrMe.employee?.id;
    const managerEmployeeId = managerMe.employee?.id;
    const employeeEmployeeId = employeeMe.employee?.id;

    assert(hrEmployeeId, 'hr_admin 未绑定员工档案');
    assert(managerEmployeeId, 'manager_zhang 未绑定员工档案');
    assert(employeeEmployeeId, 'employee_li 未绑定员工档案');

    step(summary, '验证看板与专用只读接口');
    const hrOverview = await request('/overview/dashboard', hr.accessToken);
    const managerOverview = await request('/overview/dashboard', manager.accessToken);
    const employeeOverview = await request('/overview/dashboard', employee.accessToken);
    const recruitmentDashboard = await request('/recruitment/dashboard', hr.accessToken);
    const departmentTree = await request('/departments/tree', hr.accessToken);
    const attendanceAnomalies = await request('/attendances/anomalies?page=1&limit=10', hr.accessToken);
    const employeeDashboardBefore = await request('/self-service/dashboard', employee.accessToken);
    const employeeProfileBefore = await request('/self-service/profile', employee.accessToken);
    const employeeLeaveBalances = await request('/self-service/leave-balances', employee.accessToken);
    const employeePayslips = await request('/self-service/payslips', employee.accessToken);
    const employeeProfileRequestsBefore = await request('/self-service/profile-change-requests', employee.accessToken);
    const reviewQueueBefore = await request('/self-service/profile-change-requests/review-queue?status=all', hr.accessToken);
    const knowledgeBase = await request('/agent/employee-service/knowledge-base', employee.accessToken);
    const knowledgeSources = await request('/agent/employee-service/knowledge-sources', employee.accessToken);
    const knowledgeManageArticles = await request('/knowledge-management/articles?page=1&limit=20', hr.accessToken);
    const knowledgeManageDocuments = await request('/knowledge-management/documents', hr.accessToken);
    const companyFacts = await request('/agent/employee-service/company-facts', employee.accessToken);
    const managedCompanyFacts = await request('/knowledge-management/company-facts', hr.accessToken);
    const performanceInsights = await request('/agent/performance/insights', hr.accessToken);
    const attritionAll = await request('/agent/attrition/predict', hr.accessToken);
    const attritionSingle = await request(`/agent/attrition/predict?employeeId=${employeeEmployeeId}`, hr.accessToken);
    const highRiskList = await request('/agent/attrition/high-risk-list', hr.accessToken);
    const companyInfoReply = await request('/agent/employee-service/chat', employee.accessToken, {
      method: 'POST',
      body: JSON.stringify({ message: '公司基础信息和工作时间是什么？' }),
    });

    assert(hrOverview.scope === 'management', '人力资源总览看板 scope 异常');
    assert(managerOverview.scope === 'management', '经理总览看板 scope 异常');
    assert(employeeOverview.scope === 'employee', '员工总览看板 scope 异常');
    assert(Array.isArray(departmentTree), '部门树返回异常');
    assert(Array.isArray(attendanceAnomalies.items), '考勤异常列表返回异常');
    assert(Array.isArray(employeeLeaveBalances), '员工假期余额返回异常');
    assert(Array.isArray(employeePayslips), '员工工资单返回异常');
    assert(Array.isArray(employeeProfileRequestsBefore), '员工资料变更列表返回异常');
    assert(Array.isArray(reviewQueueBefore), '资料变更审批队列返回异常');
    assert(Array.isArray(knowledgeBase), '知识库列表返回异常');
    assert(Array.isArray(knowledgeSources.documents), '知识来源文档列表返回异常');
    assert(Array.isArray(knowledgeManageArticles.items), '知识管理文章列表返回异常');
    assert(Array.isArray(knowledgeManageDocuments), '知识管理文档列表返回异常');
    assert(Array.isArray(companyFacts), '结构化公司事实列表返回异常');
    assert(Array.isArray(managedCompanyFacts), '结构化公司事实管理列表返回异常');
    assert(Array.isArray(attritionAll), '离职风险全量预测返回异常');
    assert(Array.isArray(highRiskList), '高风险员工列表返回异常');
    assert(recruitmentDashboard.stats.openJobPostings >= 0, '招聘看板统计返回异常');
    assert(performanceInsights.averageScore >= 0, '绩效洞察返回异常');
    assert(attritionSingle.employeeId === employeeEmployeeId, '单员工离职风险预测返回异常');
    assert(employeeDashboardBefore.employee.fullName === employeeProfileBefore.fullName, '员工看板与资料接口不一致');
    assert(
      Array.isArray(companyInfoReply.references) &&
        companyInfoReply.references.some((item) => item.sourceType === 'document'),
      '公司基础信息问答未命中文档 RAG 来源',
    );

    if (employeePayslips[0]?.id) {
      summary.checks.selfPayslipDownloadContentType = await downloadFile(
        `/self-service/payslips/${employeePayslips[0].id}/download`,
        employee.accessToken,
      );
    }

    if (employeeDashboardBefore.employment?.hasDocument) {
    summary.checks.selfContractContentType = await downloadFile(
      '/self-service/contracts/active/download',
      employee.accessToken,
    );
    summary.checks.ragDocumentCount = knowledgeSources.documents.length;
    summary.checks.companyInfoReferenceTypes = companyInfoReply.references.map((item) => item.sourceType);
    }

    step(summary, '验证全部资源列表与详情接口');
    const resourceEndpoints = [
      'departments',
      'positions',
      'employees',
      'employee-contracts',
      'job-postings',
      'candidates',
      'resumes',
      'interviews',
      'offers',
      'attendances',
      'leave-requests',
      'leave-balances',
      'overtime-requests',
      'performance-cycles',
      'performance-goals',
      'performance-reviews',
      'salary-configs',
      'salary-records',
      'payslips',
    ];

    for (const endpoint of resourceEndpoints) {
      const payload = await listResource(endpoint, hr.accessToken);
      assert(Array.isArray(payload.items), `${endpoint} 列表返回异常`);
      if (payload.items[0]?.id) {
        const detail = await getResource(endpoint, payload.items[0].id, hr.accessToken);
        assert(detail.id === payload.items[0].id, `${endpoint} 详情返回异常`);
      }
    }

    step(summary, '创建组织与员工临时数据并验证 CRUD');
    const departmentPayload = {
      name: `验收部门${shortSuffix}`,
      code: `QA-${shortSuffix}`,
      managerEmployeeId,
      description: '全量验收临时部门',
    };
    const department = await createResource('departments', hr.accessToken, departmentPayload);
    cleanupTasks.unshift(() => removeResource('departments', department.id, hr.accessToken));
    await getResource('departments', department.id, hr.accessToken);
    await updateResource('departments', department.id, hr.accessToken, {
      ...departmentPayload,
      description: '全量验收临时部门-已更新',
    });

    const positionPayload = {
      departmentId: department.id,
      name: `验收岗位${shortSuffix}`,
      code: `QAP-${shortSuffix}`,
      level: 'P5',
      description: '全量验收临时岗位',
    };
    const position = await createResource('positions', hr.accessToken, positionPayload);
    cleanupTasks.unshift(() => removeResource('positions', position.id, hr.accessToken));
    await getResource('positions', position.id, hr.accessToken);
    await updateResource('positions', position.id, hr.accessToken, {
      ...positionPayload,
      level: 'P6',
      description: '全量验收临时岗位-已更新',
    });

    const employeePayload = {
      employeeNo: `QA${shortSuffix}`,
      fullName: `验收员工${shortSuffix}`,
      email: `qa-${shortSuffix}@company.local`,
      phone: `1380000${shortSuffix.slice(-4)}`,
      gender: 'male',
      departmentId: department.id,
      positionId: position.id,
      managerEmployeeId,
      employmentType: 'full_time',
      employmentStatus: 'active',
      grade: 'P5',
      joinDate: toIsoDate(nextDays(-7)),
      probationEndDate: toIsoDate(nextDays(83)),
      regularizationDate: toIsoDate(nextDays(84)),
      education: '计算机相关专业',
      certificates: ['PMP'],
      address: `上海市验收路${shortSuffix}号`,
      emergencyContact: { name: '李四', phone: '13900000000' },
      nationalIdMasked: '310*************',
      bankAccountMasked: '6222********0000',
      profileSummary: '全量验收临时员工',
      avatarUrl: `/uploads/avatar-${shortSuffix}.png`,
    };
    const tempEmployee = await createResource('employees', hr.accessToken, employeePayload);
    cleanupTasks.unshift(() => removeResource('employees', tempEmployee.id, hr.accessToken));
    await getResource('employees', tempEmployee.id, hr.accessToken);
    await updateResource('employees', tempEmployee.id, hr.accessToken, {
      ...employeePayload,
      phone: `1390000${shortSuffix.slice(-4)}`,
      profileSummary: '全量验收临时员工-已更新',
    });

    const contractPayload = {
      employeeId: tempEmployee.id,
      contractNo: `CT-QA-${shortSuffix}`,
      contractType: 'labor',
      status: 'active',
      startDate: toIsoDate(nextDays(-7)),
      endDate: toIsoDate(nextDays(365)),
      probationMonths: 3,
      salaryBase: 20000,
      filePath: `uploads/contracts/CT-QA-${shortSuffix}.pdf`,
      notes: '全量验收临时合同',
    };
    const contract = await createResource('employee-contracts', hr.accessToken, contractPayload);
    cleanupTasks.unshift(() => removeResource('employee-contracts', contract.id, hr.accessToken));
    await getResource('employee-contracts', contract.id, hr.accessToken);
    await updateResource('employee-contracts', contract.id, hr.accessToken, {
      ...contractPayload,
      notes: '全量验收临时合同-已更新',
    });
    summary.checks.securedContractContentType = await downloadFile(
      `/employee-contracts/${contract.id}/download`,
      hr.accessToken,
    );
    summary.checks.unauthorizedContractDownloadStatus = await expectDownloadRejected(
      `/employee-contracts/${contract.id}/download`,
      null,
      [401],
    );

    step(summary, '创建招聘链路临时数据并验证 CRUD 与上传');
    const jobPostingPayload = {
      departmentId: department.id,
      positionId: position.id,
      title: `验收后端工程师${shortSuffix}`,
      employmentType: 'full_time',
      location: '上海',
      description: '负责验收脚本所需的后端开发工作。',
      requirements: 'Node.js NestJS PostgreSQL',
      status: 'open',
      targetCount: 2,
      publishedAt: toIsoDateTime(nextDays(-2)),
      closedAt: null,
    };
    const jobPosting = await createResource('job-postings', hr.accessToken, jobPostingPayload);
    cleanupTasks.unshift(() => removeResource('job-postings', jobPosting.id, hr.accessToken));
    await getResource('job-postings', jobPosting.id, hr.accessToken);
    await updateResource('job-postings', jobPosting.id, hr.accessToken, {
      ...jobPostingPayload,
      targetCount: 3,
      description: '负责验收脚本与平台能力的后端开发工作。',
    });

    const candidatePayload = {
      appliedJobPostingId: jobPosting.id,
      fullName: `陈验收${shortSuffix}`,
      email: `candidate-${shortSuffix}@example.com`,
      phone: `1370000${shortSuffix.slice(-4)}`,
      source: 'referral',
      stage: 'screening',
      status: 'active',
      currentCompany: '验收科技',
      yearsOfExperience: 5,
      skills: ['Node.js', 'NestJS', 'PostgreSQL'],
      aiMatchScore: 86,
      notes: '全量验收临时候选人',
    };
    const candidate = await createResource('candidates', hr.accessToken, candidatePayload);
    cleanupTasks.unshift(() => removeResource('candidates', candidate.id, hr.accessToken));
    await getResource('candidates', candidate.id, hr.accessToken);
    await updateResource('candidates', candidate.id, hr.accessToken, {
      ...candidatePayload,
      stage: 'interview',
      aiMatchScore: 91,
      notes: '全量验收临时候选人-已更新',
    });

    const resumePayload = {
      candidateId: candidate.id,
      fileName: `resume-${shortSuffix}.pdf`,
      filePath: `uploads/resumes/manual-${shortSuffix}.pdf`,
      parsedText: 'Node.js NestJS PostgreSQL',
      parsedProfile: {
        name: `陈验收${shortSuffix}`,
        skills: ['Node.js', 'NestJS'],
        summary: '全量验收手工简历',
      },
    };
    const manualResume = await createResource('resumes', hr.accessToken, resumePayload);
    cleanupTasks.unshift(() => removeResource('resumes', manualResume.id, hr.accessToken));
    await getResource('resumes', manualResume.id, hr.accessToken);
    await updateResource('resumes', manualResume.id, hr.accessToken, {
      ...resumePayload,
      parsedText: 'Node.js NestJS PostgreSQL Redis',
      parsedProfile: {
        ...resumePayload.parsedProfile,
        summary: '全量验收手工简历-已更新',
      },
    });
    summary.checks.manualResumeContentType = await downloadFile(`/resumes/${manualResume.id}/download`, hr.accessToken);

    const uploadedResume = await uploadResume(candidate.id, hr.accessToken);
    created.uploadedResumeId = uploadedResume.id;
    created.uploadedResumePath = uploadedResume.filePath;
    cleanupTasks.unshift(() => removeResource('resumes', uploadedResume.id, hr.accessToken));
    summary.checks.uploadedResumeContentType = await downloadFile(`/resumes/${uploadedResume.id}/download`, hr.accessToken);
    summary.checks.unauthorizedResumeDownloadStatus = await expectDownloadRejected(
      `/resumes/${uploadedResume.id}/download`,
      null,
      [401],
    );

    const interviewPayload = {
      candidateId: candidate.id,
      jobPostingId: jobPosting.id,
      interviewerEmployeeId: managerEmployeeId,
      scheduledAt: toIsoDateTime(nextDays(2, 10, 30)),
      interviewType: 'video',
      status: 'scheduled',
      score: 0,
      feedback: '待面试',
    };
    const interview = await createResource('interviews', hr.accessToken, interviewPayload);
    cleanupTasks.unshift(() => removeResource('interviews', interview.id, hr.accessToken));
    await getResource('interviews', interview.id, hr.accessToken);
    await updateResource('interviews', interview.id, hr.accessToken, {
      ...interviewPayload,
      status: 'completed',
      score: 4.5,
      feedback: '候选人表现良好',
    });

    const offerPayload = {
      candidateId: candidate.id,
      jobPostingId: jobPosting.id,
      approvalByEmployeeId: managerEmployeeId,
      salaryOffered: 26000,
      status: 'sent',
      offeredAt: toIsoDateTime(nextDays(3, 9, 0)),
      acceptedAt: null,
      notes: '全量验收录用通知',
    };
    const offer = await createResource('offers', hr.accessToken, offerPayload);
    cleanupTasks.unshift(() => removeResource('offers', offer.id, hr.accessToken));
    await getResource('offers', offer.id, hr.accessToken);
    await updateResource('offers', offer.id, hr.accessToken, {
      ...offerPayload,
      status: 'accepted',
      acceptedAt: toIsoDateTime(nextDays(4, 9, 0)),
      notes: '全量验收录用通知-已接受',
    });

    step(summary, '创建考勤休假临时数据并验证审批相关接口');
    const attendancePayload = {
      employeeId: tempEmployee.id,
      workDate: toIsoDate(nextDays(-5)),
      clockInAt: toIsoDateTime(nextDays(-5, 9, 0)),
      clockOutAt: toIsoDateTime(nextDays(-5, 18, 0)),
      status: 'present',
      source: 'web',
      lateMinutes: 0,
      undertimeMinutes: 0,
      anomalyReason: '',
    };
    const attendance = await createResource('attendances', hr.accessToken, attendancePayload);
    cleanupTasks.unshift(() => removeResource('attendances', attendance.id, hr.accessToken));
    await getResource('attendances', attendance.id, hr.accessToken);
    await updateResource('attendances', attendance.id, hr.accessToken, {
      ...attendancePayload,
      status: 'anomaly',
      lateMinutes: 18,
      anomalyReason: '全量验收手工修正异常',
    });

    const clockInRecord = await request('/attendances/clock-in', hr.accessToken, {
      method: 'POST',
      body: JSON.stringify({ employeeId: tempEmployee.id, source: 'web' }),
    });
    const clockOutRecord = await request('/attendances/clock-out', hr.accessToken, {
      method: 'POST',
      body: JSON.stringify({ employeeId: tempEmployee.id }),
    });
    cleanupTasks.unshift(() => removeResource('attendances', clockOutRecord.id, hr.accessToken));
    assert(clockInRecord.employeeId === tempEmployee.id, '上班打卡返回异常');
    assert(clockOutRecord.employeeId === tempEmployee.id, '下班打卡返回异常');

    const leaveBalancePayload = {
      employeeId: tempEmployee.id,
      leaveType: 'annual',
      year: new Date().getUTCFullYear(),
      totalDays: 10,
      usedDays: 0,
      remainingDays: 10,
    };
    const leaveBalance = await createResource('leave-balances', hr.accessToken, leaveBalancePayload);
    cleanupTasks.unshift(() => removeResource('leave-balances', leaveBalance.id, hr.accessToken));
    await getResource('leave-balances', leaveBalance.id, hr.accessToken);
    await updateResource('leave-balances', leaveBalance.id, hr.accessToken, {
      ...leaveBalancePayload,
      totalDays: 12,
      remainingDays: 12,
    });

    const leaveRequestPayload = {
      employeeId: tempEmployee.id,
      approverEmployeeId: managerEmployeeId,
      leaveType: 'annual',
      startAt: toIsoDateTime(nextDays(7, 9, 0)),
      endAt: toIsoDateTime(nextDays(8, 18, 0)),
      durationDays: 2,
      reason: '全量验收请假申请',
      status: 'pending',
      rejectionReason: '',
      approvedAt: null,
    };
    const leaveRequest = await createResource('leave-requests', hr.accessToken, leaveRequestPayload);
    cleanupTasks.unshift(() => removeResource('leave-requests', leaveRequest.id, hr.accessToken));
    await getResource('leave-requests', leaveRequest.id, hr.accessToken);
    await updateResource('leave-requests', leaveRequest.id, hr.accessToken, {
      ...leaveRequestPayload,
      status: 'approved',
      approvedAt: toIsoDateTime(nextDays(1, 10, 0)),
    });

    const overtimePayload = {
      employeeId: tempEmployee.id,
      approverEmployeeId: managerEmployeeId,
      workDate: toIsoDate(nextDays(5)),
      startAt: toIsoDateTime(nextDays(5, 19, 0)),
      endAt: toIsoDateTime(nextDays(5, 21, 0)),
      hours: 2,
      reason: '全量验收加班申请',
      status: 'pending',
      approvedAt: null,
    };
    const overtime = await createResource('overtime-requests', hr.accessToken, overtimePayload);
    cleanupTasks.unshift(() => removeResource('overtime-requests', overtime.id, hr.accessToken));
    await getResource('overtime-requests', overtime.id, hr.accessToken);
    await updateResource('overtime-requests', overtime.id, hr.accessToken, {
      ...overtimePayload,
      status: 'approved',
      approvedAt: toIsoDateTime(nextDays(1, 11, 0)),
    });

    step(summary, '创建绩效与薪酬临时数据并验证生成流程');
    const cyclePayload = {
      name: `验收周期${shortSuffix}`,
      year: new Date().getUTCFullYear(),
      periodType: 'quarterly',
      startDate: toIsoDate(nextDays(-15)),
      endDate: toIsoDate(nextDays(75)),
      status: 'draft',
    };
    const cycle = await createResource('performance-cycles', hr.accessToken, cyclePayload);
    cleanupTasks.unshift(() => removeResource('performance-cycles', cycle.id, hr.accessToken));
    await getResource('performance-cycles', cycle.id, hr.accessToken);
    await updateResource('performance-cycles', cycle.id, hr.accessToken, {
      ...cyclePayload,
      status: 'active',
    });

    const goalPayload = {
      cycleId: cycle.id,
      employeeId: tempEmployee.id,
      title: `验收目标${shortSuffix}`,
      category: 'okr',
      weight: 40,
      targetValue: '100%',
      currentValue: '20%',
      status: 'in_progress',
      description: '全量验收绩效目标',
    };
    const goal = await createResource('performance-goals', hr.accessToken, goalPayload);
    cleanupTasks.unshift(() => removeResource('performance-goals', goal.id, hr.accessToken));
    await getResource('performance-goals', goal.id, hr.accessToken);
    await updateResource('performance-goals', goal.id, hr.accessToken, {
      ...goalPayload,
      currentValue: '60%',
      description: '全量验收绩效目标-已更新',
    });

    const reviewPayload = {
      cycleId: cycle.id,
      employeeId: tempEmployee.id,
      reviewerEmployeeId: managerEmployeeId,
      overallScore: 4.2,
      rating: 'exceeds_expectation',
      strengths: '执行力强',
      improvements: '加强跨团队协作',
      summary: '全量验收绩效评审',
    };
    const review = await createResource('performance-reviews', hr.accessToken, reviewPayload);
    cleanupTasks.unshift(() => removeResource('performance-reviews', review.id, hr.accessToken));
    await getResource('performance-reviews', review.id, hr.accessToken);
    await updateResource('performance-reviews', review.id, hr.accessToken, {
      ...reviewPayload,
      summary: '全量验收绩效评审-已更新',
    });

    const salaryConfigPayload = {
      employeeId: tempEmployee.id,
      payType: 'monthly',
      baseSalary: 22000,
      housingAllowance: 1500,
      transportAllowance: 500,
      bonusRate: 0.1,
      socialInsuranceBase: 18000,
      taxRate: 0.05,
      effectiveFrom: toIsoDate(nextDays(-30)),
      effectiveTo: null,
    };
    const salaryConfig = await createResource('salary-configs', hr.accessToken, salaryConfigPayload);
    cleanupTasks.unshift(() => removeResource('salary-configs', salaryConfig.id, hr.accessToken));
    await getResource('salary-configs', salaryConfig.id, hr.accessToken);
    await updateResource('salary-configs', salaryConfig.id, hr.accessToken, {
      ...salaryConfigPayload,
      taxRate: 0.06,
    });

    const salaryRecordPayload = {
      employeeId: tempEmployee.id,
      month: '2026-11-01',
      attendanceDays: 20,
      overtimeHours: 2,
      performanceScore: 4.2,
      grossPay: 25000,
      deductions: 3200,
      netPay: 21800,
      status: 'generated',
    };
    const salaryRecord = await createResource('salary-records', hr.accessToken, salaryRecordPayload);
    cleanupTasks.unshift(() => removeResource('salary-records', salaryRecord.id, hr.accessToken));
    await getResource('salary-records', salaryRecord.id, hr.accessToken);
    await updateResource('salary-records', salaryRecord.id, hr.accessToken, {
      ...salaryRecordPayload,
      status: 'published',
    });

    const payslipPayload = {
      salaryRecordId: salaryRecord.id,
      employeeId: tempEmployee.id,
      slipNo: `PS-QA-${shortSuffix}`,
      issuedAt: toIsoDateTime(nextDays(1, 12, 0)),
      downloadPath: `uploads/payslips/PS-QA-${shortSuffix}.pdf`,
      visibleToEmployee: true,
    };
    const payslip = await createResource('payslips', hr.accessToken, payslipPayload);
    cleanupTasks.unshift(() => removeResource('payslips', payslip.id, hr.accessToken));
    await getResource('payslips', payslip.id, hr.accessToken);
    await updateResource('payslips', payslip.id, hr.accessToken, {
      ...payslipPayload,
      visibleToEmployee: false,
    });

    summary.checks.securedPayslipContentType = await downloadFile(`/payslips/${payslip.id}/download`, hr.accessToken);
    summary.checks.unauthorizedPayslipDownloadStatus = await expectDownloadRejected(
      `/payslips/${payslip.id}/download`,
      null,
      [401],
    );

    const generatedSalaryRecord = await request('/salary-records/generate', hr.accessToken, {
      method: 'POST',
      body: JSON.stringify({
        employeeId: tempEmployee.id,
        month: '2026-12-01',
      }),
    });
    cleanupTasks.unshift(async () => {
      const payslipsForEmployee = await listResource('payslips', hr.accessToken, { employeeId: tempEmployee.id });
      const generatedPayslip = payslipsForEmployee.items.find((item) => item.salaryRecordId === generatedSalaryRecord.id);
      if (generatedPayslip) {
        await removeResource('payslips', generatedPayslip.id, hr.accessToken);
      }
      await removeResource('salary-records', generatedSalaryRecord.id, hr.accessToken);
    });

    const generatedPayslips = await listResource('payslips', hr.accessToken, { employeeId: tempEmployee.id });
    const generatedPayslip = generatedPayslips.items.find((item) => item.salaryRecordId === generatedSalaryRecord.id);
    assert(generatedPayslip?.downloadPath, '自动生成工资单缺少下载路径');
    summary.checks.generatedPayslipContentType = await downloadFile(`/payslips/${generatedPayslip.id}/download`, hr.accessToken);

    step(summary, '验证员工自助提交与审批闭环');
    const selfLeavePayload = {
      approverEmployeeId: managerEmployeeId,
      leaveType: 'annual',
      startAt: toIsoDateTime(nextDays(10, 9, 0)),
      endAt: toIsoDateTime(nextDays(11, 18, 0)),
      durationDays: 2,
      reason: '员工自助验收请假',
    };
    const selfLeaveRequest = await request('/self-service/leave-requests', employee.accessToken, {
      method: 'POST',
      body: JSON.stringify(selfLeavePayload),
    });
    created.selfLeaveRequestId = selfLeaveRequest.id;
    cleanupTasks.unshift(() => removeResource('leave-requests', selfLeaveRequest.id, hr.accessToken));

    const selfOvertimePayload = {
      approverEmployeeId: managerEmployeeId,
      workDate: toIsoDate(nextDays(12)),
      startAt: toIsoDateTime(nextDays(12, 19, 0)),
      endAt: toIsoDateTime(nextDays(12, 21, 0)),
      hours: 2,
      reason: '员工自助验收加班',
    };
    const selfOvertimeRequest = await request('/self-service/overtime-requests', employee.accessToken, {
      method: 'POST',
      body: JSON.stringify(selfOvertimePayload),
    });
    created.selfOvertimeRequestId = selfOvertimeRequest.id;
    cleanupTasks.unshift(() => removeResource('overtime-requests', selfOvertimeRequest.id, hr.accessToken));

    const profileChangePayload = {
      changes: {
        avatarUrl: `/uploads/avatar-verified-${shortSuffix}.png`,
      },
    };
    const profileChangeRequest = await request('/self-service/profile-change-requests', employee.accessToken, {
      method: 'POST',
      body: JSON.stringify(profileChangePayload),
    });
    created.profileChangeRequestId = profileChangeRequest.id;

    const employeeProfileRequestsAfterCreate = await request('/self-service/profile-change-requests', employee.accessToken);
    assert(
      employeeProfileRequestsAfterCreate.some((item) => item.id === profileChangeRequest.id),
      '员工资料变更申请未出现在个人列表中',
    );

    const reviewQueuePending = await request('/self-service/profile-change-requests/review-queue?status=pending', hr.accessToken);
    assert(reviewQueuePending.some((item) => item.id === profileChangeRequest.id), '资料变更申请未进入审批队列');

    await request(`/self-service/profile-change-requests/${profileChangeRequest.id}/review`, hr.accessToken, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'approved',
        reviewComment: '验收通过',
      }),
    });

    const employeeProfileAfterReview = await request('/self-service/profile', employee.accessToken);
    assert(
      employeeProfileAfterReview.avatarUrl === profileChangePayload.changes.avatarUrl,
      '资料变更审批通过后未写回员工档案',
    );

    const fullSelfLeave = await getResource('leave-requests', selfLeaveRequest.id, hr.accessToken);
    await updateResource('leave-requests', selfLeaveRequest.id, hr.accessToken, {
      employeeId: fullSelfLeave.employeeId,
      approverEmployeeId: fullSelfLeave.approverEmployeeId,
      leaveType: fullSelfLeave.leaveType,
      startAt: fullSelfLeave.startAt,
      endAt: fullSelfLeave.endAt,
      durationDays: Number(fullSelfLeave.durationDays),
      reason: fullSelfLeave.reason,
      status: 'approved',
      rejectionReason: fullSelfLeave.rejectionReason,
      approvedAt: toIsoDateTime(nextDays(1, 13, 0)),
    });

    const fullSelfOvertime = await getResource('overtime-requests', selfOvertimeRequest.id, hr.accessToken);
    await updateResource('overtime-requests', selfOvertimeRequest.id, hr.accessToken, {
      employeeId: fullSelfOvertime.employeeId,
      approverEmployeeId: fullSelfOvertime.approverEmployeeId,
      workDate: fullSelfOvertime.workDate,
      startAt: fullSelfOvertime.startAt,
      endAt: fullSelfOvertime.endAt,
      hours: Number(fullSelfOvertime.hours),
      reason: fullSelfOvertime.reason,
      status: 'approved',
      approvedAt: toIsoDateTime(nextDays(1, 14, 0)),
    });

    const employeeDashboardAfterApproval = await request('/self-service/dashboard', employee.accessToken);
    const approvedLeave = employeeDashboardAfterApproval.recentLeaveRequests.find((item) => item.id === selfLeaveRequest.id);
    const approvedOvertime = employeeDashboardAfterApproval.recentOvertimeRequests.find((item) => item.id === selfOvertimeRequest.id);
    assert(approvedLeave?.status === 'approved', '员工自助请假审批后看板未刷新');
    assert(approvedOvertime?.status === 'approved', '员工自助加班审批后看板未刷新');

    step(summary, '验证智能接口与辅助能力');
    const parsedResume = await request('/agent/recruitment/parse-resume', hr.accessToken, {
      method: 'POST',
      body: JSON.stringify({
        resumeId: created.uploadedResumeId,
      }),
    });
    const parsedResumeByText = await request('/agent/recruitment/parse-resume', hr.accessToken, {
      method: 'POST',
      body: JSON.stringify({
        resumeText: '张三\nzhangsan@example.com\nNode.js NestJS PostgreSQL',
      }),
    });
    const matchScore = await request('/agent/recruitment/match-score', hr.accessToken, {
      method: 'POST',
      body: JSON.stringify({
        candidateId: candidate.id,
        jobPostingId: jobPosting.id,
      }),
    });
    const interviewEmail = await request('/agent/recruitment/generate-interview-email', hr.accessToken, {
      method: 'POST',
      body: JSON.stringify({
        candidateId: candidate.id,
        jobPostingId: jobPosting.id,
        interviewTime: toIsoDateTime(nextDays(15, 10, 0)),
        interviewerName: managerMe.displayName,
      }),
    });
    const employeeChat = await request('/agent/employee-service/chat', employee.accessToken, {
      method: 'POST',
      body: JSON.stringify({
        message: '我在哪里下载工资单？',
      }),
    });
    const performanceAnalyze = await request('/agent/performance/analyze', hr.accessToken, {
      method: 'POST',
      body: JSON.stringify({
        employeeId: tempEmployee.id,
        cycleId: cycle.id,
      }),
    });

    assert(parsedResume.summary, '基于存储简历的解析结果为空');
    assert(parsedResumeByText.summary, '基于文本的简历解析结果为空');
    assert(matchScore.summary, '智能匹配结果为空');
    assert(interviewEmail.subject && interviewEmail.body, '面试邮件生成结果为空');
    assert(employeeChat.reply, '员工服务问答结果为空');
    assert(performanceAnalyze.summary, '绩效分析结果为空');

    step(summary, '验证知识中心管理化接口');
    const managedArticlePayload = {
      category: 'policy',
      title: `验收知识条目${shortSuffix}`,
      question: '验收知识条目问题是什么？',
      answer: '这是用于全流程验收的知识中心管理化测试条目。',
      tags: ['验收', '知识中心'],
      isPublished: true,
    };
    const managedArticle = await request('/knowledge-management/articles', hr.accessToken, {
      method: 'POST',
      body: JSON.stringify(managedArticlePayload),
    });
    cleanupTasks.unshift(() => removeResource('knowledge-management/articles', managedArticle.id, hr.accessToken));

    await request(`/knowledge-management/articles/${managedArticle.id}`, hr.accessToken);
    await request(`/knowledge-management/articles/${managedArticle.id}`, hr.accessToken, {
      method: 'PATCH',
      body: JSON.stringify({
        ...managedArticlePayload,
        answer: '这是用于全流程验收的知识中心管理化测试条目（已更新）。',
        isPublished: false,
      }),
    });

    const managedDocumentPayload = {
      title: `验收制度文档${shortSuffix}`,
      scope: 'docs/policies/managed',
      category: 'policy_document',
      slug: `qa-policy-${shortSuffix}`,
      status: 'draft',
      version: '1.0.0',
      owner: '验收脚本',
      effectiveDate: toIsoDate(nextDays(1)),
      reviewNotes: '草稿阶段不应进入 RAG',
      tags: ['验收', '治理'],
      body: '## 1. 适用范围\n- 用于全流程验收。\n\n## 2. 处理规则\n- 保存后应进入本地 RAG 文档列表。',
    };
    const importPreview = await previewKnowledgeImport(hr.accessToken);
    assert(importPreview.detectedTitle, '导入预览应识别标题');
    assert(importPreview.suggestedSlug, '导入预览应生成文档标识');
    assert(
      importPreview.cleanedMarkdown.includes('核心技能') || importPreview.cleanedMarkdown.includes('星澜科技候选人简历'),
      '导入预览应返回清洗后的正文',
    );

    const importedDocumentPayload = {
      title: `导入制度${shortSuffix}`,
      scope: importPreview.suggestedScope,
      category: importPreview.suggestedCategory,
      slug: `导入制度-${shortSuffix}`,
      status: 'draft',
      version: '1.0.0',
      owner: '验收脚本',
      effectiveDate: toIsoDate(nextDays(1)),
      reviewNotes: (importPreview.warnings || []).join(' ') || '导入预览已生成',
      tags: ['导入', '验收'],
      body: `${importPreview.cleanedMarkdown}\n\n## 验证说明\n- 导入预览已进入知识治理流程。`,
    };
    const importedDocument = await request('/knowledge-management/documents', hr.accessToken, {
      method: 'POST',
      body: JSON.stringify(importedDocumentPayload),
    });
    cleanupTasks.unshift(() =>
      request(`/knowledge-management/documents/${encodeURIComponent(importedDocument.id)}`, hr.accessToken, {
        method: 'DELETE',
      }),
    );

    const importedDocumentDraftSources = await request('/agent/employee-service/knowledge-sources', employee.accessToken);
    assert(
      !importedDocumentDraftSources.documents.some((item) => item.sourcePath === importedDocument.id),
      '导入草稿文档不应出现在知识来源中',
    );

    await request(`/knowledge-management/documents/${encodeURIComponent(importedDocument.id)}`, hr.accessToken, {
      method: 'PATCH',
      body: JSON.stringify({
        ...importedDocumentPayload,
        status: 'published',
        version: '1.0.1',
        effectiveDate: toIsoDate(nextDays(-1)),
        reviewNotes: '导入文档已复核并发布',
      }),
    });

    const importedDocumentSources = await request('/agent/employee-service/knowledge-sources', employee.accessToken);
    assert(
      importedDocumentSources.documents.some((item) => item.sourcePath === importedDocument.id),
      '已发布导入文档应出现在知识来源中',
    );
    const importedDocumentReply = await request('/agent/employee-service/chat', employee.accessToken, {
      method: 'POST',
      body: JSON.stringify({ message: `导入制度${shortSuffix}` }),
    });
    assert(
      importedDocumentReply.references.some(
        (item) => item.sourceType === 'document' && item.sourcePath === importedDocument.id,
      ),
      '已发布导入文档应被员工服务问答引用',
    );

    const managedDocument = await request('/knowledge-management/documents', hr.accessToken, {
      method: 'POST',
      body: JSON.stringify(managedDocumentPayload),
    });
    cleanupTasks.unshift(() =>
      request(`/knowledge-management/documents/${encodeURIComponent(managedDocument.id)}`, hr.accessToken, {
        method: 'DELETE',
      }),
    );

    const managedDocumentDetail = await request(
      `/knowledge-management/documents/${encodeURIComponent(managedDocument.id)}`,
      hr.accessToken,
    );
    const knowledgeSourcesAfterDraft = await request('/agent/employee-service/knowledge-sources', employee.accessToken);
    assert(managedDocumentDetail.status === 'draft', '知识管理文档草稿状态返回异常');
    assert(
      !knowledgeSourcesAfterDraft.documents.some((item) => item.sourcePath === managedDocument.id),
      '草稿知识管理文档不应进入知识来源列表',
    );

    await request(`/knowledge-management/documents/${encodeURIComponent(managedDocument.id)}`, hr.accessToken, {
      method: 'PATCH',
      body: JSON.stringify({
        ...managedDocumentPayload,
        status: 'published',
        version: '1.0.1',
        effectiveDate: toIsoDate(nextDays(-1)),
        reviewNotes: '已完成复核并发布',
        body: `${managedDocumentPayload.body}\n\n## 3. 更新说明\n- 文档已完成更新。`,
      }),
    });

    const managedDocumentHistory = await request(
      `/knowledge-management/documents/${encodeURIComponent(managedDocument.id)}/history`,
      hr.accessToken,
    );
    assert(Array.isArray(managedDocumentHistory) && managedDocumentHistory.length >= 1, '知识文档历史应至少包含一个快照');

    const managedDocumentDiff = await request(
      `/knowledge-management/documents/${encodeURIComponent(managedDocument.id)}/diff?historyId=${encodeURIComponent(managedDocumentHistory[0].id)}`,
      hr.accessToken,
    );
    assert(Array.isArray(managedDocumentDiff.diff), '知识文档差异应返回逐行差异结果');

    const knowledgeSourcesAfterManaged = await request('/agent/employee-service/knowledge-sources', employee.accessToken);
    assert(managedDocumentDetail.body.includes('适用范围'), '知识管理文档详情返回异常');
    assert(
      knowledgeSourcesAfterManaged.documents.some((item) => item.sourcePath === managedDocument.id),
      '新建知识管理文档未进入知识来源列表',
    );
    const managedRagReply = await request('/agent/employee-service/chat', employee.accessToken, {
      method: 'POST',
      body: JSON.stringify({ message: `验收制度文档${shortSuffix}的处理规则是什么？` }),
    });
    assert(
      managedRagReply.references.some((item) => item.sourceType === 'document' && item.sourcePath === managedDocument.id),
      '已发布知识管理文档未被员工服务问答命中',
    );

    const diagnosticsResult = await request(
      `/knowledge-management/diagnostics/document-search?query=${encodeURIComponent(`验收制度文档${shortSuffix}`)}`,
      hr.accessToken,
    );
    assert(diagnosticsResult.resultCount >= 1, '文档检索诊断应至少返回一个命中结果');
    assert(
      diagnosticsResult.results.some((item) => item.sourcePath === managedDocument.id),
      '文档检索诊断应包含托管文档来源',
    );

    const factPayload = {
      category: 'office',
      label: `验收办公地点${shortSuffix}`,
      value: `上海市徐汇区验收大道 ${shortSuffix} 号`,
      description: '用于验证结构化公司基础信息中心与自动生成 RAG。',
      source: '全流程验收',
      tags: ['验收', '办公地点'],
      status: 'draft',
      sortOrder: 990,
    };
    const companyFact = await request('/knowledge-management/company-facts', hr.accessToken, {
      method: 'POST',
      body: JSON.stringify(factPayload),
    });
    cleanupTasks.unshift(() =>
      request(`/knowledge-management/company-facts/${companyFact.id}`, hr.accessToken, {
        method: 'DELETE',
      }),
    );

    const companyFactDetail = await request(`/knowledge-management/company-facts/${companyFact.id}`, hr.accessToken);
    const companyFactsAfterDraft = await request('/agent/employee-service/company-facts', employee.accessToken);
    assert(companyFactDetail.status === 'draft', '公司基础信息草稿状态返回异常');
    assert(
      !companyFactsAfterDraft.some((item) => item.id === companyFact.id),
      '草稿公司基础信息不应进入员工侧可见列表',
    );

    await request(`/knowledge-management/company-facts/${companyFact.id}`, hr.accessToken, {
      method: 'PATCH',
      body: JSON.stringify({
        ...factPayload,
        status: 'published',
      }),
    });

    const companyFactsAfterPublish = await request('/agent/employee-service/company-facts', employee.accessToken);
    assert(
      companyFactsAfterPublish.some((item) => item.id === companyFact.id),
      '已发布公司基础信息未进入员工侧可见列表',
    );

    const companyFactReply = await request('/agent/employee-service/chat', employee.accessToken, {
      method: 'POST',
      body: JSON.stringify({ message: `验收办公地点${shortSuffix}在哪里？` }),
    });
    assert(
      companyFactReply.references.some((item) => item.sourceType === 'document'),
      '结构化公司基础信息未通过自动生成文档进入问答引用',
    );

    summary.created = {
      departmentId: department.id,
      positionId: position.id,
      employeeId: tempEmployee.id,
      contractId: contract.id,
      jobPostingId: jobPosting.id,
      candidateId: candidate.id,
      manualResumeId: manualResume.id,
      uploadedResumeId: created.uploadedResumeId,
      interviewId: interview.id,
      offerId: offer.id,
      attendanceId: attendance.id,
      leaveBalanceId: leaveBalance.id,
      leaveRequestId: leaveRequest.id,
      overtimeRequestId: overtime.id,
      cycleId: cycle.id,
      goalId: goal.id,
      reviewId: review.id,
      salaryConfigId: salaryConfig.id,
      salaryRecordId: salaryRecord.id,
      payslipId: payslip.id,
      generatedSalaryRecordId: generatedSalaryRecord.id,
      importedDocumentId: importedDocument.id,
      selfLeaveRequestId: created.selfLeaveRequestId,
      selfOvertimeRequestId: created.selfOvertimeRequestId,
      profileChangeRequestId: created.profileChangeRequestId,
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    for (const task of cleanupTasks) {
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
