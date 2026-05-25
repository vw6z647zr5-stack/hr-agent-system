import {
  Alert,
  Button,
  Card,
  List,
  Progress,
  Switch,
  Tag,
  Typography,
} from 'antd';
import {
  ReloadOutlined,
  DashboardOutlined,
  PieChartOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
  BulbOutlined,
  FileProtectOutlined,
  NodeIndexOutlined,
  RobotOutlined,
  AimOutlined,
  ApartmentOutlined,
  ScheduleOutlined,
  RadarChartOutlined,
} from '@ant-design/icons';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOverviewDashboard, type OverviewDashboardPayload } from '../api/overview';
import { getProactiveCheck, getPulseSurveyResults, type ProactiveInsightPayload, type PulseSurveyResultsPayload } from '../api/agent';
import { FloatingAssistant } from '../components/FloatingAssistant';
import { DonutChart } from '../components/DonutChart';
import { FunnelChart } from '../components/FunnelChart';
import { JobHealthMiniChart } from '../components/JobHealthMiniChart';
import { RiskHeatmap } from '../components/RiskHeatmap';
import { SectionErrorBoundary } from '../components/shared';
import { SkeletonDashboard } from '../components/shared';
import { StatCard } from '../components/StatCard';
import { TrialBanner } from '../components/TrialBanner';
import { formatDisplayValue } from '../utils/display';

