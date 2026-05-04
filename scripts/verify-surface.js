const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Client } = require('pg');
const ts = require('typescript');

const root = process.cwd();
loadLocalEnvFile();

const apiBase = process.env.VERIFY_API_BASE || 'http://127.0.0.1:3000/api';
const webBase = process.env.VERIFY_WEB_BASE || 'http://127.0.0.1:4173';
const adminUsername = process.env.VERIFY_ADMIN_USERNAME || process.env.HR_ADMIN_USERNAME || 'hr_admin';
const defaultPassword = process.env.HR_DEMO_PASSWORD || process.env.VERIFY_DEMO_PASSWORD;
const suffix = String(Date.now());
const shortSuffix = suffix.slice(-8);

const totals = {
  webRoutes: 0,
  resources: 0,
  lists: 0,
  details: 0,
  optionSources: 0,
  downloads: 0,
  candidateSteps: 0,
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function log(message) {
  console.log(`[surface] ${message}`);
}

function loadLocalEnvFile() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
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

async function fetchWithDiagnostics(url, options = {}, label = url) {
  try {
    return await fetch(url, options);
  } catch (error) {
    const serviceHint = String(url).startsWith(webBase)
      ? `前端服务不可访问：${webBase}`
      : `后端接口不可访问：${apiBase}`;
    throw new Error(
      `${label} 请求失败；${serviceHint}。请先启动服务，或设置 VERIFY_WEB_BASE / VERIFY_API_BASE。原因：${
        (error && error.message) || error
      }`,
    );
  }
}

async function ensureStatus(response, label, expected = [200, 201]) {
  if (!expected.includes(response.status)) {
    const text = await response.text();
    throw new Error(`${label} -> ${response.status} ${text}`);
  }

  return response;
}

async function login(username, password = defaultPassword) {
  if (!password) {
    throw new Error('请通过 HR_DEMO_PASSWORD 或 VERIFY_DEMO_PASSWORD 提供演示账号密码。');
  }

  const response = await ensureStatus(
    await fetchWithDiagnostics(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }, `login:${username}`),
    `login:${username}`,
  );

  return response.json();
}

