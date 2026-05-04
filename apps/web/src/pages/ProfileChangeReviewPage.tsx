import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { listProfileChangeReviewQueue, reviewProfileChangeRequest, type ProfileChangeReviewStatus } from '../api/self-service';
import { authStore } from '../state/auth.store';
import { formatDisplayValue } from '../utils/display';

type ReviewStatus = 'pending' | 'approved' | 'rejected';
type ReviewDecision = 'approved' | 'rejected';

interface ReviewRecord {
  id: string;
  status: ReviewStatus;
  changes: Record<string, unknown>;
  reviewComment?: string;
  createdAt?: string;
  reviewedAt?: string | null;
  employee?: {
    fullName?: string;
    department?: {
      name?: string;
    } | null;
    position?: {
      name?: string;
    } | null;
  } | null;
  reviewer?: {
    fullName?: string;
  } | null;
}

const statusOptions: Array<{ label: string; value: ProfileChangeReviewStatus }> = [
  { label: '待审批', value: 'pending' },
  { label: '全部状态', value: 'all' },
  { label: '已通过', value: 'approved' },
  { label: '已驳回', value: 'rejected' },
];

const reviewActionOptions: Array<{ label: string; value: ReviewDecision }> = [
  { label: '通过申请', value: 'approved' },
  { label: '驳回申请', value: 'rejected' },
];

const changeFieldLabels: Record<string, string> = {
  address: '地址',
  phone: '手机号',
  emergencyContact: '紧急联系人',
  bankAccountMasked: '银行卡脱敏',
  avatarUrl: '头像地址',
};