const AUTO_REFRESH_KEY = 'dashboard_auto_refresh';

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<OverviewDashboardPayload | null>(null);
  const [proactiveInsights, setProactiveInsights] = useState<ProactiveInsightPayload[]>([]);
  const [pulseResults, setPulseResults] = useState<PulseSurveyResultsPayload | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(() => {
    try { return localStorage.getItem(AUTO_REFRESH_KEY) === 'true'; } catch { return false; }
  });

  const fetchDashboard = useCallback(async (showRefreshing = true) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      }
      setError(null);
      const data = await getOverviewDashboard();
      setDashboard(data);
    } catch (dashboardError) {
      setError((dashboardError as Error).message);
    } finally {
      setLoading(false);
      if (showRefreshing) {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchDashboard(false);
  }, [fetchDashboard]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => { void fetchDashboard(false); }, 30_000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchDashboard]);

  // Fetch proactive insights for HR/admin
  useEffect(() => {
    if (!dashboard || dashboard.scope === 'employee') return;
    getProactiveCheck().then((res) => setProactiveInsights(res.insights)).catch(() => {});
  }, [dashboard]);

  // Fetch pulse survey results for HR/admin
  useEffect(() => {
    if (!dashboard || dashboard.scope === 'employee') return;
    getPulseSurveyResults('30d').then(setPulseResults).catch(() => {});
  }, [dashboard]);

  if (loading) {
    return <SkeletonDashboard />;
  }

  if (!dashboard) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <Alert type="warning" showIcon message="未获取到首页数据。" />
        <Button icon={<ReloadOutlined />} loading={refreshing} onClick={() => void fetchDashboard()}>
          重新加载
        </Button>
      </div>
    );
  }

  if (dashboard.scope === 'employee') {
    return (
      <div className="space-y-8">
        {error ? <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} /> : null}

        <div className="rounded-[2rem] border border-white/60 bg-[linear-gradient(135deg,_rgba(15,118,110,0.14),_rgba(255,255,255,0.82))] p-8 shadow-panel">
          <Typography.Title level={2} className="!mb-2">
            {dashboard.headline.title}
          </Typography.Title>
          <Typography.Paragraph className="!mb-0 !max-w-3xl !text-slate-600">
            {dashboard.headline.subtitle}
          </Typography.Paragraph>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboard.metrics.map((item) => (
            <StatCard key={item.key} label={item.label} value={item.value} helper={item.helper} />
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="rounded-3xl shadow-panel">
            <Typography.Title level={4}>个人信息摘要</Typography.Title>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <InfoField label="部门" value={dashboard.employeeSnapshot.departmentName} />
              <InfoField label="岗位" value={dashboard.employeeSnapshot.positionName} />
              <InfoField label="直属经理" value={dashboard.employeeSnapshot.managerName} />
              <InfoField label="入职时间" value={formatDate(dashboard.employeeSnapshot.joinDate)} />
              <InfoField label="在职天数" value={`${dashboard.employeeSnapshot.tenureDays} 天`} />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {dashboard.quickLinks.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:border-brand hover:text-brand"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </Card>

          <Card className="rounded-3xl shadow-panel">
            <Typography.Title level={4}>提醒与待办</Typography.Title>
            <List
              className="mt-4"
              dataSource={dashboard.reminders}
              locale={{ emptyText: '当前没有新的提醒。' }}
              renderItem={(item) => (
                <List.Item>
                  <div className="w-full">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-ink">{item.title}</div>
                      <PriorityTag value={item.priority} />
                    </div>
                    <div className="mt-2 text-sm text-slate-500">{item.description}</div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-3xl shadow-panel">
            <Typography.Title level={4}>假期余额与审批进度</Typography.Title>
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <List
                dataSource={dashboard.leaveBalances}
                locale={{ emptyText: '暂无假期余额记录。' }}
                renderItem={(item) => (
                  <List.Item>
                    <div className="w-full">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-ink">{formatDisplayValue(item.leaveType)}</div>
                        <Tag color="blue">{item.remainingDays} 天</Tag>
                      </div>
                      <Progress
                        className="mt-3"
                        percent={item.remainingDays + item.usedDays > 0 ? Math.round((item.usedDays / (item.remainingDays + item.usedDays)) * 100) : 0}
                        strokeColor="#0f766e"
                        showInfo={false}
                      />
                    </div>
                  </List.Item>
                )}
              />
              <List
                dataSource={dashboard.approvalTimeline}
                locale={{ emptyText: '暂无审批流转记录。' }}
                renderItem={(item) => (
                  <List.Item>
                    <div className="w-full">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-ink">{item.title}</div>
                        <StatusTag value={item.status} />
                      </div>
                      <div className="mt-2 text-sm text-slate-500">{item.detail}</div>
                    </div>
                  </List.Item>
                )}
              />
            </div>
          </Card>

          <Card className="rounded-3xl shadow-panel">
            <Typography.Title level={4}>知识库推荐</Typography.Title>
            <List
              className="mt-4"
              dataSource={dashboard.knowledgeHighlights}
              locale={{ emptyText: '暂无推荐内容。' }}
              renderItem={(item) => (
                <List.Item>
                  <div className="w-full">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-ink">{item.title}</div>
                      <Tag>{formatDisplayValue(item.category)}</Tag>
                    </div>
                    <div className="mt-2 text-sm text-slate-500">{item.summary}</div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error ? <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} /> : null}
      <TrialBanner />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 rounded-[2rem] border border-white/60 bg-[radial-gradient(circle_at_80%_10%,_rgba(20,184,166,0.18),_transparent_36%),linear-gradient(135deg,_rgba(255,255,255,0.94),_rgba(241,245,249,0.90))] p-8 shadow-panel">
          <div className="flex items-center gap-3 mb-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/25 bg-teal-400/8 px-3 py-1 text-xs font-semibold text-teal-700">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
              实时数据看板
            </div>
          </div>
          <Typography.Title level={2} className="!mb-2 !text-3xl !leading-tight">
            {dashboard.headline.title}
          </Typography.Title>
          <Typography.Paragraph className="!mb-4 !max-w-3xl !text-slate-600 !text-base">
            {dashboard.headline.subtitle}
          </Typography.Paragraph>
          <Typography.Paragraph className="!mb-0 !text-base !text-slate-700">
            {dashboard.briefing.headline}
          </Typography.Paragraph>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm shrink-0">
          <Switch
            checked={autoRefresh}
            onChange={(checked) => {
              setAutoRefresh(checked);
              try { localStorage.setItem(AUTO_REFRESH_KEY, String(checked)); } catch {}
            }}
            size="small"
          />
          <span className="text-xs text-slate-500 whitespace-nowrap">自动刷新</span>
          <Button size="small" icon={<ReloadOutlined />} loading={refreshing} onClick={() => void fetchDashboard()} type="text" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {dashboard.metrics.map((item, idx) => (
          <StatCard key={item.key} label={item.label} value={item.value} helper={item.helper} className={`animate-fade-up stagger-${Math.min(idx + 1, 6)}`} />
        ))}
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="rounded-3xl shadow-panel">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 text-brand">
                <PieChartOutlined className="text-lg" />
              </div>
              <div>
                <Typography.Title level={4} className="!mb-1">
                  经营态势图表
                </Typography.Title>
                <Typography.Text type="secondary">人员结构、招聘流转和岗位压力一图看全。</Typography.Text>
              </div>
            </div>
            <Tag color="processing">实时汇总</Tag>
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <DonutChart
              title="员工状态结构"
              totalLabel="员工"
              items={dashboard.peopleStructure.employmentStatus.map((item, index) => ({
                label: item.label,
                value: item.value,
                color: ['#0f766e', '#0ea5e9', '#64748b'][index] ?? '#94a3b8',
              }))}
            />
            <FunnelChart
              title="招聘漏斗"
              items={dashboard.recruitment.funnel.map((item, index) => ({
                label: item.label,
                value: item.count,
                color: ['#0f766e', '#0ea5e9', '#7c3aed', '#f59e0b', '#16a34a', '#dc2626'][index] ?? '#64748b',
              }))}
            />
            <DonutChart
              title="候选人来源"
              totalLabel="候选人"
              emptyText="暂无来源数据。"
              items={dashboard.recruitment.sourceBreakdown.map((item, index) => ({
                label: formatDisplayValue(item.source),
                value: item.count,
                color: ['#2563eb', '#0f766e', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2'][index] ?? '#64748b',
              }))}
            />
          </div>
        </Card>

        <Card className="rounded-3xl shadow-panel">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-red-50 to-red-100 text-red-500">
              <SafetyOutlined className="text-lg" />
            </div>
            <Typography.Title level={4} className="!mb-0">风险与待办热力</Typography.Title>
          </div>
          <RiskHeatmap
            className="mt-5"
            items={[
              {
                label: '审批积压',
                value: dashboard.operations.pendingApprovals.length,
                helper: '待处理审批',
                level: dashboard.operations.pendingApprovals.length >= 8 ? 'high' : dashboard.operations.pendingApprovals.length >= 3 ? 'medium' : 'low',
              },
              {
                label: '用工节点',
                value: dashboard.riskRadar.contractsExpiringSoon.length + dashboard.riskRadar.probationEndingSoon.length,
                helper: '合同与转正',
                level:
                  dashboard.riskRadar.contractsExpiringSoon.length + dashboard.riskRadar.probationEndingSoon.length >= 6
                    ? 'high'
                    : dashboard.riskRadar.contractsExpiringSoon.length + dashboard.riskRadar.probationEndingSoon.length >= 1
                      ? 'medium'
                      : 'low',
              },
              {
                label: '人才保留',
                value: dashboard.riskRadar.highRiskEmployees.length,
                helper: '高风险员工',
                level: dashboard.riskRadar.highRiskEmployees.length >= 5 ? 'high' : dashboard.riskRadar.highRiskEmployees.length >= 1 ? 'medium' : 'low',
              },
              {
                label: '招聘预警',
                value: dashboard.recruitment.alerts.length,
                helper: '岗位与候选人',
                level: dashboard.recruitment.alerts.some((item) => item.level === 'high')
                  ? 'high'
                  : dashboard.recruitment.alerts.length > 0
                    ? 'medium'
                    : 'low',
              },
            ]}
          />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.84fr_1.16fr]">
        <Card className="rounded-3xl shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 text-purple-600">
                <AimOutlined className="text-lg" />
              </div>
              <div>
                <Typography.Title level={4} className="!mb-1">
                  战略行动中心
                </Typography.Title>
                <Typography.Text type="secondary">组织健康、人才供给、合规和风险信号生成的管理优先级。</Typography.Text>
              </div>
            </div>
            <PriorityTag value={dashboard.actionCenter.healthLevel} />
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-[0.9fr_1.1fr]">
            <GaugeChart
              label="组织健康分"
              value={dashboard.actionCenter.healthScore}
              helper={`开放信号 ${dashboard.actionCenter.totalOpenSignals} 个`}
            />
            <div className="grid gap-4">
              <RingMetric
                label="人才供给覆盖度"
                value={dashboard.actionCenter.candidateCoverage}
                helper={`${dashboard.recruitment.stats.openJobPostings} 个开放职位 / ${dashboard.recruitment.stats.activeCandidates} 位活跃候选人`}
              />
              <StackedDistribution
                title="员工状态分布"
                items={dashboard.peopleStructure.employmentStatus.map((item, index) => ({
                  label: item.label,
                  value: item.value,
                  color: ['#0f766e', '#0ea5e9', '#94a3b8'][index] ?? '#64748b',
                }))}
              />
            </div>
          </div>
          <List
            className="mt-4"
            dataSource={dashboard.actionCenter.executiveSummary}
            renderItem={(item) => (
              <List.Item>
                <div className="text-slate-700">{item}</div>
              </List.Item>
            )}
          />
        </Card>

        <Card className="rounded-3xl shadow-panel">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600">
              <NodeIndexOutlined className="text-lg" />
            </div>
            <Typography.Title level={4} className="!mb-0">重点领域优先级</Typography.Title>
          </div>
          <HorizontalBars
            className="mt-5"
            items={dashboard.actionCenter.focusAreas.map((item) => ({
              label: item.title,
              value: Math.round(item.score),
              helper: item.signal,
              color: item.level === 'high' ? '#dc2626' : item.level === 'medium' ? '#f59e0b' : '#0f766e',
              path: item.path,
              action: item.action,
            }))}
          />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Card className="rounded-3xl shadow-panel">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600">
              <ApartmentOutlined className="text-lg" />
            </div>
            <Typography.Title level={4} className="!mb-0">部门人力压力</Typography.Title>
          </div>
          <HorizontalBars
            className="mt-5"
            emptyText="暂无需要关注的部门压力信号。"
            items={dashboard.actionCenter.workloadByDepartment.map((item) => ({
              label: item.departmentName,
              value: item.score,
              helper: item.signals.join(' · '),
              color: item.level === 'high' ? '#dc2626' : item.level === 'medium' ? '#f59e0b' : '#0f766e',
              action: item.nextAction,
            }))}
          />
        </Card>

        <Card className="rounded-3xl shadow-panel">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-50 to-cyan-100 text-cyan-600">
              <ThunderboltOutlined className="text-lg" />
            </div>
            <Typography.Title level={4} className="!mb-0">自动化待办队列</Typography.Title>
          </div>
          <List
            className="mt-4"
            dataSource={dashboard.actionCenter.automationQueue}
            locale={{ emptyText: '当前没有需要推进的自动化待办。' }}
            renderItem={(item) => (
              <List.Item>
                <div className="w-full">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-ink">{item.title}</div>
                    <PriorityTag value={item.level} />
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    {item.category} · {item.reason}
                  </div>
                  <div className="mt-2 text-sm text-slate-700">{item.action}</div>
                  <Link to={item.path} className="mt-3 inline-block text-sm text-brand">
                    进入处理
                  </Link>
                </div>
              </List.Item>
            )}
          />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <Card className="rounded-3xl shadow-panel">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-600">
              <BulbOutlined className="text-lg" />
            </div>
            <Typography.Title level={4} className="!mb-0">智能简报</Typography.Title>
          </div>
          <List
            className="mt-4"
            dataSource={dashboard.briefing.highlights}
            renderItem={(item) => (
              <List.Item>
                <div className="text-slate-700">{item}</div>
              </List.Item>
            )}
          />
          <Typography.Title level={5} className="!mt-6">
            建议动作
          </Typography.Title>
          <List
            className="mt-3"
            dataSource={dashboard.briefing.recommendedActions}
            locale={{ emptyText: '当前没有新增建议动作。' }}
            renderItem={(item) => (
              <List.Item>
                <div className="text-slate-700">{item}</div>
              </List.Item>
            )}
          />
        </Card>

        <Card className="rounded-3xl shadow-panel">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600">
              <FileProtectOutlined className="text-lg" />
            </div>
            <Typography.Title level={4} className="!mb-0">基础信息质量</Typography.Title>
          </div>
          <RingMetric
            className="mt-5"
            label="档案平均完整度"
            value={dashboard.dataQuality.overallCompletion}
            helper="员工基础资料完整情况"
          />
          <HorizontalBars
            className="mt-5"
            emptyText="暂无资料缺口。"
            items={dashboard.dataQuality.issues
              .filter((item) => item.count > 0)
              .map((item) => ({
                label: item.label,
                value: item.count,
                helper: '待补齐字段',
                color: '#f59e0b',
              }))}
          />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-3xl shadow-panel">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-50 to-sky-100 text-sky-600">
              <ApartmentOutlined className="text-lg" />
            </div>
            <Typography.Title level={4} className="!mb-0">组织结构与人员变化</Typography.Title>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <Typography.Title level={5}>部门概览</Typography.Title>
              <HorizontalBars
                className="mt-4"
                emptyText="暂无部门信息。"
                items={dashboard.peopleStructure.departmentHeadcount.map((item) => ({
                  label: item.name,
                  value: item.headcount,
                  helper: `开放职位 ${item.openJobs} · 活跃候选人 ${item.activeCandidates} · 待审资料 ${item.pendingChanges}`,
                  color: '#0ea5e9',
                }))}
              />
            </div>
            <div>
              <Typography.Title level={5}>近期入职</Typography.Title>
              <List
                dataSource={dashboard.peopleStructure.recentJoiners}
                locale={{ emptyText: '近 60 天暂无新入职员工。' }}
                renderItem={(item) => (
                  <List.Item>
                    <div className="w-full">
                      <div className="font-medium text-ink">{item.employeeName}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {item.departmentName} / {item.positionName} / {formatDate(item.joinDate)}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </div>
          </div>
        </Card>

        <Card className="rounded-3xl shadow-panel">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 text-orange-600">
              <ScheduleOutlined className="text-lg" />
            </div>
            <Typography.Title level={4} className="!mb-0">运营待办与节点</Typography.Title>
          </div>
          <List
            className="mt-4"
            dataSource={dashboard.operations.pendingApprovals}
            locale={{ emptyText: '当前没有待处理审批。' }}
            renderItem={(item) => (
              <List.Item>
                <div className="w-full">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-ink">{item.title}</div>
                    <PriorityTag value={item.priority} />
                  </div>
                  <div className="mt-2 text-sm text-slate-500">{item.description}</div>
                  <Link to={item.path} className="mt-3 inline-block text-sm text-brand">
                    进入处理
                  </Link>
                </div>
              </List.Item>
            )}
          />
          <Typography.Title level={5} className="!mt-6">
            即将到来的关键节点
          </Typography.Title>
          <List
            className="mt-3"
            dataSource={dashboard.operations.upcomingMilestones}
            locale={{ emptyText: '暂无即将到来的关键节点。' }}
            renderItem={(item) => (
              <List.Item>
                <div className="w-full">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-ink">{item.title}</div>
                    <PriorityTag value={item.level} />
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    {item.description} · {formatDateTime(item.dueAt)}
                  </div>
                </div>
              </List.Item>
            )}
          />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="rounded-3xl shadow-panel">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-50 to-violet-100 text-violet-600">
              <RadarChartOutlined className="text-lg" />
            </div>
            <Typography.Title level={4} className="!mb-0">招聘健康度</Typography.Title>
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
            <RingMetric
              label="简历覆盖率"
              value={dashboard.recruitment.stats.resumeCoverage}
              helper={`平均匹配分 ${formatMetricNumber(dashboard.recruitment.stats.averageAiMatchScore)}`}
            />
            <MetricBarGroup
              items={[
                { label: '开放职位', value: dashboard.recruitment.stats.openJobPostings, color: '#0f766e' },
                { label: '活跃候选人', value: dashboard.recruitment.stats.activeCandidates, color: '#0ea5e9' },
                { label: '本周面试', value: dashboard.recruitment.stats.interviewsThisWeek, color: '#f59e0b' },
                { label: '待处理录用', value: dashboard.recruitment.stats.pendingOffers, color: '#dc2626' },
              ]}
            />
          </div>
          <JobHealthMiniChart className="mt-6" items={dashboard.recruitment.openJobHealth} />
          <Typography.Title level={5} className="!mt-6">
            招聘预警
          </Typography.Title>
          <List
            className="mt-3"
            dataSource={dashboard.recruitment.alerts}
            locale={{ emptyText: '当前没有招聘预警。' }}
            renderItem={(item) => (
              <List.Item>
                <div className="w-full">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-ink">{item.title}</div>
                    <PriorityTag value={item.level} />
                  </div>
                  <div className="mt-2 text-sm text-slate-500">{item.description}</div>
                </div>
              </List.Item>
            )}
          />
        </Card>

        <Card className="rounded-3xl shadow-panel">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-rose-50 to-rose-100 text-rose-600">
              <AimOutlined className="text-lg" />
            </div>
            <Typography.Title level={4} className="!mb-0">绩效与风险雷达</Typography.Title>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <GaugeChart
              label="绩效均分"
              value={Math.round((dashboard.performance.averageScore / 5) * 100)}
              displayValue={formatMetricNumber(dashboard.performance.averageScore)}
              helper={`活跃周期：${dashboard.performance.activeCycleName ?? '未设置'}`}
            />
            <MetricBarGroup
              items={[
                { label: '高风险员工', value: dashboard.riskRadar.highRiskEmployees.length, color: '#dc2626' },
                { label: '合同即将到期', value: dashboard.riskRadar.contractsExpiringSoon.length, color: '#f59e0b' },
                { label: '试用期节点', value: dashboard.riskRadar.probationEndingSoon.length, color: '#0ea5e9' },
                { label: '考勤异常', value: dashboard.riskRadar.attendanceAnomalies30Days, color: '#64748b' },
              ]}
            />
          </div>
          <Typography.Title level={5} className="!mt-6">
            高离职风险员工
          </Typography.Title>
          <List
            className="mt-3"
            dataSource={dashboard.riskRadar.highRiskEmployees}
            locale={{ emptyText: '当前没有高风险员工。' }}
            renderItem={(item) => (
              <List.Item>
                <div className="w-full">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-ink">{item.employeeName}</div>
                    <Tag color="red">风险分 {formatMetricNumber(item.riskScore)}</Tag>
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    {item.department} · {item.recommendation}
                  </div>
                </div>
              </List.Item>
            )}
          />
        </Card>
      </div>

      <Card className="rounded-3xl shadow-panel">
        <div className="flex items-center gap-3 mb-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 text-brand">
            <BulbOutlined className="text-lg" />
          </div>
          <Typography.Title level={4} className="!mb-0">知识库与快捷入口</Typography.Title>
        </div>
        <List
          className="mt-4"
          dataSource={dashboard.knowledgeHighlights}
          locale={{ emptyText: '暂无知识库内容。' }}
          renderItem={(item) => (
            <List.Item>
              <div className="w-full">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-ink">{item.title}</div>
                  <Tag>{formatDisplayValue(item.category)}</Tag>
                </div>
                <div className="mt-2 text-sm text-slate-500">{item.summary}</div>
              </div>
            </List.Item>
          )}
        />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {dashboard.quickLinks.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="rounded-3xl border border-slate-200 p-4 transition hover:border-brand hover:bg-slate-50"
            >
              <div className="font-medium text-ink">{item.label}</div>
              <div className="mt-2 text-sm text-slate-500">{item.description}</div>
            </Link>
          ))}
        </div>
      </Card>

      {/* AI 智能预警 */}
      {proactiveInsights.length > 0 ? (
        <SectionErrorBoundary name="AI 智能预警">
          <Card className="rounded-3xl shadow-panel">
            <div className="flex items-center gap-3 mb-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 text-orange-500">
                <RadarChartOutlined className="text-lg" />
              </div>
              <Typography.Title level={4} className="!mb-0">AI 智能预警</Typography.Title>
              <Tag color="orange">自动检测</Tag>
            </div>
            <div className="space-y-3">
              {proactiveInsights.map((insight) => {
                const priorityColors: Record<string, string> = { high: 'red', medium: 'orange', low: 'blue' };
                const priorityLabels: Record<string, string> = { high: '紧急', medium: '关注', low: '提示' };
                return (
                  <div key={insight.type} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Tag color={priorityColors[insight.priority] ?? 'default'}>
                            {priorityLabels[insight.priority] ?? insight.priority}
                          </Tag>
                          <span className="font-semibold text-ink text-[15px]">{insight.title}</span>
                        </div>
                        <div className="text-sm text-slate-500">{insight.message}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </SectionErrorBoundary>
      ) : null}

      {/* 员工心声 */}
      {pulseResults ? (
        <SectionErrorBoundary name="员工心声">
          <Card className="rounded-3xl shadow-panel">
            <div className="flex items-center gap-3 mb-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-purple-50 to-indigo-100 text-purple-500">
                <AimOutlined className="text-lg" />
              </div>
              <Typography.Title level={4} className="!mb-0">员工心声</Typography.Title>
              <Tag color="purple">近30天</Tag>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
              <StatCard label="总反馈数" value={pulseResults.totalResponses} icon={<BulbOutlined />} />
              <StatCard label="正面反馈" value={pulseResults.sentimentDistribution.positive} color="#10b981" />
              <StatCard label="中性反馈" value={pulseResults.sentimentDistribution.neutral} color="#3b82f6" />
              <StatCard label="负面反馈" value={pulseResults.sentimentDistribution.negative} color="#ef4444" />
            </div>
            {pulseResults.departmentHeatmap.length > 0 ? (
              <div className="mb-4">
                <div className="text-sm font-medium text-slate-600 mb-2">部门情感分布</div>
                <div className="space-y-2">
                  {pulseResults.departmentHeatmap.slice(0, 5).map((dept) => (
                    <div key={dept.departmentName} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white p-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <ApartmentOutlined className="text-slate-400" />
                        <span className="text-sm font-medium text-ink">{dept.departmentName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">{dept.responseCount}条反馈</span>
                        <Progress
                          percent={Math.round(((dept.avgSentiment + 1) / 2) * 100)}
                          size="small"
                          style={{ width: 80 }}
                          strokeColor={dept.avgSentiment >= 0.3 ? '#10b981' : dept.avgSentiment <= -0.3 ? '#ef4444' : '#f59e0b'}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {pulseResults.topKeywords.length > 0 ? (
              <div>
                <div className="text-sm font-medium text-slate-600 mb-2">热词云</div>
                <div className="flex flex-wrap gap-2">
                  {pulseResults.topKeywords.slice(0, 10).map((kw) => (
                    <Tag key={kw.keyword} color="purple">{kw.keyword} ({kw.count})</Tag>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
        </SectionErrorBoundary>
      ) : null}

      <FloatingAssistant />
    </div>
  );
}

function formatMetricNumber(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-medium text-ink">{value}</div>
    </div>
  );
}

function GaugeChart({
  label,
  value,
  helper,
  displayValue,
}: {
  label: string;
  value: number;
  helper: string;
  displayValue?: string;
}) {
  const percent = clampPercent(value);
  const color = percent >= 85 ? '#0f766e' : percent >= 70 ? '#f59e0b' : '#dc2626';

  const size = 140;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius * 0.72;
  const dash = (percent / 100) * circumference;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-ink mb-2">{label}</div>
      <div className="flex items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2 + 4}
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${2 * Math.PI * radius - circumference}`}
            strokeDashoffset={circumference * 0.14}
            transform={`rotate(130 ${size / 2} ${size / 2 + 4})`}
            strokeLinecap="round"
          />
          <circle
            cx={size / 2}
            cy={size / 2 + 4}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={circumference * 0.14}
            transform={`rotate(130 ${size / 2} ${size / 2 + 4})`}
            className="transition-all duration-700"
          />
          <text x={size / 2} y={size / 2 + 6} textAnchor="middle" className="text-2xl font-bold" fill="#112138">
            {displayValue ?? percent}
          </text>
        </svg>
      </div>
      <div className="mt-2 text-center text-xs text-slate-500">{helper}</div>
    </div>
  );
}

function RingMetric({
  label,
  value,
  helper,
  className = '',
}: {
  label: string;
  value: number;
  helper: string;
  className?: string;
}) {
  const percent = clampPercent(value);
  const size = 90;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (percent / 100) * circumference;

  return (
    <div className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ${className}`}>
      <div className="flex items-center gap-5">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="#f1f5f9" strokeWidth={stroke}
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="#0f766e" strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="transition-all duration-700"
          />
          <text x={size / 2} y={size / 2 + 1} textAnchor="middle" className="text-sm font-bold" fill="#112138">
            {percent}%
          </text>
        </svg>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink">{label}</div>
          <div className="mt-1 text-2xl font-bold text-ink">{formatMetricNumber(value)}%</div>
          <div className="mt-1 text-xs text-slate-500">{helper}</div>
        </div>
      </div>
    </div>
  );
}

function HorizontalBars({
  items,
  emptyText = '暂无数据。',
  className = '',
}: {
  items: Array<{ label: string; value: number; helper?: string; color: string; path?: string; action?: string }>;
  emptyText?: string;
  className?: string;
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  if (items.length === 0) {
    return <div className={`rounded-2xl border border-slate-100 bg-white p-6 text-center text-sm text-slate-400 ${className}`}>{emptyText}</div>;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {items.map((item) => {
        const width = Math.max(6, Math.round((item.value / maxValue) * 100));
        const content = (
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-brand/30 hover:shadow-md">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-ink text-sm">{item.label}</div>
              <div className="text-lg font-bold text-ink tabular-nums">{formatMetricNumber(item.value)}</div>
            </div>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${width}%`, backgroundColor: item.color }}
              />
            </div>
            {item.helper ? <div className="mt-2 text-xs text-slate-500">{item.helper}</div> : null}
            {item.action ? <div className="mt-1.5 text-xs text-slate-600">{item.action}</div> : null}
          </div>
        );

        return item.path ? (
          <Link key={item.label} to={item.path} className="block">
            {content}
          </Link>
        ) : (
          <div key={item.label}>{content}</div>
        );
      })}
    </div>
  );
}

function StackedDistribution({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: number; color: string }>;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-ink">{title}</div>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100 shadow-inner">
        {items.map((item) => (
          <div
            key={item.label}
            className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500"
            style={{
              width: `${total > 0 ? Math.max(6, (item.value / total) * 100) : 0}%`,
              backgroundColor: item.color,
            }}
          />
        ))}
      </div>
      <div className="mt-4 grid gap-2.5">
        {items.map((item) => {
          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2.5 text-slate-600 min-w-0">
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate">{item.label}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-semibold text-ink tabular-nums">{item.value}</span>
                <span className="text-xs text-slate-400 tabular-nums w-8 text-right">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricBarGroup({ items }: { items: Array<{ label: string; value: number; color: string }> }) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const barWidth = Math.max(8, Math.round((item.value / maxValue) * 100));
        return (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-sm text-slate-600">{item.label}</span>
              </div>
              <span className="text-lg font-bold text-ink tabular-nums">{formatMetricNumber(item.value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${barWidth}%`, backgroundColor: item.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

function PriorityTag({ value }: { value: string }) {
  const map: Record<string, string> = {
    high: 'red',
    medium: 'orange',
    low: 'blue',
    pending: 'gold',
  };

  return <Tag color={map[value] ?? 'default'}>{formatDisplayValue(value)}</Tag>;
}

function StatusTag({ value }: { value: string }) {
  const map: Record<string, string> = {
    pending: 'gold',
    approved: 'green',
    rejected: 'red',
  };

  return <Tag color={map[value] ?? 'default'}>{formatDisplayValue(value)}</Tag>;
}
