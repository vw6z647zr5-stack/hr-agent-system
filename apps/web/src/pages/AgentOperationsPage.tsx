import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ApiOutlined, ExperimentOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { listAgentRuns, type AgentRunLog, type AgentRunSummary } from '../api/agent';

type AgentModeFilter = 'all' | 'llm' | 'fallback' | 'grounded';

const modeOptions: Array<{ label: string; value: AgentModeFilter }> = [
  { label: '全部模式', value: 'all' },
  { label: '模型调用', value: 'llm' },
  { label: '确定性回退', value: 'fallback' },
  { label: '本地知识命中', value: 'grounded' },
];

const agentOptions = [
  { label: '全部智能体', value: 'all' },
  { label: '招聘助手', value: 'recruitment' },
  { label: '员工服务', value: 'employee_service' },
  { label: '绩效分析', value: 'performance' },
  { label: '离职风险', value: 'attrition' },
];

const providerOptions = [
  { label: '全部 provider', value: 'all' },
  { label: 'DeepSeek', value: 'deepseek' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'Mock', value: 'mock' },
  { label: 'Local', value: 'local' },
];

export function AgentOperationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<AgentRunLog[]>([]);
  const [summary, setSummary] = useState<AgentRunSummary | null>(null);
  const [mode, setMode] = useState<AgentModeFilter>('all');
  const [agentType, setAgentType] = useState('all');
  const [provider, setProvider] = useState('all');

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const payload = await listAgentRuns({
        limit: 80,
        mode: mode === 'all' ? undefined : mode,
        agentType: agentType === 'all' ? undefined : agentType,
        provider: provider === 'all' ? undefined : provider,
      });
      setRecords(payload.items);
      setSummary(payload.summary);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [mode, agentType, provider]);

  const columns: ColumnsType<AgentRunLog> = useMemo(() => [
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 150,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '智能体 / 动作',
      key: 'agent',
      width: 190,
      render: (_value, record) => (
        <div>
          <div className="font-medium text-ink">{getAgentLabel(record.agentType)}</div>
          <div className="text-xs text-slate-500">{getActionLabel(record.action)}</div>
        </div>
      ),
    },
    {
      title: '运行模式',
      dataIndex: 'mode',
      width: 130,
      render: (value: string, record) => (
        <Space size={4} wrap>
          {renderModeTag(value)}
          {record.fallbackReason ? (
            <Tooltip title={getFallbackReasonLabel(record.fallbackReason)}>
              <WarningOutlined className="text-amber-500" />
            </Tooltip>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Provider',
      key: 'provider',
      width: 150,
      render: (_value, record) => (
        <div>
          <Tag color={getProviderColor(record.provider)}>{record.provider}</Tag>
          <div className="mt-1 max-w-[130px] truncate text-xs text-slate-500">{record.model}</div>
        </div>
      ),
    },
    {
      title: '延迟',
      dataIndex: 'latencyMs',
      width: 100,
      render: (value: number) => <span className={value > 10_000 ? 'font-semibold text-red-600' : ''}>{value} ms</span>,
    },
    {
      title: '工具',
      dataIndex: 'toolNames',
      width: 220,
      render: (value: string[]) => (
        <div className="flex flex-wrap gap-1">
          {(value ?? []).slice(0, 3).map((tool) => <Tag key={tool}>{tool}</Tag>)}
          {value?.length > 3 ? <Tag>+{value.length - 3}</Tag> : null}
        </div>
      ),
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      ellipsis: true,
      render: (value: string, record) => (
        <Tooltip title={record.errorMessage || value || '无摘要'}>
          <span className={record.errorMessage ? 'text-red-600' : 'text-slate-600'}>{record.errorMessage || value || '-'}</span>
        </Tooltip>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      {error ? <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} /> : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Typography.Title level={3} className="!mb-1">
            智能体运行台账
          </Typography.Title>
          <Typography.Text type="secondary">
            查看最近 Agent 调用的模式、provider、延迟、工具使用和回退原因。
          </Typography.Text>
        </div>
        <Space wrap>
          <Select className="min-w-[150px]" value={mode} options={modeOptions} onChange={setMode} disabled={loading} />
          <Select className="min-w-[150px]" value={agentType} options={agentOptions} onChange={setAgentType} disabled={loading} />
          <Select className="min-w-[150px]" value={provider} options={providerOptions} onChange={setProvider} disabled={loading} />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>
            刷新
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard icon={<ApiOutlined />} label="运行总数" value={summary?.total ?? 0} helper="当前筛选下的最近记录" />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard icon={<WarningOutlined />} label="回退比例" value={`${Math.round((summary?.fallbackRate ?? 0) * 100)}%`} helper={`${summary?.fallbackCount ?? 0} 次 fallback`} tone="amber" />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard icon={<ExperimentOutlined />} label="平均延迟" value={`${summary?.averageLatencyMs ?? 0} ms`} helper="端到端执行耗时" tone="blue" />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard icon={<ApiOutlined />} label="主要 provider" value={topKey(summary?.byProvider) ?? '-'} helper="按当前筛选统计" tone="green" />
        </Col>
      </Row>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <DistributionPanel title="模式分布" values={summary?.byMode ?? {}} />
        <DistributionPanel title="智能体分布" values={summary?.byAgentType ?? {}} labelResolver={getAgentLabel} />
      </div>

      <Card className="rounded-3xl shadow-panel">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={records}
          columns={columns}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Agent 运行记录" /> }}
          pagination={{ pageSize: 12 }}
          scroll={{ x: 1180 }}
        />
      </Card>
    </div>
  );
}

function MetricCard({ icon, label, value, helper, tone = 'teal' }: { icon: React.ReactNode; label: string; value: string | number; helper: string; tone?: 'teal' | 'amber' | 'blue' | 'green' }) {
  const toneClass = {
    teal: 'bg-teal-50 text-teal-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
  }[tone];

  return (
    <Card className="rounded-3xl shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-ink">{value}</div>
          <div className="mt-1 text-xs text-slate-400">{helper}</div>
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${toneClass}`}>{icon}</div>
      </div>
    </Card>
  );
}

function DistributionPanel({ title, values, labelResolver = (value: string) => value }: { title: string; values: Record<string, number>; labelResolver?: (value: string) => string }) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map((entry) => entry[1]), 1);

  return (
    <Card className="rounded-3xl shadow-panel">
      <Typography.Title level={5} className="!mb-4">
        {title}
      </Typography.Title>
      {entries.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
      ) : (
        <div className="space-y-3">
          {entries.map(([key, count]) => (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{labelResolver(key)}</span>
                <span className="text-slate-500">{count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(6, (count / max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function renderModeTag(value: string) {
  if (value === 'llm') return <Tag color="green">模型</Tag>;
  if (value === 'grounded') return <Tag color="blue">本地命中</Tag>;
  return <Tag color="orange">回退</Tag>;
}

function getProviderColor(value: string) {
  if (value === 'deepseek') return 'geekblue';
  if (value === 'openai') return 'green';
  if (value === 'local') return 'blue';
  return 'default';
}

function getAgentLabel(value: string) {
  const labels: Record<string, string> = {
    recruitment: '招聘助手',
    employee_service: '员工服务',
    performance: '绩效分析',
    attrition: '离职风险',
  };
  return labels[value] ?? value;
}

function getActionLabel(value: string) {
  const labels: Record<string, string> = {
    parse_resume: '简历解析',
    match_score: '匹配评分',
    generate_interview_email: '面试邀约',
    chat: '员工问答',
    analyze: '绩效分析',
    predict: '风险预测',
  };
  return labels[value] ?? value;
}

function getFallbackReasonLabel(value: string) {
  const labels: Record<string, string> = {
    mock_provider: 'mock provider',
    missing_api_key: '缺少模型密钥',
    llm_error: '模型调用异常',
    grounded_answer: '本地知识命中',
  };
  return labels[value] ?? value;
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function topKey(values?: Record<string, number>) {
  const entries = Object.entries(values ?? {}).sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0];
}