export function ProfileChangeReviewPage() {
  const user = authStore((state) => state.user);
  const [form] = Form.useForm<{ status: ReviewDecision; reviewComment?: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProfileChangeReviewStatus>('pending');
  const [records, setRecords] = useState<ReviewRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<ReviewRecord | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const canReview = user?.role === 'admin' || user?.role === 'hr';

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const payload = await listProfileChangeReviewQueue(statusFilter);
      setRecords(payload as unknown as ReviewRecord[]);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canReview) {
      return;
    }

    void load();
  }, [canReview, statusFilter]);

  const pendingCount = records.filter((record) => record.status === 'pending').length;

  const columns: ColumnsType<ReviewRecord> = [
    {
      title: '员工',
      key: 'employee',
      render: (_value, record) => (
        <div>
          <div className="font-medium text-ink">{record.employee?.fullName ?? '-'}</div>
          <div className="text-xs text-slate-500">
            {record.employee?.department?.name ?? '-'} / {record.employee?.position?.name ?? '-'}
          </div>
        </div>
      ),
    },
    {
      title: '申请内容',
      dataIndex: 'changes',
      key: 'changes',
      render: (value: Record<string, unknown>) => summarizeChanges(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (value: ReviewStatus) => renderStatusTag(value),
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value?: string) => formatDateTime(value),
    },
    {
      title: '审批人',
      key: 'reviewer',
      render: (_value, record) => record.reviewer?.fullName ?? '-',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_value, record) => (
        <Space>
          <Button onClick={() => openRecord(record)}>查看</Button>
          {record.status === 'pending' ? (
            <Button type="primary" onClick={() => openRecord(record)}>
              审批
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  const openRecord = (record: ReviewRecord) => {
    setSelectedRecord(record);
    form.setFieldsValue({
      status: record.status === 'rejected' ? 'rejected' : 'approved',
      reviewComment: record.reviewComment ?? '',
    });
  };

  const closeDrawer = () => {
    if (submitting) {
      return;
    }

    setSelectedRecord(null);
    form.resetFields();
  };

  const handleReviewSubmit = async (values: { status: ReviewDecision; reviewComment?: string }) => {
    if (!selectedRecord || submitting) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await reviewProfileChangeRequest(selectedRecord.id, {
        status: values.status,
        reviewComment: values.reviewComment?.trim() || undefined,
      });
      messageApi.success('审批结果已提交。');
      closeDrawer();
      await load();
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!canReview) {
    return <Alert type="warning" showIcon message="当前角色无权访问资料变更审批。" />;
  }

  return (
    <div className="space-y-6">
      {contextHolder}
      {error ? <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} /> : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Typography.Title level={3} className="!mb-1">
            资料变更审批
          </Typography.Title>
          <Typography.Text type="secondary">
            当前筛选结果 {records.length} 条，其中待审批 {pendingCount} 条。
          </Typography.Text>
        </div>
        <Space wrap>
          <Select
            value={statusFilter}
            options={statusOptions}
            className="min-w-[160px]"
            disabled={loading}
            onChange={(value) => setStatusFilter(value)}
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>
            刷新
          </Button>
        </Space>
      </div>

      <Card className="rounded-3xl shadow-panel">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={records}
          columns={columns}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={statusFilter === 'pending' ? '当前没有待审批的资料变更申请。' : '当前筛选下没有记录。'}
              />
            ),
          }}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 980 }}
        />
      </Card>

      <Drawer
        open={Boolean(selectedRecord)}
        width={680}
        title="资料变更审批详情"
        onClose={closeDrawer}
        maskClosable={!submitting}
        destroyOnClose
      >
        {selectedRecord ? (
          <div className="space-y-6">
            <Descriptions bordered column={1}>
              <Descriptions.Item label="员工">{selectedRecord.employee?.fullName ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="部门">{selectedRecord.employee?.department?.name ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="岗位">{selectedRecord.employee?.position?.name ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="当前状态">{renderStatusTag(selectedRecord.status)}</Descriptions.Item>
              <Descriptions.Item label="提交时间">{formatDateTime(selectedRecord.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="审批时间">{formatDateTime(selectedRecord.reviewedAt)}</Descriptions.Item>
              <Descriptions.Item label="审批人">{selectedRecord.reviewer?.fullName ?? '-'}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="变更内容">
              <Descriptions bordered column={1}>
                {Object.entries(selectedRecord.changes ?? {}).length ? (
                  Object.entries(selectedRecord.changes).map(([key, value]) => (
                    <Descriptions.Item key={key} label={changeFieldLabels[key] ?? key}>
                      {renderValue(value)}
                    </Descriptions.Item>
                  ))
                ) : (
                  <Descriptions.Item label="内容">-</Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {selectedRecord.status === 'pending' ? (
              <Card size="small" title="审批处理">
                <Form form={form} layout="vertical" onFinish={handleReviewSubmit}>
                  <Form.Item name="status" label="审批结果" rules={[{ required: true, message: '请选择审批结果' }]}>
                    <Select
                      options={reviewActionOptions.map((option) => ({
                        ...option,
                        label: (
                          <span className="inline-flex items-center gap-2">
                            {option.value === 'approved' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                            {option.label}
                          </span>
                        ),
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name="reviewComment" label="审批意见">
                    <Input.TextArea rows={4} placeholder="可选填写审批意见或补充说明" />
                  </Form.Item>
                  <Space>
                    <Button disabled={submitting} onClick={closeDrawer}>取消</Button>
                    <Button type="primary" htmlType="submit" loading={submitting}>
                      提交审批
                    </Button>
                  </Space>
                </Form>
              </Card>
            ) : (
              <Card size="small" title="审批意见">
                <Typography.Text>{selectedRecord.reviewComment || '暂无审批意见。'}</Typography.Text>
              </Card>
            )}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

function renderStatusTag(status: ReviewStatus) {
  if (status === 'approved') {
    return <Tag color="success">已通过</Tag>;
  }

  if (status === 'rejected') {
    return <Tag color="error">已驳回</Tag>;
  }

  return <Tag color="processing">待审批</Tag>;
}

function summarizeChanges(changes: Record<string, unknown>) {
  const entries = Object.entries(changes ?? {});
  if (!entries.length) {
    return '-';
  }

  return entries
    .slice(0, 2)
    .map(([key, value]) => `${changeFieldLabels[key] ?? key}: ${renderValue(value)}`)
    .join(' | ');
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return '-';
  }

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : value;
}

function renderValue(value: unknown) {
  return formatDisplayValue(value);
}
