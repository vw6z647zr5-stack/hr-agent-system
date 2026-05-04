const { DEFAULT_API_BASE } = require('./utils/config');

App({
  globalData: {
    apiBase: DEFAULT_API_BASE,
    token: '',
    user: null,
  },

  onLaunch() {
    this.globalData.apiBase = wx.getStorageSync('apiBase') || DEFAULT_API_BASE;
    this.globalData.token = wx.getStorageSync('accessToken') || '';
    this.globalData.user = wx.getStorageSync('currentUser') || null;
  },

  setApiBase(apiBase) {
    const normalized = String(apiBase || '').trim().replace(/\/$/, '');
    this.globalData.apiBase = normalized || DEFAULT_API_BASE;
    wx.setStorageSync('apiBase', this.globalData.apiBase);
  },

  setSession(payload) {
    this.globalData.token = payload.accessToken;
    this.globalData.user = payload.user;
    wx.setStorageSync('accessToken', payload.accessToken);
    wx.setStorageSync('currentUser', payload.user);
  },

  clearSession() {
    this.globalData.token = '';
    this.globalData.user = null;
    wx.removeStorageSync('accessToken');
    wx.removeStorageSync('currentUser');
  },

  hasSession() {
    return Boolean(this.globalData.token);
  },
});
