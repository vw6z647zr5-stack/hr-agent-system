const { ensureLogin, showError, getApiBase } = require('../../utils/api');
const { getCurrentUser } = require('../../utils/auth');
const { getSelfServiceDashboard, getCandidateProfile } = require('../../utils/services');
const { displayValue } = require('../../utils/format');

const roleLabels = {
  admin: '系统管理员',
  hr: '人力资源',
  manager: '部门经理',
  employee: '员工',
  candidate: '候选人',
};

Page({
  data: {
    apiBase: '',
    displayName: '未登录',
    roleLabel: '-',
    statusText: '待登录',
    isCandidate: false,
    stats: {},
    reminders: [],
    candidateProfile: {},
    loading: false,
  },

  onShow() {
    if (!ensureLogin()) {
      return;
    }
    this.loadHome();
  },

  async loadHome() {
    this.setData({ loading: true, apiBase: getApiBase() });
    try {
      const user = await getCurrentUser();
      const isCandidate = user.role === 'candidate';
      const nextData = {
        displayName: user.displayName || user.username,
        roleLabel: roleLabels[user.role] || user.role,
        statusText: '已登录',
        isCandidate,
      };

      if (isCandidate) {
        const profile = await getCandidateProfile();
        const candidate = profile.candidate
          ? {
              ...profile.candidate,
              stageText: displayValue(profile.candidate.stage),
              jobTitle: profile.candidate.appliedJobPosting ? profile.candidate.appliedJobPosting.title : '未绑定职位',
            }
          : null;
        this.setData({ ...nextData, candidateProfile: { ...profile, candidate } });
      } else if (user.employeeId) {
        const dashboard = await getSelfServiceDashboard();
        const reminders = (dashboard.reminders || []).slice(0, 5).map((item) => ({
          ...item,
          priorityText: displayValue(item.priority),
        }));
        this.setData({ ...nextData, stats: dashboard.stats || {}, reminders });
      } else {
        this.setData(nextData);
      }
    } catch (error) {
      showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  goSelfService() {
    wx.switchTab({ url: '/pages/self-service/index' });
  },

  goKnowledge() {
    wx.switchTab({ url: '/pages/knowledge/index' });
  },

  goCareer() {
    wx.switchTab({ url: '/pages/career/index' });
  },

  goProfile() {
    wx.switchTab({ url: '/pages/profile/index' });
  },
});
