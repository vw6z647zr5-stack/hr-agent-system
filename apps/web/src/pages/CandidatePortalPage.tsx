import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  List,
  Progress,
  Space,
  Spin,
  Tabs,
  Tag,
  Timeline,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  BulbOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  DownloadOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  FireOutlined,
  LogoutOutlined,
  MessageOutlined,
  RadarChartOutlined,
  SendOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logoutSession } from '../api/auth';
import { apiFileRequest, triggerBrowserDownload } from '../api/http';
import {
  applyCandidatePortalJob,
  candidatePortalChat,
  getCandidatePortalProfile,
  uploadCandidatePortalResume,
  type CandidateJobMatchItem,
  type CandidatePortalChatResponse,
  type CandidatePortalProfilePayload,
} from '../api/recruitment';
import { UserPhotoUpload } from '../components/UserPhotoUpload';
import { authStore } from '../state/auth.store';
import { formatDisplayValue } from '../utils/display';

const { Dragger } = Upload;
const allowedResumeExtensions = new Set(['.pdf', '.docx']);
const maxResumeSizeBytes = 15 * 1024 * 1024;
const maxChatInputLength = 800;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  references?: CandidatePortalChatResponse['references'];
}

function getMatchTone(score: number) {
  if (score >= 80) {
    return {
      tagColor: 'green',
      progressColor: '#10b981',
      barClass: 'bg-emerald-500',
      panelClass: 'border-emerald-100 bg-emerald-50/80 text-emerald-700',
    };
  }

  if (score >= 60) {
    return {
      tagColor: 'blue',
      progressColor: '#0ea5e9',
      barClass: 'bg-sky-500',
      panelClass: 'border-sky-100 bg-sky-50/80 text-sky-700',
    };
  }

  return {
    tagColor: 'orange',
    progressColor: '#f59e0b',
    barClass: 'bg-amber-500',
    panelClass: 'border-amber-100 bg-amber-50/80 text-amber-700',
  };
}

