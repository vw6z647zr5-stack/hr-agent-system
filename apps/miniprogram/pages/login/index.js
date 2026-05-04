const { DEFAULT_API_BASE } = require('../../utils/config');
const { login } = require('../../utils/auth');
const { showError } = require('../../utils/api');

Page({
  data: {
    apiBase: DEFAULT_API_BASE,
    username: '',
    password: '',
    submitting: false,
  },

  onLoad() {
    const app = getApp();
    this.setData({
      apiBase: app.globalData.apiBase || DEFAULT_API_BASE,
    });
  },

  onApiBaseInput(event) {
    this.setData({ apiBase: event.detail.value });
  },

  onUsernameInput(event) {
    this.setData({ username: event.detail.value });
  },

  onPasswordInput(event) {
    this.setData({ password: event.detail.value });
  },

  useDemoAccount(event) {
    this.setData({
      username: event.currentTarget.dataset.username,
      password: '',
    });
  },

  async submitLogin() {
    if (!this.data.username || !this.data.password) {
      showError('请输入用户名和密码。');
      return;
    }

    this.setData({ submitting: true });
    try {
      const app = getApp();
      app.setApiBase(this.data.apiBase);
      const session = await login(this.data.username, this.data.password);
      app.setSession(session);
      wx.switchTab({ url: '/pages/home/index' });
    } catch (error) {
      showError(error);
    } finally {
      this.setData({ submitting: false });
    }
  },
});
