const webBase = process.env.VERIFY_WEB_BASE || 'http://127.0.0.1:4173';
const apiBase = process.env.VERIFY_API_BASE || 'http://127.0.0.1:3000/api';
const defaultPassword = process.env.HR_DEMO_PASSWORD || process.env.VERIFY_DEMO_PASSWORD;

async function ensureOk(response, label) {
  if (!response.ok) {
    throw new Error(`${label} -> ${response.status} ${await response.text()}`);
  }
  return response;
}

async function login(username, password) {
  const response = await ensureOk(
    await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),
    `login:${username}`,
  );

  return response.json();
}

async function request(path, token, options = {}) {
  const response = await ensureOk(
    await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    }),
    path,
  );

  return response.json();
}

async function main() {
  if (!defaultPassword) {
    throw new Error('请通过 HR_DEMO_PASSWORD 或 VERIFY_DEMO_PASSWORD 提供演示账号密码。');
  }

  const webResponse = await ensureOk(await fetch(webBase), 'web:/');
  const webHtml = await webResponse.text();

  const hr = await login('hr_admin', defaultPassword);
  const employee = await login('employee_li', defaultPassword);

  const managementDashboard = await request('/overview/dashboard', hr.accessToken);
  const recruitmentDashboard = await request('/recruitment/dashboard', hr.accessToken);
  const profileQueue = await request('/self-service/profile-change-requests/review-queue?status=pending', hr.accessToken);
  const employeeDashboard = await request('/self-service/dashboard', employee.accessToken);
  const chatReply = await request('/agent/employee-service/chat', employee.accessToken, {
    method: 'POST',
    body: JSON.stringify({ message: '我在哪里下载工资单？' }),
  });
  const match = await request('/agent/recruitment/match-score', hr.accessToken, {
    method: 'POST',
    body: JSON.stringify({
      candidateId: '70000000-0000-4000-8000-000000000001',
      jobPostingId: '60000000-0000-4000-8000-000000000001',
    }),
  });
  const email = await request('/agent/recruitment/generate-interview-email', hr.accessToken, {
    method: 'POST',
    body: JSON.stringify({
      candidateId: '70000000-0000-4000-8000-000000000001',
      jobPostingId: '60000000-0000-4000-8000-000000000001',
      interviewTime: '2026-04-27T09:30:00.000Z',
      interviewerName: '张衡',
    }),
  });

  const summary = {
    webReady: webHtml.includes('<div id="root"></div>'),
    hrDisplayName: hr.user.displayName,
    employeeDisplayName: employee.user.displayName,
    managementHeadline: managementDashboard.headline?.title,
    firstDepartment: managementDashboard.peopleStructure?.departmentHeadcount?.[0]?.name,
    firstJobTitle: recruitmentDashboard.openJobHealth?.[0]?.title,
    firstCandidate: recruitmentDashboard.priorityCandidates?.[0]?.fullName,
    nextAction: recruitmentDashboard.priorityCandidates?.[0]?.nextAction,
    employeeName: employeeDashboard.employee?.fullName,
    knowledgeTitle: employeeDashboard.knowledgeBaseTips?.[0]?.title,
    reviewQueueEmployee: profileQueue?.[0]?.employee?.fullName,
    reviewQueueAddress: profileQueue?.[0]?.changes?.address,
    chatReply: chatReply.reply,
    matchSummary: match.summary,
    emailSubject: email.subject,
    emailBody: email.body,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
