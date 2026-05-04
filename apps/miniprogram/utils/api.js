function getAppInstance() {
  return getApp();
}

function getApiBase() {
  return getAppInstance().globalData.apiBase;
}

function getToken() {
  return getAppInstance().globalData.token || wx.getStorageSync('accessToken') || '';
}

function normalizeError(error) {
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error.message === 'string') {
    return error.message;
  }
  return '请求失败，请稍后再试。';
}

function request(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.header || {}),
  };

  if (!headers['content-type'] && options.data !== undefined) {
    headers['content-type'] = 'application/json';
  }

  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${getApiBase()}${path}`,
      method: options.method || 'GET',
      data: options.data,
      header: headers,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data);
          return;
        }

        if (response.statusCode === 401) {
          getAppInstance().clearSession();
        }

        const body = response.data || {};
        const message = Array.isArray(body.message) ? body.message.join('，') : body.message || body.error;
        reject(new Error(message || `请求失败：${response.statusCode}`));
      },
      fail(error) {
        reject(new Error(normalizeError(error)));
      },
    });
  });
}

function upload(path, filePath, formData = {}) {
  const token = getToken();
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${getApiBase()}${path}`,
      filePath,
      name: 'file',
      formData,
      header: token ? { authorization: `Bearer ${token}` } : {},
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          try {
            resolve(JSON.parse(response.data));
          } catch {
            resolve(response.data);
          }
          return;
        }

        try {
          const body = JSON.parse(response.data || '{}');
          reject(new Error(body.message || body.error || `上传失败：${response.statusCode}`));
        } catch {
          reject(new Error(`上传失败：${response.statusCode}`));
        }
      },
      fail(error) {
        reject(new Error(normalizeError(error)));
      },
    });
  });
}

function showError(error) {
  wx.showToast({
    title: normalizeError(error),
    icon: 'none',
    duration: 2400,
  });
}

function ensureLogin() {
  if (!getToken()) {
    wx.navigateTo({ url: '/pages/login/index' });
    return false;
  }
  return true;
}

module.exports = {
  request,
  upload,
  showError,
  ensureLogin,
  getApiBase,
};