function renderCompactList(items: string[], fallback: string) {
  const source = items.length ? items : [fallback];

  return (
    <ul className="mt-2 space-y-1.5 pl-4 text-sm leading-6 text-slate-600">
      {source.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function CandidatePortalPage() {
  const navigate = useNavigate();
  const user = authStore((state) => state.user);
  const logout = authStore((state) => state.logout);
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [downloadingResumeId, setDownloadingResumeId] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<CandidatePortalProfilePayload | null>(null);
  const [resumeFiles, setResumeFiles] = useState<UploadFile[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '你好，我可以基于你的简历和当前开放职位，回答岗位匹配、投递建议和简历优化问题。',
    },
  ]);

  const handleLogout = () => {
    void logoutSession().catch(() => undefined);
    logout();
    navigate('/login', { replace: true });
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      setProfile(await getCandidatePortalProfile());
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const latestResume = profile?.resumes[0] ?? null;
  const jobMatches = profile?.jobMatches ?? [];
  const topMatch = jobMatches[0] ?? null;
  const parsedSkills = useMemo(() => {
    const value = latestResume?.parsedProfile?.skills;
    return Array.isArray(value) ? value.map(String).filter(Boolean) : profile?.candidate.skills ?? [];
  }, [latestResume, profile]);
  const latestSummary = typeof latestResume?.parsedProfile?.summary === 'string'
    ? latestResume.parsedProfile.summary.trim()
    : '';

  const handleResumeUpload = async () => {
    if (uploading) {
      return;
    }

    const rawFile = resumeFiles[0]?.originFileObj;
    if (!rawFile) {
      messageApi.warning('请先选择简历文件。');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      await uploadCandidatePortalResume(rawFile);
      setResumeFiles([]);
      messageApi.success('简历已上传并完成解析，职位推荐已刷新。');
      await load();
    } catch (uploadError) {
      setError((uploadError as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleApply = async (job: CandidateJobMatchItem) => {
    if (applyingJobId || job.isApplied) {
      return;
    }

    try {
      setApplyingJobId(job.id);
      setError(null);
      await applyCandidatePortalJob(job.id);
      messageApi.success(`已投递「${job.title}」。`);
      await load();
    } catch (applyError) {
      setError((applyError as Error).message);
    } finally {
      setApplyingJobId(null);
    }
  };

  const handleChat = async () => {
    const question = chatInput.trim();
    if (!question) {
      return;
    }

    if (question.length > maxChatInputLength) {
      setError(`单次咨询内容不能超过 ${maxChatInputLength} 个字符。`);
      return;
    }

    setChatInput('');
    setChatMessages((items) => [...items, { role: 'user', content: question }]);

    try {
      setChatLoading(true);
      const response = await candidatePortalChat(question);
      setChatMessages((items) => [
        ...items,
        {
          role: 'assistant',
          content: response.reply,
          references: response.references,
        },
      ]);
    } catch (chatError) {
      setChatMessages((items) => [...items, { role: 'assistant', content: (chatError as Error).message }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleDownloadResume = async (resumeId: string) => {
    if (downloadingResumeId) {
      return;
    }

    try {
      setDownloadingResumeId(resumeId);
      setError(null);
      const file = await apiFileRequest(`/career/resumes/${resumeId}/download`);
      triggerBrowserDownload(file);
    } catch (downloadError) {
      setError((downloadError as Error).message);
    } finally {
      setDownloadingResumeId(null);
    }
  };

  const renderJobMatchDetails = (job: CandidateJobMatchItem) => {
    const matchedRequirements = Array.isArray(job.matchedRequirements) ? job.matchedRequirements : [];
    const missingRequirements = Array.isArray(job.missingRequirements) ? job.missingRequirements : [];
    const resumeHighlights = Array.isArray(job.resumeHighlights) ? job.resumeHighlights : [];
    const suggestions = Array.isArray(job.suggestions) ? job.suggestions : [];
    const matchedItems = (matchedRequirements.length ? matchedRequirements : resumeHighlights).slice(0, 3);
    const missingItems = (missingRequirements.length ? missingRequirements : job.missingKeywords).slice(0, 3);
    const suggestionItems = suggestions.slice(0, 3);

    return (
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <CheckCircleOutlined />
            JD 命中点
          </div>
          {renderCompactList(matchedItems, '暂无明确命中项')}
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
            <RadarChartOutlined />
            待补强项
          </div>
          {renderCompactList(missingItems, '暂无明显缺口')}
        </div>
        <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-sky-700">
            <BulbOutlined />
            优化建议
          </div>
          {renderCompactList(suggestionItems, '建议继续完善项目成果和量化指标。')}
        </div>
      </div>
    );
  };

  if (loading && !profile) {
    return (
      <div className="grid min-h-screen place-items-center bg-mist">
        <Spin size="large" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="grid min-h-screen place-items-center bg-mist px-4">
        <Empty description="暂无候选人资料" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f8fbfd_0%,_#eef7f5_48%,_#f6f8fb_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {contextHolder}
        {error ? <Alert type="error" showIcon message={error} className="rounded-2xl" /> : null}

        <section className="overflow-hidden rounded-3xl border border-white/70 bg-white/90 shadow-panel backdrop-blur">
          <div className="grid xl:grid-cols-[1fr_390px]">
            <div className="p-6 sm:p-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <Space wrap className="mb-4">
                    <Tag color="processing">候选人门户</Tag>
                    <Tag>{formatDisplayValue(profile.candidate.stage)}</Tag>
                    <Tag>{profile.candidate.email}</Tag>
                  </Space>
                  <Typography.Title className="!mb-0 !text-3xl !leading-tight text-ink sm:!text-4xl">
                    {profile.candidate.fullName}
                  </Typography.Title>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-500">
                    <span>{profile.candidate.phone}</span>
                    <span className="text-slate-300">/</span>
                    <span>{profile.candidate.currentCompany || '当前公司待补充'}</span>
                    <span className="text-slate-300">/</span>
                    <span>{profile.candidate.yearsOfExperience ? `${profile.candidate.yearsOfExperience} 年经验` : '工作年限待补充'}</span>
                  </div>
                </div>
                <Button
                  icon={<LogoutOutlined />}
                  className="self-start border-slate-200 bg-white/80 text-slate-600 hover:!border-red-200 hover:!text-red-500"
                  onClick={handleLogout}
                >
                  退出登录
                </Button>
              </div>

              <div className="mt-7 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <FileTextOutlined className="text-brand" />
                    最近简历
                  </div>
                  <div className="mt-2 truncate text-base font-semibold text-ink">{latestResume?.fileName ?? '尚未上传'}</div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <RadarChartOutlined className="text-brand" />
                    可匹配岗位
                  </div>
                  <div className="mt-2 text-base font-semibold text-ink">{jobMatches.length} 个开放职位</div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <FireOutlined className="text-brand" />
                    最高适配
                  </div>
                  <div className="mt-2 text-base font-semibold text-ink">{topMatch ? `${topMatch.matchScore} 分` : '待分析'}</div>
                </div>
              </div>
            </div>

            <aside className="border-t border-white/10 bg-[#10243d] p-6 text-white xl:border-l xl:border-t-0">
              <div className="flex items-center gap-4">
                <UserPhotoUpload user={user} size={64} />
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold">{profile.candidate.fullName}</div>
                  <div className="mt-1 text-sm text-teal-100/75">{formatDisplayValue(profile.candidate.source)}</div>
                </div>
              </div>
              <div className="mt-7 rounded-2xl bg-white/8 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-teal-100/70">当前最佳匹配</div>
                    <div className="mt-1 text-lg font-semibold">{topMatch?.title ?? '等待简历分析'}</div>
                  </div>
                  <div className="text-right text-3xl font-bold tabular-nums">{topMatch?.matchScore ?? 0}</div>
                </div>
                <Progress
                  className="mt-4"
                  percent={topMatch?.matchScore ?? 0}
                  showInfo={false}
                  strokeColor={topMatch ? getMatchTone(topMatch.matchScore).progressColor : '#14b8a6'}
                  trailColor="rgba(255,255,255,0.16)"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {parsedSkills.slice(0, 8).map((skill) => (
                  <Tag key={skill} className="!border-white/10 !bg-white/10 !text-white">
                    {skill}
                  </Tag>
                ))}
                {parsedSkills.length === 0 ? <Tag className="!border-white/10 !bg-white/10 !text-white">暂无技能标签</Tag> : null}
              </div>
            </aside>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.88fr)_minmax(420px,1.12fr)]">
          <Card
            className="rounded-3xl border-white/70 bg-white/90 shadow-card"
            title={
              <span className="flex items-center gap-2">
                <FileDoneOutlined className="text-brand" />
                简历中心
              </span>
            }
          >
            <Dragger
              accept=".pdf,.docx"
              beforeUpload={(file) => {
                const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
                if (!allowedResumeExtensions.has(extension)) {
                  messageApi.error('仅支持 PDF 或 DOCX 简历。');
                  return Upload.LIST_IGNORE;
                }

                if (file.size > maxResumeSizeBytes) {
                  messageApi.error('简历文件大小不能超过 15MB。');
                  return Upload.LIST_IGNORE;
                }

                return false;
              }}
              fileList={resumeFiles}
              maxCount={1}
              disabled={uploading}
              onChange={({ fileList }) => setResumeFiles(fileList.slice(-1))}
              className="[&_.ant-upload-drag]:!rounded-2xl [&_.ant-upload-drag]:!border-slate-200 [&_.ant-upload-drag]:!bg-slate-50/80"
            >
              <p className="ant-upload-drag-icon">
                <CloudUploadOutlined className="!text-brand" />
              </p>
              <p className="ant-upload-text !text-ink">拖拽或选择 PDF/DOCX 简历</p>
              <p className="ant-upload-hint">上传后将刷新岗位适配结果</p>
            </Dragger>

            <Button
              className="mt-4 !h-11"
              type="primary"
              block
              icon={<ThunderboltOutlined />}
              loading={uploading}
              disabled={!resumeFiles[0]?.originFileObj}
              onClick={() => void handleResumeUpload()}
            >
              上传并智能解析
            </Button>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm text-slate-500">最近简历</div>
                  <div className="mt-1 truncate font-semibold text-ink">{latestResume?.fileName ?? '尚未上传'}</div>
                </div>
                {latestResume ? (
                  <Button
                    type="text"
                    icon={<DownloadOutlined />}
                    loading={downloadingResumeId === latestResume.id}
                    disabled={Boolean(downloadingResumeId)}
                    className="shrink-0 text-brand"
                    onClick={() => void handleDownloadResume(latestResume.id)}
                  >
                    下载
                  </Button>
                ) : null}
              </div>
              {latestSummary ? (
                <Typography.Paragraph className="!mb-0 !mt-3 text-slate-600" ellipsis={{ rows: 3 }}>
                  {latestSummary}
                </Typography.Paragraph>
              ) : null}
            </div>
          </Card>

          <Card
            className="rounded-3xl border-white/70 bg-white/90 shadow-card"
            title={
              <span className="flex items-center gap-2">
                <MessageOutlined className="text-brand" />
                智能问答助手
              </span>
            }
          >
            <div className="h-[360px] space-y-3 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
              {chatMessages.map((item, index) => (
                <div
                  key={`${item.role}-${index}`}
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                    item.role === 'user'
                      ? 'ml-auto bg-brand text-white'
                      : 'mr-auto border border-slate-100 bg-white text-slate-700'
                  }`}
                >
                  <div>{item.content}</div>
                  {item.references?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.references.slice(0, 4).map((reference) => (
                        <Tag key={`${reference.sourceType}-${reference.id}`}>{reference.title}</Tag>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {chatLoading ? <Spin size="small" /> : null}
            </div>
            <Input.Search
              className="mt-4"
              value={chatInput}
              enterButton={<Button type="primary" icon={<SendOutlined />} />}
              prefix={<MessageOutlined />}
              placeholder="问我岗位要求、投递建议、简历优化或人力资源政策"
              onChange={(event) => setChatInput(event.target.value)}
              onSearch={() => void handleChat()}
              loading={chatLoading}
              maxLength={maxChatInputLength}
              disabled={chatLoading}
            />
          </Card>
        </div>

        <Tabs
          className="[&_.ant-tabs-nav]:!mb-4"
          items={[
            {
              key: 'jobs',
              label: '职位推荐',
              children: (
                <div className="grid gap-5 xl:grid-cols-2">
                  {jobMatches.map((job) => {
                    const tone = getMatchTone(job.matchScore);
                    return (
                      <Card key={job.id} className="overflow-hidden rounded-3xl border-white/70 bg-white/95 shadow-card">
                        <div className={`-mx-6 -mt-6 mb-5 h-1.5 ${tone.barClass}`} />
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <Space wrap>
                              <Tag color={tone.tagColor}>适配度 {job.matchScore}</Tag>
                              {job.isApplied ? <Tag color="processing">已投递</Tag> : null}
                              <Tag>{formatDisplayValue(job.employmentType)}</Tag>
                            </Space>
                            <Typography.Title level={4} className="!mb-2 !mt-3 !text-xl">
                              {job.title}
                            </Typography.Title>
                            <Typography.Text type="secondary">
                              {job.department?.name ?? '未指定部门'} / {job.location}
                            </Typography.Text>
                          </div>
                          <Button
                            type="primary"
                            loading={applyingJobId === job.id}
                            disabled={Boolean(applyingJobId) || job.isApplied}
                            onClick={() => void handleApply(job)}
                          >
                            {job.isApplied ? '已投递' : '投递职位'}
                          </Button>
                        </div>

                        <div className={`mt-5 rounded-2xl border p-4 ${tone.panelClass}`}>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm font-semibold">智能匹配分析</span>
                            <span className="text-lg font-bold tabular-nums">{job.matchScore}</span>
                          </div>
                          <Progress className="mt-2" percent={job.matchScore} showInfo={false} strokeColor={tone.progressColor} />
                        </div>

                        <Typography.Paragraph className="!mt-4 !text-slate-600" ellipsis={{ rows: 2 }}>
                          {job.description}
                        </Typography.Paragraph>
                        <Typography.Paragraph className="!text-slate-500" ellipsis={{ rows: 2 }}>
                          {job.requirements}
                        </Typography.Paragraph>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {job.matchedKeywords.slice(0, 8).map((keyword) => (
                            <Tag key={keyword} color="green">
                              {keyword}
                            </Tag>
                          ))}
                          {job.matchedKeywords.length === 0 ? <Tag>暂无命中关键词</Tag> : null}
                        </div>
                        <Alert className="mt-4 rounded-2xl" type="info" showIcon message={job.analysis} />
                        {renderJobMatchDetails(job)}
                      </Card>
                    );
                  })}
                </div>
              ),
            },
            {
              key: 'process',
              label: '投递进展',
              children: (
                <div className="grid gap-6 xl:grid-cols-3">
                  <Card className="rounded-3xl border-white/70 bg-white/90 shadow-card" title="我的简历">
                    <List
                      dataSource={profile.resumes}
                      locale={{ emptyText: '暂无简历' }}
                      renderItem={(item) => (
                        <List.Item
                          actions={[
                            <Button
                              key="download"
                              icon={<DownloadOutlined />}
                              loading={downloadingResumeId === item.id}
                              disabled={Boolean(downloadingResumeId)}
                              onClick={() => void handleDownloadResume(item.id)}
                            >
                              下载
                            </Button>,
                          ]}
                        >
                          <List.Item.Meta title={item.fileName} description={new Date(item.uploadedAt).toLocaleString('zh-CN')} />
                        </List.Item>
                      )}
                    />
                  </Card>
                  <Card className="rounded-3xl border-white/70 bg-white/90 shadow-card" title="面试进度">
                    <Timeline
                      items={profile.interviews.map((item) => ({
                        color: item.status === 'completed' ? 'green' : 'blue',
                        children: (
                          <div>
                            <div className="font-medium">{item.jobTitle ?? '未指定职位'}</div>
                            <div className="text-sm text-slate-500">
                              {new Date(item.scheduledAt).toLocaleString('zh-CN')} / {formatDisplayValue(item.status)}
                            </div>
                          </div>
                        ),
                      }))}
                    />
                    {profile.interviews.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无面试记录" /> : null}
                  </Card>
                  <Card className="rounded-3xl border-white/70 bg-white/90 shadow-card" title="录用进度">
                    <List
                      dataSource={profile.offers}
                      locale={{ emptyText: '暂无录用记录' }}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            title={`${item.jobTitle ?? '未指定职位'} / ${formatDisplayValue(item.status)}`}
                            description={item.offeredAt ? new Date(item.offeredAt).toLocaleString('zh-CN') : '尚未发放'}
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
