const statusLabels = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已拒绝',
  draft: '草稿',
  sent: '已发送',
  accepted: '已接受',
  open: '开放中',
  closed: '已结束',
  new: '新投递',
  screening: '筛选中',
  interview: '面试中',
  offer: '录用阶段',
  hired: '已录用',
  annual: '年假',
  sick: '病假',
  personal: '事假',
  marriage: '婚假',
  overtime: '加班',
  full_time: '全职',
  part_time: '兼职',
  intern: '实习',
};

function displayValue(value) {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  return statusLabels[value] || String(value);
}

function formatDate(value) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTime(value) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${formatDate(value)} ${hour}:${minute}`;
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toDateTimeInput(dateText, timeText) {
  if (!dateText || !timeText) {
    return '';
  }
  return `${dateText}T${timeText}:00.000Z`;
}

module.exports = {
  displayValue,
  formatDate,
  formatDateTime,
  formatMoney,
  toDateTimeInput,
};
