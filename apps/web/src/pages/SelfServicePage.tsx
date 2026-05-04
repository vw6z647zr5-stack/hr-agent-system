import {
  Alert,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Progress,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import { BellOutlined, BookOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';
import {
  apiFileRequest,
  triggerBrowserDownload,
} from '../api/http';
import {
  createProfileChangeRequest,
  createSelfLeaveRequest,
  createSelfOvertimeRequest,
  getSelfActiveContractDownloadUrl,
  getSelfServiceDashboard,
  getSelfPayslipDownloadUrl,
  listMyProfileChangeRequests,
  type ApprovalTimelineRow,
  type EmploymentSnapshot,
  type EmployeeProfileSnapshot,
  type ProfileChangeRow,
  type SelfServiceDashboard,
  type SelfServiceReminder,
} from '../api/self-service';
import { AgentChatPanel } from '../components/AgentChatPanel';
import { StatCard } from '../components/StatCard';
import { UserPhotoUpload } from '../components/UserPhotoUpload';
import { authStore } from '../state/auth.store';
import { formatDisplayValue } from '../utils/display';

interface LeaveFormValues {
  leaveType: string;
  durationDays?: number;
  startAt?: Dayjs;
  endAt?: Dayjs;
  reason?: string;
}

interface OvertimeFormValues {
  workDate?: Dayjs;
  hours?: number;
  startAt?: Dayjs;
  endAt?: Dayjs;
  reason?: string;
}

interface ProfileFormValues {
  address?: string;
  phone?: string;
  bankAccountMasked?: string;
  avatarUrl?: string;
  emergencyContact?: {
    name?: string;
    phone?: string;
  };
}

const leaveTypeOptions = [
  { label: '年假', value: 'annual' },
  { label: '病假', value: 'sick' },
  { label: '婚假', value: 'marriage' },
  { label: '事假', value: 'personal' },
];

export function SelfServicePage() {
  const user = authStore((state) => state.user);
  const [leaveForm] = Form.useForm<LeaveFormValues>();
  const [overtimeForm] = Form.useForm<OvertimeFormValues>();
  const [profileForm] = Form.useForm<ProfileFormValues>();
  const [dashboard, setDashboard] = useState<SelfServiceDashboard | null>(null);
  const [profileRequests, setProfileRequests] = useState<ProfileChangeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState<'leave' | 'overtime' | 'profile' | null>(null);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const load = async () => {
    if (!user?.employeeId) {
      setDashboard(null);
      setProfileRequests([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [dashboardPayload, profileChangePayload] = await Promise.all([
        getSelfServiceDashboard(),
        listMyProfileChangeRequests(),
      ]);
      setDashboard(dashboardPayload);
      setProfileRequests(profileChangePayload);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user?.employeeId]);

  const submitLeaveRequest = async (values: LeaveFormValues) => {
    if (submittingAction) {
      return;
    }

    if (!values.startAt || !values.endAt) {
      return;
    }

    try {
      setSubmittingAction('leave');
      setError(null);
      await createSelfLeaveRequest({
        leaveType: values.leaveType,
        durationDays: values.durationDays,
        startAt: values.startAt.toISOString(),
        endAt: values.endAt.toISOString(),
        reason: values.reason?.trim(),
      });
      leaveForm.resetFields();
      messageApi.success('请假申请已提交，等待审批。');
      await load();
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setSubmittingAction(null);
    }
  };

  const submitOvertimeRequest = async (values: OvertimeFormValues) => {
    if (submittingAction) {
      return;
    }

    if (!values.workDate || !values.startAt || !values.endAt) {
      return;
    }

    try {
      setSubmittingAction('overtime');
      setError(null);
      await createSelfOvertimeRequest({
        workDate: values.workDate.format('YYYY-MM-DD'),
        hours: values.hours,
        startAt: values.startAt.toISOString(),
        endAt: values.endAt.toISOString(),
        reason: values.reason?.trim(),
      });
      overtimeForm.resetFields();
      messageApi.success('加班申请已提交，等待审批。');
      await load();
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setSubmittingAction(null);
    }
  };

  const submitProfileChange = async (values: ProfileFormValues) => {
    if (submittingAction) {
      return;
    }

    const changes = buildProfileChangePayload(values, dashboard?.employee ?? null);

    if (Object.keys(changes).length === 0) {
      messageApi.warning('请至少填写一个发生变化的字段。');
      return;
    }

    try {
      setSubmittingAction('profile');
      setError(null);
      await createProfileChangeRequest({ changes });
      profileForm.resetFields();
      messageApi.success('资料变更申请已提交，等待人力资源审批。');
      await load();
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleDownloadSelfFile = async (path: string) => {
    if (downloadingPath || !path) {
      return;
    }

    try {
      setError(null);
      setDownloadingPath(path);
      const file = await apiFileRequest(path);
      triggerBrowserDownload(file);
    } catch (downloadError) {
      setError((downloadError as Error).message);
    } finally {
      setDownloadingPath(null);
    }
  };

  if (!user?.employeeId) {
    return (
      <Card className="rounded-3xl shadow-panel">
        <Alert
          type="info"
          showIcon
          message="当前账号未绑定员工档案"
          description="员工自助工作台仅对已关联员工档案的账号开放。请先在组织人事模块绑定员工档案后再访问此页面。"
        />
      </Card>
    );
  }

  if (loading && !dashboard) {
    return (
      <div className="space-y-6">
        <div className="animate-shimmer rounded-3xl bg-white p-8">
          <div className="h-6 w-1/3 rounded-2xl bg-slate-200" />
          <div className="mt-3 h-4 w-2/3 rounded-2xl bg-slate-200" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-shimmer rounded-2xl border border-slate-100 bg-white p-5">
              <div className="h-3 w-1/3 rounded-2xl bg-slate-200" />
              <div className="mt-2 h-8 w-2/3 rounded-2xl bg-slate-200" />
              <div className="mt-2 h-3 w-1/2 rounded-2xl bg-slate-200" />
            </div>
          ))}
        </div>
        <div className="animate-shimmer rounded-3xl bg-white p-8">
          <div className="h-5 w-1/4 rounded-2xl bg-slate-200" />
          <div className="mt-4 h-4 w-full rounded-2xl bg-slate-200" />
          <div className="mt-3 h-4 w-2/3 rounded-2xl bg-slate-200" />
        </div>
      </div>
    );
  }

  const employee = dashboard?.employee ?? null;
  const employment = dashboard?.employment ?? null;
  const stats = dashboard?.stats;
  const attendanceSummary = dashboard?.attendanceSummary;
  const performance = dashboard?.performance;
  const latestReview = performance?.latestReview ?? null;
  const compensation = dashboard?.compensation ?? null;
  const reminders = dashboard?.reminders ?? [];
  const knowledgeTips = dashboard?.knowledgeBaseTips ?? [];
  const approvalTimeline = dashboard?.approvalTimeline ?? [];
  const leaveBalances = dashboard?.leaveBalances ?? [];
  const attendanceRows = dashboard?.recentAttendance ?? [];
  const leaveRows = dashboard?.recentLeaveRequests ?? [];
  const overtimeRows = dashboard?.recentOvertimeRequests ?? [];
  const payslipRows = dashboard?.recentPayslips ?? [];
  const latestPayslip = payslipRows[0] ?? null;
  const activeGoals = performance?.activeGoals ?? [];
  const contractExpiry = getContractExpiryLabel(employment);

  return (
    <div className="space-y-8">
      {contextHolder}
      {error ? <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} /> : null}
      <div className="flex justify-end">
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()} size="small" className="rounded-xl">
          刷新数据
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="待审批请假" value={stats?.pendingLeaveRequests ?? 0} helper="当前仍在审批流中的请假申请" />
        <StatCard label="待审批加班" value={stats?.pendingOvertimeRequests ?? 0} helper="待主管确认后进入薪资计算" />
        <StatCard label="资料变更中" value={stats?.profileChanges ?? 0} helper="已提交但尚未完成人力资源审批" />
        <StatCard label="可查看工资单" value={stats?.visiblePayslips ?? 0} helper="员工端当前可下载的工资单数量" />
        <StatCard
          label="本月已核准加班"
          value={`${formatMetricNumber(stats?.approvedOvertimeHours ?? 0)} 小时`}
          helper="本月已审批通过的加班工时"
        />
        <StatCard
          label="年假剩余"
          value={`${formatMetricNumber(stats?.annualLeaveRemaining ?? 0)} 天`}
          helper="来自当前可用的年假余额记录"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-3xl border-slate-100 shadow-panel">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Typography.Title level={4} className="!mb-1">
                个人档案与任职信息
              </Typography.Title>
              <Typography.Text type="secondary">
                查看员工基础信息、任职状态、合同进度和个人资料完整度。
              </Typography.Text>
            </div>
            <Space wrap>
              <UserPhotoUpload user={user} size={48} showText onUploaded={load} />
              <Tag color="processing">{formatDisplayValue(employee?.employmentStatus)}</Tag>
              {contractExpiry ? <Tag color={contractExpiry.color}>{contractExpiry.label}</Tag> : null}
            </Space>
          </div>

          <div className="mt-6 rounded-2xl bg-gradient-to-br from-teal-50/60 to-white px-5 py-4 border border-teal-100/40">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-slate-500">档案完整度</div>
                <div className="text-2xl font-bold text-ink">{employee?.profileCompletion ?? 0}%</div>
              </div>
              <div className="w-full max-w-[280px]">
                <Progress percent={employee?.profileCompletion ?? 0} strokeColor="#0f766e" showInfo={false} />
              </div>
            </div>
          </div>

          <Descriptions className="mt-6" bordered column={{ xs: 1, md: 2 }}>
            <Descriptions.Item label="姓名">{employee?.fullName ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="工号">{employee?.employeeNo ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="部门">{employee?.department?.name ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="岗位">{employee?.position?.name ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="直属上级">{employee?.manager?.fullName ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="职级">{employee?.grade ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="入职日期">{formatDate(employee?.joinDate)}</Descriptions.Item>
            <Descriptions.Item label="转正日期">{formatDate(employee?.regularizationDate)}</Descriptions.Item>
            <Descriptions.Item label="劳动合同">{employment?.contractNo ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="合同期限">
              {employment?.startDate ? `${formatDate(employment.startDate)} 至 ${formatDate(employment.endDate)}` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="合同附件">
              {employment?.hasDocument ? (
                <Button
                  type="link"
                  className="!px-0"
                  loading={downloadingPath === getSelfActiveContractDownloadUrl()}
                  disabled={Boolean(downloadingPath)}
                  onClick={() => void handleDownloadSelfFile(getSelfActiveContractDownloadUrl())}
                >
                  下载当前合同
                </Button>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="邮箱">{employee?.email ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="手机">{employee?.phone ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="地址">{employee?.address ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="紧急联系人">{formatEmergencyContact(employee?.emergencyContact)}</Descriptions.Item>
            <Descriptions.Item label="银行卡脱敏">{employee?.bankAccountMasked ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="工龄">{formatTenure(employee?.tenureDays)}</Descriptions.Item>
          </Descriptions>

          <div className="mt-6 flex flex-wrap gap-2">
            {(employee?.certificates ?? []).map((certificate) => (
              <Tag key={certificate} color="blue">
                {certificate}
              </Tag>
            ))}
          </div>

          {employee?.profileSummary ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-5 py-4">
              <div className="text-sm font-medium text-slate-500">个人简介</div>
              <Typography.Paragraph className="!mt-2 !mb-0">{employee.profileSummary}</Typography.Paragraph>
            </div>
          ) : null}
        </Card>

        <AgentChatPanel />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-3xl border-slate-100 shadow-panel">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-orange-50 text-orange-500">
              <BellOutlined className="text-base" />
            </div>
            <Typography.Title level={4} className="!mb-0">
              待办提醒
            </Typography.Title>
          </div>
          <Typography.Text type="secondary">系统根据审批、考勤、合同和资料状态自动生成提醒。</Typography.Text>
          <List
            className="mt-4"
            dataSource={reminders}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有待办提醒" /> }}
            renderItem={(item) => renderReminderItem(item)}
          />
        </Card>

        <Card className="rounded-3xl border-slate-100 shadow-panel">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-50 text-cyan-500">
              <BookOutlined className="text-base" />
            </div>
            <Typography.Title level={4} className="!mb-0">
              自助服务指引
            </Typography.Title>
          </div>
          <Typography.Text type="secondary">优先展示与请假、加班、工资单和员工服务有关的知识条目。</Typography.Text>
          <List
            className="mt-4"
            dataSource={knowledgeTips}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无推荐知识条目" /> }}
            renderItem={(item) => (
              <List.Item>
                <div className="w-full">
                  <Space wrap>
                    <Tag color="cyan">{formatDisplayValue(item.category)}</Tag>
                    {item.tags.slice(0, 2).map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </Space>
                  <div className="mt-2 text-base font-medium text-ink">{item.title}</div>
                  <Typography.Paragraph className="!mt-2 !mb-1 text-slate-600" ellipsis={{ rows: 2 }}>
                    {item.question}
                  </Typography.Paragraph>
                  <Typography.Paragraph className="!mb-0 text-slate-500" ellipsis={{ rows: 2 }}>
                    {item.answer}
                  </Typography.Paragraph>
                </div>
              </List.Item>
            )}
          />
        </Card>
      </div>

      <Tabs
        items={[
          {
            key: 'overview',
            label: '工作台总览',
            children: (
              <div className="space-y-6">
                <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                  <Card className="rounded-3xl shadow-panel">
                    <Typography.Title level={4}>审批进度时间线</Typography.Title>
                    <List
                      className="mt-4"
                      dataSource={approvalTimeline}
                      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无审批动态" /> }}
                      renderItem={(item) => renderTimelineItem(item)}
                    />
                  </Card>

                  <Card className="rounded-3xl shadow-panel">
                    <Typography.Title level={4}>薪酬与考勤快照</Typography.Title>
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      <StatCard label="近 30 天打卡天数" value={attendanceSummary?.trackedDays ?? 0} />
                      <StatCard label="近 30 天异常记录" value={attendanceSummary?.anomalyRecords ?? 0} />
                    </div>

                    {compensation ? (
                      <Descriptions className="mt-6" bordered column={1}>
                        <Descriptions.Item label="工资月份">{formatDate(compensation.month)}</Descriptions.Item>
                        <Descriptions.Item label="实发工资">{formatCurrency(compensation.netPay)}</Descriptions.Item>
                        <Descriptions.Item label="应发工资">{formatCurrency(compensation.grossPay)}</Descriptions.Item>
                        <Descriptions.Item label="扣减合计">{formatCurrency(compensation.deductions)}</Descriptions.Item>
                        <Descriptions.Item label="加班工时">
                          {formatMetricNumber(compensation.overtimeHours)} 小时
                        </Descriptions.Item>
                        <Descriptions.Item label="绩效分">
                          {formatMetricNumber(compensation.performanceScore)}
                        </Descriptions.Item>
                        <Descriptions.Item label="工资单">
                          {compensation.downloadPath ? (
                            <Button
                              type="link"
                              className="!px-0"
                              loading={latestPayslip ? downloadingPath === getSelfPayslipDownloadUrl(latestPayslip.id) : false}
                              disabled={Boolean(downloadingPath) || !latestPayslip}
                              onClick={() => (latestPayslip ? void handleDownloadSelfFile(getSelfPayslipDownloadUrl(latestPayslip.id)) : undefined)}
                            >
                              {compensation.slipNo}
                            </Button>
                          ) : (
                            compensation.slipNo
                          )}
                        </Descriptions.Item>
                      </Descriptions>
                    ) : (
                      <Empty className="mt-8" image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无已发布的工资单" />
                    )}
                  </Card>
                </div>

                <Card className="rounded-3xl shadow-panel">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <Typography.Title level={4} className="!mb-1">
                        最近考勤
                      </Typography.Title>
                      <Typography.Text type="secondary">
                        帮助员工快速回看最近打卡状态、迟到早退和异常原因。
                      </Typography.Text>
                    </div>
                    <Space wrap>
                      <Tag color="blue">最新状态：{formatDisplayValue(attendanceSummary?.latestStatus ?? '-')}</Tag>
                      <Tag>最近打卡日：{formatDate(attendanceSummary?.latestWorkDate)}</Tag>
                    </Space>
                  </div>

                  <Table
                    className="mt-6"
                    rowKey="id"
                    pagination={{ pageSize: 6 }}
                    scroll={{ x: 920 }}
                    locale={{ emptyText: '暂无考勤记录' }}
                    dataSource={attendanceRows}
                    columns={[
                      {
                        title: '日期',
                        dataIndex: 'workDate',
                        render: (value: string) => formatDate(value),
                      },
                      {
                        title: '状态',
                        dataIndex: 'status',
                        render: (value: string) => renderStatusTag(value),
                      },
                      {
                        title: '上班时间',
                        dataIndex: 'clockInAt',
                        render: (value: string | null) => formatDateTime(value),
                      },
                      {
                        title: '下班时间',
                        dataIndex: 'clockOutAt',
                        render: (value: string | null) => formatDateTime(value),
                      },
                      {
                        title: '迟到/早退',
                        key: 'minutes',
                        render: (_value, record) =>
                          `${record.lateMinutes ? `迟到 ${record.lateMinutes} 分钟` : '正常'}${
                            record.undertimeMinutes ? ` / 早退 ${record.undertimeMinutes} 分钟` : ''
                          }`,
                      },
                      {
                        title: '异常说明',
                        dataIndex: 'anomalyReason',
                        render: (value: string) => value || '-',
                      },
                    ]}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'requests',
            label: '审批与记录',
            children: (
              <div className="space-y-6">
                <Card className="rounded-3xl shadow-panel">
                  <Typography.Title level={4}>假期余额</Typography.Title>
                  <List
                    className="mt-4"
                    dataSource={leaveBalances}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无假期余额数据" /> }}
                    renderItem={(item) => {
                      const usedPercent = item.totalDays > 0 ? Math.round((item.usedDays / item.totalDays) * 100) : 0;

                      return (
                        <List.Item>
                          <div className="w-full">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <div>
                                <div className="text-base font-medium text-ink">{formatDisplayValue(item.leaveType)}</div>
                                <div className="text-sm text-slate-500">
                                  {item.year} 年度，共 {formatMetricNumber(item.totalDays)} 天，已使用{' '}
                                  {formatMetricNumber(item.usedDays)} 天
                                </div>
                              </div>
                              <Tag color="green">剩余 {formatMetricNumber(item.remainingDays)} 天</Tag>
                            </div>
                            <Progress className="mt-3" percent={usedPercent} showInfo={false} strokeColor="#0f766e" />
                          </div>
                        </List.Item>
                      );
                    }}
                  />
                </Card>

                <Card className="rounded-3xl shadow-panel">
                  <Typography.Title level={4}>最近请假申请</Typography.Title>
                  <Table
                    className="mt-6"
                    rowKey="id"
                    pagination={{ pageSize: 5 }}
                    scroll={{ x: 980 }}
                    locale={{ emptyText: '暂无请假申请' }}
                    dataSource={leaveRows}
                    columns={[
                      {
                        title: '假期类型',
                        dataIndex: 'leaveType',
                        render: (value: string) => formatDisplayValue(value),
                      },
                      {
                        title: '申请区间',
                        key: 'range',
                        render: (_value, record) => `${formatDateTime(record.startAt)} 至 ${formatDateTime(record.endAt)}`,
                      },
                      {
                        title: '时长',
                        dataIndex: 'durationDays',
                        render: (value: number) => `${formatMetricNumber(value)} 天`,
                      },
                      {
                        title: '审批状态',
                        dataIndex: 'status',
                        render: (value: string) => renderStatusTag(value),
                      },
                      {
                        title: '审批人',
                        dataIndex: 'approverName',
                        render: (value: string | null) => value || '-',
                      },
                      {
                        title: '原因',
                        dataIndex: 'reason',
                        render: (value: string) => value || '-',
                      },
                    ]}
                  />
                </Card>

                <Card className="rounded-3xl shadow-panel">
                  <Typography.Title level={4}>最近加班申请</Typography.Title>
                  <Table
                    className="mt-6"
                    rowKey="id"
                    pagination={{ pageSize: 5 }}
                    scroll={{ x: 980 }}
                    locale={{ emptyText: '暂无加班申请' }}
                    dataSource={overtimeRows}
                    columns={[
                      {
                        title: '加班日期',
                        dataIndex: 'workDate',
                        render: (value: string) => formatDate(value),
                      },
                      {
                        title: '时间区间',
                        key: 'range',
                        render: (_value, record) => `${formatDateTime(record.startAt)} 至 ${formatDateTime(record.endAt)}`,
                      },
                      {
                        title: '时长',
                        dataIndex: 'hours',
                        render: (value: number) => `${formatMetricNumber(value)} 小时`,
                      },
                      {
                        title: '审批状态',
                        dataIndex: 'status',
                        render: (value: string) => renderStatusTag(value),
                      },
                      {
                        title: '审批人',
                        dataIndex: 'approverName',
                        render: (value: string | null) => value || '-',
                      },
                      {
                        title: '原因',
                        dataIndex: 'reason',
                        render: (value: string) => value || '-',
                      },
                    ]}
                  />
                </Card>

                <Card className="rounded-3xl shadow-panel">
                  <Typography.Title level={4}>资料变更历史</Typography.Title>
                  <Table
                    className="mt-6"
                    rowKey="id"
                    pagination={{ pageSize: 5 }}
                    scroll={{ x: 980 }}
                    locale={{ emptyText: '暂无资料变更申请' }}
                    dataSource={profileRequests}
                    columns={[
                      {
                        title: '申请时间',
                        dataIndex: 'createdAt',
                        render: (value: string) => formatDateTime(value),
                      },
                      {
                        title: '变更内容',
                        dataIndex: 'changes',
                        render: (value: Record<string, unknown>) => formatProfileChangeSummary(value),
                      },
                      {
                        title: '审批状态',
                        dataIndex: 'status',
                        render: (value: string) => renderStatusTag(value),
                      },
                      {
                        title: '审批人',
                        dataIndex: 'reviewerName',
                        render: (value: string | null) => value || '-',
                      },
                      {
                        title: '审批意见',
                        dataIndex: 'reviewComment',
                        render: (value: string) => value || '-',
                      },
                    ]}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'performance',
            label: '绩效与工资单',
            children: (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="进行中目标" value={activeGoals.length} helper="当前仍在推进的绩效目标数量" />
                  <StatCard
                    label="最近绩效分"
                    value={latestReview ? formatMetricNumber(latestReview.overallScore) : '-'}
                    helper="来自最近一次绩效考核结果"
                  />
                  <StatCard label="最近考核周期" value={latestReview?.cycleName ?? '-'} helper="最近一轮绩效考核周期" />
                  <StatCard
                    label="最近工资实发"
                    value={compensation ? formatCurrency(compensation.netPay) : '-'}
                    helper="最新已发布工资单的实发金额"
                  />
                </div>

                <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                  <Card className="rounded-3xl shadow-panel">
                    <Typography.Title level={4}>最新绩效反馈</Typography.Title>
                    {latestReview ? (
                      <div className="mt-6 space-y-4">
                        <Space wrap>
                          <Tag color="blue">评分 {formatMetricNumber(latestReview.overallScore)}</Tag>
                          <Tag color="processing">{formatDisplayValue(latestReview.rating)}</Tag>
                          <Tag>{latestReview.cycleName ?? '未命名周期'}</Tag>
                          <Tag>评估人：{latestReview.reviewerName || '-'}</Tag>
                        </Space>

                        <Descriptions bordered column={1}>
                          <Descriptions.Item label="综合评价">{latestReview.summary || '-'}</Descriptions.Item>
                          <Descriptions.Item label="优势">{latestReview.strengths || '-'}</Descriptions.Item>
                          <Descriptions.Item label="改进方向">{latestReview.improvements || '-'}</Descriptions.Item>
                          <Descriptions.Item label="评估时间">{formatDateTime(latestReview.createdAt)}</Descriptions.Item>
                        </Descriptions>
                      </div>
                    ) : (
                      <Empty className="mt-8" image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无绩效评估记录" />
                    )}
                  </Card>

                  <Card className="rounded-3xl shadow-panel">
                    <Typography.Title level={4}>最近工资单</Typography.Title>
                    <Table
                      className="mt-6"
                      rowKey="id"
                      pagination={{ pageSize: 5 }}
                      scroll={{ x: 900 }}
                      locale={{ emptyText: '暂无工资单' }}
                      dataSource={payslipRows}
                      columns={[
                        {
                          title: '工资月份',
                          dataIndex: ['salaryRecord', 'month'],
                          render: (value: string | undefined) => formatDate(value),
                        },
                        {
                          title: '工资单号',
                          dataIndex: 'slipNo',
                        },
                        {
                          title: '签发时间',
                          dataIndex: 'issuedAt',
                          render: (value: string) => formatDateTime(value),
                        },
                        {
                          title: '实发工资',
                          dataIndex: ['salaryRecord', 'netPay'],
                          render: (value: number | undefined) => formatCurrency(value ?? 0),
                        },
                        {
                          title: '下载',
                          key: 'download',
                          render: (_value: unknown, record) =>
                            record.downloadPath ? (
                              <Button
                                type="link"
                                className="!px-0"
                                loading={downloadingPath === getSelfPayslipDownloadUrl(record.id)}
                                disabled={Boolean(downloadingPath)}
                                onClick={() => void handleDownloadSelfFile(getSelfPayslipDownloadUrl(record.id))}
                              >
                                下载工资单
                              </Button>
                            ) : (
                              '-'
                            ),
                        },
                      ]}
                    />
                  </Card>
                </div>

                <Card className="rounded-3xl shadow-panel">
                  <Typography.Title level={4}>进行中目标</Typography.Title>
                  <Table
                    className="mt-6"
                    rowKey="id"
                    pagination={{ pageSize: 5 }}
                    scroll={{ x: 980 }}
                    locale={{ emptyText: '暂无进行中的绩效目标' }}
                    dataSource={activeGoals}
                    columns={[
                      {
                        title: '周期',
                        dataIndex: 'cycleName',
                        render: (value: string | null) => value || '-',
                      },
                      {
                        title: '目标',
                        dataIndex: 'title',
                      },
                      {
                        title: '类别',
                        dataIndex: 'category',
                        render: (value: string) => formatDisplayValue(value),
                      },
                      {
                        title: '权重',
                        dataIndex: 'weight',
                        render: (value: number) => `${formatMetricNumber(value)}%`,
                      },
                      {
                        title: '当前进展',
                        dataIndex: 'currentValue',
                        render: (value: string) => value || '-',
                      },
                      {
                        title: '目标值',
                        dataIndex: 'targetValue',
                        render: (value: string) => value || '-',
                      },
                      {
                        title: '状态',
                        dataIndex: 'status',
                        render: (value: string) => renderStatusTag(value),
                      },
                    ]}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'submit',
            label: '发起申请',
            children: (
              <Card className="rounded-3xl shadow-panel">
                <Tabs
                  items={[
                    {
                      key: 'leave',
                      label: '请假申请',
                      children: (
                        <Form layout="vertical" form={leaveForm} onFinish={(values) => void submitLeaveRequest(values)}>
                          <Alert
                            className="mb-6"
                            type="info"
                            showIcon
                            message="请填写请假时间、天数和原因。审批完成后会同步到自助工作台与审批时间线。"
                          />
                          <div className="grid gap-4 md:grid-cols-2">
                            <Form.Item name="leaveType" label="假期类型" rules={[{ required: true, message: '请选择假期类型' }]}>
                              <Select options={leaveTypeOptions} placeholder="请选择假期类型" />
                            </Form.Item>
                            <Form.Item name="durationDays" label="请假天数" rules={[{ required: true, message: '请输入请假天数' }]}>
                              <InputNumber className="!w-full" min={0.5} step={0.5} />
                            </Form.Item>
                            <Form.Item name="startAt" label="开始时间" rules={[{ required: true, message: '请选择开始时间' }]}>
                              <DatePicker className="!w-full" showTime format="YYYY-MM-DD HH:mm" />
                            </Form.Item>
                            <Form.Item name="endAt" label="结束时间" rules={[{ required: true, message: '请选择结束时间' }]}>
                              <DatePicker className="!w-full" showTime format="YYYY-MM-DD HH:mm" />
                            </Form.Item>
                          </div>
                          <Form.Item name="reason" label="请假原因">
                            <Input.TextArea rows={4} placeholder="例如：家庭事务、医疗就诊、婚假安排等" />
                          </Form.Item>
                          <Button type="primary" htmlType="submit" loading={submittingAction === 'leave'} disabled={Boolean(submittingAction)}>
                            提交请假申请
                          </Button>
                        </Form>
                      ),
                    },
                    {
                      key: 'overtime',
                      label: '加班申请',
                      children: (
                        <Form
                          layout="vertical"
                          form={overtimeForm}
                          onFinish={(values) => void submitOvertimeRequest(values)}
                        >
                          <Alert
                            className="mb-6"
                            type="info"
                            showIcon
                            message="请填写加班日期、时间区间和原因。审批通过后将进入薪资计算。"
                          />
                          <div className="grid gap-4 md:grid-cols-2">
                            <Form.Item name="workDate" label="加班日期" rules={[{ required: true, message: '请选择加班日期' }]}>
                              <DatePicker className="!w-full" format="YYYY-MM-DD" />
                            </Form.Item>
                            <Form.Item name="hours" label="加班小时数" rules={[{ required: true, message: '请输入加班小时数' }]}>
                              <InputNumber className="!w-full" min={0.5} step={0.5} />
                            </Form.Item>
                            <Form.Item name="startAt" label="开始时间" rules={[{ required: true, message: '请选择开始时间' }]}>
                              <DatePicker className="!w-full" showTime format="YYYY-MM-DD HH:mm" />
                            </Form.Item>
                            <Form.Item name="endAt" label="结束时间" rules={[{ required: true, message: '请选择结束时间' }]}>
                              <DatePicker className="!w-full" showTime format="YYYY-MM-DD HH:mm" />
                            </Form.Item>
                          </div>
                          <Form.Item name="reason" label="加班原因">
                            <Input.TextArea rows={4} placeholder="例如：版本发布支持、紧急线上处理、项目交付等" />
                          </Form.Item>
                          <Button type="primary" htmlType="submit" loading={submittingAction === 'overtime'} disabled={Boolean(submittingAction)}>
                            提交加班申请
                          </Button>
                        </Form>
                      ),
                    },
                    {
                      key: 'profile',
                      label: '资料变更申请',
                      children: (
                        <Form layout="vertical" form={profileForm} onFinish={(values) => void submitProfileChange(values)}>
                          <Alert
                            className="mb-6"
                            type="info"
                            showIcon
                            message="仅提交发生变化的字段即可。系统会自动过滤空值，并在人力资源审批通过后写回员工档案。"
                          />
                          <div className="grid gap-4 md:grid-cols-2">
                            <Form.Item name="address" label="最新地址">
                              <Input allowClear placeholder={employee?.address || '例如：上海市徐汇区...'} />
                            </Form.Item>
                            <Form.Item name="phone" label="新手机号">
                              <Input allowClear placeholder={employee?.phone || '例如：13800000000'} />
                            </Form.Item>
                            <Form.Item name="bankAccountMasked" label="银行卡脱敏">
                              <Input allowClear placeholder={employee?.bankAccountMasked || '例如：6222********1234'} />
                            </Form.Item>
                            <Form.Item name="avatarUrl" label="头像地址">
                              <Input allowClear placeholder="例如：https://..." />
                            </Form.Item>
                            <Form.Item name={['emergencyContact', 'name']} label="紧急联系人姓名">
                              <Input
                                allowClear
                                placeholder={
                                  typeof employee?.emergencyContact?.name === 'string'
                                    ? employee.emergencyContact.name
                                    : '例如：张三'
                                }
                              />
                            </Form.Item>
                            <Form.Item name={['emergencyContact', 'phone']} label="紧急联系人电话">
                              <Input
                                allowClear
                                placeholder={
                                  typeof employee?.emergencyContact?.phone === 'string'
                                    ? employee.emergencyContact.phone
                                    : '例如：13900000000'
                                }
                              />
                            </Form.Item>
                          </div>
                          <Button type="primary" htmlType="submit" loading={submittingAction === 'profile'} disabled={Boolean(submittingAction)}>
                            提交资料变更申请
                          </Button>
                        </Form>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}

function renderReminderItem(item: SelfServiceReminder) {
  const colorMap: Record<string, string> = {
    high: 'red',
    medium: 'orange',
    low: 'blue',
  };

  return (
    <List.Item>
      <div className="w-full">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-base font-medium text-ink">{item.title}</div>
          <Tag color={colorMap[item.priority] ?? 'default'}>{formatDisplayValue(item.priority)}</Tag>
        </div>
        <Typography.Paragraph className="!mt-2 !mb-0 text-slate-500">{item.description}</Typography.Paragraph>
      </div>
    </List.Item>
  );
}

function renderTimelineItem(item: ApprovalTimelineRow) {
  return (
    <List.Item>
      <div className="w-full">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-base font-medium text-ink">{item.title}</div>
            <div className="text-sm text-slate-500">{item.detail}</div>
          </div>
          <Space wrap>
            <Tag>{getTimelineCategoryLabel(item.category)}</Tag>
            {renderStatusTag(item.status)}
          </Space>
        </div>
        <div className="mt-2 text-sm text-slate-500">
          提交时间：{formatDateTime(item.submittedAt)}
          {item.completedAt ? `，完成时间：${formatDateTime(item.completedAt)}` : ''}
        </div>
      </div>
    </List.Item>
  );
}

function buildProfileChangePayload(values: ProfileFormValues, employee: EmployeeProfileSnapshot | null) {
  const changes: Record<string, unknown> = {};
  const currentEmergency = employee?.emergencyContact ?? {};

  assignChangedString(changes, 'address', values.address, employee?.address);
  assignChangedString(changes, 'phone', values.phone, employee?.phone);
  assignChangedString(changes, 'bankAccountMasked', values.bankAccountMasked, employee?.bankAccountMasked);
  assignChangedString(changes, 'avatarUrl', values.avatarUrl, employee?.avatarUrl);

  const emergencyName = values.emergencyContact?.name?.trim() ?? '';
  const emergencyPhone = values.emergencyContact?.phone?.trim() ?? '';
  const currentName = typeof currentEmergency.name === 'string' ? currentEmergency.name : '';
  const currentPhone = typeof currentEmergency.phone === 'string' ? currentEmergency.phone : '';

  if ((emergencyName && emergencyName !== currentName) || (emergencyPhone && emergencyPhone !== currentPhone)) {
    changes.emergencyContact = {
      ...(emergencyName ? { name: emergencyName } : {}),
      ...(emergencyPhone ? { phone: emergencyPhone } : {}),
    };
  }

  return changes;
}

function assignChangedString(
  target: Record<string, unknown>,
  key: string,
  nextValue?: string,
  currentValue?: string | null,
) {
  const trimmed = nextValue?.trim();
  if (!trimmed) {
    return;
  }

  if (trimmed === (currentValue ?? '').trim()) {
    return;
  }

  target[key] = trimmed;
}

function renderStatusTag(status: string) {
  const normalized = status.toLowerCase();
  const color =
    normalized === 'approved' || normalized === 'published' || normalized === 'active'
      ? 'success'
      : normalized === 'pending' || normalized === 'in_progress'
        ? 'processing'
        : normalized === 'rejected' || normalized === 'cancelled'
          ? 'error'
          : normalized === 'anomaly' || normalized === 'late'
            ? 'warning'
            : 'default';

  return <Tag color={color}>{formatDisplayValue(status)}</Tag>;
}

function formatProfileChangeSummary(changes: Record<string, unknown>) {
  const fieldLabels: Record<string, string> = {
    address: '地址',
    phone: '手机号',
    bankAccountMasked: '银行卡',
    avatarUrl: '头像地址',
    emergencyContact: '紧急联系人',
  };

  return Object.entries(changes)
    .map(([key, value]) => {
      if (key === 'emergencyContact' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const nextValue = value as { name?: unknown; phone?: unknown };
        const name = typeof nextValue.name === 'string' ? nextValue.name : '-';
        const phone = typeof nextValue.phone === 'string' ? nextValue.phone : '-';
        return `${fieldLabels[key] ?? key}: ${name} / ${phone}`;
      }

      return `${fieldLabels[key] ?? key}: ${formatDisplayValue(value)}`;
    })
    .join('；');
}

function getTimelineCategoryLabel(category: string) {
  if (category === 'leave') {
    return '请假';
  }

  if (category === 'overtime') {
    return '加班';
  }

  if (category === 'profile') {
    return '资料变更';
  }

  return category;
}

function formatTenure(tenureDays?: number) {
  if (!tenureDays) {
    return '-';
  }

  const years = Math.floor(tenureDays / 365);
  const months = Math.floor((tenureDays % 365) / 30);

  if (years > 0) {
    return `${years} 年 ${months} 个月`;
  }

  return `${months || 1} 个月`;
}

function formatEmergencyContact(contact?: Record<string, unknown> | null) {
  if (!contact) {
    return '-';
  }

  const name = typeof contact.name === 'string' ? contact.name : '-';
  const phone = typeof contact.phone === 'string' ? contact.phone : '-';
  return `${name} / ${phone}`;
}

function formatDate(value?: string | null) {
  if (!value || !dayjs(value).isValid()) {
    return '-';
  }

  return dayjs(value).format('YYYY-MM-DD');
}

function formatDateTime(value?: string | null) {
  if (!value || !dayjs(value).isValid()) {
    return '-';
  }

  return dayjs(value).format('YYYY-MM-DD HH:mm');
}

function formatMetricNumber(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2,
  }).format(value);
}

function getContractExpiryLabel(employment: EmploymentSnapshot | null) {
  if (!employment || employment.daysToExpire === null || employment.daysToExpire === undefined) {
    return null;
  }

  if (employment.daysToExpire <= 0) {
    return { color: 'red', label: '合同已到期' };
  }

  if (employment.daysToExpire <= 30) {
    return { color: 'red', label: `${employment.daysToExpire} 天内到期` };
  }

  if (employment.daysToExpire <= 90) {
    return { color: 'orange', label: `${employment.daysToExpire} 天后到期` };
  }

  return { color: 'blue', label: `距到期 ${employment.daysToExpire} 天` };
}