async function request(path, token, options = {}, expected = [200, 201]) {
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  if (!headers.has('content-type') && options.body && !(options.body instanceof FormData)) {
    headers.set('content-type', 'application/json');
  }

  const response = await ensureStatus(
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

async function download(path, token, expected = [200]) {
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  const response = await ensureStatus(
    await fetchWithDiagnostics(`${apiBase}${path}`, { headers }, `download:${path}`),
    `download:${path}`,
    expected,
  );
  const body = await response.arrayBuffer();
  assert(body.byteLength > 0, `download:${path} returned an empty file`);
  totals.downloads += 1;

  return {
    bytes: body.byteLength,
    contentType: response.headers.get('content-type') || '',
  };
}

async function fetchPage(path) {
  const response = await ensureStatus(
    await fetchWithDiagnostics(`${webBase}${path}`, {}, `page:${path}`),
    `page:${path}`,
    [200],
  );
  const html = await response.text();
  assert(html.includes('<div id="root"></div>'), `page:${path} is missing the React mount node`);
  totals.webRoutes += 1;
}

function loadResourceGroups() {
  const resourcesPath = join(root, 'apps', 'web', 'src', 'config', 'resources.ts');
  const source = readFileSync(resourcesPath, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const moduleStub = { exports: {} };
  const compiled = new Function('exports', 'require', 'module', '__filename', '__dirname', js);
  compiled(moduleStub.exports, require, moduleStub, resourcesPath, join(root, 'apps', 'web', 'src', 'config'));

  return moduleStub.exports.resourceGroups;
}

function resolveValue(record, key) {
  if (!record || !key) {
    return undefined;
  }

  if (Array.isArray(key)) {
    return key.reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), record);
  }

  return record[key];
}

function flattenResources(resourceGroups) {
  return resourceGroups.flatMap((group) => group.items.map((item) => ({
    ...item,
    groupKey: group.key,
  })));
}

async function sweepWebShell() {
  const routes = [
    '/',
    '/login',
    '/dashboard',
    '/knowledge-center',
    '/recruitment-workbench',
    '/self-service',
    '/profile-change-reviews',
    '/career',
    '/career/register',
    '/career/me',
  ];

  for (const route of routes) {
    await fetchPage(route);
  }

  log(`前端壳路由已检查：${routes.length}`);
}

async function sweepResources(token) {
  const resourceGroups = loadResourceGroups();
  const resources = flattenResources(resourceGroups);
  assert(resources.length >= 19, `预期至少 19 个资源配置，实际为 ${resources.length}`);

  for (const resource of resources) {
    assert(resource.endpoint, `资源 ${resource.key} 缺少 endpoint`);
    assert(resource.path, `资源 ${resource.key} 缺少 path`);

    await fetchPage(resource.path);

    const list = await request(`/${resource.endpoint}${buildQuery({ page: 1, limit: 3 })}`, token);
    assert(Array.isArray(list.items), `${resource.key} 列表响应缺少 items[]`);
    assert(list.meta && typeof list.meta.total === 'number', `${resource.key} 列表响应缺少 meta.total`);
    totals.lists += 1;

    const firstRecord = list.items.find((item) => item && typeof item.id === 'string');
    if (firstRecord) {
      const detail = await request(`/${resource.endpoint}/${encodeURIComponent(firstRecord.id)}`, token);
      assert(detail && detail.id === firstRecord.id, `${resource.key} 详情响应 id 不一致`);
      totals.details += 1;
    }

    const optionEndpoints = [...new Set((resource.fields || []).map((field) => field.optionsEndpoint).filter(Boolean))];
    for (const endpoint of optionEndpoints) {
      const options = await request(`/${endpoint}${buildQuery({ page: 1, limit: 100 })}`, token);
      assert(Array.isArray(options.items), `${resource.key} 下拉数据源 ${endpoint} 缺少 items[]`);
      totals.optionSources += 1;
    }

    const downloadableFields = (resource.fields || []).filter((field) => field.downloadEndpoint);
    for (const field of downloadableFields) {
      const downloadableRecord = list.items.find((item) => item?.id && resolveValue(item, field.key));
      if (!downloadableRecord) {
        continue;
      }

      const path = field.downloadEndpoint.replace(':id', encodeURIComponent(downloadableRecord.id));
      await download(path, token);
    }

    totals.resources += 1;
  }

  log(`资源页已检查：${resources.length}`);
}

function appendResumeFile(form, fileName) {
  const samplePath = join(root, 'docs', 'samples', 'candidate-resume.docx');
  const docx = readFileSync(samplePath);
  form.append(
    'file',
    new Blob([docx], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }),
    fileName,
  );
}

async function submitPublicCareerApplication(jobId, cleanupLater, adminToken) {
  const email = `surface-public-${suffix}@example.com`;
  const form = new FormData();
  form.append('jobPostingId', jobId);
  form.append('fullName', `表面巡检公开投递${shortSuffix}`);
  form.append('email', email);
  form.append('phone', `139${shortSuffix}`);
  form.append('currentCompany', '表面巡检公司');
  form.append('yearsOfExperience', '5');
  form.append('notes', '自动化公开职位投递验证。');
  appendResumeFile(form, `public-${shortSuffix}.docx`);

  const application = await request('/career/applications', null, { method: 'POST', body: form });
  assert(application?.candidate?.id, '公开职位投递未返回 candidate.id');
  assert(application?.resume?.id, '公开职位投递未返回 resume.id');
  assert(application?.jobPosting?.id === jobId, '公开职位投递返回了错误的 jobPosting.id');
  totals.candidateSteps += 1;

  cleanupLater(`candidate:${application.candidate.id}`, () =>
    request(`/candidates/${application.candidate.id}`, adminToken, { method: 'DELETE' }, [200, 204]),
  );
  cleanupLater(`resume:${application.resume.id}`, () =>
    request(`/resumes/${application.resume.id}`, adminToken, { method: 'DELETE' }, [200, 204]),
  );
}

