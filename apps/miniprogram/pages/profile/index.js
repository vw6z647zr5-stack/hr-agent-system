const { DEFAULT_API_BASE } = require('../../utils/config');

const roleLabels = {
  admin: '系统管理员',
  hr: '人力资源',
  manager: '部门经理',
  employee: '员工',
  candidate: '候选人',
};

Page({
  data: {
    apiBase: DEFAULT_API_BASE,
    user: {},
    roleLabel: '-',
  },

  onShow() {
    const app = getApp();
    const user = app.globalData.user || {};
    this.setData({
      apiBase: app.globalData.apiBase || DEFAULT_API_BASE,
      user,
      roleLabel: roleLabels[user.role] || user.role || '-',
    });
  },

  onApiBaseInput(event) {
    this.setData({ apiBase: event.detail.value });
  },

  saveApiBase() {
    getApp().setApiBase(this.data.apiBase);
    wx.showToast({ title: '已保存', icon: 'success' });
  },

  logout() {
    getApp().clearSession();
    wx.navigateTo({ url: '/pages/login/index' });
  },
});
