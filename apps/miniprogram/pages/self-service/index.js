const { ensureLogin, showError } = require('../../utils/api');
const {
  getSelfServiceDashboard,
  createLeaveRequest,
  createOvertimeRequest,
  createProfileChangeRequest,
} = require('../../utils/services');
const { displayValue, formatDate, formatMoney, toDateTimeInput } = require('../../utils/format');

Page({
  data: {
    activeTab: 'leave',
    employee: {},
    annualLeaveRemaining: 0,
    latestPayslip: '-',
    recentRequests: [],
    leaveTypeOptions: [
      { label: '年假', value: 'annual' },
      { label: '病假', value: 'sick' },
      { label: '事假', value: 'personal' },
      { label: '婚假', value: 'marriage' },
    ],
    leaveTypeIndex: 0,
    leaveType: 'annual',
    leaveTypeLabel: '年假',
    leaveStartDate: '',
    leaveEndDate: '',
    durationDays: '1',
    leaveReason: '',
    overtimeDate: '',
    overtimeStartTime: '10:00',
    overtimeEndTime: '12:00',
    overtimeHours: '2',
    overtimeReason: '',
    profilePhone: '',
    profileAddress: '',
    submitting: false,
  },

  onShow() {
    if (!ensureLogin()) {
      return;
    }
    this.loadDashboard();
  },

  async loadDashboard() {
    try {
      const dashboard = await getSelfServiceDashboard();
      const employee = {
        ...dashboard.employee,
        departmentName: dashboard.employee.department ? dashboard.employee.department.name : '未设置部门',
        positionName: dashboard.employee.position ? dashboard.employee.position.name : '未设置岗位',
      };
      const recentLeave = (dashboard.recentLeaveRequests || []).slice(0, 3).map((item) => ({
        id: item.id,
        title: `${displayValue(item.leaveType)}申请`,
        statusText: displayValue(item.status),
        detail: `${formatDate(item.startAt)} 至 ${formatDate(item.endAt)} · ${item.durationDays} 天`,
      }));
      const recentOvertime = (dashboard.recentOvertimeRequests || []).slice(0, 3).map((item) => ({
        id: item.id,
        title: '加班申请',
        statusText: displayValue(item.status),
        detail: `${formatDate(item.workDate)} · ${item.hours} 小时`,
      }));
      this.setData({
        employee,
        annualLeaveRemaining: dashboard.stats ? dashboard.stats.annualLeaveRemaining : 0,
        latestPayslip: dashboard.compensation ? formatMoney(dashboard.compensation.netPay) : '-',
        recentRequests: [...recentLeave, ...recentOvertime].slice(0, 5),
        profilePhone: dashboard.employee.phone || '',
        profileAddress: dashboard.employee.address || '',
      });
    } catch (error) {
      showError(error);
    }
  },

  switchTab(event) {
    this.setData({ activeTab: event.currentTarget.dataset.tab });
  },

  onLeaveTypeChange(event) {
    const index = Number(event.detail.value);
    const option = this.data.leaveTypeOptions[index];
    this.setData({ leaveTypeIndex: index, leaveType: option.value, leaveTypeLabel: option.label });
  },
  onLeaveStartDateChange(event) {
    this.setData({ leaveStartDate: event.detail.value });
  },
  onLeaveEndDateChange(event) {
    this.setData({ leaveEndDate: event.detail.value });
  },
  onDurationInput(event) {
    this.setData({ durationDays: event.detail.value });
  },
  onLeaveReasonInput(event) {
    this.setData({ leaveReason: event.detail.value });
  },
  onOvertimeDateChange(event) {
    this.setData({ overtimeDate: event.detail.value });
  },
  onOvertimeStartTimeChange(event) {
    this.setData({ overtimeStartTime: event.detail.value });
  },
  onOvertimeEndTimeChange(event) {
    this.setData({ overtimeEndTime: event.detail.value });
  },
  onOvertimeHoursInput(event) {
    this.setData({ overtimeHours: event.detail.value });
  },
  onOvertimeReasonInput(event) {
    this.setData({ overtimeReason: event.detail.value });
  },
  onProfilePhoneInput(event) {
    this.setData({ profilePhone: event.detail.value });
  },
  onProfileAddressInput(event) {
    this.setData({ profileAddress: event.detail.value });
  },

  async submitLeave() {
    if (!this.data.leaveStartDate || !this.data.leaveEndDate) {
      showError('请选择请假日期。');
      return;
    }
    this.setData({ submitting: true });
    try {
      await createLeaveRequest({
        leaveType: this.data.leaveType,
        startAt: `${this.data.leaveStartDate}T09:00:00.000Z`,
        endAt: `${this.data.leaveEndDate}T18:00:00.000Z`,
        durationDays: Number(this.data.durationDays || 1),
        reason: this.data.leaveReason || '小程序提交请假申请',
      });
      wx.showToast({ title: '已提交', icon: 'success' });
      await this.loadDashboard();
    } catch (error) {
      showError(error);
    } finally {
      this.setData({ submitting: false });
    }
  },

  async submitOvertime() {
    if (!this.data.overtimeDate) {
      showError('请选择加班日期。');
      return;
    }
    this.setData({ submitting: true });
    try {
      await createOvertimeRequest({
        workDate: `${this.data.overtimeDate}T00:00:00.000Z`,
        startAt: toDateTimeInput(this.data.overtimeDate, this.data.overtimeStartTime),
        endAt: toDateTimeInput(this.data.overtimeDate, this.data.overtimeEndTime),
        hours: Number(this.data.overtimeHours || 1),
        reason: this.data.overtimeReason || '小程序提交加班申请',
      });
      wx.showToast({ title: '已提交', icon: 'success' });
      await this.loadDashboard();
    } catch (error) {
      showError(error);
    } finally {
      this.setData({ submitting: false });
    }
  },

  async submitProfileChange() {
    const changes = {};
    if (this.data.profilePhone) {
      changes.phone = this.data.profilePhone;
    }
    if (this.data.profileAddress) {
      changes.address = this.data.profileAddress;
    }
    if (!Object.keys(changes).length) {
      showError('请至少填写一项资料变更。');
      return;
    }
    this.setData({ submitting: true });
    try {
      await createProfileChangeRequest({ changes });
      wx.showToast({ title: '已提交', icon: 'success' });
      await this.loadDashboard();
    } catch (error) {
      showError(error);
    } finally {
      this.setData({ submitting: false });
    }
  },
});
