import {
  ArrowRightOutlined,
  BankOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Select, Steps, Typography } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerCompany, type RegisterCompanyPayload } from '../api/auth';
import { BrandMark } from '../components/BrandMark';
import { authStore } from '../state/auth.store';

export function CompanyRegisterPage() {
  const navigate = useNavigate();
  const { setSession } = authStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const onFinish = async (values: RegisterCompanyPayload) => {
    try {
      setLoading(true);
      setError(null);
      const response = await registerCompany(values);
      setSession(response.accessToken, response.user);
      navigate('/dashboard');
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb]">
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-8 text-center">
            <BrandMark />
            <Typography.Title level={2} className="!mt-6 !mb-2">
              注册企业试用
            </Typography.Title>
            <Typography.Text type="secondary">
              30 天免费试用，最多 20 个用户，涵盖组织、招聘、考勤、绩效和 AI 助手。
            </Typography.Text>
          </div>

          <Steps
            current={step}
            className="mb-8"
            size="small"
            items={[
              { title: '企业信息' },
              { title: '管理员账号' },
            ]}
          />

          <Card className="border-slate-200 shadow-card">
            {error ? (
              <Alert className="mb-5" type="error" showIcon message={error} closable onClose={() => setError(null)} />
            ) : null}

            <Form
              layout="vertical"
              onFinish={onFinish}
              size="large"
              scrollToFirstError
            >
              {step === 0 ? (
                <>
                  <Form.Item
                    name="companyName"
                    label="企业名称"
                    rules={[{ required: true, message: '请输入企业名称。' }]}
                  >
                    <Input prefix={<BankOutlined className="!text-slate-400" />} placeholder="例如：XX科技有限公司" />
                  </Form.Item>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Form.Item name="industry" label="行业">
                      <Select
                        placeholder="请选择行业"
                        options={[
                          { label: '互联网 / 信息技术', value: '互联网/信息技术' },
                          { label: '金融 / 保险', value: '金融/保险' },
                          { label: '制造业', value: '制造业' },
                          { label: '零售 / 电商', value: '零售/电商' },
                          { label: '教育 / 培训', value: '教育/培训' },
                          { label: '医疗 / 健康', value: '医疗/健康' },
                          { label: '房地产 / 建筑', value: '房地产/建筑' },
                          { label: '其他', value: '其他' },
                        ]}
                      />
                    </Form.Item>

                    <Form.Item name="size" label="企业规模">
                      <Select
                        placeholder="请选择规模"
                        options={[
                          { label: '1-10 人', value: '1-10' },
                          { label: '11-50 人', value: '11-50' },
                          { label: '51-100 人', value: '51-100' },
                          { label: '101-500 人', value: '101-500' },
                          { label: '500+ 人', value: '500+' },
                        ]}
                      />
                    </Form.Item>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Form.Item name="contactName" label="联系人姓名">
                      <Input prefix={<UserOutlined className="!text-slate-400" />} placeholder="请输入联系人姓名" />
                    </Form.Item>

                    <Form.Item name="contactPhone" label="联系人电话">
                      <Input placeholder="请输入联系电话" />
                    </Form.Item>
                  </div>

                  <Form.Item
                    name="contactEmail"
                    label="联系人邮箱"
                    rules={[{ type: 'email', message: '请输入有效的邮箱地址。' }]}
                  >
                    <Input prefix={<MailOutlined className="!text-slate-400" />} placeholder="请输入联系人邮箱" />
                  </Form.Item>

                  <Button type="primary" block onClick={() => setStep(1)} className="!h-12 !rounded-xl !text-base">
                    下一步：设置管理员
                  </Button>
                </>
              ) : (
                <>
                  <Form.Item
                    name="adminUsername"
                    label="管理员用户名"
                    rules={[
                      { required: true, message: '请输入管理员用户名。' },
                      { min: 3, message: '用户名至少 3 个字符。' },
                    ]}
                  >
                    <Input prefix={<UserOutlined className="!text-slate-400" />} placeholder="请输入管理员用户名" autoComplete="off" />
                  </Form.Item>

                  <Form.Item
                    name="adminDisplayName"
                    label="管理员姓名"
                    rules={[{ required: true, message: '请输入管理员姓名。' }]}
                  >
                    <Input placeholder="请输入管理员姓名" />
                  </Form.Item>

                  <Form.Item
                    name="adminEmail"
                    label="管理员邮箱"
                    rules={[
                      { required: true, message: '请输入管理员邮箱。' },
                      { type: 'email', message: '请输入有效的邮箱地址。' },
                    ]}
                  >
                    <Input prefix={<MailOutlined className="!text-slate-400" />} placeholder="请输入管理员邮箱" />
                  </Form.Item>

                  <Form.Item
                    name="adminPassword"
                    label="管理员密码"
                    rules={[
                      { required: true, message: '请输入管理员密码。' },
                      { min: 6, message: '密码至少 6 位字符。' },
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined className="!text-slate-400" />}
                      placeholder="请设置管理员密码"
                      autoComplete="new-password"
                    />
                  </Form.Item>

                  <div className="flex gap-3">
                    <Button onClick={() => setStep(0)} className="!h-12 !rounded-xl">
                      上一步
                    </Button>
                    <Button
                      type="primary"
                      htmlType="submit"
                      block
                      loading={loading}
                      icon={<ArrowRightOutlined />}
                      className="!h-12 !rounded-xl !text-base !font-semibold"
                    >
                      开通试用
                    </Button>
                  </div>
                </>
              )}
            </Form>
          </Card>

          <div className="mt-6 text-center text-sm text-slate-400">
            已有企业账号？{' '}
            <Link to="/login" className="font-medium text-brand hover:text-brand/80">
              前往登录
            </Link>
          </div>

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            <div className="flex items-center gap-2 mb-3 font-semibold text-ink">
              <SafetyCertificateOutlined className="text-brand" />
              试用说明
            </div>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>免费试用期 30 天，最多可创建 20 个系统用户。</li>
              <li>试用期间可使用组织管理、招聘协同、考勤假期、绩效评估和 AI 知识助手。</li>
              <li>薪酬模块在试用期默认关闭，如需开通请联系我们。</li>
              <li>试用到期后可联系我们升级为正式版本，数据无缝保留。</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
