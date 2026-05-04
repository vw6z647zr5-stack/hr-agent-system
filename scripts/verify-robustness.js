const apiBase = process.env.VERIFY_API_BASE || 'http://127.0.0.1:3000/api';
const defaultPassword = process.env.HR_DEMO_PASSWORD || process.env.VERIFY_DEMO_PASSWORD;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(path, token, options = {}, expected = [200, 201]) {
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  if (!headers.has('content-type') && options.body && !(options.body instanceof FormData)) {
    headers.set('content-type', 'application/json');
  }

  let response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new Error(`接口不可访问：${apiBase}。原始错误：${(error && error.message) || error}`);
  }

  if (!expected.includes(response.status)) {
    const text = await response.text();
    throw new Error(`${path} -> ${response.status} ${text}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

async function login(username, password = defaultPassword) {
  if (!password) {
    throw new Error('请通过 HR_DEMO_PASSWORD 或 VERIFY_DEMO_PASSWORD 提供演示账号密码。');
  }

  return request('/auth/login', null, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

async function expectStatus(path, token, options = {}, expected = [200]) {
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  if (!headers.has('content-type') && options.body && !(options.body instanceof FormData)) {
    headers.set('content-type', 'application/json');
  }

  let response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new Error(`接口不可访问：${apiBase}。原始错误：${(error && error.message) || error}`);
  }

  if (!expected.includes(response.status)) {
    const text = await response.text();
    throw new Error(`${path} -> ${response.status} ${text}`);
  }

  return response;
}

async function main() {
  const hr = await login('hr_admin');
  const token = hr.accessToken;
  const suffix = String(Date.now()).slice(-8);
  const cleanupTasks = [];

  try {
    await expectStatus('/auth/me', token, {}, [200]);

    const logoutUser = await login('hr_admin');
    await expectStatus('/auth/logout', logoutUser.accessToken, { method: 'POST' }, [204]);
    await expectStatus('/auth/me', logoutUser.accessToken, {}, [401]);

    const department = await request('/departments', token, {
      method: 'POST',
      body: JSON.stringify({
        name: `健壮性部门${suffix}`,
        code: `RB-${suffix}`,
        description: '健壮性专项验证临时部门',
      }),
    });
    cleanupTasks.unshift(() => request(`/departments/${department.id}`, token, { method: 'DELETE' }));

    const patchedDepartment = await request(`/departments/${department.id}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ description: `健壮性局部更新验证 ${suffix}` }),
    });
    assert(
      patchedDepartment.description === `健壮性局部更新验证 ${suffix}`,
      '部门 PATCH 局部更新未生效',
    );

    const position = await request('/positions', token, {
      method: 'POST',
      body: JSON.stringify({
        departmentId: department.id,
        name: `健壮性岗位${suffix}`,
        code: `RBP-${suffix}`,
        level: 'P5',
        description: '健壮性专项验证临时岗位',
      }),
    });
    cleanupTasks.unshift(() => request(`/positions/${position.id}`, token, { method: 'DELETE' }));

    const patchedPosition = await request(`/positions/${position.id}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ description: `健壮性局部更新验证 ${suffix}` }),
    });
    assert(
      patchedPosition.description === `健壮性局部更新验证 ${suffix}`,
      '岗位 PATCH 局部更新未生效',
    );

    await request(
      '/knowledge-management/documents/..%2F..%2FREADME.md',
      token,
      {},
      [404],
    );
    await request(
      '/knowledge-management/documents/docs%2Fpolicies%2Fmanaged%2Femployee-handbook.md/diff?historyId=..%2Fescape',
      token,
      {},
      [400, 404],
    );
    await request(
      '/knowledge-management/documents/%E0%A4%A',
      token,
      {},
      [400],
    );

    const candidates = await request('/candidates?page=1&limit=1', token);
    const candidate = candidates.items[0];
    assert(candidate?.id, '缺少可用于非法上传验证的候选人数据');

    const invalidResumeForm = new FormData();
    invalidResumeForm.append('file', new Blob(['not a resume'], { type: 'text/plain' }), 'resume.txt');
    const invalidUpload = await fetch(`${apiBase}/resumes/upload/${candidate.id}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: invalidResumeForm,
    });
    assert(invalidUpload.status === 400, '非法简历上传应被拒绝');

    const spoofedPdfForm = new FormData();
    spoofedPdfForm.append('file', new Blob(['not a real pdf'], { type: 'application/pdf' }), 'resume.pdf');
    const spoofedPdfUpload = await fetch(`${apiBase}/resumes/upload/${candidate.id}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: spoofedPdfForm,
    });
    assert(spoofedPdfUpload.status === 400, '伪造 PDF 文件头的简历上传应被拒绝');

    const spoofedImportForm = new FormData();
    spoofedImportForm.append('file', new Blob(['not a real pdf'], { type: 'application/pdf' }), 'policy.pdf');
    const spoofedImport = await fetch(`${apiBase}/knowledge-management/document-imports/preview`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: spoofedImportForm,
    });
    assert(spoofedImport.status === 400, '伪造 PDF 文件头的知识文档导入应被拒绝');

    console.log('健壮性专项验证通过。');
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
