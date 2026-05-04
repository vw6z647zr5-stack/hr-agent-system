const { showError } = require('../../utils/api');
const { listPublicJobs, submitCareerApplication, getCandidateProfile } = require('../../utils/services');
const { displayValue } = require('../../utils/format');

Page({
  data: {
    jobs: [],
    selectedJobId: '',
    selectedJobTitle: '请先选择岗位',
    fullName: '',
    email: '',
    phone: '',
    yearsOfExperience: '',
    notes: '',
    resumePath: '',
    resumeName: '',
    candidateProfile: {},
    loading: false,
    submitting: false,
  },

  onShow() {
    this.loadJobs();
    this.loadCandidateProfile();
  },

  async loadJobs() {
    this.setData({ loading: true });
    try {
      const result = await listPublicJobs();
      const jobs = (result.items || []).map((item) => ({
        ...item,
        statusText: displayValue(item.status),
        employmentTypeText: displayValue(item.employmentType),
      }));
      this.setData({ jobs });
      if (jobs.length && !this.data.selectedJobId) {
        this.setData({ selectedJobId: jobs[0].id, selectedJobTitle: jobs[0].title });
      }
    } catch (error) {
      showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadCandidateProfile() {
    const app = getApp();
    if (!app.globalData.token || app.globalData.user?.role !== 'candidate') {
      return;
    }
    try {
      const profile = await getCandidateProfile();
      const candidate = profile.candidate
        ? {
            ...profile.candidate,
            stageText: displayValue(profile.candidate.stage),
            jobTitle: profile.candidate.appliedJobPosting ? profile.candidate.appliedJobPosting.title : '未绑定职位',
          }
        : null;
      this.setData({
        candidateProfile: { ...profile, candidate },
        fullName: candidate?.fullName || this.data.fullName,
        email: candidate?.email || this.data.email,
        phone: candidate?.phone || this.data.phone,
      });
    } catch {
      this.setData({ candidateProfile: {} });
    }
  },

  selectJob(event) {
    const job = this.data.jobs[Number(event.currentTarget.dataset.index)];
    this.setData({ selectedJobId: job.id, selectedJobTitle: job.title });
  },

  onFullNameInput(event) {
    this.setData({ fullName: event.detail.value });
  },
  onEmailInput(event) {
    this.setData({ email: event.detail.value });
  },
  onPhoneInput(event) {
    this.setData({ phone: event.detail.value });
  },
  onYearsInput(event) {
    this.setData({ yearsOfExperience: event.detail.value });
  },
  onNotesInput(event) {
    this.setData({ notes: event.detail.value });
  },

  chooseResume() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf', 'docx'],
      success: (result) => {
        const file = result.tempFiles[0];
        this.setData({ resumePath: file.path, resumeName: file.name });
      },
      fail: () => {
        showError('未选择简历文件。');
      },
    });
  },

  async submitApplication() {
    if (!this.data.selectedJobId) {
      showError('请先选择岗位。');
      return;
    }
    if (!this.data.fullName || !this.data.email || !this.data.phone) {
      showError('请填写姓名、邮箱和手机号。');
      return;
    }
    if (!this.data.resumePath) {
      showError('请上传 PDF 或 DOCX 简历。');
      return;
    }

    this.setData({ submitting: true });
    try {
      await submitCareerApplication(
        {
          jobPostingId: this.data.selectedJobId,
          fullName: this.data.fullName,
          email: this.data.email,
          phone: this.data.phone,
          yearsOfExperience: this.data.yearsOfExperience ? Number(this.data.yearsOfExperience) : undefined,
          notes: this.data.notes,
        },
        this.data.resumePath,
      );
      wx.showToast({ title: '投递成功', icon: 'success' });
      this.setData({ resumePath: '', resumeName: '', notes: '' });
      this.loadCandidateProfile();
    } catch (error) {
      showError(error);
    } finally {
      this.setData({ submitting: false });
    }
  },
});
