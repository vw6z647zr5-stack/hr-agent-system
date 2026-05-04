import type { ResourceField, UserRole } from '../types';

const roleLabels: Record<UserRole, string> = {
  admin: '系统管理员',
  hr: '人力资源',
  manager: '部门经理',
  employee: '员工',
  candidate: '候选人',
};

const commonValueLabels: Record<string, string> = {
  admin: '系统管理员',
  hr: '人力资源',
  manager: '部门经理',
  employee: '员工',
  candidate: '候选人',
  high: '高',
  medium: '中',
  low: '低',
  pending: '待审批',
  approved: '已通过',
  rejected: '已拒绝',
  annual: '年假',
  sick: '病假',
  marriage: '婚假',
  personal: '事假',
  maternity: '产假',
  paternity: '陪产假',
  sent: '已发送',
  accepted: '已接受',
  completed: '已完成',
  cancelled: '已取消',
  male: '男',
  female: '女',
  unknown: '未知',
  present: '正常',
  anomaly: '异常',
  late: '迟到',
  active: '有效',
  probation: '试用期',
  full_time: '全职',
  part_time: '兼职',
  intern: '实习',
  monthly: '月薪制',
  quarterly: '季度',
  labor: '劳动合同',
  service: '劳务合同',
  open: '开放中',
  draft: '草稿',
  review: '待复核',
  published: '已发布',
  archived: '已归档',
  generated: '已生成',
  scheduled: '已安排',
  closed: '已结束',
  expired: '已过期',
  exited: '已离职',
  in_progress: '进行中',
  new: '新投递',
  screening: '筛选中',
  interview: '面试中',
  offer: '录用阶段',
  hired: '已录用',
  benefits: '福利',
  company_overview: '公司概况',
  policy: '制度',
  leave: '假期',
  profile: '资料',
  overtime: '加班',
  attendance: '考勤',
  office: '办公',
  schedule: '作息安排',
  security: '信息安全',
  support: '支持渠道',
  operations: '运营节奏',
  onboarding: '入职',
  company: '公司信息',
  organization: '组织管理',
  it_support: '信息技术支持',
  payroll: '薪酬',
  video: '视频面试',
  onsite: '现场面试',
  phone: '电话面试',
  linkedin: '领英',
  referral: '内部推荐',
  campus: '校园招聘',
  social: '社交媒体',
  career_portal: '候选人门户',
  web: '网页端',
  mobile: '移动端',
  meets_expectation: '符合预期',
  exceeds_expectation: '超出预期',
  okr: '目标与关键结果',
  kpi: '关键绩效指标',
  policy_document: '制度文档',
  company_profile: '公司资料',
  architecture: '技术架构',
  general_document: '通用文档',
  added: '新增',
  removed: '已移除',
  unchanged: '未变更',
  changed: '已修改',
};

const errorMessageLabels: Record<string, string> = {};

const objectKeyLabels: Record<string, string> = {
  name: '姓名',
  fullName: '姓名',
  employeeNo: '工号',
  email: '邮箱',
  phone: '电话',
  address: '地址',
  emergencyContact: '紧急联系人',
  bankAccountMasked: '银行卡脱敏',
  nationalIdMasked: '身份证脱敏',
  avatarUrl: '头像地址',
  profileSummary: '个人简介',
  summary: '摘要',
  title: '标题',
  label: '字段名称',
  description: '说明',
  value: '字段值',
  question: '问题',
  answer: '答案',
  category: '类别',
  status: '状态',
  owner: '负责人',
  version: '版本',
  effectiveDate: '生效日期',
  reviewNotes: '复核说明',
  lastPublishedAt: '最近发布时间',
  tags: '标签',
  source: '来源',
  stage: '阶段',
  score: '评分',
  rating: '评级',
  jobTitle: '岗位',
  currentCompany: '现公司',
  yearsOfExperience: '工作年限',
  skills: '技能',
  matchedSkills: '命中技能',
  missingSkills: '缺失技能',
  certificates: '证书',
  education: '学历背景',
  department: '部门',
  position: '岗位',
  manager: '直属经理',
  startDate: '开始日期',
  endDate: '结束日期',
  workDate: '工作日期',
  leaveType: '假期类型',
  reason: '原因',
  requirements: '岗位要求',
};

export function getRoleLabel(role?: UserRole | null) {
  if (!role) {
    return '-';
  }

  return roleLabels[role] ?? role;
}

export function extractErrorMessage(rawText: string, fallback: string) {
  try {
    const parsed = JSON.parse(rawText) as { message?: string | string[] };

    if (Array.isArray(parsed.message)) {
      return parsed.message.join('，');
    }

    if (typeof parsed.message === 'string') {
      return parsed.message;
    }
  } catch {
    // 按纯文本响应继续处理。
  }

  return rawText || fallback;
}

export function translateErrorMessage(message: string) {
  const normalized = message.trim();

  if (!normalized) {
    return '请求失败，请稍后再试。';
  }

  if (normalized.startsWith('简历解析失败：')) {
    return normalized;
  }

  return errorMessageLabels[normalized] ?? normalized;
}

export function formatDisplayValue(
  value: unknown,
  field?: Pick<ResourceField, 'kind' | 'options'>,
): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (field?.options?.length && !Array.isArray(value)) {
    const option = field.options.find((item) => item.value === value || String(item.value) === String(value));
    if (option) {
      return option.label;
    }
  }

  if (field?.kind === 'switch' && typeof value === 'boolean') {
    return value ? '是' : '否';
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatDisplayValue(item, field)).join('，');
  }

  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }

  if (typeof value === 'object') {
    return formatObjectValue(value as Record<string, unknown>);
  }

  if (typeof value === 'string') {
    return commonValueLabels[value] ?? value;
  }

  return String(value);
}

function formatObjectValue(value: Record<string, unknown>) {
  const parts = Object.entries(value)
    .filter(([, item]) => item !== null && item !== undefined && item !== '')
    .map(([key, item]) => `${objectKeyLabels[key] ?? key}：${formatDisplayValue(item)}`);

  return parts.length ? parts.join('，') : '-';
}
