import { Alert, Button, Card, Empty, Form, Input, InputNumber, Modal, Space, Tag, Typography, Upload, message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useEffect, useState } from 'react';
import { listPublicJobPostings, submitCareerApplication, type PublicJobPostingItem } from '../api/recruitment';
import { formatDisplayValue } from '../utils/display';

interface CareerFormValues {
  fullName: string;
  email: string;
  phone: string;
  currentCompany?: string;
  yearsOfExperience?: number;
  notes?: string;
}

const allowedResumeExtensions = new Set(['.pdf', '.docx']);
const maxResumeSizeBytes = 15 * 1024 * 1024;

export function CareerPage() {
  const [jobs, setJobs] = useState<PublicJobPostingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<PublicJobPostingItem | null>(null);
  const [resumeFiles, setResumeFiles] = useState<UploadFile[]>([]);
  const [form] = Form.useForm<CareerFormValues>();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await listPublicJobPostings({ page: 1, limit: 50 });
        setJobs(response.items);
      } catch (loadError) {
        setError((loadError as Error).message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const closeModal = () => {
    if (submitting) {
      return;
    }

    setActiveJob(null);
    setResumeFiles([]);
    form.resetFields();
  };

  const handleSubmit = async (values: CareerFormValues) => {
    const file = resumeFiles[0]?.originFileObj;

    if (!activeJob || !file) {
      messageApi.warning('请先选择简历文件。');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await submitCareerApplication(
        {
          jobPostingId: activeJob.id,
          ...values,
        },
        file,
      );
      messageApi.success('投递成功，后台已收到你的简历。');
      setActiveJob(null);
      setResumeFiles([]);
      form.resetFields();
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] px-4 py-10">
      {contextHolder}
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-card">
          <Typography.Title className="!mb-3 !text-4xl !leading-tight">加入智能人事系统团队</Typography.Title>
          <Typography.Paragraph className="!mb-0 !max-w-3xl !text-base !text-slate-600">
            在线浏览开放职位，上传简历完成投递。注册候选人账号后还能持续查看投递进度。
          </Typography.Paragraph>
        </div>

        {error ? <Alert type="error" showIcon closable message={error} onClose={() => setError(null)} /> : null}

        <div className="grid gap-6 lg:grid-cols-2">
          {jobs.map((job) => (
            <Card key={job.id} className="border-slate-200 shadow-card">
              <Space direction="vertical" size="middle" className="!flex">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Typography.Title level={3} className="!mb-1">
                      {job.title}
                    </Typography.Title>
                    <Typography.Text type="secondary">
                      {job.department?.name || '未分配部门'} / {job.position?.name || '未分配岗位'}
                    </Typography.Text>
                  </div>
                  <Tag color="processing">{formatDisplayValue(job.employmentType)}</Tag>
                </div>

                <Space wrap>
                  <Tag>{job.location || '地点待定'}</Tag>
                  <Tag color="gold">招聘 {job.targetCount} 人</Tag>
                  {job.position?.level ? <Tag color="purple">{job.position.level}</Tag> : null}
                </Space>

                <Typography.Paragraph ellipsis={{ rows: 4 }}>{job.description}</Typography.Paragraph>
                <Typography.Paragraph type="secondary" ellipsis={{ rows: 4 }}>
                  岗位要求：{job.requirements}
                </Typography.Paragraph>

                <Button type="primary" size="large" onClick={() => setActiveJob(job)}>
                  立即投递
                </Button>
              </Space>
            </Card>
          ))}
        </div>

        {!loading && jobs.length === 0 ? <Empty description="当前没有开放职位" /> : null}
      </div>

      <Modal
        open={Boolean(activeJob)}
        title={activeJob ? `投递职位：${activeJob.title}` : '投递职位'}
        onCancel={closeModal}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(values) => void handleSubmit(values)}>
          <Form.Item name="fullName" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input maxLength={120} />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
            <Input maxLength={160} />
          </Form.Item>
          <Form.Item name="phone" label="手机号" rules={[{ required: true, message: '请输入手机号' }]}>
            <Input maxLength={40} />
          </Form.Item>
          <Form.Item name="currentCompany" label="当前公司">
            <Input maxLength={120} />
          </Form.Item>
          <Form.Item name="yearsOfExperience" label="工作年限">
            <InputNumber className="!w-full" min={0} max={50} />
          </Form.Item>
          <Form.Item name="notes" label="补充说明">
            <Input.TextArea rows={4} maxLength={1_000} showCount />
          </Form.Item>
          <Form.Item label="简历文件" required>
            <Upload
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
              disabled={submitting}
              onChange={({ fileList }) => setResumeFiles(fileList.slice(-1))}
            >
              <Button disabled={submitting}>选择简历文件</Button>
            </Upload>
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting} disabled={!resumeFiles[0]?.originFileObj}>
            提交投递
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