async function sweepCandidatePortal(adminToken, cleanupLater) {
  const jobs = await request('/career/job-postings?page=1&limit=5', null);
  assert(Array.isArray(jobs.items), '公开职位列表响应缺少 items[]');
  assert(jobs.items.length > 0, '候选人门户至少需要一个开放职位');
  const firstJob = jobs.items[0];
  totals.candidateSteps += 1;

  await submitPublicCareerApplication(firstJob.id, cleanupLater, adminToken);

  const username = `surface_candidate_${shortSuffix}`;
  const email = `surface-candidate-${suffix}@example.com`;
  cleanupLater(`user:${username}`, () => cleanupTemporaryUser(username));
  const candidateAuth = await request('/auth/candidate-register', null, {
    method: 'POST',
    body: JSON.stringify({
      username,
      email,
      fullName: `表面巡检候选人${shortSuffix}`,
      password: defaultPassword,
      phone: `138${shortSuffix}`,
      currentCompany: '表面巡检公司',
    }),
  });
  assert(candidateAuth?.accessToken, '候选人注册未返回访问令牌');
  assert(candidateAuth?.user?.role === 'candidate', '候选人注册未返回候选人用户');
  const candidateToken = candidateAuth.accessToken;
  totals.candidateSteps += 1;

  const profile = await request('/career/me', candidateToken);
  assert(profile?.candidate?.email === email, '候选人门户档案邮箱不一致');
  cleanupLater(`candidate:${profile.candidate.id}`, () =>
    request(`/candidates/${profile.candidate.id}`, adminToken, { method: 'DELETE' }, [200, 204]),
  );
  totals.candidateSteps += 1;

  const resumeForm = new FormData();
  appendResumeFile(resumeForm, `portal-${shortSuffix}.docx`);
  const upload = await request('/career/me/resumes', candidateToken, { method: 'POST', body: resumeForm });
  assert(upload?.resume?.id, '候选人简历上传未返回 resume.id');
  assert(upload?.resume?.filePath, '候选人简历上传未返回 resume.filePath');
  assert(Array.isArray(upload.jobMatches), '候选人简历上传未返回 jobMatches[]');
  cleanupLater(`resume:${upload.resume.id}`, () =>
    request(`/resumes/${upload.resume.id}`, adminToken, { method: 'DELETE' }, [200, 204]),
  );
  totals.candidateSteps += 1;

  await download(`/career/resumes/${upload.resume.id}/download`, candidateToken);
  totals.candidateSteps += 1;

  const matches = await request('/career/me/job-matches', candidateToken);
  assert(Array.isArray(matches), '候选人职位匹配响应不是数组');
  totals.candidateSteps += 1;

  const targetJobId = matches[0]?.id || firstJob.id;
  const application = await request(`/career/me/applications/${encodeURIComponent(targetJobId)}`, candidateToken, {
    method: 'POST',
  });
  assert(application?.success === true, '候选人门户投递未返回 success=true');
  assert(application?.jobPosting?.id === targetJobId, '候选人门户投递返回了错误的 jobPosting.id');
  totals.candidateSteps += 1;

  const chat = await request('/career/me/chat', candidateToken, {
    method: 'POST',
    body: JSON.stringify({ message: '哪个开放岗位最匹配我的简历？' }),
  });
  assert(typeof chat?.reply === 'string' && chat.reply.trim(), '候选人门户问答未返回回复');
  assert(Array.isArray(chat.references), '候选人门户问答未返回 references[]');
  totals.candidateSteps += 1;

  log('候选人门户已检查');
}

async function cleanup(cleanupTasks) {
  for (const task of cleanupTasks.reverse()) {
    try {
      await task.run();
    } catch (error) {
      console.error(`[surface] 清理失败 ${task.label}: ${(error && error.message) || error}`);
    }
  }
}

async function cleanupTemporaryUser(username) {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('DELETE FROM users WHERE username = $1 AND role = $2', [username, 'candidate']);
  } finally {
    await client.end();
  }
}

async function main() {
  if (!defaultPassword) {
    throw new Error('请通过 HR_DEMO_PASSWORD 或 VERIFY_DEMO_PASSWORD 提供演示账号密码。');
  }

  const cleanupTasks = [];
  const cleanupLater = (label, run) => cleanupTasks.push({ label, run });
  const adminAuth = await login(adminUsername);
  const adminToken = adminAuth.accessToken;

  try {
    await sweepWebShell();
    await sweepResources(adminToken);
    await sweepCandidatePortal(adminToken, cleanupLater);

    log(JSON.stringify(totals, null, 2));
    log('表面巡检验证通过');
  } finally {
    await cleanup(cleanupTasks);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
