import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFileRequest, triggerBrowserDownload } from '../api/http';
import { createResource, fetchReferenceOptions, listResource, removeResource, updateResource } from '../api/resources';
import type { FormRecordValue, ResourceConfig, ResourceField } from '../types';
import { formatDisplayValue } from '../utils/display';

interface ResourcePageProps {
  config: ResourceConfig;
}

type OptionMap = Record<string, Array<{ label: string; value: string | number }>>;

export function ResourcePage({ config }: ResourcePageProps) {
  const [form] = Form.useForm<Record<string, FormRecordValue>>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<Array<Record<string, unknown>>>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [editingRecord, setEditingRecord] = useState<Record<string, unknown> | null>(null);
  const [detailRecord, setDetailRecord] = useState<Record<string, unknown> | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [optionsMap, setOptionsMap] = useState<OptionMap>({});
  const [downloadingRecordId, setDownloadingRecordId] = useState<string | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listResource<Record<string, unknown>>(config.endpoint, {
        page,
        limit: 10,
        search,
      });
      setRecords(response.items);
      setTotal(response.meta.total);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const remoteFields = config.fields.filter((field) => field.optionsEndpoint);
        const entries = await Promise.all(
          remoteFields.map(async (field) => {
            const optionRecords = await fetchReferenceOptions(field.optionsEndpoint!);
            return [
              field.key,
              optionRecords.map((record) => ({
                label: String(resolveValue(record, field.optionLabelKey ?? 'name') ?? ''),
                value: String(resolveValue(record, field.optionValueKey ?? 'id') ?? ''),
              })),
            ] as const;
          }),
        );
        setOptionsMap(Object.fromEntries(entries));
      } catch (optionError) {
        setError((optionError as Error).message);
      }
    };

    void loadOptions();
  }, [config.fields]);

  const fieldsByKey = useMemo(
    () => Object.fromEntries(config.fields.map((field) => [field.key, field])),
    [config.fields],
  );

  const openCreate = () => {
    setEditingRecord(null);
    form.resetFields();
    setDrawerOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (deletingRecordId) {
      return;
    }

    try {
      setDeletingRecordId(id);
      setError(null);
      await removeResource(config.endpoint, id);
      await load();
    } catch (deleteError) {
      setError((deleteError as Error).message);
    } finally {
      setDeletingRecordId(null);
    }
  };

  const handleDownload = async (record: Record<string, unknown>) => {
    const recordId = typeof record.id === 'string' ? record.id : '';
    const downloadableField = config.fields.find((field) => field.downloadEndpoint && resolveValue(record, field.key));

    if (!recordId || !downloadableField?.downloadEndpoint || downloadingRecordId) {
      return;
    }

    try {
      setDownloadingRecordId(recordId);
      setError(null);
      const file = await apiFileRequest(downloadableField.downloadEndpoint.replace(':id', encodeURIComponent(recordId)));
      triggerBrowserDownload(file);
    } catch (downloadError) {
      setError((downloadError as Error).message);
    } finally {
      setDownloadingRecordId(null);
    }
  };

  const handleSubmit = async (values: Record<string, FormRecordValue>) => {
    if (submitting) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const payload = serializeFormValues(config.fields, values);

      if (editingRecord?.id) {
        await updateResource(config.endpoint, String(editingRecord.id), payload);
      } else {
        await createResource(config.endpoint, payload);
      }

      setDrawerOpen(false);
      form.resetFields();
      await load();
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo(
    () => [
      ...config.columns.map((column) => ({
        title: column.title,
        dataIndex: column.dataIndex,
        key: column.key,
        ellipsis: column.ellipsis,
        render: (_value: unknown, record: Record<string, unknown>) =>
          formatDisplayValue(
            resolveValue(record, column.dataIndex),
            typeof column.dataIndex === 'string' ? fieldsByKey[column.dataIndex] : undefined,
          ),
      })),
      {
        title: '操作',
        key: 'actions',
        render: (_value: unknown, record: Record<string, unknown>) => {
          const recordId = String(record.id ?? '');
          const hasDownload = config.fields.some((field) => field.downloadEndpoint && resolveValue(record, field.key));

          return (
            <Space>
              <Button icon={<EyeOutlined />} onClick={() => setDetailRecord(record)}>
                详情
              </Button>
              <Button
                icon={<EditOutlined />}
                disabled={submitting}
                onClick={() => {
                  setEditingRecord(record);
                  form.setFieldsValue(toFormValues(config.fields, record));
                  setDrawerOpen(true);
                }}
              >
                编辑
              </Button>
              {hasDownload ? (
                <Button
                  icon={<DownloadOutlined />}
                  loading={downloadingRecordId === recordId}
                  disabled={Boolean(downloadingRecordId)}
                  onClick={() => void handleDownload(record)}
                >
                  下载
                </Button>
              ) : null}
              <Popconfirm title="确认删除该记录？" onConfirm={() => void handleDelete(recordId)}>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  loading={deletingRecordId === recordId}
                  disabled={Boolean(deletingRecordId)}
                >
                  删除
                </Button>
              </Popconfirm>
            </Space>
          );
        },
      },
    ],
    [config.columns, config.fields, deletingRecordId, downloadingRecordId, fieldsByKey, form, handleDelete, handleDownload, submitting],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Typography.Title level={3} className="!mb-1">
              {config.label}
            </Typography.Title>
            <Typography.Text type="secondary">集中维护当前模块的数据、附件和状态。</Typography.Text>
          </div>
          <Space wrap>
            <Input.Search
              placeholder="搜索关键字"
              allowClear
              onSearch={(value) => {
                setPage(1);
                setSearch(value.trim());
              }}
              className="min-w-[240px]"
            />
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新建
            </Button>
          </Space>
        </div>
      </div>

      {error ? <Alert type="error" showIcon closable message={error} onClose={() => setError(null)} /> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={records}
          columns={columns}
          pagination={{
            current: page,
            total,
            pageSize: 10,
            showSizeChanger: false,
            onChange: (nextPage) => setPage(nextPage),
          }}
          scroll={{ x: 1100 }}
        />
      </div>

      <Drawer
        open={drawerOpen}
        title={editingRecord ? `编辑${config.label}` : `新建${config.label}`}
        width={720}
        onClose={() => {
          if (!submitting) {
            setDrawerOpen(false);
          }
        }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(values) => void handleSubmit(values)}>
          {config.fields.map((field) => (
            <Form.Item
              key={field.key}
              name={field.key}
              label={field.label}
              valuePropName={field.kind === 'switch' ? 'checked' : 'value'}
              rules={field.required ? [{ required: true, message: `请输入${field.label}` }] : undefined}
            >
              {renderField(field, optionsMap[field.key] ?? field.options ?? [])}
            </Form.Item>
          ))}
          <Space className="sticky bottom-0 -mx-6 mt-6 border-t border-slate-100 bg-white px-6 py-4">
            <Button disabled={submitting} onClick={() => setDrawerOpen(false)}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              保存
            </Button>
          </Space>
        </Form>
      </Drawer>

      <Drawer
        open={Boolean(detailRecord)}
        title={`${config.label}详情`}
        width={640}
        onClose={() => setDetailRecord(null)}
      >
        <Descriptions bordered column={1}>
          {config.fields.map((field) => (
            <Descriptions.Item key={field.key} label={field.label}>
              {renderDetailValue(detailRecord, field)}
            </Descriptions.Item>
          ))}
        </Descriptions>
      </Drawer>
    </div>
  );
}

function renderField(field: ResourceField, options: Array<{ label: string; value: string | number }>) {
  switch (field.kind) {
    case 'textarea':
      return <Input.TextArea rows={4} placeholder={field.placeholder} maxLength={2_000} showCount />;
    case 'number':
      return <InputNumber className="!w-full" placeholder={field.placeholder} />;
    case 'date':
      return <DatePicker className="!w-full" />;
    case 'datetime':
      return <DatePicker className="!w-full" showTime />;
    case 'select':
      return <Select options={options} allowClear showSearch optionFilterProp="label" />;
    case 'multitag':
      return <Select mode="tags" tokenSeparators={[',', '，']} />;
    case 'json':
      return <Input.TextArea rows={4} placeholder='请输入结构化内容，例如 {"姓名":"张三"}' maxLength={5_000} showCount />;
    case 'switch':
      return <Switch />;
    default:
      return <Input placeholder={field.placeholder} maxLength={240} />;
  }
}

function renderDetailValue(record: Record<string, unknown> | null, field: ResourceField) {
  const value = record ? resolveValue(record, field.key) : '';

  if (field.downloadEndpoint && value) {
    return '已上传附件，请使用操作列下载。';
  }

  return formatDisplayValue(value, field);
}

function serializeFormValues(fields: ResourceField[], values: Record<string, FormRecordValue>) {
  const payload: Record<string, unknown> = {};

  fields.forEach((field) => {
    const value = values[field.key];

    if (value === undefined || value === null || value === '') {
      return;
    }

    if (field.kind === 'date' && dayjs.isDayjs(value)) {
      payload[field.key] = value.format('YYYY-MM-DD');
      return;
    }

    if (field.kind === 'datetime' && dayjs.isDayjs(value)) {
      payload[field.key] = value.toISOString();
      return;
    }

    if (field.kind === 'json' && typeof value === 'string') {
      try {
        payload[field.key] = JSON.parse(value || '{}');
      } catch {
        throw new Error(`${field.label} 必须是合法 JSON。`);
      }
      return;
    }

    payload[field.key] = value;
  });

  return payload;
}

function toFormValues(fields: ResourceField[], record: Record<string, unknown>) {
  const values: Record<string, FormRecordValue> = {};

  fields.forEach((field) => {
    const raw = resolveValue(record, field.key);

    if (field.kind === 'date' && typeof raw === 'string') {
      values[field.key] = dayjs(raw);
      return;
    }

    if (field.kind === 'datetime' && typeof raw === 'string') {
      values[field.key] = dayjs(raw);
      return;
    }

    if (field.kind === 'json' && raw) {
      values[field.key] = JSON.stringify(raw, null, 2);
      return;
    }

    values[field.key] = raw as FormRecordValue;
  });

  return values;
}

function resolveValue(record: Record<string, unknown>, path: string | string[]) {
  if (Array.isArray(path)) {
    return path.reduce<unknown>((current, segment) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[segment];
      }
      return undefined;
    }, record);
  }

  return record[path];
}
