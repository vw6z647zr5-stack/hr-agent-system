import {
  Alert,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Progress,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { generateInterviewEmail, matchScore } from '../api/agent';
import { apiFileRequest, triggerBrowserDownload } from '../api/http';
import {
  analyzeResumeRecord,
  getRecruitmentDashboard,
  listResumes,
  type HiringAlertItem,
  type PriorityCandidateItem,
  type RecruitmentDashboardPayload,
  type RecruitmentFunnelItem,
  type RecruitmentJobHealthItem,
  type ResumeListItem,
} from '../api/recruitment';
import { listWorkflowEvents, type WorkflowEvent } from '../api/workflow';
import { listResource } from '../api/resources';
import { StatCard } from '../components/StatCard';
import { formatDisplayValue } from '../utils/display';

interface JobPostingOption {
  id: string;
  title?: string;
  requirements?: string;
}

interface CandidateOption {
  id: string;
  fullName?: string;
  appliedJobPosting?: {
    id?: string;
    title?: string;
    requirements?: string;
  } | null;
}

interface InterviewEmailFormValues {
  interviewTime?: Dayjs;
  interviewerName?: string;
}

export function RecruitmentWorkbenchPage() {
  const [dashboard, setDashboard] = useState<RecruitmentDashboardPayload | null>(null);
  const [jobOptions, setJobOptions] = useState<JobPostingOption[]>([]);
  const [candidateOptions, setCandidateOptions] = useState<CandidateOption[]>([]);
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCandidate, setActiveCandidate] = useState<PriorityCandidateItem | null>(null);
  const [candidateEvents, setCandidateEvents] = useState<WorkflowEvent[]>([]);
  const [candidateEventsLoading, setCandidateEventsLoading] = useState(false);
  const [matchScoreResult, setMatchScoreResult] = useState<Record<string, unknown> | null>(null);
  const [emailDraft, setEmailDraft] = useState<Record<string, unknown> | null>(null);
  const [activeResume, setActiveResume] = useState<ResumeListItem | null>(null);
  const [resumeAnalysis, setResumeAnalysis] = useState<Record<string, unknown> | null>(null);
  const [actionLoading, setActionLoading] = useState<'match' | 'email' | 'resume-analysis' | null>(null);
  const [downloadingResumeId, setDownloadingResumeId] = useState<string | null>(null);
  const [interviewForm] = Form.useForm<InterviewEmailFormValues>();
  const [messageApi, contextHolder] = message.useMessage();

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [dashboardPayload, jobPostingPayload, candidatePayload, resumePayload] = await Promise.all([
        getRecruitmentDashboard(),
        listResource<JobPostingOption>('job-postings', { page: 1, limit: 100 }),
        listResource<CandidateOption>('candidates', { page: 1, limit: 100 }),
        listResumes({ page: 1, limit: 20 }),
      ]);

      setDashboard(dashboardPayload);
      setJobOptions(jobPostingPayload.items);
      setCandidateOptions(candidatePayload.items);
      setResumes(resumePayload.items);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const candidateJobMap = useMemo(
    () =>
      new Map(
        candidateOptions.map((candidate) => [
          candidate.id,
          candidate.appliedJobPosting
            ? {
                id: candidate.appliedJobPosting.id ?? '',
                title: candidate.appliedJobPosting.title ?? '',
                requirements: candidate.appliedJobPosting.requirements ?? '',
              }
            : null,
        ]),
      ),
    [candidateOptions],
  );
  const activeMatchScore = matchScoreResult
    ? toNumber(matchScoreResult.score)
    : activeCandidate?.aiMatchScore ?? 0;
  const shouldShowInterviewEmail = activeCandidate ? ['new', 'screening', 'interview'].includes(activeCandidate.stage) : false;

  const openCandidateDrawer = (candidate: PriorityCandidateItem) => {
    setActiveCandidate(candidate);
    setMatchScoreResult(null);
    setEmailDraft(null);
    setCandidateEvents([]);
    interviewForm.resetFields();
    void loadCandidateEvents(candidate.id);
  };

  const closeCandidateDrawer = () => {
    setActiveCandidate(null);
    setMatchScoreResult(null);
    setEmailDraft(null);
    setCandidateEvents([]);
    interviewForm.resetFields();
  };

  const loadCandidateEvents = async (candidateId: string) => {
    try {
      setCandidateEventsLoading(true);
      setCandidateEvents(await listWorkflowEvents({ entityType: 'candidate', entityId: candidateId, limit: 20 }));
    } catch {
      setCandidateEvents([]);
    } finally {
      setCandidateEventsLoading(false);
    }
  };

  const handleRunMatchScore = async () => {
    if (!activeCandidate || actionLoading) {
      return;
    }

    try {
      setActionLoading('match');
      setError(null);
      const candidateJob = candidateJobMap.get(activeCandidate.id);
      const result = await matchScore({
        candidateId: activeCandidate.id,
        jobPostingId: candidateJob?.id || undefined,
        jobRequirements: candidateJob?.requirements || undefined,
      });
      setMatchScoreResult(result);
      const newScore = toNumber(result.score);
      setDashboard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          priorityCandidates: prev.priorityCandidates.map((candidate) =>
            candidate.id === activeCandidate.id ? { ...candidate, aiMatchScore: newScore } : candidate,
          ),
        };
      });
      messageApi.success('已完成候选人和岗位的智能匹配分析。');
    } catch (actionError) {
      setError((actionError as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleGenerateInterviewEmail = async (values: InterviewEmailFormValues) => {
    if (!activeCandidate || !values.interviewTime || !values.interviewerName?.trim() || actionLoading) {
      return;
    }

    try {
      setActionLoading('email');
      setError(null);
      const candidateJob = candidateJobMap.get(activeCandidate.id);
      const result = await generateInterviewEmail({
        candidateId: activeCandidate.id,
        jobPostingId: candidateJob?.id || undefined,
        interviewTime: values.interviewTime.toISOString(),
        interviewerName: values.interviewerName.trim(),
      });
      setEmailDraft(result);
      messageApi.success('已生成面试邀请邮件草稿。');
    } catch (actionError) {
      setError((actionError as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadResume = async (resume: ResumeListItem) => {
    if (downloadingResumeId) {
      return;
    }

    try {
      setDownloadingResumeId(resume.id);
      setError(null);
      const file = await apiFileRequest(`/resumes/${encodeURIComponent(resume.id)}/download`);
      triggerBrowserDownload(file);
    } catch (downloadError) {
      setError((downloadError as Error).message);
    } finally {
      setDownloadingResumeId(null);
    }
  };

  const handleAnalyzeResume = async (resume: ResumeListItem) => {
    if (actionLoading) {
      return;
    }

    try {
      setActionLoading('resume-analysis');
      setError(null);
      setActiveResume(resume);
      const result = await analyzeResumeRecord(resume.id);
      setResumeAnalysis(result);
      messageApi.success('已完成简历智能分析。');
    } catch (analyzeError) {
      setError((analyzeError as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !dashboard) {
    return (
      <div className="space-y-6">
        <div className="animate-shimmer rounded-3xl bg-white p-8">
          <div className="h-6 w-1/3 rounded-2xl bg-slate-200" />
          <div className="mt-3 h-4 w-2/3 rounded-2xl bg-slate-200" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="animate-shimmer rounded-2xl border border-slate-100 bg-white p-5">
              <div className="h-3 w-1/3 rounded-2xl bg-slate-200" />
              <div className="mt-2 h-8 w-2/3 rounded-2xl bg-slate-200" />
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

  return (
    <div className="space-y-8">
      {contextHolder}
      {error ? <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} /> : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Typography.Title level={3} className="!mb-1">
            招聘工作台
          </Typography.Title>
          <Typography.Text type="secondary">
            集中查看职位健康度、候选人优先级和候选人简历，支持直接下载和智能分析。
          </Typography.Text>
        </div>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>
          刷新数据
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <StatCard label="开放职位" value={dashboard?.stats.openJobPostings ?? 0} helper="当前正在招聘的职位数" />
        <StatCard label="活跃候选人" value={dashboard?.stats.activeCandidates ?? 0} helper="当前仍在招聘流程中的候选人" />
        <StatCard label="本周面试" value={dashboard?.stats.interviewsThisWeek ?? 0} helper="未来 7 天内已安排的面试" />
        <StatCard label="待处理录用" value={dashboard?.stats.pendingOffers ?? 0} helper="草稿或已发出但未完成的录用流程" />
        <StatCard label="已接受录用" value={dashboard?.stats.acceptedOffers ?? 0} helper="已接受录用通知的候选人数" />
        <StatCard label="简历覆盖率" value={`${formatMetricNumber(dashboard?.stats.resumeCoverage ?? 0)}%`} helper="活跃候选人中已上传简历的比例" />
        <StatCard label="平均匹配分" value={formatMetricNumber(dashboard?.stats.averageAiMatchScore ?? 0)} helper="系统已计算的平均智能匹配分" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-3xl shadow-panel">
          <Typography.Title level={4}>招聘预警</Typography.Title>
          <List
            className="mt-4"
            dataSource={dashboard?.hiringAlerts ?? []}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有招聘预警" /> }}
            renderItem={renderHiringAlert}
          />
        </Card>

        <Card className="rounded-3xl shadow-panel">
          <Typography.Title level={4}>招聘漏斗</Typography.Title>
          <List
            className="mt-4"
            dataSource={dashboard?.funnel ?? []}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无漏斗数据" /> }}
            renderItem={renderFunnelItem}
          />
        </Card>
      </div>

      <Card className="rounded-3xl shadow-panel">
        <Typography.Title level={4}>职位健康度</Typography.Title>
        <Table
          className="mt-6"
          rowKey="id"
          pagination={{ pageSize: 6 }}
          scroll={{ x: 1100 }}
          locale={{ emptyText: '暂无开放职位' }}
          dataSource={dashboard?.openJobHealth ?? []}
          columns={[
            {
              title: '职位',
              key: 'title',
              render: (_value, record: RecruitmentJobHealthItem) => (
                <div>
                  <div className="font-medium text-ink">{record.title}</div>
                  <div className="text-xs text-slate-500">
                    {record.departmentName || '-'} / {record.positionName || '-'}
                  </div>
                </div>
              ),
            },
            {
              title: '地点',
              dataIndex: 'location',
              render: (value: string) => value || '-',
            },
            {
              title: '进展',
              key: 'progressPercent',
              render: (_value, record: RecruitmentJobHealthItem) => (
                <div className="min-w-[170px]">
                  <div className="mb-2 text-sm text-slate-500">
                    已录用 {record.acceptedOffers} / 目标 {record.targetCount}
                  </div>
                  <Progress percent={record.progressPercent} strokeColor="#0f766e" showInfo={false} />
                </div>
              ),
            },
            {
              title: '候选人/面试/录用',
              key: 'pipeline',
              render: (_value, record: RecruitmentJobHealthItem) =>
                `${record.candidateCount} / ${record.interviewCount} / ${record.offerCount}`,
            },
            {
              title: '平均匹配分',
              dataIndex: 'averageMatchScore',
              render: (value: number) => formatMetricNumber(value),
            },
            {
              title: '紧急程度',
              dataIndex: 'urgencyLevel',
              render: (value: string) => renderUrgencyTag(value),
            },
          ]}
        />
      </Card>

      <Card className="rounded-3xl shadow-panel">
        <Typography.Title level={4}>优先候选人</Typography.Title>
        <Table
          className="mt-6"
          rowKey="id"
          pagination={{ pageSize: 6 }}
          scroll={{ x: 1080 }}
          locale={{ emptyText: '暂无优先候选人' }}
          dataSource={dashboard?.priorityCandidates ?? []}
          columns={[
            {
              title: '候选人',
              key: 'fullName',
              render: (_value, record: PriorityCandidateItem) => (
                <div>
                  <div className="font-medium text-ink">{record.fullName}</div>
                  <div className="text-xs text-slate-500">{record.currentCompany || '暂无当前公司'}</div>
                </div>
              ),
            },
            {
              title: '应聘职位',
              dataIndex: 'jobTitle',
              render: (value: string | null) => value || '-',
            },
            {
              title: '阶段',
              dataIndex: 'stage',
              render: (value: string) => renderPipelineTag(value),
            },
            {
              title: '智能匹配分',
              dataIndex: 'aiMatchScore',
              render: (value: number) => formatMetricNumber(value),
            },
            {
              title: '下一步',
              dataIndex: 'nextAction',
            },
            {
              title: '操作',
              key: 'actions',
              render: (_value, record: PriorityCandidateItem) => (
                <Button type="primary" onClick={() => openCandidateDrawer(record)}>
                  招聘动作
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Card className="rounded-3xl shadow-panel">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Typography.Title level={4} className="!mb-1">
              候选人简历中心
            </Typography.Title>
            <Typography.Text type="secondary">
              后台可查看解析内容、下载原始简历并直接触发智能分析。
            </Typography.Text>
          </div>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>
            刷新简历
          </Button>
        </div>

        <Table
          className="mt-6"
          rowKey="id"
          pagination={{ pageSize: 8 }}
          scroll={{ x: 1120 }}
          locale={{ emptyText: '暂无候选人简历' }}
          dataSource={resumes}
          columns={[
            {
              title: '候选人',
              key: 'candidate',
              render: (_value, record: ResumeListItem) => (
                <div>
                  <div className="font-medium text-ink">{record.candidate?.fullName || '-'}</div>
                  <div className="text-xs text-slate-500">{record.candidate?.email || '-'}</div>
                </div>
              ),
            },
            {
              title: '文件名',
              dataIndex: 'fileName',
            },
            {
              title: '上传时间',
              dataIndex: 'uploadedAt',
              render: (value: string) => formatDateTime(value),
            },
            {
              title: '已解析技能',
              key: 'skills',
              render: (_value, record: ResumeListItem) => (
                <div className="flex flex-wrap gap-2">
                  {toStringArray(record.parsedProfile.skills).slice(0, 4).map((skill) => (
                    <Tag key={skill} color="cyan">
                      {skill}
                    </Tag>
                  ))}
                </div>
              ),
            },
            {
              title: '操作',
              key: 'actions',
              render: (_value, record: ResumeListItem) => (
                <Space wrap>
                  <Button
                    onClick={() => {
                      setActiveResume(record);
                      setResumeAnalysis(null);
                    }}
                  >
                    查看
                  </Button>
                  <Button
                    loading={downloadingResumeId === record.id}
                    disabled={Boolean(downloadingResumeId)}
                    onClick={() => void handleDownloadResume(record)}
                  >
                    下载
                  </Button>
                  <Button
                    type="primary"
                    loading={actionLoading === 'resume-analysis' && activeResume?.id === record.id}
                    disabled={Boolean(actionLoading)}
                    onClick={() => void handleAnalyzeResume(record)}
                  >
                    智能分析
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Drawer
        open={Boolean(activeCandidate)}
        width={760}
        title={activeCandidate ? `${activeCandidate.fullName} 招聘动作` : '招聘动作'}
        onClose={closeCandidateDrawer}
        destroyOnClose
      >
        {activeCandidate ? (
          <div className="space-y-6">
            <Card size="small" title="候选人摘要">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm text-slate-500">应聘职位</div>
                  <div className="mt-1 font-medium text-ink">{activeCandidate.jobTitle || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">当前阶段</div>
                  <div className="mt-1">{renderPipelineTag(activeCandidate.stage)}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">智能匹配分</div>
                  <div className="mt-1 font-medium text-ink">{formatMetricNumber(activeMatchScore)}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">下一步动作</div>
                  <div className="mt-1 font-medium text-ink">{activeCandidate.nextAction}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {activeCandidate.skills.map((skill) => (
                  <Tag key={skill} color="blue">
                    {skill}
                  </Tag>
                ))}
              </div>
            </Card>

            <Card size="small" title="候选人时间线">
              <List
                loading={candidateEventsLoading}
                dataSource={candidateEvents}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无流程记录" /> }}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <div className="flex items-center gap-2">
                          <span>{item.title}</span>
                          <Tag>{formatDisplayValue(item.category)}</Tag>
                        </div>
                      }
                      description={
                        <div>
                          <div>{item.description}</div>
                          <div className="mt-1 text-xs text-slate-400">{formatDateTime(item.createdAt)}</div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>

            <Card
              size="small"
              title="智能匹配分析"
              extra={
                <Button
                  type="primary"
                  loading={actionLoading === 'match'}
                  disabled={Boolean(actionLoading) && actionLoading !== 'match'}
                  onClick={() => void handleRunMatchScore()}
                >
                  运行匹配分析
                </Button>
              }
            >
              {matchScoreResult ? (
                <div className="space-y-4">
                  <Space wrap>
                    <Tag color="processing">匹配分 {formatMetricNumber(toNumber(matchScoreResult.score))}</Tag>
                    {toStringArray(matchScoreResult.matchedSkills).length ? (
                      <Tag color="success">命中技能 {toStringArray(matchScoreResult.matchedSkills).length}</Tag>
                    ) : null}
                    {toStringArray(matchScoreResult.missingSkills).length ? (
                      <Tag color="warning">缺失技能 {toStringArray(matchScoreResult.missingSkills).length}</Tag>
                    ) : null}
                  </Space>
                  <Typography.Paragraph className="!mb-0">
                    {String(matchScoreResult.summary ?? '已生成匹配分析。')}
                  </Typography.Paragraph>
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未生成匹配分析" />
              )}
            </Card>

            {shouldShowInterviewEmail ? (
              <Card size="small" title="智能面试邀请邮件">
                <Form layout="vertical" form={interviewForm} onFinish={(values) => void handleGenerateInterviewEmail(values)}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Form.Item
                      name="interviewTime"
                      label="面试时间"
                      rules={[{ required: true, message: '请选择面试时间' }]}
                    >
                      <DatePicker className="!w-full" showTime format="YYYY-MM-DD HH:mm" />
                    </Form.Item>
                    <Form.Item
                      name="interviewerName"
                      label="面试官"
                      rules={[{ required: true, message: '请输入面试官姓名' }]}
                    >
                      <Input placeholder="例如：张三 / 李四" />
                    </Form.Item>
                  </div>
                  <Button type="primary" htmlType="submit" loading={actionLoading === 'email'} disabled={Boolean(actionLoading) && actionLoading !== 'email'}>
                    生成邮件草稿
                  </Button>
                </Form>

                {emailDraft ? (
                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="text-sm font-medium text-slate-500">邮件标题</div>
                    <Typography.Paragraph className="!mb-4 !mt-2">{String(emailDraft.subject ?? '-')}</Typography.Paragraph>
                    <div className="text-sm font-medium text-slate-500">邮件正文</div>
                    <Typography.Paragraph className="!mt-2 whitespace-pre-wrap">{String(emailDraft.body ?? '-')}</Typography.Paragraph>
                  </div>
                ) : null}
              </Card>
            ) : (
              <Card size="small" title={activeCandidate.stage === 'offer' ? '录用跟进建议' : '阶段动作建议'}>
                <Alert
                  type="info"
                  showIcon
                  message={
                    activeCandidate.stage === 'offer'
                      ? '候选人已进入录用阶段，无需再生成面试邀请邮件。'
                      : '当前阶段不需要生成面试邀请邮件。'
                  }
                  description={
                    activeCandidate.stage === 'offer'
                      ? '建议确认薪资方案、审批人、发放时间和候选人接受状态，并在录用管理中跟进草稿或已发出的录用通知。'
                      : activeCandidate.nextAction
                  }
                />
              </Card>
            )}
          </div>
        ) : null}
      </Drawer>

      <Drawer
        open={Boolean(activeResume)}
        width={720}
        title={activeResume ? `${activeResume.candidate?.fullName || '候选人'} 的简历` : '简历详情'}
        onClose={() => {
          setActiveResume(null);
          setResumeAnalysis(null);
        }}
        destroyOnClose
      >
        {activeResume ? (
          <div className="space-y-6">
            <Card size="small" title="文件信息">
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="文件名">{activeResume.fileName}</Descriptions.Item>
                <Descriptions.Item label="候选人">{activeResume.candidate?.fullName || '-'}</Descriptions.Item>
                <Descriptions.Item label="邮箱">{activeResume.candidate?.email || '-'}</Descriptions.Item>
                <Descriptions.Item label="上传时间">{formatDateTime(activeResume.uploadedAt)}</Descriptions.Item>
              </Descriptions>
              <div className="mt-4">
                <Button
                  loading={downloadingResumeId === activeResume.id}
                  disabled={Boolean(downloadingResumeId)}
                  onClick={() => void handleDownloadResume(activeResume)}
                >
                  下载原始简历
                </Button>
              </div>
            </Card>

            <Card size="small" title="解析结果">
              <Typography.Paragraph className="!mb-0 whitespace-pre-wrap">
                {activeResume.parsedText || '暂无解析文本。'}
              </Typography.Paragraph>
            </Card>

            <Card size="small" title="智能简历分析">
              {resumeAnalysis ? (
                <div className="space-y-4">
                  <Typography.Paragraph className="!mb-0">
                    {String(resumeAnalysis.summary ?? '已完成智能分析。')}
                  </Typography.Paragraph>
                  <Descriptions column={1} bordered size="small">
                    {Object.entries((resumeAnalysis.parsedProfile as Record<string, unknown>) ?? {}).map(([key, value]) => (
                      <Descriptions.Item key={key} label={key}>
                        {Array.isArray(value) ? value.join(', ') : String(value ?? '-')}
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="点击上方“智能分析”后在这里查看结果。" />
              )}
            </Card>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

function renderHiringAlert(item: HiringAlertItem) {
  const levelColor: Record<string, string> = {
    high: 'red',
    medium: 'orange',
    low: 'blue',
  };

  return (
    <List.Item>
      <div className="w-full">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="font-medium text-ink">{item.title}</div>
          <Tag color={levelColor[item.level] ?? 'default'}>{formatDisplayValue(item.level)}</Tag>
        </div>
        <Typography.Paragraph className="!mb-0 !mt-2 text-slate-500">{item.description}</Typography.Paragraph>
      </div>
    </List.Item>
  );
}

function renderFunnelItem(item: RecruitmentFunnelItem) {
  return (
    <List.Item>
      <div className="w-full">
        <div className="flex items-center justify-between gap-4">
          <div className="text-base font-medium text-ink">{item.label}</div>
          <Tag color="processing">{item.count}</Tag>
        </div>
        <Progress className="mt-3" percent={Math.min(item.count * 10, 100)} showInfo={false} strokeColor="#14b8a6" />
      </div>
    </List.Item>
  );
}

function renderPipelineTag(status: string) {
  const colorMap: Record<string, string> = {
    new: 'blue',
    screening: 'processing',
    interview: 'purple',
    offer: 'gold',
    hired: 'success',
    rejected: 'error',
    active: 'processing',
    scheduled: 'processing',
    completed: 'success',
    cancelled: 'default',
    sent: 'gold',
    accepted: 'success',
    draft: 'default',
    open: 'processing',
  };

  return <Tag color={colorMap[status] ?? 'default'}>{formatDisplayValue(status)}</Tag>;
}

function renderUrgencyTag(level: string) {
  const colorMap: Record<string, string> = {
    high: 'red',
    medium: 'orange',
    low: 'blue',
  };

  return <Tag color={colorMap[level] ?? 'default'}>{formatDisplayValue(level)}</Tag>;
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

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function toNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}
